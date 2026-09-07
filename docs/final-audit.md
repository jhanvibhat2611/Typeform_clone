# Final assignment audit — 2026-09-08

> Checkpoint note (2026-09-08): the user subsequently authorized committing and pushing
> this documentation. Local-only/no-push statements below describe the audit before that
> authorization; its verification evidence and visual limitations are unchanged.

## Scope and evidence

The complete original [assignment](https://docs.google.com/document/d/1IAoeus50jWRmC87cwTcee-xeE5Ml59y2Pfei78HEnaA/edit)
was read through its text export, including features, evaluation criteria and deliverables.
[Requirements](requirements.md) maps every mandatory feature to implementation and evidence.
No optional feature, application behavior, dependency, schema or hosted record changed.
Only documentation and ignore rules changed. No commit, push, deployment or assignment submission.

## Checks executed in this audit

- Backend: `python -m unittest discover -s tests -q` from backend/: **40 passed**.
  Temporary databases cover migration preservation, fresh setup, atomic failures,
  publication/version validation, retry/concurrency, restart, workspace/results and seeding.
- Frontend: `npm test`: **9 passed**; `npm run typecheck`: **passed**.
- Production build was not rerun for this documentation-only change. The current frontend
  source is unchanged from the previously successful Stage 5 build recorded in its report.
- Git diff/whitespace check passed. A scan of 65 tracked/unignored files found no excluded
  runtime files or common credential patterns; no secret values were printed. This is a
  pattern-based check, not proof that all possible secrets are absent. Historical report
  bodies match HEAD after line-ending normalization; only dated annotations were added.
- Non-failing warnings: Starlette's HTTPX test-client deprecation and Node's inferred ES
  module warning. No dependency changes were made to silence them.
- Live backend health and unauthenticated frontend loaded. GitHub API confirmed a public
  repository with master as default branch. Local tracked files include frontend/, backend/
  and README; the final documentation changes are still local and need a reviewed push.
- Both live sample snapshots load: Event Registration (6 responses), Product Feedback (5).
  Their six-question snapshots collectively cover all eight types. Counts agree with the
  sum of version submissions, and every summary's answered + unanswered equals that total.
- Read-only individual-response API retrieval succeeded for both forms. Browser checks
  opened an individual response, closed it, and switched Responses / Response summary.
  The visible table preserves 0, No and Unanswered (optional). No hosted response was added.
- Browser checked both welcome screens and Start -> question one; required-empty input
  displayed its error on mobile. At 390x844 respondent and results had no document-level
  horizontal overflow. Results tables retain their own horizontal scroll region.
- Browser request interception allowed GET/HEAD/OPTIONS only. No write requests were attempted.
  The first run hit an ambiguous alert selector (Next route announcer also has role=alert);
  narrowing to .respondent-error completed the check. This was a test-selector issue.

Seed tests independently recreate both fixtures in temporary storage: two versions, ten
submissions and 55 answer rows; all eight types; zero/false/optional omissions; exact expected
option/rating summaries; second-run equality across all records; unrelated same-title data
and edited/unpublished seed forms preserved. The live Event Registration count includes one
additional response, so it should not be expected to equal the five fictional fixtures.

## Deployment evidence and limits

The user confirmed Railway root /backend, /data volume, SQLITE_PATH=/data/typeform.sqlite3,
normal Uvicorn command, frontend CORS origin and Vercel configuration documented in README.
**User-verified:** both seed forms appeared and a new response survived redeployment after
restoring the normal start command. This audit read the resulting hosted data; it did not
execute the redeployment, inspect the volume/account or run a hosted restart/restore test.
Railway credit/plan availability must be maintained for assessment. No indefinite free
hosting, uptime or backup restore guarantee is made.

Hosted CRUD, save/publish/unpublish, successful submission and network retry were deliberately
not repeated because this audit must not modify hosted records. Their implementation and
local tests are covered by the current suite and historical browser reports. No full physical
mobile keyboard, assistive-technology or cross-browser pass was executed in this audit.

## Visual comparison

Inspected original PNGs: 01-workspace, 02-builder, 08-responses and 09-summary, plus the
supplied welcome and short-text respondent screenshots. Original browser chrome is excluded
when comparing page areas: builder/workspace references have 1920x842 content below 88px
chrome; results/summary have 1918x896 below 182px chrome. Respondent reference is 1918x898.
Live captures used 1920x842 for builder and 1918x896 for results/summary; initial dashboard
and respondent captures were 1918x896, a two-pixel viewport difference from the respondent
reference. These do not establish pixel identity. Reference recordings were not replayed in
this audit; Stage 5 records earlier sampled-frame inspection. Exact original easing/timing
and reverse-motion timing remain unverified.

Concrete remaining differences:

- Builder: three panels, 346px central phone canvas and pale panel surfaces follow the
  reference. Current header is shorter, question cards and text are denser, and prompt/
  description editing lives in the settings panel. The reference's selected item is a
  configurable welcome screen; ours selects a short-text question, so settings are not an
  equivalent-state comparison. Welcome editing and decorative AI/plan controls are omitted.
- Respondent short text: approximately 1080px answer width, left edge near x419, numbered
  badge, 40px heading/input, compact OK, top line and bottom-right arrows are present.
  Description and required marker add content absent in the supplied short-text example,
  shifting the heading upward and answer/button downward within the centred block. Focus
  thickens/tints the underline and the keyboard hint adds text. Typeform branding is omitted.
  Published-title welcome preserves the approved neutral text; shorter titles wrap differently
  from the long reference title. No recruitment copy or completion-time estimate is inserted.
- Results: white table and summary cards on grey match the broad structure. Current table
  text/rows are denser; summary cards are about 1120px wide versus about 1430px in the reference,
  and text responses use a compact grid. Explicit version controls replace unavailable filter/
  analytics tooling. Search, spam, AI insights, views and completion-rate controls are omitted.
- Dashboard: the original content is a loading screen. Header/tab structure is comparable;
  **no usable loaded form-card reference exists**, so exact card fidelity cannot be assessed.
- Missing references: loaded dashboard cards, individual-response detail dialog, equivalent
  short-text builder settings state and native mobile layouts. No original font asset was supplied.

No CSS correction was made: the observed differences span density, font and state/content,
not an isolated unambiguous regression. Changing the approved UI during documentation cleanup
would need a separate visual review. The application's fidelity is approximate, not exact;
this remains an assessment risk given the brief's strong visual requirement. Local comparison
screenshots are ignored under .artifacts/final-*.png and are not repository deliverables.
Two later attempts to recapture the exact 1918x898 respondent viewport and repeat Next/Back
timed out while loading Vercel. Those follow-up checks did not complete; the successful
earlier captures/checks above remain the available evidence. Recheck live availability
before assessment; these tool timeouts alone do not establish a hosting outage.

## Final manual checklist

- Review and authorize committing/pushing this documentation cleanup; it is not yet on GitHub.
- Open both submission links in a signed-out browser shortly before assessment.
- Verify Railway credits/volume remain active; retain a SQLite-safe backup.
- Review the stated visual differences; supply missing references if exact comparison is required.
- Be ready to explain draft/snapshot separation, stable IDs, atomic saves/deletes, retry UUIDs,
  historical answer labels and idempotent seed identities. Originality and interview readiness
  require the author's own confirmation; automated checks cannot establish them.
- Submit only the public repository and live frontend links after your final approval.

No missing mandatory functional feature was identified. Exact visual equivalence and the
manual release/readiness checks above remain open; this is not a claim of rubric approval.
