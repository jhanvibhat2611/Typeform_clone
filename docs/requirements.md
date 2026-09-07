# Assignment roadmap

Source: https://docs.google.com/document/d/1IAoeus50jWRmC87cwTcee-xeE5Ml59y2Pfei78HEnaA/edit

Stage 3 is implemented for review. Checked items are implemented, not a claim that the
full assignment is complete. Further stages require authorization.

## Completed through Stage 3

- [x] Next.js/TypeScript frontend and modular FastAPI/SQLAlchemy/SQLite backend.
- [x] Create a draft, edit its title, explicit Save with unsaved/saving/saved/error states.
- [x] Save/load through API; configurable SQLite path and backend restart persistence.
- [x] Preserve Stage 1 form/question IDs and values through a transactional migration.
- [x] Add/select/edit/delete questions and pointer/keyboard drag-and-drop reorder.
- [x] Eight types: short text, long text, multiple choice, dropdown, email, number, yes/no, rating.
- [x] Relational options with stable IDs; add/edit/delete/reorder choices.
- [x] Prompt, description and required per question; confirmed discard on incompatible type change.
- [x] Single-select choices and fixed rating1–5 assumptions documented.
- [x] Atomic whole-draft saves and structural client/server validation, rollback on failure.
- [x] Incomplete/empty drafts permitted, nonblank title retained; length limits enforced.
- [x] Reference-based three-panel builder, picker/confirmation dialogs, proper SVG icons.
- [x] Immediate ordered preview with reusable eight-type controls and separate temporary answers.
- [x] Preview cannot create submissions; unsaved-change warning retained.
- [x] README, schema/API/architecture notes, tests and verification record.
- [x] References, recordings, databases, secrets and generated outputs excluded from Git.
- [x] Public GitHub repository exists with reviewed Stage 1 and Stage 2 checkpoints.

- [x] Immutable complete snapshots, separate publication state and stable public UUID/link.
- [x] Atomic publish of current editor contents; unpublish/republish at the same link.
- [x] Share dialog and copy-link feedback; draft Save leaves live version unchanged.
- [x] Publication completeness validation including at least two nonblank choice options.
- [x] No-login public one-question flow, transitions, progress, back/next and keyboard behavior.
- [x] Shared controls with separate respondent validation, field errors and retained answers.
- [x] Reduced-motion CSS and responsive respondent layout (see verification limits).
- [x] Exact-version server validation; older versions accepted while still published.
- [x] Atomic persisted submissions/relational answers and confirmed thank-you screen.
- [x] Retry UUID uniqueness, identical acknowledgements and conflicts for changed content.
- [x] Existing successful retries acknowledged after unpublish; new attempts blocked.
- [x] Stage 1/2 migration preservation, restart persistence, rollback and retry tests.
- [x] Dedicated API documentation and updated setup/architecture.

## Required later stages — await authorization

- [ ] Forms list with draft/published status and response counts.
- [ ] Complete form management: rename, duplicate and delete (builder title editing/create exist).
- [ ] Responses list, individual responses and per-question summaries.
- [ ] Remaining Typeform-like inline editing, toasts and theme/thank-you settings placeholders.
- [ ] Seed at least two published mixed-type forms with existing responses idempotently.
- [ ] Final README coverage and completed visual/interaction comparison.
- [ ] Publish reviewed remaining stages to the repository only when requested.
- [ ] Hosted application with SQLite persistence proven across restarts AND redeploys.
- [ ] Final assignment review and interview readiness.

## Optional — wait until required scope works

- [ ] Branching / logic jumps.
- [ ] Custom themes.
- [ ] CSV export.
- [ ] Partial-response tracking / completion rate.
- [ ] File uploads.
- [ ] Dark mode.

Integrations/webhooks, collaboration and payment/upload questions may remain placeholders.
Real creator authentication may be simplified to a default creator with shared-demo limits.
Marketing homepage and AI form generation are not required and are outside the roadmap.
