import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import NoteSet
from ..schemas import AttemptRequest
from ..services import record_attempt, serialize_quiz

router = APIRouter(prefix="/api/quizzes", tags=["attempts"])


def _owned(db: Session, user_id: str, quiz_id: int) -> NoteSet:
    row = db.query(NoteSet).filter(NoteSet.id == quiz_id, NoteSet.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return row


@router.post("/{quiz_id}/attempts")
def submit_attempt(
    quiz_id: int,
    payload: AttemptRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    row = _owned(db, user_id, quiz_id)
    attempt, score, total = record_attempt(
        db, row, payload.answers, taker="owner", user_id=user_id,
    )
    data = serialize_quiz(row, include_attempts=True)
    data["last_attempt"] = {"id": attempt.id, "number": row.attempt_count, "score": score, "total": total}
    return data


@router.get("/{quiz_id}/attempts")
def list_attempts(quiz_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    row = _owned(db, user_id, quiz_id)
    return {
        "items": [
            {
                "id": a.id,
                "number": i + 1,
                "score": a.score,
                "total": a.total,
                "answers": json.loads(a.answers_json),
                "taker": a.taker,
                "taker_name": a.taker_name,
                "created_at": a.created_at,
            }
            for i, a in enumerate(row.attempts)
        ]
    }
