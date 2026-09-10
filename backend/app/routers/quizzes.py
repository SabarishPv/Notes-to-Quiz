from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import (
    DEFAULT_QUESTIONS,
    MAX_QUESTIONS,
    MIN_QUESTIONS,
    QUESTION_TYPES,
)
from ..database import get_db
from ..ingest import read_upload, read_url
from ..models import Folder, NoteSet
from ..schemas import GenerateRequest, QuizPatch, RegenerateRequest
from ..services import create_quiz, new_share_token, regenerate_quiz, serialize_quiz

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


def _validate_folder(db: Session, user_id: str, folder_id: int | None) -> int | None:
    if folder_id is None:
        return None
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    return folder.id


def _owned(db: Session, user_id: str, quiz_id: int) -> NoteSet:
    row = db.query(NoteSet).filter(NoteSet.id == quiz_id, NoteSet.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return row


def _parse_types(raw: str | None) -> list[str]:
    if not raw:
        return ["mcq"]
    wanted = [t.strip() for t in raw.split(",") if t.strip()]
    clean = [t for t in dict.fromkeys(wanted) if t in QUESTION_TYPES]
    if not clean:
        raise HTTPException(status_code=422, detail="Select at least one valid question type.")
    return clean


# ------------------------------------------------------------------- generate

@router.post("", status_code=201)
def generate_from_text(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    folder_id = _validate_folder(db, user_id, payload.folder_id)
    row = create_quiz(
        db, user_id,
        text=payload.text, name=payload.name, source_type="text", source_name=None,
        folder_id=folder_id,
        question_count=payload.question_count, question_types=payload.question_types,
    )
    return serialize_quiz(row, include_attempts=True)


@router.post("/upload", status_code=201)
async def generate_from_upload(
    name: str | None = Form(default=None),
    url: str | None = Form(default=None),
    folder_id: int | None = Form(default=None),
    question_count: int = Form(default=DEFAULT_QUESTIONS),
    question_types: str | None = Form(default=None),
    upload: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if bool(url) == bool(upload):
        raise HTTPException(status_code=400, detail="Provide exactly one URL or one file.")
    if not MIN_QUESTIONS <= question_count <= MAX_QUESTIONS:
        raise HTTPException(status_code=422, detail=f"question_count must be {MIN_QUESTIONS}-{MAX_QUESTIONS}.")

    types = _parse_types(question_types)
    checked_folder = _validate_folder(db, user_id, folder_id)

    if url:
        text, source_type, source_name = read_url(url), "url", url
    else:
        text, source_type = await read_upload(upload)
        source_name = upload.filename

    row = create_quiz(
        db, user_id,
        text=text, name=name, source_type=source_type, source_name=source_name,
        folder_id=checked_folder,
        question_count=question_count, question_types=types,
    )
    return serialize_quiz(row, include_attempts=True)


# ----------------------------------------------------------------- list / read

@router.get("")
def list_quizzes(
    folder: str | None = None,
    sort: str = "newest",
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    query = db.query(NoteSet).filter(NoteSet.user_id == user_id)
    if folder == "unfiled":
        query = query.filter(NoteSet.folder_id.is_(None))
    elif folder not in (None, "all"):
        try:
            query = query.filter(NoteSet.folder_id == int(folder))
        except ValueError:
            raise HTTPException(status_code=422, detail="folder must be 'all', 'unfiled', or a folder id.")

    if sort == "score":
        query = query.order_by(NoteSet.best_score.desc().nullslast(), NoteSet.created_at.desc())
    elif sort == "name":
        query = query.order_by(NoteSet.quiz_name.asc(), NoteSet.created_at.desc())
    else:
        query = query.order_by(NoteSet.created_at.desc())

    rows = query.limit(100).all()
    return {"items": [serialize_quiz(r) for r in rows]}


@router.get("/{quiz_id}")
def get_quiz(quiz_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    return serialize_quiz(_owned(db, user_id, quiz_id), include_attempts=True)


@router.patch("/{quiz_id}")
def patch_quiz(
    quiz_id: int,
    payload: QuizPatch,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    row = _owned(db, user_id, quiz_id)
    if payload.name is not None:
        row.quiz_name = payload.name.strip() or row.quiz_name
    if payload.clear_folder:
        row.folder_id = None
    elif payload.folder_id is not None:
        row.folder_id = _validate_folder(db, user_id, payload.folder_id)
    db.commit()
    db.refresh(row)
    return serialize_quiz(row, include_attempts=True)


@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    row = _owned(db, user_id, quiz_id)
    db.delete(row)
    db.commit()


@router.post("/{quiz_id}/regenerate")
def regenerate(
    quiz_id: int,
    payload: RegenerateRequest | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    row = _owned(db, user_id, quiz_id)
    requested = payload.name if payload and payload.name else None
    return serialize_quiz(regenerate_quiz(db, row, requested), include_attempts=True)


# --------------------------------------------------------------------- sharing

@router.post("/{quiz_id}/share")
def create_share_link(quiz_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    row = _owned(db, user_id, quiz_id)
    if not row.share_token:
        row.share_token = new_share_token()
        db.commit()
    return {"share_token": row.share_token}


@router.delete("/{quiz_id}/share", status_code=204)
def revoke_share_link(quiz_id: int, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    row = _owned(db, user_id, quiz_id)
    row.share_token = None
    db.commit()
