"""Test fixtures: a fresh in-memory SQLite DB and a stubbed model + auth.

No network, no Postgres, no Clerk. The LLM call is monkeypatched to return a
deterministic study set so the API surface can be exercised end to end.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("GROQ_API_KEY", "gsk_test_dummy")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    from app import database, services
    from app.llm import Question, StudySet

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", TestingSession)

    from app import models  # noqa: F401

    database.Base.metadata.create_all(bind=engine)

    def fake_generate(notes, question_count, question_types):
        qs = []
        for i in range(question_count):
            qtype = question_types[i % len(question_types)]
            if qtype == "true_false":
                qs.append(Question(type="true_false", question=f"TF {i}?", options=["True", "False"],
                                   correct_index=i % 2, explanation="because"))
            else:
                qs.append(Question(type="mcq", question=f"Q {i}?",
                                   options=["a", "b", "c", "d"], correct_index=i % 4, explanation="because"))
        return StudySet(summary="A tidy summary of the notes.", questions=qs)

    monkeypatch.setattr(services, "generate_study_set", fake_generate)

    from app.main import app
    from app.auth import get_current_user
    from app.database import get_db

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: "user_test_1"

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
