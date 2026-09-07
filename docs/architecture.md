# Architecture

One Next.js/TypeScript frontend calls one modular FastAPI application. SQLAlchemy uses
SQLite through Python's built-in driver. No additional dependency or service was added
in Stage 4. Creator access remains a shared demo with no login or private workspace.

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
fixed to integer 1–5. Snapshot JSON includes schema_version=1, title/form ID, every common
question field, stable option IDs/labels, array order plus explicit positions, and frozen
choice/rating settings. SQLite always rejects snapshot updates. Deletion is permitted only after the publication
record has been removed, as part of confirmed whole-form deletion. Standalone history
deletion remains blocked, including for unpublished forms.

## Workspace and results

Root / renders Dashboard; /?form={id} keeps the existing Builder. Per-form results live at
/forms/{form_id}/results. Forms breadcrumbs use normal navigation, preserving the existing
browser unload warning for unsaved edits. No new dependencies or infrastructure were added.

Workspace API listing joins forms/publications with counts of submissions across ALL
versions. Create persists an empty draft via the existing service. Rename modifies only
the draft title and does not mutate snapshots. Duplicate serializes the current saved draft,
allocates fresh form/question/option IDs, then saves it atomically as an unpublished form
with a fresh public ID and no history/responses. Titles gain a bounded ' (copy)' suffix.

Confirmed Delete warns that responses and public access will be removed. Its BEGIN IMMEDIATE
transaction deletes answers, submissions, publication, versions, options, questions and the
form in foreign-key order. The publication's removal is the database trigger prerequisite
for deleting snapshots. Any failure rolls back every row. Other forms are unaffected.
This is a permanent delete, not archive/soft delete; prior submission acknowledgements are
also removed. A submit and delete are serialized by the same SQLite writer lock.

Results metadata returns explicit versions and per-version response counts. The selected
version endpoint returns its snapshot, submissions/answers and calculated summaries. An
individual response endpoint checks form ownership and returns its own snapshot even when
questions/options later change or disappear. Display helpers resolve labels from that
snapshot and test key presence, preserving 0/false and distinguishing optional omissions.

Summaries include answered/unanswered counts, all configured option buckets (including zero
counts), Yes/No and fixed 1–5 rating distributions, text/email values and numeric minimum/
maximum. No summaries mix versions, and no views/completion-rate data is invented. Tables
scroll horizontally inside their region; summary cards use the reference's white-on-grey
layout. The latest version is selected initially and the selector/UUID make that explicit.
Results currently load one version's full response set; pagination is deferred for demo scale.

Theme/thank-you settings are focusable aria-disabled placeholders labelled Coming Soon.
Dashboard mutations provide status toasts, dialogs and retry/error states. User confirmation
is required by the UI for delete; the API is a shared creator API, not a permission boundary.

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
content returns 409. This check never inserts another row. For a new UUID, the same locked
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
never assumes failure means nothing committed. Definite 422/409 rejection retains answers
and permits correction/retry. A thank-you screen requires the matching server acknowledgement.
Attempt/answers live only in tab memory; refreshing starts a new attempt and may discard
answers after the unload warning. There is no resume link or partial-response persistence.

## Migration and deployment

The original transactional 0 -> 2 migration is retained. Stage 3 adds a forward-only 2 -> 3
migration in migrations_v3.py: back up through SQLite's backup API, create four tables,
indexes/immutability triggers, allocate public IDs for existing forms and record version 3.
All existing draft columns/rows remain untouched. The backup is
<database filename>.stage2-backup.sqlite3 beside the configured file; an existing backup
is never overwritten. Fresh setup runs these migrations followed by Stage 4 below. Repeat startup is a no-op; unknown
versions fail without resetting data. No automatic downgrade exists.

Stop the prior backend before upgrading; use the same SQLITE_PATH. It is absolute or
relative to backend/, default data/typeform.sqlite3. Foreign keys are enabled on every
connection; the lock timeout is 10 seconds. Keep backups and the database directory writable.
Restoring an old backup requires a deliberate stopped-server procedure and loses later data.

