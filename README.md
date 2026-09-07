# Typeform Builder

- [Live demo](https://typeform-clone-rosy.vercel.app)
- [Public repository](https://github.com/jhanvibhat2611/Typeform_clone)
- [Live backend API documentation](https://typeformclone-production.up.railway.app/docs)
- [Final assignment audit](docs/final-audit.md), [requirements](docs/requirements.md),
  [architecture and schema](docs/architecture.md), [API contracts](docs/api.md).

A Next.js/TypeScript builder with FastAPI, SQLAlchemy and SQLite. Build eight question
types, save incomplete drafts, publish an immutable version, share a stable public link,
and collect validated, persisted responses through a one-question-at-a-time public flow.

## Prerequisites and installation

Install Git, Python 3.12+ and Node.js 22.18+ (or Node 24 LTS), including npm.
Commands below use Windows PowerShell and start from a fresh clone:

```powershell
git clone https://github.com/jhanvibhat2611/Typeform_clone.git
cd Typeform_clone
py -3.12 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
Copy-Item .env.example .env.local
cd ..
```

Set frontend/.env.local to `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` for local use.
The backend template documents shell variables; it is not automatically loaded.
On Linux/macOS use `python3 -m venv backend/.venv`, `backend/.venv/bin/python`
and `npm` instead of the Windows interpreter paths and `npm.cmd`.

## Stack

Next.js 16 / React 19 / TypeScript 5.9, plain CSS, dnd-kit sorting and Lucide SVG icons.
Python 3.12+, FastAPI, Pydantic, Uvicorn, SQLAlchemy 2 and built-in SQLite. Backend unittest/
HTTPX and Node's built-in test runner. No external database or queue service is required.
Python requirements are pinned; frontend resolution is in package-lock.json.
Use Node.js 22.18+ or 24 LTS for the frontend tests.

## Run locally

After installation, open two PowerShell terminals at the repository root.

Backend:

```powershell
cd backend
$env:SQLITE_PATH = 'data/typeform.sqlite3'
$env:FRONTEND_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm.cmd run dev
```

Open http://127.0.0.1:3000; API docs: http://127.0.0.1:8000/docs. Ctrl+C stops a server.
For a production frontend locally, run npm.cmd run build, then npm.cmd run start instead
of dev. Both use port 3000. Keep the configured backend running.

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

## Database migrations and upgrades

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
| SQLITE_PATH | data/typeform.sqlite3 | Absolute, or relative to the backend directory (also the process working directory in the local commands) |
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
  Rating uses fixed integer 1–5. No custom range/scale settings in this stage.
- Drafts may be empty/incomplete; publication requires nonblank prompts and at least one
  question. Title stays nonblank. Title max 160; prompt 1000; description 2000; option 500;
  at most 200 questions and 100 options each, measured in Unicode code points.
- Optional omission/null/blank answers have no answer row. False and zero remain valid.
- Email uses a documented practical ASCII format check without DNS verification. Browser
  numbers use JavaScript precision; the backend requires finite JSON numbers.
- One UUID per respondent attempt makes retries safe. Same UUID with changed content is 409.
  Exact successful retries remain acknowledged after unpublish without inserting anything.
- Answers/attempts live in tab memory until submission; reload does not resume an attempt.
  Unsaved/unsubmitted content has an unload warning. No partial-response storage exists.
- Default shared creator, no private isolation; multiple editor tabs are last-save-wins.
- Visual fidelity is approximate, not pixel-perfect. System sans approximates the reference
  font; builder/results text and spacing are denser. Usable loaded-dashboard and individual-
  response detail references are missing, and exact original animation timing is unverified.
  See the [final visual comparison](docs/final-audit.md#visual-comparison).
- Hosted SQLite uses the Railway volume at /data. The user verified that a new response
  survived redeployment with the normal start command. This audit did not restart or
  redeploy the service; see the deployment evidence and limits below.

## Checks

Run from the repository root. These commands test temporary databases, not the hosted database.

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd '..\frontend'
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Backend tests use temporary SQLite databases, including migration fixtures, workspace/results, concurrency,
rollback and two real Uvicorn process runs. [Stage 4 verification](docs/stage-4-verification.md)
distinguishes performed browser checks from remaining limitations. Stage 1/2/3 verification
documents are historical records; later stages deliberately change their scope.


## Respondent navigation

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
The welcome screen has no configurable editor; it uses the published title.

Optional browser integration check: `frontend/tests/browser/respondent.cjs` requires an
existing Playwright installation and Microsoft Edge (or TEST_BROWSER channel). Start a
separate backend with SQLITE_PATH pointing at a disposable database and port 8001, and a
frontend on port 3001. From the repository root, set PLAYWRIGHT_MODULE to the installed
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
choices. Fixtures include numeric 0, No, and omitted optional answers, with example.com
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
First run creates two forms, two published versions, ten submissions and 55 answer rows.
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

## Seed the mounted Railway database (explicit maintenance command)

**User-verified hosted seeding:** the user reports that both sample forms were seeded
and are visible in the deployed application.
These commands are for deliberate future execution; the final audit did not run them.
The deployed backend must contain app/seed.py. A frontend-only deployment cannot install it.

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
https://typeform-clone-rosy.vercel.app and check both sample cards show Published and 5 responses
on their initial seed. If they were already edited/unpublished, the command preserves that
state instead. Results are read from the mounted backend database at
https://typeformclone-production.up.railway.app, not from the frontend filesystem.

`railway run` and `railway shell` run locally with Railway environment variables; they do
NOT attach the remote volume. Setting SQLITE_PATH=/data/typeform.sqlite3 on your laptop
cannot seed Railway's database. Use the SSH session above for remote execution.
See Railway's [SSH documentation](https://docs.railway.com/cli/ssh) and
[CLI local-development distinction](https://docs.railway.com/cli).

## Confirmed hosting configuration and evidence

| Service | Setting | Value |
| --- | --- | --- |
| Railway backend | Source root | /backend |
| Railway backend | Persistent volume mount | /data |
| Railway backend | SQLITE_PATH | /data/typeform.sqlite3 |
| Railway backend | FRONTEND_ORIGINS | https://typeform-clone-rosy.vercel.app |
| Vercel | Source root | frontend |
| Vercel | NEXT_PUBLIC_API_URL | https://typeformclone-production.up.railway.app |

The leading slash matters: `/data/typeform.sqlite3` is an **absolute Linux path** inside
Railway's mounted `/data` volume. Without the slash, `data/typeform.sqlite3` is relative
to this application's backend directory and may write to the container's ephemeral
filesystem instead of the volume. Use `SQLITE_PATH=/data/typeform.sqlite3` in the deployed
backend. The relative path remains appropriate for local development. The documented commands
run with `backend/` as the process working directory, so the relative value resolves
there. More precisely, `database_path()` anchors relative paths to the backend directory
using its module location, even if the process is launched from another working directory.
Neither path on your own computer accesses the Railway volume.

Normal Railway start command (Linux shell; $PORT is supplied by Railway):

```sh
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

If SSH is unavailable, an explicit temporary startup seed is an alternative: in the
Railway BACKEND service settings, temporarily replace the start command with:

```sh
python -m app.seed && exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Keep SQLITE_PATH=/data/typeform.sqlite3 and the mounted /data volume configured. This runs
INSIDE the deployed runtime, not locally or during image build. After successful seed logs
and checking both forms, restore the normal command above and redeploy. Do not leave the
seed command in routine startup. Existing seed identities are skipped, preserving edits.
No reset or table-clearing command is needed. Retain SQLite-safe backups outside the volume
before destructive maintenance; application migrations also make local upgrade backups.

**User-verified evidence, reported 2026-09-08:** both samples appeared and a newly submitted
response survived redeployment after restoration of the normal start command. The final
audit independently read the running forms/results, but did not perform that redeployment
or inspect the Railway account/volume directly. A separate hosted restart and backup restore
exercise were not independently performed.

Hosting availability depends on Railway plan limits and remaining credits. Trial credits
are time/usage limited, and expired-trial volumes have a retention limit; this is not an
indefinite free-hosting promise. Check the account before assessment and keep a backup.
See Railway's [trial policy](https://docs.railway.com/pricing/free-trial) and
[plans](https://docs.railway.com/pricing/plans) (reviewed 2026-09-08).

## Actual database relationships

| Table | Key fields and relationships |
| --- | --- |
| forms | id PK, editable title |
| draft_questions | id PK; form_id FK -> forms; type, position, prompt, description, required |
| choice_options | id PK; question_id FK -> draft_questions; label, position |
| form_versions | id PK; form_id FK -> forms; immutable snapshot JSON text, created_at |
| publications | form_id PK/FK -> forms; unique public_id; nullable active_version_id; composite FK ensures active version belongs to this form |
| submissions | id PK (attempt UUID); version_id FK -> form_versions; canonical request_json, created_at |
| answers | PK(submission_id, question_id); submission_id FK -> submissions; value_json scalar |

The migration in `backend/app/migrations_v3.py` defines
`FOREIGN KEY(form_id, active_version_id) REFERENCES form_versions(form_id, id)`, backed
by `UNIQUE(form_id, id)` on form_versions. This is the composite constraint described above.

One form has many draft questions and versions, one publication record, and responses
through versions. Questions have many options; submissions have many answers. Answer
question IDs refer to snapshot membership, deliberately not to mutable draft rows.
Deleting a draft question cannot erase historical answers. Whole-form deletion explicitly
removes dependent records atomically. Snapshot updates are blocked by a database trigger.
See [API overview](docs/api.md) for all draft, publication, public submission, workspace
and version-specific results routes and their validation/error contracts.
