# Focused UI fidelity verification — 2026-09-08

## Changes and boundaries

No backend code, schema, migrations, API contracts, publication rules or stored user data changed.
No new dependencies. The existing transition direction, lock, answer map, validation and retry
services remain in place. Submission success still requires the matching server acknowledgement.
The initial review was left uncommitted. The user subsequently authorized this reviewed UI
work and the bounded question-sizing correction for commit and push to the existing branch.

- Respondent: responsive vertical padding avoids forcing short questions to scroll at shorter
  viewports; long panels retain internal scrolling. Welcome enters subtly over 380 ms without
  delaying data loading. Reduced motion disables that entrance, and outgoing welcome content
  does not replay it during the existing question transition.
- ChoiceDropdown: controlled select-only combobox/listbox replaces native dropdowns in both
  respondent and preview. Arrows/Home/End and typeahead move the active option; Enter/Space
  selects, Escape cancels, Tab exits. Focus stays on the trigger with aria-activedescendant;
  selected state and errors are announced. Optional selections can be cleared. List scrolling
  does not scroll the surrounding question. Disabled/inert controls cannot change answers.
- Long text begins with one row, grows to 240 px including borders, then scrolls internally;
  resize handles are removed. Width changes recalculate its height.
- Success: larger check icon, one wider heading, acknowledgement text and a Create a form
  link to the local workspace. No recruitment text or invented timing estimate.
- Builder: centred Content/Workflow/Connect/Share/Results navigation; all Save/New/Publish/
  Unpublish actions retained; wider side panels, compact phone preview, more readable cards,
  Design placeholder and Endings area using the existing Coming Soon thank-you setting.
- Dashboard: workspace sidebar, actual total responses, compact form list and local title
  search. Existing create/rename/duplicate/delete/results handlers are retained. No quota,
  invented date or completion percentage. Unsupported controls say Coming Soon.
- Results: centred top navigation, clearer page heading, roomier rows, purple distributions
  and wider summary cards. Version selection remains explicit; raw UUID is removed from the
  main caption and is available under a collapsed identifier disclosure in response details.

## References and visual evidence

Inspected all ten supplied screenshots (first five Typeform, last five the app). Sampled
Screen Recording 2026-09-08 021426.mp4 across its 76.2-second duration, then sampled 35–39 seconds
to distinguish the actual post-submit acknowledgement from the preceding submit message.
This was sampled-frame inspection, not an end-to-end viewing or exact easing measurement.

Fresh Edge/Playwright sessions used 1918x898 CSS pixels, deviceScaleFactor=1 and verified
visualViewport.scale=1 (100% zoom). The earlier short-text reference has the same viewport.
The supplied builder/dashboard/results images have slightly varying crops/heights; compare
width/alignment directly and account for those crop differences. The user subsequently confirmed
both original and clone were at 100% zoom; original zoom is user-verified, while local automated
viewport measurements are agent-verified. Motion, dropdown and the updated success screen were
approved by the user.

Final short-text reference fixture: heading x=419, y=309.875, width=1080 at 1918x898. The seeded
short question had scrollHeight=clientHeight=898, so no unnecessary panel scrolling. Description
and required text differ from the reference, affecting vertical placement. Builder phone is
306x544 with approximately 20.5% side panels. Desktop and mobile screenshots were inspected.

Ignored local evidence under .artifacts/:
- fidelity-recording.png and fidelity-success-reference.png: sampled recording contact sheets.
- fidelity-after-dashboard.png, fidelity-after-builder.png, fidelity-after-respondent.png,
  fidelity-after-results.png and fidelity-after-summary.png: updated layouts.
- fidelity-dropdown.png, fidelity-mobile-dropdown.png, fidelity-mobile-long-text.png,
  fidelity-mobile-long-question.png and fidelity-success.png: control/success checks.
- fidelity-mobile-results.png: narrow results layout.

The supplied app screenshots are the before evidence. Early new screenshot attempts hit browser
crashes/Windows paging-memory exhaustion and one local CORS configuration issue; they were not
accepted as visual verification. The completed captures use the running production frontend
and correctly configured disposable backend. No hosted records were used for mutation checks.

## Checks actually performed

- Frontend unit tests: 9 passed. TypeScript check passed. Production build passed.
- Existing respondent browser regression updated for the custom dropdown: all eight types,
  required/invalid values, error focus, Enter/multiline editing, forward/back retention,
  rapid navigation, outgoing inert content, reduced motion, preview isolation, failed-network
  retry with identical payload and exactly one stored response passed.
- New fidelity browser suite: desktop 100% zoom, short panel without scrolling, 30-option
  listbox, End/typeahead/Tab/clear, mobile listbox, long-text growth/internal scrolling,
  access to controls below long content, real acknowledged success link and reduced-motion
  welcome passed. All writes target .artifacts/fidelity-review.sqlite3 on localhost:8001.
- Narrow workspace and builder had no horizontal page overflow; individual response dialog
  and summary navigation passed, and purple chart screenshots were inspected.
- Git whitespace check passed. Backend source and manifests are unchanged; backend tests
  were not repeated for this frontend-only pass.

To repeat from the repository root, start a disposable backend on 8001 with
FRONTEND_ORIGINS=http://127.0.0.1:3001 and SQLITE_PATH pointing to a disposable absolute file.
Build/start the frontend on 3001 with NEXT_PUBLIC_API_URL=http://127.0.0.1:8001. With an existing
Playwright installation and Edge (no application dependency was added):

```powershell
$env:PLAYWRIGHT_MODULE = '<absolute path to the installed playwright package>'
node frontend/tests/browser/respondent.cjs
node frontend/tests/browser/fidelity.cjs
```

The scripts create test forms/responses. Never point them at hosted or personal data.

## Local review and remaining gaps

### Bounded release check

At 1920x898 and 100% zoom, the final short-text answer measures 1080 px wide; question and
input text measure 40 px. The OK button now measures exactly 88x60 px (previously 90.47x60).
The focused underline retains its 2 px border with a 1 px focus shadow instead of 3 px;
forced-colour focus remains supported. Welcome/success sizing, mobile sizing and motion
were not changed by this correction. The desktop screenshot was inspected after rebuilding.

Re-ran all 9 frontend unit tests, TypeScript, production build and both disposable-local
browser suites successfully. The respondent suite now asserts these desktop dimensions.
Checks cover all eight controls, validation, answer retention, rapid navigation, network
retry, reduced motion and mobile/long-content scrolling. No seed command was run and no
hosted records were changed. Git whitespace and staged-file exclusion checks passed.

Review workspace: http://127.0.0.1:3001/
Sample respondent: http://127.0.0.1:3001/f/b334d341-f495-5c00-bbe5-adbe1427e4d5
Backend: http://127.0.0.1:8001/docs
The running frontend is a production build of these local changes, backed by disposable data;
review/test forms may appear alongside the two seeded samples. Existing user databases are intact.

Exact proprietary font and original easing, physical mobile keyboards and assistive-technology
behavior across browsers remain unverified. This pass follows the now-usable workspace reference;
individual-response and native-mobile reference screens are still missing. Reference quota banners,
AI recommendations, plan actions, analytics/filter tooling and configurable welcome settings are
intentionally absent or honest placeholders. The UI is closer, not claimed pixel-perfect.
