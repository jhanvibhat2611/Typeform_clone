# Assignment requirements and evidence

Source: [complete original assignment](https://docs.google.com/document/d/1IAoeus50jWRmC87cwTcee-xeE5Ml59y2Pfei78HEnaA/edit).
Final audit: 2026-09-08. Implemented does not mean every interaction was re-executed on the
hosted site. Current tests use temporary/local data; hosted verification is read-only.
See [final audit](final-audit.md) for commands, limitations and concrete visual differences.

| Mandatory requirement | Implementation | Evidence and remaining limits |
| --- | --- | --- |
| Next.js/TypeScript, Python backend, SQLite; frontend/ and backend/ | Implemented; FastAPI/SQLAlchemy | Manifests, source and current typecheck/backend tests |
| Title and ordered question CRUD, drag-and-drop | Builder, SortableList, draft service | Current editor/draft tests; historical Stage 2 browser drag checks; hosted mutations not repeated |
| Eight types | Shared QuestionControl, schemas and validation | Current tests and both live snapshots cover all eight; Stage 5 browser report covers controls |
| Required toggle and descriptions | QuestionSettings and snapshot fields | Draft/publication tests; live builder inspection |
| Immediate live preview | Preview uses local definition and separate answers | Historical browser checks; no submission import/call in Preview |
| Form list, status, response counts | Dashboard and workspace queries | Live two published forms; counts 6/5 agree with all-version submissions |
| Create, rename, duplicate, delete | Workspace endpoints/dialogs; fresh duplicate IDs; atomic delete | Current workspace tests; Stage 4 browser report; no hosted CRUD in final audit |
| Publish/unpublish, stable share link | Immutable versions and separate publication pointer | Current publication tests; both live public GETs and welcome screens |
| Persist form definitions | Relational drafts and migration chain | Current draft/migration/process restart tests |
| One-question fullscreen flow, transitions, progress, keyboard | Respondent with approved welcome, paired directional panels, navigation guard | Current validation tests; Stage 5 browser motion/keyboard report; final live Start and mobile required error; exact reference timing unverified |
| Client/server validation | Shared frontend rules, Pydantic and exact-snapshot server validation | Current tests cover types, required, options, wrong versions, zero/false and invalid requests |
| Persist submissions, thank-you after success; no login | Transactional submissions/answers, public route | Current tests and historical success/retry browser checks; live read-only no-login access |
| Responses list/table and individual full response | Results and snapshot-based detail | Current results tests; final hosted table/dialog/API inspection |
| Basic per-question summaries | Explicit version-specific distributions/text/numeric values | Current two-version tests; live summary totals; 0/No/unanswered rendered distinctly |
| Typeform-like modals, inline editing, notifications/toasts | Builder/workspace/share/confirmation dialogs | Source and historical stage browser checks; final visual review remains approximate |
| Theme and thank-you placeholders | Accessible Coming Soon settings | Live builder and source inspected |
| Seed a couple of published mixed forms with responses | Explicit app.seed, two forms, five fictional submissions each | Four current seed tests: exact summaries, all types, idempotency, preserved edits/unrelated data; both live samples present |
| README setup, stack, architecture, schema, API, assumptions | README and architecture/API documents finalized for this checkpoint | Compared against current models, migrations, routes and manifests; included in the authorized documentation checkpoint |
| Public GitHub repository | Existing public repository, master | Unauthenticated GitHub API confirmed public; source directories and README tracked locally |
| Hosted working application | Vercel frontend + Railway backend/volume | Live reads succeeded; user verified response survived redeploy; account/volume/restart not independently exercised |
| Strong reference visual fidelity | Reference-inspired implementation | Concrete gaps in final audit; exact match is not established |
| Original work and ability to explain every line | Author responsibility | Cannot be certified by automated tests; final interview/manual review required |

The default shared creator is allowed by the brief: creator APIs have no authentication or
private isolation. Incomplete drafts are intentional; publication requires completeness.
Multiple choice/dropdown are single-select with at least two nonblank options; rating is 1–5.
Older published snapshots accept submissions while the form remains published. Preview never
stores responses. Dashboard counts include all versions; summaries explicitly select one.

## Optional and outside completed scope

Branching/logic jumps, custom themes, CSV export, partial responses/completion rates,
file uploads and dark mode are optional and not implemented. Integrations, team management,
payment/upload features may be mocked under the brief; no implementation was added.
Marketing homepage, AI generation and configurable welcome editor are outside the agreed scope.
No remaining optional feature is treated as a submission blocker.

## Historical evidence

[Stage 1](stage-1-verification.md), [Stage 2](stage-2-verification.md),
[Stage 3](stage-3-verification.md), [Stage 4](stage-4-verification.md),
[Stage 5](stage-5-verification.md), [seeding](seeding-verification.md).
Their original results are retained with dated supersession notes. New final evidence does
not retroactively convert earlier unverified checks into executed checks.
