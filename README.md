# Typeform-inspired builder — Stage 5

A Next.js/TypeScript builder with FastAPI, SQLAlchemy and SQLite. Build eight question
types, save incomplete drafts, publish an immutable version, share a stable public link,
and collect validated, persisted responses through a one-question-at-a-time public flow.

Stage 5 is committed. Explicit, repeatable demo seeding is now implemented for review.
Existing drafts and Git history are preserved. See [roadmap](docs/requirements.md),
[architecture](docs/architecture.md), [API contracts](docs/api.md),
[respondent verification](docs/stage-5-verification.md) and [seed verification](docs/seeding-verification.md).

Deployment URLs supplied for this project (not deployed or modified by this stage):

- Frontend: https://typeform-clone-rosy.vercel.app
- Backend: https://typeformclone-production.up.railway.app

## Stack

Next.js16 / React19 / TypeScript5.9, plain CSS, dnd-kit sorting and Lucide SVG icons.
Python3.12+, FastAPI, Pydantic, Uvicorn, SQLAlchemy2 and built-in SQLite. Backend unittest/
HTTPX and Node's built-in test runner. No new Stage 4 dependency or infrastructure.
Python requirements are pinned; frontend resolution is in package-lock.json.
Use Node.js22.18+ or24 LTS for the frontend tests.

## Run locally

Dependencies are installed in this workspace. If ports3000/8000 are already running, use
the existing servers. Otherwise open separate PowerShell terminals.

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

Open http://127.0.0.1:3000; API docs: http://127.0.0.1:8000/docs. Ctrl+C stops a server.
For a production frontend locally, run npm.cmd run build, then npm.cmd run start instead
of dev. Both use port3000. Keep the configured backend running.

The root URL opens the forms workspace. Create form persists an empty draft and opens
its builder. Existing /?form={id} URLs still work. Forms breadcrumbs return to the workspace.
Cards show saved titles, publication status and actual response counts across all versions.
Rename changes only the saved draft title; the live snapshot title changes on republish.
Duplicate copies current saved draft content with fresh IDs, no responses and no publication
history. Confirmed Delete permanently removes the form, its versions and associated responses
in one transaction; the public link then stops working. Drag grips reorder questions or
options; keyboard sorting uses Space, Up/Down, Space (Escape cancels).

Publish validates and saves the CURRENT editor contents in one transaction, creates a
snapshot and opens Share. Copy link shows feedback. The public path is /f/{public_id}.
Draft Save after publishing affects only the editor. Republish activates a new snapshot
at the same link; Unpublish stops new responses. An already-open older version can submit
while the form remains published.

Public filling preserves answers on Back. Enter advances single-line inputs; multiline
Enter inserts a newline, Ctrl+Enter advances. Choice/dropdown keys remain native; use OK
or Submit to advance. Errors focus the answer. Network failure retains answers and offers
a retry with the same attempt UUID/payload. Thank-you appears only after confirmed success.
Editor Preview remains local and never stores responses.

## Fresh setup / upgrade

From the repository root on Windows, with Python3.12+ and Node.js22.18+ installed:

```powershell
py -3.12 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
```

Without the Windows launcher use python -m venv with a suitable interpreter. On macOS/Linux
use python3 -m venv backend/.venv, backend/.venv/bin/python to install/run backend commands,
and npm instead of npm.cmd. Then run the servers above.

Before upgrading, stop the old backend and retain the SAME SQLITE_PATH. Startup runs the
original 0 -> 2 migration if needed, then 2 -> 3 and 3 -> 4. Existing draft rows/IDs are not
rewritten in Stage 4. SQLite-safe backups are created beside the database as
.stage1-backup.sqlite3, .stage2-backup.sqlite3 and .stage3-backup.sqlite3 when applicable, without
replacing an existing backup. New publication IDs are allocated for existing forms.
Fresh setup runs the migration chain; repeat startup is a no-op. Unknown versions fail without
resetting data. Keep the database directory writable and refresh old frontend tabs.
There is no automatic downgrade; restoring an older backup discards subsequent data.

## Workspace and results

Per-form Results navigation opens /forms/{form_id}/results. Select a published version
explicitly in the dropdown; the latest is selected initially. Responses show submission
time, version and snapshot-based answers. Click a submission time to inspect every
question, including unanswered optional questions removed from later drafts.

Response summary shows answered/unanswered counts; option, Yes/No and rating distributions;
text/email answers; and numeric values/minimum/maximum. All summaries are for the selected
version only. Zero displays as 0, false as No, and omitted optionals as Unanswered (optional).
No views, completion rates or uncollected analytics are displayed. Wide tables have an
independent horizontal scrollbar and keyboard-focusable region. The builder has accessible
Theme and Thank-you screen placeholders labelled Coming Soon; they change no settings.

Results currently load all responses for one selected version; pagination is not implemented.
This is appropriate for assignment/demo data, not an unbounded production response volume.
Creator endpoints remain shared-demo APIs without authentication or access isolation.

