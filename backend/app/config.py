"""Central place for environment-derived settings.

Everything the app needs from the environment is read here once, so the rest
of the code imports named values instead of calling os.getenv all over.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load the repo-root .env for local dev. In production (Render) the real
# environment variables are already set, and this line is a harmless no-op.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _origins(raw: str | None) -> list[str]:
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_JWT_KEY = os.getenv("CLERK_JWT_KEY")
ALLOWED_ORIGINS = _origins(os.getenv("ALLOWED_ORIGINS")) or ["http://localhost:5173"]

# Generation bounds — shared by the API validation and the LLM prompt.
MIN_QUESTIONS = 3
MAX_QUESTIONS = 15
DEFAULT_QUESTIONS = 5
QUESTION_TYPES = ("mcq", "true_false")
DEFAULT_QUESTION_TYPES = ("mcq",)

MIN_SOURCE_CHARS = 100
MAX_SOURCE_CHARS = 8000

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Copy backend/.env.example to .env and fill it in.")
if not CLERK_SECRET_KEY:
    raise RuntimeError("CLERK_SECRET_KEY is not set. Copy backend/.env.example to .env and fill it in.")
