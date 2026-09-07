# Architecture

## Stage 1: implemented

One Next.js/TypeScript frontend calls one modular FastAPI application over JSON HTTP.
SQLAlchemy uses SQLite through Python's built-in driver. No separate database service.
The assumed creator is shared; there is no authentication or private workspace isolation.

The builder owns a complete draft in React state. The settings panel and immediate preview
read the same question object. `ShortTextQuestion` owns only a temporary answer and imports
no API code. Preview has no submit action, endpoint or database table.

Explicit Save validates the client draft, then sends it to FastAPI. Pydantic checks the
complete payload before the route writes. A SQLAlchemy transaction updates the form and
question together; failure rolls back both. Success is returned only after commit.
Inputs are disabled during saving so an older response cannot overwrite newer edits.
Rejected saves keep the user's edits in memory and the prior saved database state intact.
An ambiguous network failure may happen after a commit; retrying the same PUT is safe.

Client-generated UUIDs identify the form and question independently. PUT creates a missing
form or updates an existing one, preventing duplicate creation on request retries. Existing
question IDs cannot be replaced. The saved form ID lives in the URL, so refresh loads it
from the API. Browser unload warns about unsaved edits; unsaved edits are not backed up.
Multiple tabs currently use last-successful-save-wins; conflict detection is deferred.

## Current schema

| Table | Columns / relationships |
| --- | --- |
| forms | UUID `id` PK, `title` |
| draft_questions | UUID `id` PK, unique `form_id` FK, `type`, `position`, `prompt`, `description`, `required` |

Stage 1 permits exactly one short-text question per form, at position 0. Creation and
updates keep the two rows together. The unique FK and type/position checks deliberately
enforce the authorized scope. All current forms are drafts; publication is not modeled yet.
SQLite foreign keys are enabled for each connection. Per-request sessions use short
transactions and a 10-second SQLite lock timeout. No async database layer is needed.

`SQLITE_PATH` accepts an absolute path or a path relative to `backend/`; default:
`backend/data/typeform.sqlite3`. Parent directories are created. Schema creation on startup
creates missing tables only, never drops or resets data. Introduce migrations before changing
this schema (including removing the one-question constraint); `create_all` is not migration.

## Planned architecture — not implemented

- Relational ordered draft questions and options; stable question and option IDs independent of order.
- Atomic whole-draft save. Add a revision check when introducing multi-question editing/autosave concerns.
- Immutable JSON snapshots in `form_versions`, with an active published-version pointer on forms.
- Publish validates and snapshots the draft in one transaction. Draft edits do not change the public version.
- Stable public URL resolves the current version when opened. A respondent already on an older
  published version may submit while the form remains published. Validate against that exact
  snapshot; reject unknown/unrelated versions and block all submissions when unpublished.
- Submissions link to the exact version answered. Store submission and answers in one transaction.
- Server checks publication state, version ownership, question membership, duplicate answers,
  required values, types and allowed options. Preserve legitimate `false` and `0` answers.
- Preview and respondent flow share question controls; submission behavior belongs to the public flow.
- Results use snapshot wording/options; initially group summaries by version.
- Duplicate creates a new draft with new IDs and no responses/history. Confirm destructive deletion.

## References and design decisions

All nine provided PNGs were inspected before implementing UI. Builder references 02 and 04
establish a white workspace, rounded pale-grey side panels, plum controls, blue short-text
badges, and a narrow portrait canvas. Stage 1 adapts those into question outline / live
preview / editable settings. Arial/system sans is an approximation: the screenshots do not
establish a licensed font asset. Browser chrome is excluded. Out-of-scope toolbars, AI and
upgrade actions are omitted. The workspace and share screenshots show loading states.
Source PNGs and recordings stay local and are excluded from Git.

## Unresolved deployment requirement

SQLite MUST live on persistent storage across process restarts AND redeploys. Candidate:
one FastAPI instance with a persistent disk (e.g. Render, which requires a paid service).
No hosting resource has been created. The frontend can be hosted separately; configure
its public API URL and backend CORS origins. The backend alone accesses SQLite.

Before approving deployment, verify a mount path and budget. Then write a uniquely named
draft, restart the service, redeploy a changed build, and retrieve identical IDs/values after
each step. Put the database and journals beneath the persistent mount, migrate at runtime
where storage is available, seed idempotently, and plan a SQLite-safe backup/restore procedure.
Local restart success is not proof of hosting persistence.