## Configuration

| Variable | Default | Behavior |
| --- | --- | --- |
| SQLITE_PATH | data/typeform.sqlite3 | Absolute or relative to backend/ |
| FRONTEND_ORIGINS | http://localhost:3000,http://127.0.0.1:3000 | Comma-separated backend CORS origins |
| NEXT_PUBLIC_API_URL | http://127.0.0.1:8000 | Browser API origin; rebuild for production changes |

.env.example documents configuration. Backend does not automatically load .env; set shell
variables. Frontend can use .env.local. NEXT_PUBLIC_* values are public, never secrets.
Databases, backups/journals, environment files, references, recordings, dependencies and
build output remain excluded from Git.

## Data flow, schema and assumptions

React definition -> draft PUT or publish POST -> Pydantic validation -> SQLAlchemy
transaction -> SQLite. Publish also inserts immutable snapshot JSON and activates its
publication pointer. Public GET -> frozen snapshot -> shared controls/local answers ->
submission POST -> exact-version validation -> submission and answer rows committed together.

Tables: forms, draft_questions, choice_options, form_versions, publications, submissions,
answers. [Architecture](docs/architecture.md) explains keys/migration/transactions;
[API documentation](docs/api.md) includes every endpoint, payload, limit and retry behavior.

- Eight types: short/long text, multiple choice, dropdown, email, number, yes/no, rating.
- Choice types are single-select and need at least TWO nonblank choices to publish.
  Rating uses fixed integer1–5. No custom range/scale settings in this stage.
- Drafts may be empty/incomplete; publication requires nonblank prompts and at least one
  question. Title stays nonblank. Title max160; prompt1000; description2000; option500;
  at most200 questions and100 options each, measured in Unicode code points.
- Optional omission/null/blank answers have no answer row. False and zero remain valid.
- Email uses a documented practical ASCII format check without DNS verification. Browser
  numbers use JavaScript precision; the backend requires finite JSON numbers.
- One UUID per respondent attempt makes retries safe. Same UUID with changed content is409.
  Exact successful retries remain acknowledged after unpublish without inserting anything.
- Answers/attempts live in tab memory until submission; reload does not resume an attempt.
  Unsaved/unsubmitted content has an unload warning. No partial-response storage exists.
- Default shared creator, no private isolation; multiple editor tabs are last-save-wins.
- System sans approximates reference typography; no supplied font asset was available.
- Persistent SQLite HOSTING remains unresolved. A deployment must prove data survives
  both restart and redeploy on persistent storage. No paid resources were created.

## Checks

