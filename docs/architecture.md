# Architecture

## Stage 2: implemented

One Next.js/TypeScript frontend calls one modular FastAPI application over JSON HTTP.
SQLAlchemy uses SQLite through Python's built-in driver. The default creator is shared;
there is no authentication or private workspace isolation.

Builder owns the editable definition, selected question ID and last saved JSON.
Settings, the sortable outline and preview read that same ordered questions array.
Preview owns a separate in-memory answer map keyed by question ID and a signature of
its type/options. Deleted or incompatible answers are removed. QuestionControl supplies
controlled inputs for all eight types, without API imports or submission behavior.
Previous/Next navigates the ordered preview. Preview never writes answers to the server.

Explicit Save validates locally, then PUTs the complete definition. Pydantic validates
structure before any writes. A short SQLite BEGIN IMMEDIATE transaction checks identity
ownership, reconciles questions/options by stable UUID, deletes omitted rows and assigns
positions from array order. Success is returned only after commit. Any database failure
rolls back the whole save; local unsaved edits remain available for correction/retry.
Inputs are disabled while saving. A network failure can occur after commit; retrying the
same UUIDs and PUT is safe. Multiple tabs remain last-successful-save-wins; revision
conflict detection is a future enhancement, not extra infrastructure in this stage.

## Schema and validation

| Table | Columns / relationships |
| --- | --- |
| forms | UUID id PK, title |
| draft_questions | UUID id PK, form_id FK, type, position, prompt, description, required |
| choice_options | UUID id PK, question_id FK, label, position |

Relationships cascade deletion. Foreign keys are enabled per connection. Indexes cover
parent ID plus position. IDs are independent of ordering. Existing option IDs cannot be
moved to another question. IDs cannot collide between questions/options or belong to
another form. API arrays are authoritative; clients do not supply position numbers.
SQLite uses a 10-second lock timeout and synchronous per-request sessions.

Supported types: short_text, long_text, multiple_choice, dropdown, email, number, yes_no,
rating. Multiple choice and dropdown are single-select. Rating is always integer 1–5;
no configurable rating scale, number ranges or other type settings are accepted yet.
Choice options are allowed only on the two choice types. Changing between choice types
retains options; changing to another type confirms discarding existing options, preserving
question ID, prompt, description and required. Client preview answers are not persisted.

Incomplete drafts deliberately relax Stage 1's nonblank-question rule: an empty question
list, blank prompts and blank choice labels are valid. Title remains nonblank, max160;
prompt max1000; description max2000; label max500 Unicode code points; max200 questions
and max100 options per question. UUIDs, supported types, actual boolean required values,
unique IDs and compatible options are enforced. Extra settings/fields are rejected.
Complete-question and respondent-answer validation belongs to future publication/filling.

## Migration and storage

SQLITE_PATH is absolute or relative to backend/, default data/typeform.sqlite3.
Startup runs the forward-only runner in app/migrations.py. Stage 1 is unversioned
(PRAGMA user_version=0); Stage 2 is version2. No new backend dependency is needed.

Before migrating a recognized Stage 1 database, SQLite's backup API creates
<database filename>.stage1-backup.sqlite3 beside it, unless that backup already exists.
It includes committed WAL data and is ignored by Git. With the old backend stopped,
the migration takes a write transaction, copies every question column into a replacement
table without the old unique-form/position-zero/short-text constraints, swaps the table,
adds options/indexes and checks foreign keys before committing version2. Form rows are
untouched; existing values and IDs are preserved. Failure rolls back DDL and data together.
Fresh databases use the same versioned schema; version2 startup is a no-op. Unknown
versions/unrecognized table sets fail startup without resetting data.

The API changes from singular question to questions; reload old frontend tabs.
Do not run Stage 1 against the migrated schema. There is no automatic downgrade; keep
the backup and stop the server before an explicitly planned restore. Restoring it would
lose later edits. Hosting must allow the database directory to be written during startup.

## Dependencies and references

New frontend packages: @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 and
@dnd-kit/utilities 3.2.2 for pointer/keyboard sorting; lucide-react 1.41.0 for SVG icons.
Native HTML dialogs provide the picker and discard confirmation. Plain CSS remains.

All nine PNGs were inspected in Stage 1; builder 02, picker 03 and settings 04 were
reinspected for Stage 2. Compact panels, rows, plum actions, pastel type badges and a
portrait canvas follow those references. Desktop panels scroll internally; narrow screens
stack outline/settings/preview. System sans is an approximation because no font asset was
supplied. Browser chrome and out-of-scope AI/upgrade toolbars are omitted. Recordings
were not watched; extracted PNGs are the inspected visual source and remain Git-ignored.

## Planned architecture — not implemented

- Immutable JSON snapshots in form_versions with an active published-version pointer.
- Publish validates completeness and snapshots atomically; draft edits do not alter it.
- A stable public URL opens the current version. An already-open older published version
  may submit while the form remains published. Validate that exact snapshot, reject
  unknown/unrelated versions and block submissions when unpublished.
- Submissions link to the exact version; save submission and answers in one transaction.
- Validate publication state, version ownership, question membership, duplicate answers,
  required values, types and allowed options; preserve legitimate false and zero.
- Public filling reuses controlled question inputs with its own validation/navigation.
- Results use snapshot wording/options and initially group summaries by version.
- Duplicate creates a draft with new IDs and no responses/history. Confirm form deletion.

## Unresolved deployment requirement

SQLite must use persistent storage across restarts AND redeploys. No paid hosting resource
has been created. Before deployment approval, select a persistent mount and budget, then
write a uniquely identified draft, restart, redeploy a changed build and retrieve identical
IDs/values after each. Keep database/journals under the mount; migrate where storage is
available; seed idempotently and establish a SQLite-safe backup/restore procedure. The
frontend can host separately using the API origin and configured CORS. Local restart tests
do not prove hosting persistence.
