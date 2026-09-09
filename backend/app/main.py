import json
import os
from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sqlalchemy.orm import Session

from .auth import get_current_user
from .db import NoteSet, get_db, init_db
from .llm import generate_study_set

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()          # runs once, before the first request
    yield
    # anything after yield runs on shutdown


app = FastAPI(title="Notes to Quiz API", lifespan=lifespan)

origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],   # includes Authorization
)


class GenerateRequest(BaseModel):
    text: str = Field(min_length=100, max_length=8000)
    name: str | None = Field(default=None, max_length=160)


class ResultRequest(BaseModel):
    answers: list[int | None]


class RegenerateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)


class SourceTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            cleaned = " ".join(data.split())
            if cleaned:
                self.parts.append(cleaned)


def _clean_name(name: str | None, fallback: str) -> str:
    value = " ".join((name or "").split()).strip()
    return value[:160] or fallback


def _next_name(db: Session, user_id: str, requested: str | None, exclude_id: int | None = None) -> str:
    base = _clean_name(requested, "")
    if not base:
        base = f"Test {db.query(NoteSet).filter(NoteSet.user_id == user_id).count() + 1}"

    name_query = db.query(NoteSet.quiz_name).filter(NoteSet.user_id == user_id)
    if exclude_id is not None:
        name_query = name_query.filter(NoteSet.id != exclude_id)
    existing = {row.quiz_name for row in name_query.all()}
    if base not in existing:
        return base

    suffix = 2
    while f"{base} ({suffix})" in existing:
        suffix += 1
    return f"{base} ({suffix})"[:160]


def _read_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Enter a valid http(s) URL.")
    request = UrlRequest(url, headers={"User-Agent": "NotesToQuiz/1.0"})
    try:
        with urlopen(request, timeout=15) as response:
            data = response.read(2_000_000)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that URL: {exc}")
    parser = SourceTextParser()
    parser.feed(data.decode("utf-8", errors="replace"))
    return "\n".join(parser.parts)


async def _read_upload(upload: UploadFile) -> tuple[str, str]:
    content = await upload.read()
    filename = upload.filename or "uploaded file"
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf" or upload.content_type == "application/pdf":
        try:
            reader = PdfReader(BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read that PDF: {exc}")
        return text, "pdf"
    if suffix in {"txt", "md", "markdown"} or (upload.content_type or "").startswith("text/"):
        return content.decode("utf-8", errors="replace"), "text"
    raise HTTPException(status_code=400, detail="Upload a PDF, TXT, or Markdown file.")


def _serialize(row: NoteSet) -> dict:
    return {
        "id": row.id,
        "name": row.quiz_name or f"Test {row.id}",
        "summary": row.summary,
        "questions": json.loads(row.questions_json),
        "answers": json.loads(row.answers_json) if row.answers_json else None,
        "score": row.score,
        "source_type": row.source_type or "text",
        "source_name": row.source_name,
        "created_at": row.created_at,
        "completed_at": row.completed_at,
    }


def _create_test(db: Session, user_id: str, text: str, name: str | None, source_type: str, source_name: str | None):
    if len(text.strip()) < 100:
        raise HTTPException(status_code=422, detail="Provide at least 100 characters of source material.")
    try:
        study_set = generate_study_set(text[:8000])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The model could not produce a usable quiz. {exc}")
    row = NoteSet(
        user_id=user_id,
        quiz_name=_next_name(db, user_id, name),
        source_type=source_type,
        source_name=source_name,
        source_text=text,
        summary=study_set.summary,
        questions_json=json.dumps([q.model_dump() for q in study_set.questions]),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/generate")
def generate(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return _create_test(db, user_id, payload.text, payload.name, "text", None)


@app.post("/api/generate-upload")
async def generate_upload(
    name: str | None = Form(default=None),
    url: str | None = Form(default=None),
    upload: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if bool(url) == bool(upload):
        raise HTTPException(status_code=400, detail="Provide exactly one URL or one file.")
    if url:
        source = _read_url(url)
        return _create_test(db, user_id, source, name, "url", url)
    source, source_type = await _read_upload(upload)
    return _create_test(db, user_id, source, name, source_type, upload.filename)


@app.get("/api/history")
def history(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
    sort: str = "newest",
):
    query = db.query(NoteSet).filter(NoteSet.user_id == user_id)
    if sort == "score":
        query = query.order_by(NoteSet.score.desc().nullslast(), NoteSet.created_at.desc())
    elif sort == "name":
        query = query.order_by(NoteSet.quiz_name.asc(), NoteSet.created_at.desc())
    else:
        query = query.order_by(NoteSet.created_at.desc())
    rows = query.limit(50).all()
    return {"items": [_serialize(row) for row in rows]}


@app.post("/api/tests/{test_id}/result")
def save_result(
    test_id: int,
    payload: ResultRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    row = db.query(NoteSet).filter(NoteSet.id == test_id, NoteSet.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Test not found.")
    questions = json.loads(row.questions_json)
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=400, detail="Submit one answer for every question.")
    score = sum(answer == question.get("correct_index") for answer, question in zip(payload.answers, questions))
    row.answers_json = json.dumps(payload.answers)
    row.score = score
    row.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@app.post("/api/tests/{test_id}/regenerate")
def regenerate(
    test_id: int,
    payload: RegenerateRequest | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    row = db.query(NoteSet).filter(NoteSet.id == test_id, NoteSet.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Test not found.")

    try:
        study_set = generate_study_set(row.source_text[:8000])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The model could not produce a usable quiz. {exc}")

    requested_name = payload.name if payload and payload.name else None
    row.quiz_name = _next_name(db, user_id, requested_name or row.quiz_name, exclude_id=row.id)
    row.summary = study_set.summary
    row.questions_json = json.dumps([q.model_dump() for q in study_set.questions])
    row.answers_json = None
    row.score = None
    row.completed_at = None
    row.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _serialize(row)