```powershell
cd 'C:\Users\LENOVO\Documents\ChatGPT\Scaler assignment\backend'
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd '..\frontend'
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Backend tests use temporary SQLite databases, including migration fixtures, workspace/results, concurrency,
rollback and two real Uvicorn process runs. [Stage 4 verification](docs/stage-4-verification.md)
distinguishes performed browser checks from remaining limitations. Stage1/2/3 verification
documents are historical records; later stages deliberately change their scope.


## Stage 5 respondent navigation

Public forms have a wide question area, numbered heading badge, underline answer controls,
compact OK button, top progress line and fixed lower-right Up/Down buttons. Forward exits
upward and enters from below; Back reverses this. Both panels move together for 600 ms; navigation locks for that entire
transition. Reduced motion removes movement and retains a 350 ms repeat-click guard.
Answers remain in the respondent's question-ID map, independently of the displayed panel.
No schema, API, publication or persistence changes were made.

Enter advances short text, email and number after validation. Long text keeps Enter for
newlines and uses Ctrl+Enter to advance. Native input/select/radio arrows keep their normal
behavior. Outside those controls, Up/Down navigates without submitting; the final Down arrow is disabled. Tab reaches the navigation buttons,
which also support Enter/Space. Holding a key does not repeatedly advance. Focus returns
to the new answer, and invalid answers keep focus on their field. The focused underline
thickens; forced-colour mode uses a visible outline. Submission retries retain their original
payload and UUID. Preview controls retain their previous styling and never submit.

See [Stage 5 verification](docs/stage-5-verification.md) for references, browser checks and
remaining differences. A simple snapshot-title welcome screen now precedes question one; Start or Enter begins.
No configurable welcome-screen editor, seeding or deployment was added.

Optional browser integration check: `frontend/tests/browser/respondent.cjs` requires an
existing Playwright installation and Microsoft Edge (or TEST_BROWSER channel). Start a
separate backend with SQLITE_PATH pointing at a disposable database and port8001, and a
frontend on port3001. From the repository root, set PLAYWRIGHT_MODULE to the installed
Playwright package path and run `node frontend/tests/browser/respondent.cjs`. TEST_API,
TEST_UI and TEST_ARTIFACTS override those defaults. The check routes browser API calls to
the disposable backend, creates fresh test forms/responses there, and intentionally fails
one network request. Never point TEST_API at a database containing user data. This optional
tool is not a runtime application dependency; normal setup/test commands are unchanged.


## Explicit demo data

`python -m app.seed` creates two published samples with five fictional responses each:

| Form | Question types |
| --- | --- |
| Event Registration | Short text, email, dropdown, number, yes/no, long text |
| Product Feedback | Rating, multiple choice, yes/no, number, long text, email |

Questions include help text, required and optional answers, and meaningful single-select
choices. Fixtures include numeric0, No, and omitted optional answers, with example.com
emails only. They are fictional demo records, not collected user responses. Results use
real relational answers and immutable snapshots; no dashboard numbers are fabricated.

Run locally from the repository root in PowerShell:

```powershell
cd backend
$env:SQLITE_PATH = 'data/typeform.sqlite3'
.\.venv\Scripts\python.exe -m app.seed
```

This targets the LOCAL database. To inspect a separate local demo database, set SQLITE_PATH
to another local filename before running. Linux/macOS, from backend/ with dependencies active:

```sh
SQLITE_PATH=data/typeform.sqlite3 python -m app.seed
```

The command prints the resolved database path, form IDs, public IDs and created/skipped-existing
status. Public URLs are the frontend origin plus `/f/{public_id}`; builder URLs use `/?form={form_id}`.
First run creates two forms, two published versions, ten submissions and55 answer rows.
Submissions get timestamps when first seeded; subsequent runs preserve all timestamps.

A fixed UUID namespace and semantic keys identify forms/questions/options/versions/responses;
changing a title never changes seed identity. An existing seed form is skipped entirely,
including edited drafts, republished snapshots, extra responses and unpublished state.
Missing responses are not replenished in existing forms. Forms with identical titles but
other IDs are unrelated and untouched. If a seed form is deliberately deleted, a later
explicit seed run recreates it; no tombstone is stored. Never change the namespace/version
keys to update existing fixtures, since that would create a different set of forms.

Existing migration code prepares fresh databases; no new migration or dependency was added.
One BEGIN IMMEDIATE transaction covers identity checks and all newly seeded records. Errors
roll back both new forms and their responses. Concurrent writers use the same SQLite lock.
The command reuses normal draft/publication/submission validation and persistence services.
There is no seed/reset endpoint and no startup/request hook.

## Seed the mounted Railway database (manual, after review)

These are instructions only. This stage did not commit, push, deploy or access the hosted
database. First deploy the reviewed backend code through your normal release process so
`app/seed.py` exists in the running service. A Vercel frontend deployment alone does not
install this backend command. No deployment command is executed here.

Confirm in Railway that the BACKEND service uses SQLITE_PATH=/data/typeform.sqlite3 and
has its persistent volume mounted at /data. Use the running backend service and correct
environment; a build/pre-deploy container is not the target mounted runtime.

On your LOCAL computer with the Railway CLI installed:

```sh
railway login
```

Use the normal browser sign-in. In the Railway dashboard, select the backend service and
use **Copy SSH Command**. Run that exact command locally; it selects the real project,
service and environment IDs. Its form is:

```sh
railway ssh --project <PROJECT_ID> --service <BACKEND_SERVICE_ID> --environment <ENVIRONMENT_ID>
```

The resulting shell is INSIDE the running Railway container. From there, locate the
backend working directory containing `app/seed.py` (commonly /app if Railway's root is
backend/, or /app/backend if the repository root was deployed):

```sh
pwd
ls
```

Change to that directory if necessary, then confirm the module is deployed and importable:

```sh
python -c "import app.seed; print(app.seed.__file__)"
```

Use the same Python interpreter as the running FastAPI service. If that service uses an
explicit virtualenv interpreter, substitute that path for `python` in the commands below.
If the module is missing, stop: the seed code has not been deployed to this service.

Run the following INSIDE Railway. The guard refuses to create a replacement database if
/data is not mounted or the expected existing database is absent:

```sh
python -c "import os; assert os.path.ismount('/data'), '/data is not mounted'; assert os.path.isfile('/data/typeform.sqlite3'), 'Expected database missing'" && SQLITE_PATH=/data/typeform.sqlite3 python -m app.seed
```

Run the same command again to confirm both records report `skipped-existing`. Then refresh
https://typeform-clone-rosy.vercel.app and check both sample cards show Published and5 responses
on their initial seed. If they were already edited/unpublished, the command preserves that
state instead. Results are read from the mounted backend database at
https://typeformclone-production.up.railway.app, not from the frontend filesystem.

`railway run` and `railway shell` run locally with Railway environment variables; they do
NOT attach the remote volume. Setting SQLITE_PATH=/data/typeform.sqlite3 on your laptop
cannot seed Railway's database. Use the SSH session above for remote execution.
See Railway's [SSH documentation](https://docs.railway.com/cli/ssh) and
[CLI local-development distinction](https://docs.railway.com/cli).
