from datetime import datetime, timezone
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, inspect, text

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

class NoteSet(Base):
    __tablename__ = "note_sets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    quiz_name = Column(String(160), nullable=True)
    source_type = Column(String(20), nullable=True)
    source_name = Column(String(255), nullable=True)
    source_text = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    questions_json = Column(Text, nullable=False)
    answers_json = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
def init_db():
    Base.metadata.create_all(bind=engine)
    # Keep existing installations usable without requiring a migration tool.
    columns = {column["name"] for column in inspect(engine).get_columns("note_sets")}
    additions = {
        "quiz_name": "VARCHAR(160)",
        "source_type": "VARCHAR(20)",
        "source_name": "VARCHAR(255)",
        "answers_json": "TEXT",
        "score": "INTEGER",
        "completed_at": "TIMESTAMP WITH TIME ZONE",
    }
    with engine.begin() as connection:
        for name, definition in additions.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE note_sets ADD COLUMN {name} {definition}"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()