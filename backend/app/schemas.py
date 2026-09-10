"""Pydantic models for request bodies and response shapes."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import (
    DEFAULT_QUESTION_TYPES,
    DEFAULT_QUESTIONS,
    MAX_QUESTIONS,
    MAX_SOURCE_CHARS,
    MIN_QUESTIONS,
    MIN_SOURCE_CHARS,
    QUESTION_TYPES,
)

QuestionType = Literal["mcq", "true_false"]


class GenerationConfig(BaseModel):
    question_count: int = Field(default=DEFAULT_QUESTIONS, ge=MIN_QUESTIONS, le=MAX_QUESTIONS)
    question_types: list[QuestionType] = Field(default_factory=lambda: list(DEFAULT_QUESTION_TYPES))

    @field_validator("question_types")
    @classmethod
    def _dedupe_nonempty(cls, value: list[str]) -> list[str]:
        seen = [t for t in dict.fromkeys(value) if t in QUESTION_TYPES]
        if not seen:
            raise ValueError("Select at least one question type.")
        return seen


class GenerateRequest(GenerationConfig):
    text: str = Field(min_length=MIN_SOURCE_CHARS, max_length=MAX_SOURCE_CHARS)
    name: str | None = Field(default=None, max_length=160)
    folder_id: int | None = None


class RegenerateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)


class QuizPatch(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    folder_id: int | None = None
    clear_folder: bool = False  # explicit "move to Unfiled"


class AttemptRequest(BaseModel):
    answers: list[int | None]


class GuestAttemptRequest(AttemptRequest):
    guest_name: str | None = Field(default=None, max_length=80)


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class FolderPatch(BaseModel):
    name: str = Field(min_length=1, max_length=120)
