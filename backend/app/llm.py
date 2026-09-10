"""Ask the model for a summary + questions, and validate what comes back."""

import json
import re

from openai import OpenAI
from pydantic import AliasChoices, BaseModel, Field, ValidationError, model_validator

from .config import GROQ_API_KEY, LLM_MODEL

client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

_TYPE_LABEL = {"mcq": "multiple choice", "true_false": "true/false"}


class Question(BaseModel):
    type: str = "mcq"
    question: str
    options: list[str] = Field(default_factory=list)
    correct_index: int
    explanation: str = Field(validation_alias=AliasChoices("explanation", "explaination"))

    @model_validator(mode="after")
    def _check_shape(self) -> "Question":
        if self.type not in {"mcq", "true_false"}:
            raise ValueError(f"unknown question type: {self.type!r}")
        if self.type == "true_false":
            # Normalise to a fixed pair so grading is a plain index compare.
            self.options = ["True", "False"]
        elif len(self.options) != 4:
            raise ValueError("multiple-choice questions need exactly 4 options")
        if not 0 <= self.correct_index < len(self.options):
            raise ValueError("correct_index is out of range for the options")
        return self


class StudySet(BaseModel):
    summary: str
    questions: list[Question] = Field(min_length=1, max_length=20)


def _system_prompt(count: int, types: list[str]) -> str:
    allowed = ", ".join(_TYPE_LABEL[t] for t in types)
    type_rules = []
    if "mcq" in types:
        type_rules.append(
            '- For "mcq": give exactly 4 options, exactly one correct. Wrong '
            "options must be plausible near-misses, never filler."
        )
    if "true_false" in types:
        type_rules.append(
            '- For "true_false": options must be exactly ["True", "False"] and '
            "correct_index is 0 for True or 1 for False."
        )
    return f"""You turn study notes into a revision aid.

Read the notes and produce:
1. A summary of the key ideas in 3 to 5 sentences, in plain language.
2. Exactly {count} questions that test understanding of the notes - not trivia
   about wording. Use only these question types: {allowed}. Mix them if more
   than one type is allowed.

Rules:
- Every question must be answerable from the notes alone.
{chr(10).join(type_rules)}
- "explanation" says why the correct answer is right, in one or two sentences.
- "correct_index" is the 0-based position of the correct option.

Reply with a single JSON object and nothing else:

{{
  "summary": "string",
  "questions": [
    {{ "type": "mcq", "question": "string",
       "options": ["a", "b", "c", "d"], "correct_index": 0,
       "explanation": "string" }}
  ]
}}
"""


def _call_model(messages: list[dict]) -> str:
    kwargs = {"model": LLM_MODEL, "messages": messages, "temperature": 0.4}
    try:
        response = client.chat.completions.create(**kwargs, response_format={"type": "json_object"})
    except Exception:
        response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


def _extract_json(raw: str) -> str:
    text = re.sub(r"^```(?:json)?|```$", " ", raw.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("The model did not return anything resembling JSON.")
    return text[start:end + 1]


def generate_study_set(notes: str, question_count: int, question_types: list[str]) -> StudySet:
    messages = [
        {"role": "system", "content": _system_prompt(question_count, question_types)},
        {"role": "user", "content": f"Here are the notes:\n\n{notes}"},
    ]

    last_error = ""
    for attempt in range(2):
        raw = _call_model(messages)
        try:
            study_set = StudySet.model_validate(json.loads(_extract_json(raw)))
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = str(exc)
            print(f"[llm] attempt {attempt + 1} rejected: {last_error}")
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": (
                    "That reply was rejected by the validator. Fix it and reply "
                    f"with the JSON object only.\n\nValidation error:\n{last_error}"
                )},
            ]
            continue

        # Reject wrong-type questions rather than silently keeping them.
        study_set.questions = [q for q in study_set.questions if q.type in question_types]
        if not study_set.questions:
            last_error = "no questions of the requested type(s)"
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": (
                    f"Use only these types: {', '.join(question_types)}. Try again, "
                    "JSON object only."
                )},
            ]
            continue
        return study_set

    raise ValueError(f"Failed to generate a valid study set after 2 attempts. Last error: {last_error}")
