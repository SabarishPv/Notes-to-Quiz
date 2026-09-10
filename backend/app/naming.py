"""Pick a unique, tidy quiz name for a user."""

from sqlalchemy.orm import Session

from .models import NoteSet


def clean_name(name: str | None, fallback: str) -> str:
    value = " ".join((name or "").split()).strip()
    return value[:160] or fallback


def next_name(db: Session, user_id: str, requested: str | None, exclude_id: int | None = None) -> str:
    base = clean_name(requested, "")
    if not base:
        count = db.query(NoteSet).filter(NoteSet.user_id == user_id).count()
        base = f"Test {count + 1}"

    query = db.query(NoteSet.quiz_name).filter(NoteSet.user_id == user_id)
    if exclude_id is not None:
        query = query.filter(NoteSet.id != exclude_id)
    existing = {row.quiz_name for row in query.all()}

    if base not in existing:
        return base
    suffix = 2
    while f"{base} ({suffix})" in existing:
        suffix += 1
    return f"{base} ({suffix})"[:160]
