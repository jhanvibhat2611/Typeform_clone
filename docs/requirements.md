# Assignment roadmap

Source: https://docs.google.com/document/d/1IAoeus50jWRmC87cwTcee-xeE5Ml59y2Pfei78HEnaA/edit

Only Stage 1 is authorized. A checked item is implemented; this is not a claim that the full assignment is complete.

## Stage 1

- [x] Next.js/TypeScript frontend and FastAPI/SQLAlchemy/SQLite backend in separate directories.
- [x] Create a form with a title and one stable-ID short-text question.
- [x] Edit prompt, description and required setting.
- [x] Reference-based three-panel builder with immediate live preview.
- [x] Explicit Save with unsaved, saving, saved and error states.
- [x] Save/load API; values and IDs persist in a configurable SQLite file.
- [x] Client/server save validation; atomic save and rollback on failure.
- [x] Preview answers remain in memory and cannot create submissions.
- [x] README, architecture notes and this checklist.
- [x] References and recordings excluded from Git.

## Required later stages — await authorization

- [ ] Add/edit/delete questions and drag-and-drop reordering with stable IDs.
- [ ] Long text, multiple choice, dropdown, email, number, yes/no, rating.
- [ ] Per-type settings and shared reusable question controls.
- [ ] Forms list with draft/published status and response counts.
- [ ] Complete management: rename, duplicate and delete forms (create/title editing exist in Stage 1).
- [ ] Publish/unpublish, immutable versions and a stable shareable public link.
- [ ] No-login public filling: full-screen one-at-a-time flow, transitions, keyboard navigation, progress.
- [ ] Client/server respondent validation, atomic persisted submissions, thank-you screen.
- [ ] Responses list, individual response view and per-question summaries.
- [ ] Typeform-like modals, inline editing, toasts and theme/thank-you settings placeholders.
- [ ] Seed at least two published mixed-type forms with existing responses without overwriting user data.
- [ ] Complete README: setup, stack, architecture, schema, API overview and assumptions.
- [ ] Public GitHub repository (only when requested).
- [ ] Hosted working application with verified persistent SQLite across restarts and redeploys (only when requested).
- [ ] Final visual/interaction comparison, original code and interview readiness.

## Optional — wait until required scope works

- [ ] Branching / logic jumps.
- [ ] Custom themes.
- [ ] CSV export.
- [ ] Partial-response tracking / completion rate.
- [ ] File uploads.
- [ ] Dark mode.

Integrations/webhooks, collaboration and payment/upload questions may remain placeholders.
Real creator authentication may be simplified to a default creator; document shared-demo limits.
Marketing homepage and AI form generation are not required and are outside the roadmap.
