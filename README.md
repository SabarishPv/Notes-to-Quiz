# Notes to Quiz

Paste your notes, upload a PDF/text file, or point at a URL — get back a short summary
and a 5-question multiple-choice quiz to test yourself, with results and history saved
per account.

## How it works

- **Frontend** (`frontend/`) — React + Vite. Handles sign-in (Clerk), the create/upload
  form, taking a quiz, and browsing saved tests.
- **Backend** (`backend/`) — FastAPI. Verifies the Clerk session token, extracts text
  from the pasted notes / uploaded file / URL, sends it to an LLM (via Groq) to generate
  a summary and questions, and stores everything in Postgres.
- **Auth** — [Clerk](https://clerk.com). The frontend signs the user in and attaches a
  session token to every API request; the backend verifies that token on each request.
- **LLM** — Groq-hosted model (OpenAI-compatible API), prompted to return a summary plus
  5 multiple-choice questions as strict JSON.
- **Database** — Postgres, accessed through SQLAlchemy. Schema is created and
  lightly migrated automatically on startup (see `backend/app/db.py`).

## Project layout

```
backend/
  app/
    main.py    API routes: generate, upload/URL ingest, history, submit answers, regenerate
    llm.py     Prompting Groq and validating its JSON response
    auth.py    Clerk token verification (FastAPI dependency)
    db.py      SQLAlchemy models + engine + startup migrations
  requirements.txt
  .env.example

frontend/
  src/
    App.jsx       Tabs (Create / Saved), sign-in gate, top-level state
    QuizCard.jsx   Taking a quiz / reviewing a completed one
    api.js         Thin fetch wrapper that attaches the Clerk token
  .env.example
```

## Prerequisites

- Python 3.11+
- Node 18+
- A Postgres database (e.g. [Neon](https://neon.tech) free tier)
- A [Clerk](https://clerk.com) application (for auth)
- A [Groq](https://console.groq.com) API key (for quiz generation)

## Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in the values, see below
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Health check: `GET /api/health`.

### Backend environment variables

See `backend/.env.example` for the full list with descriptions. In short:

| Variable            | Required | Notes                                                        |
| ------------------- | -------- | ------------------------------------------------------------- |
| `DATABASE_URL`      | Yes      | Postgres connection string                                    |
| `GROQ_API_KEY`      | Yes      | From the Groq console                                         |
| `CLERK_SECRET_KEY`  | Yes      | From the Clerk dashboard                                      |
| `LLM_MODEL`         | No       | Defaults to `openai/gpt-oss-20b`                               |
| `CLERK_JWT_KEY`     | No       | Enables local token verification instead of a network call    |
| `ALLOWED_ORIGINS`   | No       | Comma-separated frontend origins allowed to call the API      |

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # fill in the values, see below
npm run dev
```

The app runs at `http://localhost:5173`.

### Frontend environment variables

See `frontend/.env.example`. In short:

| Variable                     | Required | Notes                                      |
| ----------------------------- | -------- | ------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Yes      | From the Clerk dashboard                    |
| `VITE_API_URL`                | No       | Defaults to `http://localhost:8000`         |

## Notes

- `ALLOWED_ORIGINS` (backend) is used both for CORS and as the list of parties Clerk
  will accept tokens from — it must match wherever the frontend is actually served.
- Never commit `.env` files or real API keys. Only the `.env.example` files (with
  placeholder values) belong in version control.
