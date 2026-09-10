"""Shared helpers: create a quiz, grade an attempt, serialise for the API."""

import json
import secrets

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .config import MAX_SOURCE_CHARS, MIN_SOURCE_CHARS
from .llm import generate_study_set
from .models import Attempt, NoteSet
from .naming import next_name


# ---------------------------------------------------------------- create / regen

def create_quiz(
    db: Session,
    user_id: str,
    *,
    text: str,
    name: str | None,
    source_type: str,
    source_name: str | None,
    folder_id: int | None,
    question_count: int,
    question_types: list[str],
) -> NoteSet:
    if len(text.strip()) < MIN_SOURCE_CHARS:
        raise HTTPException(status_code=422, detail=f"Provide at least {MIN_SOURCE_CHARS} characters of source material.")

    try:
        study_set = generate_study_set(text[:MAX_SOURCE_CHARS], question_count, question_types)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The model could not produce a usable quiz. {exc}")

    row = NoteSet(
        user_id=user_id,
        quiz_name=next_name(db, user_id, name),
        folder_id=folder_id,
        source_type=source_type,
        source_name=source_name,
        source_text=text,
        summary=study_set.summary,
        questions_json=json.dumps([q.model_dump() for q in study_set.questions]),
        config_json=json.dumps({"question_count": question_count, "question_types": question_types}),
        attempt_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def regenerate_quiz(db: Session, row: NoteSet, requested_name: str | None) -> NoteSet:
    config = json.loads(row.config_json) if row.config_json else {}
    count = config.get("question_count") or len(json.loads(row.questions_json)) or 5
    types = config.get("question_types") or ["mcq"]

    try:
        study_set = generate_study_set(row.source_text[:MAX_SOURCE_CHARS], count, types)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The model could not produce a usable quiz. {exc}")

    row.quiz_name = next_name(db, row.user_id, requested_name or row.quiz_name, exclude_id=row.id)
    row.summary = study_set.summary
    row.questions_json = json.dumps([q.model_dump() for q in study_set.questions])
    # A new question set invalidates every past take.
    row.attempts.clear()
    row.answers_json = None
    row.score = None
    row.best_score = None
    row.attempt_count = 0
    row.completed_at = None
    db.commit()
    db.refresh(row)
    return row


# --------------------------------------------------------------------- grading

def grade(questions: list[dict], answers: list[int | None]) -> int:
    return sum(
        1
        for answer, question in zip(answers, questions)
        if answer is not None and answer == question.get("correct_index")
    )


def record_attempt(
    db: Session,
    row: NoteSet,
    answers: list[int | None],
    *,
    taker: str,
    user_id: str | None,
    taker_name: str | None = None,
):
    questions = json.loads(row.questions_json)
    if len(answers) != len(questions):
        raise HTTPException(status_code=400, detail="Submit one answer for every question.")

    score = grade(questions, answers)
    total = len(questions)

    attempt = Attempt(
        note_set_id=row.id,
        user_id=user_id,
        answers_json=json.dumps(answers),
        score=score,
        total=total,
        taker=taker,
        taker_name=taker_name,
    )
    db.add(attempt)

    row.attempt_count = (row.attempt_count or 0) + 1
    if taker == "owner":
        row.answers_json = json.dumps(answers)
        row.score = score
        row.completed_at = attempt.created_at
        row.best_score = max(row.best_score or 0, score)

    db.commit()
    db.refresh(attempt)
    return attempt, score, total


# ----------------------------------------------------------------- serialisers

def _attempt_dict(a: Attempt, number: int) -> dict:
    return {
        "id": a.id,
        "number": number,
        "score": a.score,
        "total": a.total,
        "answers": json.loads(a.answers_json),
        "taker": a.taker,
        "taker_name": a.taker_name,
        "created_at": a.created_at,
    }


def serialize_quiz(row: NoteSet, *, include_attempts: bool = False) -> dict:
    data = {
        "id": row.id,
        "name": row.quiz_name or f"Test {row.id}",
        "folder_id": row.folder_id,
        "summary": row.summary,
        "questions": json.loads(row.questions_json),
        "answers": json.loads(row.answers_json) if row.answers_json else None,
        "score": row.score,
        "best_score": row.best_score,
        "attempt_count": row.attempt_count or 0,
        "config": json.loads(row.config_json) if row.config_json else {"question_count": len(json.loads(row.questions_json)), "question_types": ["mcq"]},
        "source_type": row.source_type or "text",
        "source_name": row.source_name,
        "share_token": row.share_token,
        "created_at": row.created_at,
        "completed_at": row.completed_at,
    }
    if include_attempts:
        data["attempts"] = [_attempt_dict(a, i + 1) for i, a in enumerate(row.attempts)]
    return data


def public_quiz(row: NoteSet) -> dict:
    """What an anonymous taker is allowed to see - no answer key."""
    questions = json.loads(row.questions_json)
    stripped = [
        {"type": q.get("type", "mcq"), "question": q["question"], "options": q["options"]}
        for q in questions
    ]
    return {
        "name": row.quiz_name or f"Test {row.id}",
        "summary": row.summary,
        "questions": stripped,
        "attempt_count": row.attempt_count or 0,
    }


def new_share_token() -> str:
    return secrets.token_urlsafe(16)[:32]
