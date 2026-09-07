# API — Stage 3

Base: http://127.0.0.1:8000. Interactive schemas: /docs. JSON requests/responses.
Creator endpoints are shared-demo endpoints, without authentication. Public endpoints need
no creator login. The frontend never directly opens the database.

| Method | Route | Contract |
| --- | --- | --- |
| GET | /api/health | Process health |
| GET | /api/forms/{form_id} | Saved draft;404 if absent |
| PUT | /api/forms/{form_id} | Atomic complete draft replacement; missing form is created |
| GET | /api/forms/{form_id}/publication | public_id, published boolean, nullable active_version_id |
| POST | /api/forms/{form_id}/publish | Draft body; atomically save, snapshot, activate; returns draft and publication |
| POST | /api/forms/{form_id}/unpublish | Empty body; deactivate and return publication state |
| GET | /api/public/{public_id} | public_id, version_id, snapshot;404 if unavailable/unpublished |
| POST | /api/public/{public_id}/submissions | Validate/store or acknowledge an identical retry |

## Draft and publish payload

```json
{
  "title": "Introductions",
  "questions": [{
    "id": "f48bcebe-191d-4cfb-83cf-f3352a678bf0",
    "type": "short_text",
    "prompt": "What is your name?",
    "description": "Your preferred name is fine.",
    "required": true,
    "options": []
  }]
}
```

Supported types: short_text, long_text, multiple_choice, dropdown, email, number, yes_no,
rating. Options contain id UUID and label; only choice types permit options. Array order
sets stored positions; omitted questions/options are deleted in the same transaction.
Title is nonblank/max160; prompt max1000; description max2000; option label max500 Unicode
code points. At most200 questions and100 options each; required must be a JSON boolean.
Duplicate, cross-form and incompatible IDs/settings are rejected. IDs cannot move options
to another question. Extra input fields are forbidden.

Draft Save allows zero questions and blank prompts/options. Publish additionally requires
at least one question, nonblank prompts, and at least TWO nonblank options on choice
questions. Choice types are single-select; rating is fixed integer1–5. Unsupported custom
settings are rejected by the draft schema. No complete-draft validation is added to Save.

Publish returns {draft: <saved draft including id>, publication: <state>}. Snapshot content
also contains schema_version, explicit positions and fixed choice/rating settings. Publish
creates a new immutable version each time, including if repeated after a lost response;
publication retries are atomic but not deduplicated. The stable public URL is /f/{public_id}
on the frontend origin. Draft Save never changes its active snapshot.

## Submission payload and acknowledgement

```json
{
  "submission_id": "1b0fc0ba-7321-4af8-b72e-5d61cfdcdb64",
  "version_id": "3d276e5d-c9a7-45cb-98a7-58d719c723da",
  "answers": [{
    "question_id": "f48bcebe-191d-4cfb-83cf-f3352a678bf0",
    "value": "Alex"
  }]
}
```

Successful first submission and identical retry both return200:

```json
{
  "submission_id": "1b0fc0ba-7321-4af8-b72e-5d61cfdcdb64",
  "version_id": "3d276e5d-c9a7-45cb-98a7-58d719c723da",
  "received_at": "2026-09-07T12:00:00+00:00"
}
```

| Type | Nonempty answer |
| --- | --- |
| short_text | JSON string, max1000 Unicode code points |
| long_text | JSON string, max10000 code points |
| email | JSON string, max254, practical ASCII local@domain.tld format |
| number | JSON number, finite and within IEEE754 finite magnitude; booleans rejected |
| multiple_choice / dropdown | One allowed option UUID string from this exact snapshot |
| yes_no | JSON true or false; strings/numbers rejected |
| rating | JSON integer1–5; booleans, strings and fractional values rejected |

Email policy checks domain labels and prohibits leading/trailing/consecutive local-part
periods; quoted local parts and internationalized addresses are outside this demo policy.
It performs no DNS or deliverability check. Client and server use the same rule.
Numbers allow decimals; JavaScript numeric precision applies in the browser.

Omitted, null and whitespace-only optional answers produce no answer row. The same values
are rejected for required questions. Zero and false are legitimate answers, never treated
as missing. At most200 answer entries; duplicate/unknown question IDs are rejected even
if the question is optional. Structured objects/arrays are not accepted as values.

A new submission must reference a known version belonging to the public form. Any older
published version remains accepted while the form is published. Unpublishing blocks new
attempts. An existing successful UUID is checked first: identical content returns its old
acknowledgement even when unpublished; changed public ID/version/values returns409.
Answer entry ordering is ignored for retry comparison; resend exact values and omission
choices. The check/state validation/inserts share one SQLite BEGIN IMMEDIATE transaction.

## Errors

- 404: draft missing or public form unavailable/unpublished.
- 409: ID ownership/integrity conflict, reused submission UUID with different content,
  or form no longer accepting new responses.
- 422: invalid payload, incomplete publication, unknown/unrelated version or invalid answers.
- 503: handled storage failure; retry. Publication/save failures roll back their transaction.

Completeness/answer errors use detail: {message, fields: {question_id: message}}. Collection
publication errors can use the questions key. Structural errors use detail: [{loc,msg,type}].
Raw values are not echoed. The respondent keeps answers, focuses known field errors and
retries the same payload/UUID after an uncertain network or server failure.
