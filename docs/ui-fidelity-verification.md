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

## Follow-up: desktop display-scale reproduction

The prior DPR-1 measurements were correct but insufficient: a 1280x600 CSS viewport at
devicePixelRatio 1.5 produces a 1920x900 screenshot at 100% browser zoom. On the actual public
route this reproduced the supplied oversized screenshot: 1080 CSS-pixel underline becomes
1620 image pixels, 40 px text becomes 60, and the 88x60 button becomes 132x90. Computed CSS
zoom was 1 and settled transforms were none on the question and its ancestors. The winning
fixed-pixel respondent rules caused the mismatch; no stale build is needed to reproduce it.
This is an agent-reproduced configuration, not an independent reading of the user's OS setting.

Desktop text-question dimensions now use a bounded viewport-relative CSS length at their
source. At 1920 CSS pixels they retain their original targets; at 1280 CSS pixels they use
720 px width, approximately 26.67 px text and 58.67x40 px OK, producing the target 1080/40/88x60
image dimensions at DPR 1.5. No CSS zoom, page scaling, device-detection JavaScript or motion
changes. Mobile rules, choice/dropdown screens, builder, results, welcome and success stay
unchanged. Descriptions and question spacing use the same length; long content still scrolls.

The read-only regression covers public routes at 1920x900/DPR 1, 1280x600/DPR 1.5 and
390x844/DPR 1, checking computed styles, rectangles, centering and scrolling. Run with an
existing short-text-first published form; every non-GET/HEAD request is blocked:

```powershell
$env:TEST_PUBLIC_URL = 'http://127.0.0.1:3001/f/<existing-public-id>'
node frontend/tests/browser/respondent-sizing.cjs
```

The first production rebuild passed; a subsequent rebuild hit Windows VirtualAlloc memory
exhaustion. The review frontend was paused to free memory before retrying successfully.
All 9 frontend tests, typecheck, final production build and the three read-only sizing cases
passed. A sandboxed browser retry timed out; the same read-only check passed outside the
network sandbox. Desktop screenshots were inspected, including the reproduced DPR-1.5 case.
No forms were
republished or seeded; styling requires only a frontend deployment.

## Builder typography-only follow-up

The original builder was not accessible: admin.typeform.com redirected to login. Its rendered
font family and weight therefore remain unverified; no identification was made from screenshots.
DevTools CSS.getPlatformFontsForNode confirmed our former navigation/cards used ArialMT at 400,
and Pages/Endings resolved CSS weight 600 to Arial-BoldMT. Helvetica and generic sans-serif were
declared fallbacks, not the fonts used for those sampled labels.

Builder chrome now self-hosts the unmodified Open Sans variable font as an approximate alternative,
with regular 400 labels/cards/controls and true medium 500 headings/actions. DevTools confirmed
OpenSansRoman-Medium was actually rendered for Pages, with no Arial Bold substitution. The
SIL OFL 1.1 license and source attribution are included in frontend/public/fonts. Unsupported
glyphs retain the documented fallback stack; exact glyph coverage beyond sampled English is
not claimed. No new package dependency or runtime third-party font request is needed.

Only builder font-family/weight rules changed. Preview and public respondent retain Arial;
respondent dimensions, motion, results and application behavior are untouched. Nine frontend
tests, typecheck and production build passed. Read-only browser checks verified font loading,
400/500 weights, inherited control fonts, card containment and no horizontal page overflow at
1920, 1280 and 390 CSS pixels. Desktop/mobile screenshots were inspected; existing two-line
question-card truncation remains intentional. Original font matching remains approximate.

## Bounded builder sizing correction

Measured the production builder at 1280x600 CSS pixels / DPR 1.5 (1920x900 screenshot).
The source 64 px toolbar and 306 px preview produced 96 and 459 image pixels. Builder-only
bounded viewport lengths now produce a 72 px toolbar and approximately 305 px preview,
centered in the canvas. Toolbar top moved from 120 to approximately 98 image pixels;
preview top from 252 to approximately 206 (the supplied reference is near 196). Pages,
Endings and card text now render near 20 image pixels with smaller card padding.

Inspected .artifacts/builder-sizing-after.png from the production build. All 9 frontend
tests, typecheck, production build and whitespace check passed. The current font family
and weight rules are unchanged. Only builder layout rules changed; public respondent,
dropdown implementation, motion, thank-you screen, backend and stored records are untouched.
Narrow layouts retain responsive preview width and the existing larger text/card treatment.
Preview text wraps within its narrower paper; no additional cosmetic changes were made.
