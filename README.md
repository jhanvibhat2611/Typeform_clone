# Typeform-inspired builder — Stage 1

A deliberately small full-stack assignment increment: create, edit, save and reload a
form with one short-text question. The three-panel builder follows the supplied Typeform
screenshots. The centre preview updates immediately; its answers never leave the browser.

**Stage 1 only.** No publishing, public filling, submissions, results, additional question
types, AI, or bonus features are implemented. No repository publication or deployment has occurred.
See [the full requirement checklist](docs/requirements.md) and [architecture decisions](docs/architecture.md).

## Stack

- Next.js 16 / React 19 / TypeScript 5.9; plain CSS, no UI/component library.
- Python 3.12+, FastAPI, Pydantic, Uvicorn.
- SQLAlchemy 2 and SQLite through Python's built-in driver.
- Python unittest and HTTPX for backend tests. Exact installed Python versions are pinned
  in `backend/requirements.txt`; frontend dependency resolution is in `frontend/package-lock.json`.

## Run locally on this Windows workspace

Dependencies and the virtual environment are already installed. Open two PowerShell terminals.

**Terminal 1 — backend:**

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\backend'
$env:SQLITE_PATH = 'data/typeform.sqlite3'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\frontend'
npm.cmd run dev
```

Open http://127.0.0.1:3000. API documentation is at http://127.0.0.1:8000/docs.
Use Ctrl+C in each terminal to stop. A draft is only created in SQLite on its first Save.
After saving, bookmark the `?form=...` URL to reopen that draft. Reloading this URL fetches
the saved values from the backend. New form starts another unsaved draft; it does not delete
the previous form. There is no form-list screen in Stage 1.

## Setup on another machine

Use Node.js 22 LTS or newer and Python 3.12+. From the repository root on Windows:

```powershell
py -3.12 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
```

If Python is installed without the Windows launcher, use `python -m venv backend/.venv`
with a Python 3.12+ interpreter. On macOS/Linux use `python3 -m venv backend/.venv`,
`backend/.venv/bin/python -m pip install -r backend/requirements.txt`, and `npm ci` in
`frontend/`; use `.venv/bin/python` for backend commands and `npm` for frontend commands.

## Configuration

| Variable | Default | Behavior |
| --- | --- | --- |
| `SQLITE_PATH` | `data/typeform.sqlite3` | Absolute path, or relative to `backend/` regardless of shell working directory. |
| `FRONTEND_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed browser origins. Set in backend shell. |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Browser-visible API origin. Set in frontend `.env.local` or shell; rebuild for production changes. |

Example files document these values. The backend does **not** automatically load `.env`;
set its environment variables in the shell. Do not put secrets in `NEXT_PUBLIC_*` variables.
SQLite data, environments, build output, `typeform-references/`, and recordings are ignored by Git.

## Data flow and schema

`Builder` holds a complete draft and its last saved value. Settings update that draft and
the preview immediately. Save runs client validation, then sends JSON to FastAPI. Pydantic
validates the payload; SQLAlchemy saves both rows in one transaction. Only a committed
response changes the UI to saved. Failed saves preserve local edits; invalid or rolled-back
writes preserve the previous database state. Network failure can be ambiguous after commit,
so retries reuse the same UUIDs and PUT operation.

| Table | Fields |
| --- | --- |
| `forms` | `id` UUID primary key, `title` |
| `draft_questions` | `id` UUID primary key, unique `form_id` foreign key, `type`, `position`, `prompt`, `description`, `required` |

One short-text question at position 0 is enforced for this stage. Question IDs cannot be
changed on save. SQLite foreign keys are enabled. Startup creates missing tables; it does
not reset data. A migration must accompany future schema changes.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Process health. |
| GET | `/api/forms/{uuid}` | Retrieve one saved draft; 404 if missing. |
| PUT | `/api/forms/{uuid}` | Create or atomically replace the editable fields of one draft; retry-safe with the same IDs. |

PUT body (response includes the form `id` in addition):

```json
{
  "title": "Student introductions",
  "question": {
    "id": "f48bcebe-191d-4cfb-83cf-f3352a678bf0",
    "type": "short_text",
    "prompt": "What is your name?",
    "description": "Your preferred name is fine.",
    "required": true
  }
}
```

Title: nonblank, at most 160 characters. Prompt: nonblank, at most 1,000 characters.
Description: at most 2,000 characters, empty allowed. Required: actual JSON boolean.
Unknown fields/types and invalid UUIDs are rejected. Validation errors return 422; question
identity/database conflicts return 409; handled database save failures return 503.

## Checks

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\backend'
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd '..\frontend'
npm.cmd run typecheck
npm.cmd run build
```

Backend tests use isolated temporary SQLite files, never your working drafts. See
[Stage 1 verification](docs/stage-1-verification.md) for checks actually performed and limitations.

## Assumptions and remaining work

- Default shared creator; no login or access isolation. Anyone reaching this demo API can
  edit its drafts. Do not treat it as a private production workspace.
- New drafts and unsaved edits live in memory. Closing/reloading can discard them after a browser warning.
- Multiple tabs use last-successful-save-wins; revision conflict protection is deferred.
- System sans-serif approximates the reference typography; no supplied font asset was available.
- **Hosting persistence is unresolved.** The database must be on a persistent volume and
  survive both restart and redeploy. No paid resource has been created. Local checks do not
  establish that deployment requirement.
- Accepted future publishing rule: an already-open older published version is accepted while
  its form remains published. Validate that exact snapshot; reject unknown/unrelated versions
  and block submissions when unpublished. This behavior is documented, not implemented.
