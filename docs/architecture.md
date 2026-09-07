# Architecture — Stage 3

One Next.js/TypeScript frontend calls one modular FastAPI application. SQLAlchemy uses
SQLite through Python's built-in driver. No additional dependency or service was added
in Stage 3. Creator access remains a shared demo with no login or private workspace.

## Drafts and publication

Builder owns the draft definition and explicit Save states. QuestionControl is a controlled
renderer shared by Preview and Respondent. Preview has its own temporary answer map and
never imports or calls submission functions. Respondent owns navigation, validation,
answers and the attempt UUID independently of the editor.

Draft PUT accepts incomplete forms: empty question lists and blank prompts/choice labels.
Title remains nonblank. Stable question/option IDs are independent of their array order.
The shared persist_draft service reconciles definitions and relational positions inside
its caller's transaction, including omitted-row deletions and ownership checks.

Publish POST receives the current editor payload, not just a request to publish whatever
was last saved. Structural and completeness validation precede writing. BEGIN IMMEDIATE
locks the SQLite writer; one transaction saves that exact draft, inserts a new immutable
snapshot and changes the active publication pointer. Failure rolls back all three.
Ordinary draft Save never changes the active version. Republish creates a new version;
unpublish clears only the pointer. The public UUID and link remain stable.

Published forms need at least one question, nonblank prompts and, for either choice type,
at least two nonblank options. Multiple choice and dropdown are single-select. Rating is
fixed to integer1–5. Snapshot JSON includes schema_version=1, title/form ID, every common
question field, stable option IDs/labels, array order plus explicit positions, and frozen
choice/rating settings. SQLite triggers reject updates/deletes of version rows. This stage
has no version pruning or form deletion workflow.

## Schema

| Table | Fields / purpose |
| --- | --- |
| forms | id UUID PK, title; editable draft title |
| draft_questions | id PK, form_id FK, type, position, prompt, description, required |
| choice_options | id PK, question_id FK, label, position |
| form_versions | id PK, form_id FK, snapshot JSON text, UTC created_at; immutable |
| publications | form_id PK/FK, unique public_id, nullable active_version_id |
| submissions | id UUID PK, version_id FK, canonical request_json, UTC created_at |
| answers | composite PK(submission_id, question_id), submission FK, typed value_json |

A composite publication foreign key ensures its active version belongs to the same form.
Answer question IDs intentionally do not reference editable draft rows: deleting a draft
question must not invalidate a response to a published snapshot. Membership is checked
against the exact snapshot before insertion. JSON scalars preserve string/number/boolean
types. Missing optional answers have no answer row. Required, type and option validation
is server authoritative. See [API documentation](api.md) for limits and examples.

## Submission transaction and retries

The public route GET resolves the active snapshot once. The respondent retains that exact
version ID while navigating, even if V2 is published later. New submissions to an older
version remain valid while the form is published; unknown/unrelated versions are rejected.
Unpublished forms reject new submissions.

For each attempt the browser generates one submission UUID at first submission and reuses
it on retries. Within BEGIN IMMEDIATE the server first looks up that UUID. An identical
canonical request returns the original acknowledgement even after unpublishing; changed
content returns409. This check never inserts another row. For a new UUID, the same locked
transaction checks publication status/version ownership, validates all answers, and inserts
the submission plus every answer before a single commit. Unpublish uses the same writer
lock, giving these actions a defined order. The primary key also enforces uniqueness.

Canonical requests include public ID, version ID and submitted values, with answers sorted
by question ID. Answer entry order does not affect retry identity. Missing versus explicit
null/blank entries, different whitespace, or numeric JSON representation may change retry
identity even when storage normalizes omission. Clients should resend the same payload.
The canonical request is retained for exact conflict checks; it contains response data and
must receive the same privacy/backup treatment as answers.

After network/5xx uncertainty, the UI freezes the submitted payload and offers retry. It
never assumes failure means nothing committed. Definite422/409 rejection retains answers
and permits correction/retry. A thank-you screen requires the matching server acknowledgement.
Attempt/answers live only in tab memory; refreshing starts a new attempt and may discard
answers after the unload warning. There is no resume link or partial-response persistence.

## Migration and deployment

The original transactional 0 -> 2 migration is retained. Stage 3 adds a forward-only 2 -> 3
migration in migrations_v3.py: back up through SQLite's backup API, create four tables,
indexes/immutability triggers, allocate public IDs for existing forms and record version3.
All existing draft columns/rows remain untouched. The backup is
<database filename>.stage2-backup.sqlite3 beside the configured file; an existing backup
is never overwritten. Fresh setup runs both migrations. Repeat startup is a no-op; unknown
versions fail without resetting data. No automatic downgrade exists.

Stop the prior backend before upgrading; use the same SQLITE_PATH. It is absolute or
relative to backend/, default data/typeform.sqlite3. Foreign keys are enabled on every
connection; the lock timeout is10 seconds. Keep backups and the database directory writable.
Restoring an old backup requires a deliberate stopped-server procedure and loses later data.

Hosting persistence is unresolved. Before deployment approval, choose a persistent mount
and budget, then create a draft/submission, restart, redeploy a changed build, and retrieve
identical IDs/values after each. Keep database/journals under the mount and establish a
SQLite-safe backup/restore procedure. No paid resource or deployment was created.

## UI references and limits

Builder/picker/settings PNGs were inspected in earlier stages. Stage 3 reinspected the
choice respondent, thank-you and share PNGs. The share reference contains only a loading
screen; its dialog follows existing panel/plum-button styles. The respondent uses a quiet
full-screen canvas, prominent wording, choice cards, progress and plum actions. System
sans approximates the typography; no licensed font asset was supplied. Recordings were
not watched; the extracted PNGs are the inspected source and remain excluded from Git.

Single-line Enter advances; multiline Enter inserts a newline and Ctrl+Enter advances.
Native select/radio keys and text editing shortcuts are left to their controls. Back keeps
answers. Transitions use CSS with a prefers-reduced-motion override. Field errors associate
with the controls and focus the relevant answer. Narrow screens retain vertical scrolling
for long questions/options rather than clipping content.

Multiple creator tabs still use last-successful-save-wins. Results, form-list management,
seeds and deployment remain later stages. Future results must use snapshot wording/options
and group summaries by version. A duplicate should receive new IDs and no response history.
