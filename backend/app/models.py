"""SQLAlchemy ORM models.

Three tables:
  folders     - per-user grouping of quizzes by subject/topic
  note_sets   - a generated quiz (summary + questions) plus a cached "last take"
  attempts    - one row per time the quiz was taken (owner or shared guest)
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    quizzes = relationship("NoteSet", back_populates="folder")


class NoteSet(Base):
    __tablename__ = "note_sets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    quiz_name = Column(String(160), nullable=True)

    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)

    source_type = Column(String(20), nullable=True)
    source_name = Column(String(255), nullable=True)
    source_text = Column(Text, nullable=False)

    summary = Column(Text, nullable=False)
    questions_json = Column(Text, nullable=False)
    config_json = Column(Text, nullable=True)

    # Cached view of the most recent take, kept for cheap list rendering.
    answers_json = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)
    best_score = Column(Integer, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    share_token = Column(String(32), nullable=True, unique=True, index=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    folder = relationship("Folder", back_populates="quizzes")
    attempts = relationship(
        "Attempt",
        back_populates="note_set",
        cascade="all, delete-orphan",
        order_by="Attempt.created_at",
    )


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True, index=True)
    note_set_id = Column(Integer, ForeignKey("note_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)  # null for anonymous guests

    answers_json = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)

    taker = Column(String(20), nullable=False, default="owner")  # "owner" | "guest"
    taker_name = Column(String(80), nullable=True)               # guest display name

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    note_set = relationship("NoteSet", back_populates="attempts")
