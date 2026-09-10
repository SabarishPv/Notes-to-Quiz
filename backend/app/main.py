"""FastAPI application entrypoint.

Run locally:   uvicorn app.main:app --reload
On Render:     uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .database import init_db
from .routers import attempts, folders, health, quizzes, sharing


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Notes to Quiz API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (health, folders, quizzes, attempts, sharing):
    app.include_router(module.router)
