"""Public, unauthenticated endpoints for taking a shared quiz."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import NoteSet
from ..schemas import GuestAttemptRequest
from ..services import public_quiz, record_attempt

router = APIRouter(prefix="/api/shared", tags=["sharing"])


def _by_token(db: Session, token: str) -> NoteSet:
    row = db.query(NoteSet).filter(NoteSet.share_token == token).first()
    if not row:
        raise HTTPException(status_code=404, detail="This shared quiz link is invalid or was revoked.")
    return row


@router.get("/{token}")
def get_shared_quiz(token: str, db: Session = Depends(get_db)):
    return public_quiz(_by_token(db, token))


@router.post("/{token}/attempts")
def submit_shared_attempt(token: str, payload: GuestAttemptRequest, db: Session = Depends(get_db)):
    row = _by_token(db, token)
    guest_name = (payload.guest_name or "").strip() or None

    attempt, score, total = record_attempt(
        db, row, payload.answers, taker="guest", user_id=None, taker_name=guest_name,
    )

    # Guests get the answer key back only after submitting.
    questions = json.loads(row.questions_json)
    review = [
        {
            "question": q["question"],
            "options": q["options"],
            "correct_index": q.get("correct_index"),
            "your_answer": payload.answers[i] if i < len(payload.answers) else None,
            "explanation": q.get("explanation") or q.get("explaination"),
        }
        for i, q in enumerate(questions)
    ]
    return {
        "score": score,
        "total": total,
        "attempt_number": attempt.id,
        "review": review,
    }
