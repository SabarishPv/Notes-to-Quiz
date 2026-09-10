from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Folder, NoteSet
from ..schemas import FolderCreate, FolderPatch

router = APIRouter(prefix="/api/folders", tags=["folders"])


def _serialize(folder: Folder, count: int) -> dict:
    return {"id": folder.id, "name": folder.name, "quiz_count": count, "created_at": folder.created_at}


@router.get("")
def list_folders(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    counts = dict(
        db.query(NoteSet.folder_id, func.count(NoteSet.id))
        .filter(NoteSet.user_id == user_id, NoteSet.folder_id.isnot(None))
        .group_by(NoteSet.folder_id)
        .all()
    )
    folders = (
        db.query(Folder)
        .filter(Folder.user_id == user_id)
        .order_by(Folder.name.asc())
        .all()
    )
    unfiled = (
        db.query(func.count(NoteSet.id))
        .filter(NoteSet.user_id == user_id, NoteSet.folder_id.is_(None))
        .scalar()
    )
    total = db.query(func.count(NoteSet.id)).filter(NoteSet.user_id == user_id).scalar()
    return {
        "items": [_serialize(f, counts.get(f.id, 0)) for f in folders],
        "unfiled_count": unfiled or 0,
        "total_count": total or 0,
    }


@router.post("", status_code=201)
def create_folder(payload: FolderCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    name = payload.name.strip()
    exists = (
        db.query(Folder)
        .filter(Folder.user_id == user_id, func.lower(Folder.name) == name.lower())
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="A folder with that name already exists.")
    folder = Folder(user_id=user_id, name=name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return _serialize(folder, 0)


def _owned_folder(db: Session, user_id: str, folder_id: int) -> Folder:
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == user_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    return folder


@router.patch("/{folder_id}")
def rename_folder(
    folder_id: int,
    payload: FolderPatch,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    folder = _owned_folder(db, user_id, folder_id)
    folder.name = payload.name.strip()
    db.commit()
    count = db.query(func.count(NoteSet.id)).filter(NoteSet.folder_id == folder.id).scalar()
    return _serialize(folder, count or 0)


@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    folder = _owned_folder(db, user_id, folder_id)
    # Delete quizzes inside the folder (and their attempts, via cascade).
    for quiz in db.query(NoteSet).filter(NoteSet.folder_id == folder.id).all():
        db.delete(quiz)
    db.delete(folder)
    db.commit()
