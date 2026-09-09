import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import AliasChoices, BaseModel, Field, ValidationError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

MODEL = os.getenv("LLM_MODEL","openai/gpt-oss-20b")


SYSTEM_PROMPT = """You turn study notes into a revision aid.

Read the notes you are given and produce:

1. A summary of the key ideas in 3 to 5 sentences, in plain language.
2. Exactly 5 multiple choice questions that test understanding of those
   notes - not trivia about wording.

Rules for the questions:
- Every question must be answerable from the notes alone.
- Give exactly 4 options. Exactly one is correct.
- Wrong options must be plausible: common misconceptions or near-misses,
  never obvious filler.
- The explanation says why the correct answer is right, in one or two
  sentences.

Reply with a single JSON object and nothing else. No prose before it and
no prose after it.

{
"summary":"string",
"questions":[
    {
        "question":"string",
        "options":["string","string","string","string"],
        "correct_index":0,
        "explanation":"string"
    }
]
}

correct_index is the 0-based position of the correct option in the options array.

"""

class Question(BaseModel):
    question:str
    options:list[str]= Field(min_length=4,max_length=4)
    correct_index:int = Field(ge=0,le=3)
    explanation: str = Field(validation_alias=AliasChoices("explanation", "explaination"))

class StudySet(BaseModel):
    summary:str
    questions:list[Question] = Field(min_length=3,max_length=6)

def _call_model(messages: list[dict])-> str:
    kwargs = {"model":MODEL,"messages":messages,"temperature":0.4}

    try:
        response = client.chat.completions.create(**kwargs,response_format = {"type":"json_object"})

    except Exception:


        response = client.chat.completions.create(**kwargs)

    return response.choices[0].message.content

def _extract_json(raw: str) -> str:
    text = re.sub(r"^```(?:json)?|```$", " ", raw.strip(), flags=re.MULTILINE)
    text = text.strip()

    start = text.find("{")

    end = text.rfind("}")

    if start == -1 or end == -1:
        raise ValueError("The model did not return anything resembling JSON.")

    return text[start : end  + 1]

def generate_study_set(notes: str) -> StudySet:
    messages = [
        {"role":"system","content":SYSTEM_PROMPT},
        {"role":"user","content":f" here are the Notes:\n\n{notes}"},
    ]

    last_error = ""

    for attempt in range(2):
        raw = _call_model(messages)

        try:
            data = json.loads(_extract_json(raw))
            return StudySet.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as  exc:
            last_error = str(exc)

            print(f"[llm] attempt {attempt + 1} rejected: {last_error}")


            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": (
                    "That reply was rejected by the validator. Fix it and "
                    "reply with the JSON object only.\n\n"
                    f"Validation error:\n{last_error}"
                )},
            ]

    raise ValueError(f"Failed to generate a valid study set after 2 attempts. Last error: {last_error}")