# Typeform-inspired builder — Stage 2

A multi-question draft builder using Next.js/TypeScript, FastAPI, SQLAlchemy and SQLite.
Add, edit, delete and reorder eight question types and choice options; preview locally;
explicitly save and reload the whole draft. Existing Stage 1 IDs and values are migrated.

Stage 2 contains no publishing, public submissions, results, AI or deployment. Stage 1
was published to GitHub; Stage 2 is pending review and has not been committed or pushed.
See [architecture](docs/architecture.md), [full roadmap](docs/requirements.md) and
[checks actually performed](docs/stage-2-verification.md).

## Stack and dependencies

- Next.js 16 / React 19 / TypeScript 5.9, plain CSS.
- dnd-kit for pointer and keyboard sorting; Lucide for SVG icons.
- Python 3.12+, FastAPI, Pydantic, Uvicorn, SQLAlchemy 2, built-in SQLite driver.
- Python unittest/HTTPX and Node's built-in test runner. No migration framework added.
- Python dependencies are pinned in backend/requirements.txt; frontend versions are
  resolved in frontend/package-lock.json. Use Node.js 22.18+ or 24 LTS for the tests.

## Run locally in this workspace

Dependencies are installed. If servers are already running, use the existing localhost
links rather than starting a second process on the same ports. Otherwise open two
PowerShell terminals.

Backend:

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\backend'
$env:SQLITE_PATH = 'data/typeform.sqlite3'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\frontend'
npm.cmd run dev
```

Open http://127.0.0.1:3000; API docs: http://127.0.0.1:8000/docs.
Save creates the draft in SQLite. Bookmark its ?form= UUID URL for later reload.
New form starts an empty unsaved draft and does not delete the previous form. There is
no forms-list screen yet. Use the drag grips to reorder, or focus a grip and press Space,
Up/Down, Space; Escape cancels sorting. Preview arrows navigate without submitting.

## Fresh setup

From the repository root on Windows, with Python 3.12+ and Node.js 22.18+ installed:

```powershell
py -3.12 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
```

Then run the two commands above. Without the Windows launcher, use python -m venv with
a suitable interpreter. On macOS/Linux use python3 -m venv backend/.venv, install through
backend/.venv/bin/python, and use npm instead of npm.cmd. The first backend startup creates
an empty version2 schema. Tests create their own temporary databases, never reset yours.

For a production frontend locally, run npm.cmd run build followed by npm.cmd run start
instead of dev. Both use port3000; stop your existing frontend first.

## Configuration and migration

| Variable | Default | Behavior |
| --- | --- | --- |
| SQLITE_PATH | data/typeform.sqlite3 | Absolute or relative to backend/, regardless of shell directory. |
| FRONTEND_ORIGINS | http://localhost:3000,http://127.0.0.1:3000 | Comma-separated backend CORS origins. |
| NEXT_PUBLIC_API_URL | http://127.0.0.1:8000 | Public browser API origin; rebuild for production changes. |

.env.example files document configuration. Backend .env files are not automatically
loaded: set environment variables in the shell. Frontend can use .env.local. Never put
secrets in NEXT_PUBLIC_* values. Real environment files, SQLite and backup files,
recordings, references, dependencies and build outputs stay Git-ignored.

When upgrading Stage 1, stop its backend and keep the same SQLITE_PATH. Stage 2 startup
creates a SQLite-safe .stage1-backup.sqlite3 beside the database, then migrates in one
transaction. It copies all question values/IDs, removes old single-question constraints,
adds ordered relational options, checks foreign keys and records user_version=2. It does
not delete user forms. Repeated startup skips the migration. Unknown schema/version
fails startup; there is no automatic reset or downgrade. Reload old frontend tabs because
the API now uses questions instead of question. See architecture for restore cautions.

## Data flow and schema

React holds the definition separately from preview answers. Settings and sorting update
local state immediately. Save validates and PUTs the whole draft. Pydantic validates
structure; a SQLAlchemy transaction verifies ID ownership and reconciles all rows and
positions. Only commit success marks the UI saved. Rejected saves leave the previous
stored draft intact and keep the local edits. Retrying after an ambiguous network failure
uses the same IDs. Browser unload warns about unsaved edits.

| Table | Fields |
| --- | --- |
| forms | id UUID PK, title |
| draft_questions | id UUID PK, form_id FK, type, position, prompt, description, required |
| choice_options | id UUID PK, question_id FK, label, position |

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/health | Process health. |
| GET | /api/forms/{uuid} | Saved ordered draft; 404 if absent. |
| PUT | /api/forms/{uuid} | Create or atomically replace the complete draft. |

PUT body (response additionally contains the form id):

```json
{
  "title": "Student introductions",
  "questions": [
    {
      "id": "f48bcebe-191d-4cfb-83cf-f3352a678bf0",
      "type": "multiple_choice",
      "prompt": "Your focus?",
      "description": "Choose one.",
      "required": true,
      "options": [
        {"id": "bc989022-1acd-4538-8220-3a533e101ae2", "label": "Frontend"},
        {"id": "d6d3bd15-dfcd-449a-a28c-b639535f67bb", "label": "Backend"}
      ]
    }
  ]
}
```

Array order sets stored positions. Omitted questions/options are deleted atomically.
Use options: [] for non-choice types. Supported types are short_text, long_text,
multiple_choice, dropdown, email, number, yes_no and rating. Duplicate/cross-form IDs,
option IDs moved to another question, incompatible options and extra settings are rejected.
422 means payload validation failed; 409 means identity/integrity conflict; handled
storage failures return503. The singular Stage 1 payload is deliberately no longer valid.

## Draft assumptions and limits

- Multiple choice/dropdown are single-select; rating has a fixed integer 1–5 scale.
- Prompt, description and required apply to every type. Options apply only to choice
  types. No custom rating scales or numeric range settings exist in this stage.
- Incomplete drafts are allowed: zero questions, blank prompts and blank choice labels.
  This deliberately relaxes Stage 1's nonblank-question rule. Publication will validate
  completeness later. Title must still be nonblank and at most160 characters.
- Prompt max1000, description max2000, choice label max500 Unicode code points;
  at most200 questions and100 options per question. required is a JSON boolean.
- Type changes preserve question ID and common fields; discarding options requires
  confirmation. Preview answers are separate, temporary and cleared when incompatible.
- Default shared creator, no private workspace isolation. Multiple tabs use
  last-successful-save-wins. Unsaved edits are not backed up.
- System sans approximates the supplied typography; no font asset was available.
- Future publication accepts an already-open older snapshot only while its form remains
  published, validates that exact version and rejects unknown/unrelated versions.
- Hosting persistence is unresolved: SQLite must survive both restart and redeploy on a
  persistent mount. No paid resource has been created; local tests do not prove hosting.

## Checks

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\backend'
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd '..\frontend'
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

See [Stage 2 verification](docs/stage-2-verification.md) for outcomes and limitations.
[Stage 1 verification](docs/stage-1-verification.md) remains a historical record.
