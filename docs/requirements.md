# Assignment roadmap

Source: https://docs.google.com/document/d/1IAoeus50jWRmC87cwTcee-xeE5Ml59y2Pfei78HEnaA/edit

Stage 2 is implemented for review. Checked items are implemented, not a claim that the
full assignment is complete. Further stages require authorization.

## Completed through Stage 2

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
- [x] Public GitHub repository exists with the reviewed Stage 1 checkpoint.

## Required later stages — await authorization

- [ ] Forms list with draft/published status and response counts.
- [ ] Complete form management: rename, duplicate and delete (builder title editing/create exist).
- [ ] Publish/unpublish, publication completeness validation, immutable versions and shareable link.
- [ ] No-login public filling: one-at-a-time flow, transitions, keyboard navigation, progress.
- [ ] Client/server respondent validation and atomic persisted submissions; thank-you screen.
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
