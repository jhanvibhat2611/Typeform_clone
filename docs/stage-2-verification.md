# Stage 2 verification — 2026-09-07

## Automated checks performed

- Backend: python -m unittest discover -s tests -v — 16 tests passed.
  Includes all eight types, complete round trips, question/option positions, additions,
  deletions, incomplete/empty drafts, duplicate/cross-form IDs, invalid settings/types,
  length limits, option ownership, injected commit failure rollback, fresh setup,
  legacy migration, migration rollback, unknown version rejection and two real Uvicorn
  processes verifying persistence after restart.
- Frontend: npm test — 5 passed: incomplete drafts/title, common fields on type change,
  deleting selected questions/empty selection, preview compatibility and Unicode/IDs.
- npm run typecheck — passed.
- npm run build — optimized production build passed, including TypeScript checking.
- Non-failing warnings: Starlette warns about the installed HTTPX integration's future
  deprecation; Node's TypeScript test import warns that package module type is inferred.
  These did not cause test/build failures.

## Working database migration

Before startup migration, all existing forms/questions were captured locally. After
migration and browser checks, every original row was compared by primary key and was
identical, including prompt, description, required, title and IDs. The original draft is
12252174-f674-4a7f-bff8-096794fc9793. SQLite user_version is2 and foreign_key_check is clean.
The backup exists at backend/data/typeform.sqlite3.stage1-backup.sqlite3. Test artifacts,
working database and backup remain local and Git-ignored.

## Actual browser checks

Used the running FastAPI server and a production Next.js build through the in-app browser.
A separate Stage 2 review draft was created; the original user's draft was not edited.
Review URL: http://127.0.0.1:3000/?form=93a045c2-1c24-48ca-bf05-1cc4926646b4

- Created all eight types through the picker; edited prompts/descriptions/required;
  added choice options, saved and reloaded. All eight types and settings persisted.
- Pointer drag moved a question from third to first and an option from third to first.
  Keyboard sorting also moved a question and option. Saved/reloaded order was checked
  in the UI and directly against stored explicit positions.
- Deleted an option and verified persisted remaining order (Third choice, Second choice).
- Changed multiple choice to dropdown: retained options and reset the preview answer.
- Changed a choice question to short text: Cancel retained content; Discard removed
  options and preserved the prompt. The in-page confirmation was exercised both ways.
- Deleted the only selected question, saved an empty form and reloaded it; then added
  new questions successfully. Neighbor selection also has a frontend unit test.
- Entered an answer into all eight controls, used Previous/Next and checked retained
  answers when returning. Reset cleared them. The database dump hash was unchanged
  across a further answer/reset interaction; the database has only definition tables.
- Visually inspected the compact three-panel builder at1280px width. At1920x842
  (reference app viewport excluding browser chrome), document dimensions equaled the
  viewport: no whole-page overflow. Wide screenshot capture was cropped by the browser
  tool, so this is geometry verification rather than a pixel-perfect comparison.
- At390x844, the outline/settings/preview stacked; settings and preview controls remained
  reachable, and there was no horizontal overflow. Vertical page scrolling is intentional
  on narrow screens. Temporary viewport overrides were reset.

## Limits and remaining work

No real-device touch test, cross-browser matrix or screen-reader audit was performed.
Migration and atomic failure paths are tested on local SQLite; hosted restart/redeploy
persistence is still unresolved. Publication completeness/answer validation, submissions,
results and the remainder of the assignment are not implemented. Multiple tabs still use
last-successful-save-wins. Stage 1 verification remains a historical record; this stage
intentionally changes its one-question/nonblank-prompt rules.

## Interview questions

1. Why preserve IDs independently of order? An ID represents a question/option's identity;
   position represents presentation order. Reordering changes positions without replacing
   rows, losing selection, or breaking future version/answer references.
2. How does an atomic draft save prevent partial updates? Validate structure first, take
   one transaction, check ownership and reconcile every row/order, then commit once. Any
   failure rolls back additions, edits and deletions together.
3. Why allow incomplete drafts but validate publication later? Editing is incremental:
   blank questions and empty forms are useful intermediate states. Structural checks keep
   stored definitions safe; publication will require a complete answerable snapshot.
