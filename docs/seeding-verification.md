# Demo seeding verification

Implemented for review; no hosted database, live local database or deployment was modified.
No commit/push was performed. All writes used temporary SQLite databases during tests.

## Checks performed

- Full backend unittest discovery from backend/:40 tests passed (36 existing +4 seed tests).
- Fresh command invocation with SQLITE_PATH and `python -m app.seed` succeeded twice in
  separate Python processes: first created both samples, second skipped both.
- Two published forms, two versions, ten submissions and55 relational answer rows.
- Dashboard each reports Published and5 responses; public endpoints serve valid snapshots.
- All eight types covered; snapshots retain order. Event workshop counts2/2/1, guests min0
  and max2, Yes/No counts3/2, accessibility question2 omissions. Product rating1–5 counts
  0/1/1/2/1, feature counts2/1/2, improvement1 omission and contact email2 omissions.
- Existing same-title unrelated form and response remained unchanged in every table.
- Rerun compared every row in all seven tables, including timestamps/snapshots/fingerprints:
  no changes. Edited seed title, deletion of draft questions and unpublication also survived.
- An invalid email in the second fixture rolled back BOTH newly seeded forms and all their
  responses while preserving unrelated records. Foreign-key check passed on the CLI database.
- Existing publication/retry/concurrency/migration/rollback tests passed after extraction of
  caller-transaction service functions. No HTTP contract or schema change.

Frontend code is unchanged; no frontend/browser/build rerun was needed for this backend-only
stage. Hosted URLs were supplied by the user, not verified by modifying or seeding them.
Railway SSH vs local run/shell instructions were checked against official Railway docs.
The actual Railway service IDs, container cwd/interpreter and /data mount have not been
inspected; README tells the operator how to select/verify them before seeding.

## Interview questions

1. Why not match by title? Titles are editable and non-unique. Fixed UUID identities let
   reruns recognize only owned fixtures while preserving unrelated same-title forms.
2. Why one transaction? Identity checks and all fixture writes share a writer lock; partial
   failure cannot leave a half-seeded form that a later run would mistake for a complete one.
3. Why reuse submission validation? Fixtures must obey the same snapshot and answer rules
   as respondents; results then demonstrate real persisted behavior instead of mock counts.
