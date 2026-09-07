> Historical report. Note added 2026-09-08: later release, seeding and hosting status is
> recorded in [the final audit](final-audit.md). Original checks and limitations below
> are preserved; stage-specific pending/no-deploy statements describe that stage only.

# Stage 4 verification — 2026-09-07

## Automated checks performed

- Backend unittest discovery: 36 tests passed, including all Stage1–3 tests.
- Frontend npm test: 9 tests passed.
- TypeScript check and optimized production build: passed.
- Git diff whitespace check: passed. No commit, push or deployment performed.

New tests cover create/rename and reload, nonblank title validation, duplication of the
saved draft with fresh IDs/no history/no responses, independent edits, deletion scoped
to one form, rollback of every table on simulated delete failure, all-version counts,
V1/V2 wording and option labels, removed questions, unanswered optional values, zero,
false, rating distribution, empty results, cross-form result ownership, and snapshot
immutability while unpublished. A dedicated version3 fixture verifies every existing
table's rows survive the trigger migration. Fresh setup traverses the full migration chain.

Existing non-failing warnings remain: Starlette/HTTPX test integration deprecation and
Node's inferred module type when importing TypeScript test helpers.

## Working database preservation

Captured all seven tables before startup. After migration, every row and value matched
exactly, including version snapshot JSON, public IDs, submissions and answers. Rechecked
all original rows after browser CRUD tests; none changed. SQLite reports user_version4
and foreign_key_check is clean. The stage3-backup.sqlite3 file and local verification
artifacts remain Git-ignored. Every dashboard count was reconciled with a direct count of
stored submissions joined through form_versions.

## Actual browser checks

Used the in-app browser against the local FastAPI backend and production Next.js build.

- Root / loads the workspace; original /?form= URLs still open the builder.
- Created Stage 4 browser check using the title modal; its empty draft persisted.
- Builder Results opened the empty-results page; Forms navigation returned to the dashboard.
- Theme and Thank-you screen placeholders were exposed with Coming Soon and aria-disabled.
- Renamed to Stage 4 results review and refreshed; title/status/count persisted.
- Duplicated via the dashboard; copy showed Draft and0 responses. API inspection confirmed
  fresh IDs, no publication versions, and independent edits. The original stayed unchanged.
- A disposable copy was published and given a test response to exercise full deletion.
  Cancel retained it; Confirm deleted it and its history/response. Refresh showed it gone;
  unrelated forms and responses remained intact. Success notifications appeared.
- The review fixture has two versions with changed question/option wording and one removed
  optional question. Dashboard shows2 responses across versions; each version has1.
- Selected V1 explicitly, opened its individual response, and saw Original team / Design,
  numeric0, No for false, rating4, and Optional notes: Unanswered (optional).
- V1 summary showed Design1/Engineering0, No1/Yes0, numeric min/max0, rating4 count1 with
  the other buckets0, and one unanswered optional question.
- Switched to V2: Updated department / Product design replaced the wording only in V2;
  the removed optional question was absent. V1 remained readable.
- Desktop1280 workspace and summary layouts inspected. Mobile390x844 response table had
  a350px viewport and1540px scrollable contents, while document width remained390px.
  Keyboard ArrowRight moved the table scrollLeft from0 to40. Mobile summary cards were
  visually inspected; the page remained usable. Viewport overrides were reset.
- Results network failure and retry recovery were exercised by briefly stopping/restarting
  the local backend. Existing database data persisted through restart.

Review workspace: http://127.0.0.1:3000/

Review results: http://127.0.0.1:3000/forms/709ec3f5-5de8-4366-9132-d7b99ca17e4b/results

The retained review fixture is manual verification data, not repeatable sample seeding.
No original user form was renamed/deleted or used for destructive testing.

## References and unverified cases

Workspace01 contains only a usable header/navigation; its content is loading, so card layout
is an adaptation. Responses08 and Summary09 supplied usable table/card layouts. No separate
individual-response reference was supplied; that modal follows existing dialog styling.

No physical-device touch/virtual-keyboard, cross-browser or screen-reader audit was run.
The fully empty dashboard state is implemented but was not checked live by clearing the
user's database; fresh/empty backend and no-version results states were tested. Not every
mutation failure was injected through the UI; deletion rollback was tested automatically.
Results are unpaged for assignment-scale data. No views/completion rates are fabricated.
Repeatable sample seeding, hosted persistence and final deployment remain next-stage work.

## Interview questions

1. Why do dashboard counts span versions but summaries select one? Total counts describe
   all submissions to the form. Summary labels/configuration can change between versions,
   so combining them silently could give misleading option/question statistics.
2. Why is duplication a new identity graph? Fresh form/question/option IDs keep edits
   independent and prevent linking the copy to the original's publication or responses.
3. How can immutable snapshots coexist with deleting a form? Snapshot updates always
   fail. Whole-form deletion explicitly removes the publication first, permitting history
   deletion under the same transaction; any error restores every related row.
