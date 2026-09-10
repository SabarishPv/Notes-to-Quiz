# Notes to Quiz

Turn a page of notes, a PDF, or a URL into a summary and a custom quiz. Organise
quizzes into folders, retake them as often as you like (every attempt is scored
and kept), and share a quiz with a public link.

See [ROADMAP.md](ROADMAP.md) for what's shipped and what's next.

## Features

- **Sources** — paste notes, upload a PDF/TXT/Markdown file, or import a URL.
- **Configurable generation** — pick the number of questions (3–15) and the
  question types (multiple choice, true/false) per quiz.
- **Folders** — group quizzes by subject. Deleting a folder deletes the quizzes
  inside it (with a confirm).
- **Repeat attempts** — "Retake" scores a fresh attempt; the quiz shows how many
  times it's been taken and your best score, with a full attempt history.
- **Shareable links** — mint a public `/s/<token>` link. Anyone can take it
  without an account; they enter an optional name and their attempts are counted
  separately from yours.
- Light / dark / system theme.

## Architecture

```
frontend/                     React + Vite SPA (Clerk auth, React Router)
  src/
    App.jsx                    routes: /  ·  /studio  ·  /s/:token
    pages/       Landing · Studio · SharedQuiz
    components/  QuizCard · SourceForm · QuizConfig · FolderRail · …
    lib/         api.js (fetch wrapper + endpoints) · theme.js
  vercel.json                  SPA rewrite so deep links survive a refresh

backend/                      FastAPI
  app/
    main.py                    app factory, CORS, router registration
    config.py                  env-derived settings
    database.py                engine + startup auto-migration (Postgres only)
    models.py                  Folder · NoteSet · Attempt
    schemas.py                 request/response models
    auth.py                    Clerk token verification (FastAPI dependency)
    llm.py                     Groq prompt + response validation
    ingest.py                  URL / file text extraction
    services.py                create / regenerate / grade / serialize
    routers/     health · folders · quizzes · attempts · sharing
  tests/                       pytest, SQLite, mocked model
```

- **Auth** — [Clerk](https://clerk.com). The frontend attaches a session token to
  every API call; the backend verifies it. Shared-quiz endpoints are public.
- **LLM** — Groq (OpenAI-compatible API), prompted for strict JSON, validated and
  retried once on failure.
- **Database** — Postgres (e.g. [Neon](https://neon.tech)) via SQLAlchemy. Schema
  is created and lightly migrated on startup; SQLite is used for the test suite.

## Prerequisites

- Python 3.11 or 3.12
- Node 18+
- A Postgres database, a Clerk application, and a Groq API key

## Run the backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in the values
uvicorn app.main:app --reload
```

API at `http://localhost:8000` — check `GET /api/health`, browse `/docs`.

| Variable            | Required | Notes                                          |
| ------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`      | yes      | Postgres connection string                     |
| `GROQ_API_KEY`      | yes      | from the Groq console                          |
| `CLERK_SECRET_KEY`  | yes      | from the Clerk dashboard                       |
| `LLM_MODEL`         | no       | defaults to `openai/gpt-oss-20b`               |
| `CLERK_JWT_KEY`     | no       | enables local (offline) token verification    |
| `ALLOWED_ORIGINS`   | no       | comma-separated frontend origins for CORS      |

## Run the frontend

```bash
cd frontend
npm install
cp .env.example .env          # fill in the values
npm run dev
```

App at `http://localhost:5173`.

| Variable                     | Required | Notes                                    |
| ----------------------------- | -------- | ---------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY`  | yes      | from the Clerk dashboard                 |
| `VITE_API_URL`                | no       | backend base URL; default `:8000`. **No trailing slash.** |

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

## Deploy notes

- **Backend (Render):** start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  Set `PYTHON_VERSION=3.12.7` in the dashboard. Set every required env var above;
  `ALLOWED_ORIGINS` must include your deployed frontend origin.
- **Frontend (Vercel):** framework "Vite", build `npm run build`, output `dist`.
  `vercel.json` handles SPA routing. Set `VITE_API_URL` to the Render URL with no
  trailing slash, and `VITE_CLERK_PUBLISHABLE_KEY`.
- Never commit `.env`; only the `.env.example` files (placeholders) belong in git.
