# Stage 5 verification — 2026-09-07

## Scope and references actually inspected

Inspected both supplied clipboard PNGs (1918 × 898): welcome screen and the first
short-text question. The welcome screen informs colour/typography only; a simple published-title welcome was added in the correction, with no configurable editor
or recruitment copy in application defaults. Also inspected the existing
05-choice-respondent.png reference. All three named MP4 files were accessible and decoded
using the existing Playwright/Edge runtime, without installing application dependencies.
Sampled the 09:59:21 and 10:19:07 recordings across their durations and the 10:51:34
recording at 10 seconds (results screen). These were sampled, not watched end to end.

Inspected consecutive decoded frames at 100ms intervals around 142–143.1 seconds in the
10:19:07 recording: the mobile preview's existing content shifts upward and the next
content appears below, visibly progressing around 142.7–143.1 seconds. This is a grouped
preview interaction, not a frame-perfect measurement of a full-screen standalone question.
The corrected implementation uses simultaneous 600ms panel transitions, based
on that observed vertical motion. Exact original easing and reverse-navigation timing
were not established. Screenshot-only evidence is not treated as animation verification.

## Checks actually performed

- Backend unittest discovery: 36 passed; unchanged backend and schema version4.
- Existing frontend Node tests: 9 passed.
- TypeScript no-emit check and optimized production build: passed.
- Browser integration script: frontend/tests/browser/respondent.cjs, Microsoft Edge headless.
  The correction passed against the rebuilt production server on port3000.
  Uses a separate backend on port8001 and an ignored disposable SQLite database. No existing
  user draft, version, response or public link was changed. API requests are forwarded to
  that test backend by Playwright; real publication, validation and storage endpoints run.
- All eight control types completed through the public route. Stored number0 and boolean
  false were checked through the results API. Textarea Enter inserted a newline; Ctrl+Enter
  advanced. Text/email/number Enter advanced after validation.
- Required blank and invalid email could not advance; error focus returned to the answer.
  Existing unit tests also exercise invalid number/rating/options and required whitespace.
- Same-task triple click advanced exactly once. Forward exit had a negative Y transform;
  Back exit had a positive Y transform. Answers survived Back then Forward.
- Text arrows did not advance; radio ArrowDown changed its selected option; native dropdown
  ArrowDown remained within the question. A navigation-button ArrowDown used validation.
- First submission request deliberately failed at the network layer. Retry retained identical
  UUID/version/answers, succeeded against the real backend and created exactly one response.
  The thank-you screen appeared only after acknowledgement. This test fails before storage;
  existing backend tests cover successful-request idempotency and storage rollback.
- Reduced-motion navigation produced no panel animations; rapid clicks still advanced once.
- Desktop1918 × 898 and narrow390 × 844 screenshots inspected. No mobile horizontal overflow;
  bottom-right controls remained inside the viewport. Rating controls and submit remained usable.
- Builder preview exercised all eight controls; original styling remained and response count
  did not increase. Builder desktop1280 × 900 screenshot inspected.

## Visual comparison and remaining limits

At the matching1918 × 898 viewport, the question area is1080px wide, begins aroundx419
(referencex420), heading aroundy318 (referencey318), underline aroundy494 (referencey494),
and compact OK aroundy540 (referencey541). Background is#fafafa; heading/input are40px
Arial with dark neutral text. Number badge sits immediately beside the heading; progress
is a thin top line and navigation uses Lucide chevrons at the lower right.

Deliberate differences: a required marker and keyboard hint remain; focus thickens the
underline; Typeform branding is not reproduced. The missing branding means navigation
sits at the right edge rather than left of a branding block. Arial is an available fallback,
not a verified proprietary Typeform font. Long text and eight-type controls use the existing
implementation rather than copying unsupported reference question types. The final screenshots are from production and have no development indicator.

The supplied narrow reference shows a preview inside a desktop recording, not a native
390px screenshot of the standalone respondent. Mobile was checked for usability rather
than claimed pixel identity. No physical phone keyboard, touch, Safari/Firefox or screen-reader
session was tested. Forced-colour focus fallback is implemented but not visually audited.
Exact reference reverse-motion timing and all long-content/mobile-keyboard combinations
remain unverified. No API, database, publication/version or persistence rules changed.

## Interview questions

1. Why use a ref as well as moving state? A ref locks synchronously before React rerenders,
   stopping several events in one task from scheduling different question indices.
2. Why keep answers above the keyed panel? Replacing a panel for navigation must not replace
   the answer map. Stable question IDs let Back restore values regardless of visual order.
3. Why ignore arrows from native controls? Inputs need caret/number movement and select/radio
   controls need option movement. Navigation handles arrows only outside those controls.

## Correction and live preview

The original browser tab retained Stage3 UI; port3000's Node process133768 started at
16:57 before the18:09 build. A fresh headless page stayed on Loading. Restarting the
frontend against the corrected build resolved it; the existing backend/database were
not restarted or modified. This stale-output issue was separate from the unfinished
sequential animation, now replaced by simultaneous panels. The server on port3000 is
left running with the corrected production build.

Verified live URL (no API interception):
http://127.0.0.1:3000/f/7ebd0f6c-63df-4582-8e20-47b72c0faece?review=stage5-corrected

This existing form was only viewed and filled locally for screenshots, never submitted.
The successful eight-type submission test uses the separate test database. Live welcome,
short-text question and mobile long-text screenshots are under the ignored directory
.artifacts/stage5-correction/. A matching-type fixture screenshot used1918x898; settled
heading container was x419,y308.75,width1080 (visible text starts aroundy318). The fixture
asserts its position after all animations end, rather than taking a mid-animation image.

Correction browser checks also cover Start via Enter, welcome excluded from numbering,
outgoing inert/aria-hidden with a negative Forward or positive Back transform, rapid clicks,
required/invalid validation, native keyboard controls, reduced motion, one successful stored
response after a network retry, and final Next arrow disabled with zero submission requests.
Actual live animation inspection saw two simultaneous panels with opposite-signed offsets.
Focus uses preventScroll; long content scrolls inside its panel. No global page scroll or
scrollIntoView is used. All eight builder preview controls still work without submissions.

Backend tests were initially invoked from the repository root with the wrong import path;
rerunning from backend/ passed all36 tests. Frontend9 tests, typecheck, production build and
Git whitespace checks passed. Exact proprietary font/easing and physical mobile keyboard,
screen-reader and cross-browser fidelity remain unverified. The welcome's shorter published
title naturally wraps differently from the supplied long recruitment title. Review remains
open; no claim of pixel-perfect or reference-identical animation is made.

No commit, push or deployment was performed.
