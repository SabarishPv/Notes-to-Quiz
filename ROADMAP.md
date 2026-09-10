# Notes to Quiz — Roadmap

Status legend: ✅ done · 🚧 in progress · ⏳ planned

## v1 (shipped)

- ✅ Paste notes / upload PDF-TXT-MD / import URL → LLM summary + 5 MCQs
- ✅ Clerk auth, per-user library, take a quiz, save one score
- ✅ Regenerate a quiz in place
- ✅ Light / dark / system theme

## v2 (this milestone)

### Data model
- ✅ `folders` table — group quizzes by subject/topic
- ✅ `attempts` table — every take is recorded, not just the last one
- ✅ `note_sets` gains `folder_id`, `share_token`, `attempt_count`, `best_score`, `config_json`
- ✅ Additive, dialect-aware auto-migration on startup (Postgres only); SQLite used for tests

### Folders
- ✅ Create / delete folders (delete cascades to the quizzes inside, with a UI confirm)
- ✅ "All" and "Unfiled" pseudo-folders
- ✅ New quizzes land in the folder you're viewing
- ✅ Move a quiz between folders from the "⋯" menu ("Move to folder" submenu)
- ✅ Folder rail with per-folder quiz counts

### Repeat attempts
- ✅ "Retake" a quiz — each take is a new attempt, graded and stored
- ✅ Attempt count shown on the quiz ("Taken 3×") and in the library list
- ✅ Attempt history panel: number, score, when, who (owner vs guest)
- ✅ `best_score` tracked and used for the "Highest score" sort

### Studio UX
- ✅ Drive-style shell: "New quiz" button + folder list in the left rail
- ✅ Create form is a "Choose a source" card — three large option tiles
  (Paste notes / Upload file / Import URL) over a drag-and-drop file zone
- ✅ Left rail is a folder tree: selecting a folder expands its quizzes as a nested
  list right under it; picking one loads it in the main pane
- ✅ Retake / Regenerate / Share / Move to folder / Sort / Delete in a "⋯" actions
  menu at the top-right of the quiz card; submenus expand inline
- ✅ Active share link shown as a compact bar at the top of the quiz card

### Configurable generation
- ✅ Choose question count (3–15) per generation
- ✅ Choose question types (Multiple choice, True/False) — multi-select, MCQ default
- ✅ Config stored on the quiz and reused by "Regenerate"

### Shareable quiz links
- ✅ `POST /api/quizzes/{id}/share` mints a public token; `DELETE` revokes it
- ✅ Public `GET /api/shared/{token}` returns questions **without** answers
- ✅ Public `POST /api/shared/{token}/attempts` grades server-side, returns the key + explanations
- ✅ Optional guest display name; guest attempts stored with `taker = "guest"` and counted separately
- ✅ Frontend route `/s/:token`

### Landing page
- ✅ Public marketing page at `/` (hero, features, how-it-works)
- ✅ Router added (`react-router-dom`): `/`, `/studio`, `/s/:token`, `/sign-in`
- ✅ `vercel.json` SPA rewrite so deep links survive a refresh

### Project structure
- ✅ Backend split into a package: `config`, `database`, `models`, `schemas`, `auth`, `llm`, `ingest`, `naming`, `routers/*`
- ✅ Frontend split into `lib/`, `components/`, `pages/`
- ✅ Backend tests (`pytest`, SQLite, mocked LLM)
- ✅ Refreshed `.env.example` files and README with a clear run guide

## v3 (later — not in this milestone)

- ⏳ Alembic migrations (replace the startup ALTER shim)
- ⏳ Async generation job + progress polling (large PDFs vs. request timeout)
- ⏳ Score-trend analytics per folder / weak-topic detection
- ⏳ Export a quiz to PDF / Anki
- ⏳ Sentry error monitoring, GitHub Actions CI (lint + tests on every push)
- ⏳ Move Clerk to a production instance (`pk_live_…` / `sk_live_…`)
