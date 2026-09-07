> Historical report. Note added 2026-09-08: later release, seeding and hosting status is
> recorded in [the final audit](final-audit.md). Original checks and limitations below
> are preserved; stage-specific pending/no-deploy statements describe that stage only.

# Stage 1 verification — 2026-09-07

## Checks actually performed

- Inspected all nine supplied PNG references before writing UI. Compared the rendered
  desktop builder against the panel shapes, spacing, palette, badge and portrait canvas
  in references 02 and 04. Typography is an approximation with system sans-serif.
- `python -m unittest discover -s tests -v`: **10 tests passed**. Coverage includes:
  retry-safe creation, updates with stable IDs, validation boundary cases, missing/extra
  fields, invalid UUIDs, unrelated question IDs, uniqueness rollback, simulated commit
  failure, fresh app/engine reads, no submission tables/endpoints, and real process restart.
- The process test starts two separate Uvicorn servers in sequence against the same
  environment-configured temporary database, verifies the first process exits and its port
  closes, then checks identical IDs and values after the second startup. An initial Windows
  launcher cleanup issue was fixed by requesting graceful server shutdown through stdin.
- Final `npm.cmd run build`: **passed**, including static page generation.
- Final `npm.cmd run typecheck`: **passed**.
- Initial npm install audit reported **0 vulnerabilities** in the installed dependency tree.
- Browser: edited title, question prompt, description and required toggle; the outline and
  preview updated before saving. Observed unsaved, saving (inputs disabled), and saved states.
- Browser: saved a draft, received its stable URL, refreshed, and verified saved values and
  required state. SQLite inspection confirmed one form row and its unchanged question ID.
- Browser: entered a preview answer and pressed Enter. SQLite rows were unchanged and no
  submission table existed. Refresh cleared the preview answer and retained the saved draft.
- Browser: whitespace-only question prompt produced inline validation and the not-saved state.
- Browser plus SQLite: held a temporary SQLite write lock, attempted a valid save, observed
  the server-error message with edits retained, and confirmed the database still held the
  previous description. Released the lock and retried successfully using the same IDs.
- Browser: checked the 390px narrow layout; found and fixed a header overlap, rebuilt, and
  verified the two-row header. Reset the browser viewport afterward.
- Git: `git check-ignore` confirmed reference PNGs, MP4 recordings, SQLite data and
  dependencies are ignored. `git ls-files` confirmed references/recordings are not tracked.

Browser attachment initially timed out; it later recovered and the browser checks above
were completed. Those early timeouts were not counted as successful UI verification.

## Review fixture

One local draft named **Stage 1 review** was created through the UI and retained for review:
http://127.0.0.1:3000/?form=12252174-f674-4a7f-bff8-096794fc9793

This is local test data, not the required future published-form seed set. The SQLite file is
ignored by Git. The backend tests use their own temporary databases.

## Remaining limits

- No hosted persistence/redeploy test: no hosting resources were created.
- No multi-tab revision protection; last successful save wins.
- No real creator authentication. This is a shared demo.
- No automated browser regression suite or pixel-diff suite. Browser checks were performed
  using the connected browser; desktop and one narrow width were inspected.
- The current Starlette test client emits a non-failing HTTPX deprecation warning. Tests
  pass with the pinned versions; revisit its test transport during a future dependency update.
- All stages beyond the single short-text draft remain unimplemented. See `requirements.md`.

## Interview questions

1. **Why save the form and question in one transaction?** A save must represent one consistent
   draft. If either write or the commit fails, rollback preserves the previous form and question.
2. **Why use UUIDs instead of question positions as identity?** Reordering must not change
   which question an edit or future answer refers to. The current ID is stable across saves;
   ordering can change independently in later stages.
3. **How is preview prevented from creating submissions?** Its answer is local component
   state. The question component imports no API client, and this stage has no submission
   endpoint or table. Definition saves contain only the draft's editable fields.
