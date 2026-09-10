"""Engine, session factory, and a tiny additive migration on startup.

We don't use Alembic yet (see ROADMAP). Instead `init_db()`:
  1. creates any missing tables (safe, idempotent), and
  2. on Postgres only, ADDs any columns introduced after the first release
     and backfills them, so an already-deployed database keeps working.
SQLite (used by the test suite) always starts from a fresh schema, so it
skips step 2 entirely.
"""

import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

log = logging.getLogger("notes-to-quiz.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Columns added to note_sets after the initial release. name -> SQL type.
_NOTE_SET_ADDITIONS = {
    "quiz_name": "VARCHAR(160)",
    "source_type": "VARCHAR(20)",
    "source_name": "VARCHAR(255)",
    "answers_json": "TEXT",
    "score": "INTEGER",
    "completed_at": "TIMESTAMP WITH TIME ZONE",
    "folder_id": "INTEGER",
    "share_token": "VARCHAR(32)",
    "attempt_count": "INTEGER DEFAULT 0",
    "best_score": "INTEGER",
    "config_json": "TEXT",
}

# Backfills, each run in its own transaction so one failing on odd legacy data
# doesn't roll back the others (or the column adds above).
_BACKFILLS = (
    "UPDATE note_sets SET attempt_count = 1 "
    "WHERE score IS NOT NULL AND (attempt_count IS NULL OR attempt_count = 0)",

    "UPDATE note_sets SET best_score = score "
    "WHERE score IS NOT NULL AND best_score IS NULL",

    "UPDATE note_sets SET attempt_count = 0 WHERE attempt_count IS NULL",

    "CREATE UNIQUE INDEX IF NOT EXISTS ix_note_sets_share_token "
    "ON note_sets (share_token)",

    # Copy any pre-v2 "last attempt" into the attempts table, once.
    "INSERT INTO attempts (note_set_id, user_id, answers_json, score, total, taker, created_at) "
    "SELECT ns.id, ns.user_id, ns.answers_json, ns.score, "
    "       COALESCE(json_array_length(ns.questions_json::json), ns.score), "
    "       'owner', COALESCE(ns.completed_at, ns.created_at) "
    "FROM note_sets ns "
    "WHERE ns.score IS NOT NULL "
    "  AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.note_set_id = ns.id)",
)


def init_db() -> None:
    # Import here so every model is registered on Base before create_all.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    if engine.dialect.name != "postgresql":
        return

    existing = {col["name"] for col in inspect(engine).get_columns("note_sets")}
    with engine.begin() as conn:
        for name, ddl in _NOTE_SET_ADDITIONS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE note_sets ADD COLUMN {name} {ddl}"))

    for statement in _BACKFILLS:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception as exc:  # pragma: no cover - legacy-data guard
            log.warning("skipped backfill (%s): %s", statement.split()[0], exc)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