Railway is configured with a /data persistent volume and SQLITE_PATH=/data/typeform.sqlite3.
The user reports a response survived redeployment with the normal Uvicorn command restored.
This is user-verified evidence; the final audit only performed live read-only checks.
See README for exact deployment/seed commands, credit dependence and backup limitations.

Stage 4 retains all prior migration code and adds 3 -> 4 in migrations_v4.py. It creates
<database filename>.stage3-backup.sqlite3 and transactionally replaces only the snapshot
DELETE trigger. No tables, row values, IDs or public links are rewritten. Updates remain
unconditionally blocked. Unpublished forms still have publication records and retain their
protected history. Fresh databases traverse the full chain; schema version is now 4.

## UI references and limits

Builder/picker/settings PNGs were inspected in earlier stages. Stage 3 reinspected the
choice respondent, thank-you and share PNGs. The share reference contains only a loading
screen; its dialog follows existing panel/plum-button styles. The respondent uses a quiet
full-screen canvas, prominent wording, choice cards, progress and plum actions. System
sans approximates the typography; no licensed font asset was supplied. The final audit inspected extracted PNGs; historical recording/frame inspection is
recorded in stage-5-verification.md. Exact original animation timing remains unverified.

Single-line Enter advances; multiline Enter inserts a newline and Ctrl+Enter advances.
Native select/radio keys and text editing shortcuts are left to their controls. Back keeps
answers. Transitions use CSS with a prefers-reduced-motion override. Field errors associate
with the controls and focus the relevant answer. Narrow screens retain vertical scrolling
for long questions/options rather than clipping content.

Stage 4 reinspected workspace01, responses08 and summary09. The workspace content is a
loading screen: only its header/navigation is usable, so form-card placement is an adaptation.
Responses and summary references contain usable table/card layouts. No AI/integration,
performance or views controls were added.

Multiple creator tabs still use last-successful-save-wins. Explicit seeding and hosting
are now in place; dated stage reports remain historical evidence, not current release status.


## Stage 5 respondent presentation

Only Respondent.tsx and public-scoped CSS alter application behavior. The shared
QuestionControl component and all backend contracts are unchanged. Index -1 represents
the welcome screen, which renders the published snapshot title and neutral introductory
text. It is never part of the question array, validation or answer map. Start/Enter moves
to index 0. No settings, API fields or database migrations were added.

moveTo holds a synchronous ref lock, then mounts the outgoing and incoming viewport
panels in the same render. Both translate together over 600 ms with identical easing;
Forward moves up and Back down. The outgoing panel is inert and aria-hidden with distinct
control IDs, and preserves its previous internal scroll offset. Each active panel starts
at its own scroll origin; no scrollIntoView is used. Focus waits until movement ends and
uses preventScroll. Unmount cancels both animations. Reduced motion replaces movement
with a 350 ms repeated-click guard. Answer state lives above both panels, keyed by question
ID. Validation runs before advancing. Only the explicit OK/Submit/retry action or applicable
text Enter shortcut can submit; navigation arrows never submit or retry. Existing UUID,
inFlight guard, snapshot ownership and submission transaction rules remain unchanged.


## Explicit repeatable demo seeding

app.seed is a command module, never a startup hook or API route. UUIDv5 identities use a
fixed namespace plus semantic fixture keys. Existing Form IDs are skipped entirely; titles
are not identifiers. This preserves all user edits, unpublication, extra responses and
history. Deleted seed forms can be recreated only by a subsequent explicit command.

publish_in_session and submit_in_session in publication.py are shared by HTTP handlers
and the seed command. HTTP handlers retain their BEGIN IMMEDIATE transaction and error
mapping. Seeding acquires one BEGIN IMMEDIATE lock for both fixtures and all responses;
an error rolls back all new records. The service functions retain snapshot completeness,
ownership, allowed-answer validation, fingerprinting and answer normalization. A seed
may supply an internal deterministic version ID; that is not an added API field. All
relational definitions, published snapshots, public links and answers are persisted through
SQLAlchemy. No dependency, table or schema-version change was needed. The CLI runs the
existing migrations, then writes only missing seed identities. Initial timestamps are
actual seed time and are never rewritten on repeat. Results remain ordinary versioned
results queries. Railway execution must occur inside the deployed backend container to
reach its /data volume; local environment injection alone cannot access remote files.
