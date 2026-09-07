# Stage 3 verification — 2026-09-07

## Automated checks actually performed

- Backend unittest discovery from backend/: 28 tests passed.
- Frontend npm test: 7 tests passed.
- npm run typecheck: passed.
- Production npm run build: passed (dynamic /f/[publicId] route plus the builder).
- Git diff whitespace check: passed; no commit/push/deployment performed.

Coverage includes fresh schema, Stage1 -> Stage3 and Stage2 -> Stage3 migration fixtures,
preserved IDs/values, incomplete draft Save versus Publish, atomic publish rollback,
immutable version triggers, draft/live isolation, stable links, V1 acceptance after V2,
unpublished rejection, wrong-form/unknown versions, duplicate/missing/unknown answers,
all eight types, invalid options/email/types, false, zero, nonfinite numbers, optional
null/blank omission, identical/conflicting/concurrent retries, simulated storage rollback,
and an unpublish write-lock check. A response remains valid after its draft question is
deleted. The process restart test starts two actual Uvicorn processes and verifies the
same stored submission acknowledgement on the second boot.

Non-failing existing warnings: Starlette's HTTPX test integration deprecation and Node's
inferred module type when importing TypeScript test helpers. An initial test invocation
from the repository root failed imports; running the documented command from backend/
resolved it. Testing found a NaN error-rendering failure; the handler now excludes raw
input values and the regression passes.

## Working data and browser checks

All forms, questions and options were captured before migration. After migration and
browser testing every original row matched by primary key and value. The existing user's
Stage2 draft had further edits (nine questions); those were preserved too. Version3 and
SQLite foreign_key_check were verified. The stage2-backup.sqlite3 is local/Git-ignored.
Only a separate Stage3 fixture was edited/published during browser tests.

Editor: http://127.0.0.1:3000/?form=d1156963-2420-4ccc-8b01-8160133d2dd6

Public: http://127.0.0.1:3000/f/7ebd0f6c-63df-4582-8e20-47b72c0faece

Through the actual in-app browser and production frontend:

- An incomplete saved form failed Publish with its invalid question selected.
- Published an unsaved editor title; the saved draft and snapshot included that exact edit.
- Copy link displayed Link copied. The Share dialog exposed the stable public URL.
- Opened V1, edited/saved the draft prompt, verified public GET still served V1, then
  republished V2 at the same link. The open respondent retained V1.
- Completed all eight controls. Required blank submission showed a field error and focused
  the input. Invalid email stayed on the question; correction advanced successfully.
- Single-line Enter advanced. Multiline Enter inserted a newline; Ctrl+Enter advanced.
  Back retained that newline/answer. Native radio ArrowDown changed choice without
  advancing; dropdown Enter opened its native menu without advancing the form.
- Entered numeric0, boolean No and rating4. Database inspection confirmed typed0/false
  and all eight answers on a submission linked to V1.
- Stopped the backend before final Submit. The UI retained answers, showed an error and
  Retry submission, and did not show thank-you. Restarted the backend and retried; matching
  acknowledgement produced the thank-you screen.
- Unpublish made a fresh public tab unavailable. Direct API calls then confirmed that
  the existing successful UUID was acknowledged and a new UUID was rejected. Exactly
  one submission existed; no duplicate rows were inserted.
- Restarted the working backend again after success: the same acknowledgement and eight
  stored answers survived. Editor preview input then left the submission count unchanged.
- Republished at the same link and used Retry on the unavailable public page; it loaded
  the current snapshot successfully.
- Desktop1280 and mobile390x844 respondent layouts were visually inspected. Mobile had
  no horizontal overflow; all rating controls and submission actions were visible.
  Temporary viewport overrides were reset.

The public fixture is left published for review; it is manual verification data, not the
assignment's later idempotent seed implementation. The original drafts remain unmodified.

## Unverified cases / remaining limitations

- Reduced-motion CSS was inspected; the tool reported the current preference as false
  and exposes no preference emulation, so reduced-motion behavior was not tested live.
- No physical-device touch/virtual-keyboard, screen-reader or cross-browser matrix was run.
- Network recovery was exercised with an unavailable backend, not a deliberately dropped
  acknowledgement AFTER commit. Backend idempotency/concurrency tests cover that retry
  contract, but the exact lost-ack browser scenario was not injected.
- Initial-load network-error rendering is implemented; the unavailable/unpublished state
  was checked live, but a separate failed initial-load network test was not performed.
- Hosted SQLite restart/redeploy persistence is unresolved. Local restart tests do not
  establish deployment persistence. No hosting resources were created.
- Respondent state is tab memory; refresh does not resume attempts. Multiple editor tabs
  remain last-save-wins. Creator APIs remain a shared demo without access isolation.

## Interview questions

1. Why link submissions to immutable snapshots instead of draft questions? Draft wording,
   options and order can change or disappear. A snapshot preserves exactly what the
   respondent answered and permits validation of an older already-open version.
2. How do you prevent duplicate submissions after a lost acknowledgement? Generate one
   attempt UUID, enforce it as the primary key, and compare the canonical request under
   the write transaction. Identical retries return the original acknowledgement; changed
   content conflicts without inserting again.
3. How is the unpublish/submission race resolved? Both take SQLite BEGIN IMMEDIATE. A new
   submission checks publication and writes all rows under that same lock. Whichever
   obtains the lock first establishes the order; successful prior retries are read first.
