"""Immutable publication and retry-safe submission endpoints."""
import json
import math
import re
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from .forms import persist_draft, serialize
from .models import Answer, FormVersion, Publication, Submission
from .schemas import DraftInput

router = APIRouter(tags=['publication'])
EMAIL = re.compile(r'^[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$')


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def now():
    return datetime.now(timezone.utc).isoformat()


def publication_state(publication):
    return {'public_id': publication.public_id, 'active_version_id': publication.active_version_id,
            'published': publication.active_version_id is not None}


def complete_draft(draft):
    errors = {}
    if not draft.questions:
        errors['questions'] = 'Add at least one question before publishing.'
    for q in draft.questions:
        if not q.prompt.strip():
            errors[str(q.id)] = 'Enter a question prompt.'
        if q.type in {'multiple_choice', 'dropdown'}:
            if len(q.options) < 2 or any(not o.label.strip() for o in q.options):
                errors[str(q.id)] = 'Add at least two choices with nonblank labels.'
    if errors:
        raise HTTPException(422, {'message': 'Complete the form before publishing.', 'fields': errors})


@router.get('/api/forms/{form_id}/publication')
def get_publication(form_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        publication = session.get(Publication, str(form_id))
        if publication is None:
            raise HTTPException(404, 'Save or publish the form first.')
        return publication_state(publication)


@router.post('/api/forms/{form_id}/publish')
def publish(form_id: UUID, draft: DraftInput, request: Request):
    complete_draft(draft)
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            form = persist_draft(session, str(form_id), draft)
            saved = serialize(form)
            snapshot = saved.model_dump(mode='json')
            snapshot['schema_version'] = 1
            for position, q in enumerate(snapshot['questions']):
                q['position'] = position
                q['settings'] = ({'selection': 'single'} if q['type'] in {'multiple_choice', 'dropdown'} else
                                 {'min': 1, 'max': 5, 'step': 1} if q['type'] == 'rating' else {})
                for option_position, option in enumerate(q['options']):
                    option['position'] = option_position
            version = FormVersion(id=str(uuid4()), form_id=form.id, snapshot=canonical(snapshot), created_at=now())
            session.add(version)
            session.flush()
            publication = session.get(Publication, form.id)
            publication.active_version_id = version.id
            result = {'draft': saved.model_dump(mode='json'), 'publication': publication_state(publication)}
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Publication failed. Saved draft and live version are unchanged. Retry.') from exc


@router.post('/api/forms/{form_id}/unpublish')
def unpublish(form_id: UUID, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            publication = session.get(Publication, str(form_id))
            if publication is None:
                raise HTTPException(404, 'Form not found.')
            publication.active_version_id = None
            result = publication_state(publication)
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Could not unpublish. Retry.') from exc


@router.get('/api/public/{public_id}')
def public_form(public_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        publication = session.scalar(select(Publication).where(Publication.public_id == str(public_id)))
        if publication is None or publication.active_version_id is None:
            raise HTTPException(404, 'This form is unavailable or no longer published.')
        version = session.get(FormVersion, publication.active_version_id)
        return {'public_id': publication.public_id, 'version_id': version.id, 'snapshot': json.loads(version.snapshot)}


class AnswerInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    question_id: UUID
    value: StrictStr | StrictBool | StrictInt | StrictFloat | None

    @field_validator('value')
    @classmethod
    def bounded_value(cls, value):
        if isinstance(value, str) and len(value) > 10000:
            raise ValueError('Answer exceeds 10000 characters.')
        if type(value) in {int, float} and (abs(value) > 1.7976931348623157e308 or (isinstance(value, float) and not math.isfinite(value))):
            raise ValueError('Number must be finite.')
        return value


class SubmissionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    submission_id: UUID
    version_id: UUID
    answers: list[AnswerInput] = Field(max_length=200)

    @model_validator(mode='after')
    def unique_questions(self):
        ids = [a.question_id for a in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate question IDs are not allowed.')
        return self


def validate_answers(snapshot, incoming):
    questions = {q['id']: q for q in snapshot['questions']}
    supplied = {str(a.question_id): a.value for a in incoming}
    errors = {key: 'Question does not belong to this version.' for key in supplied if key not in questions}
    normalized = {}
    for key, q in questions.items():
        value = supplied.get(key)
        # Omitted/null/blank optional answers have no relational answer row.
        if value is None or (isinstance(value, str) and not value.strip()):
            if q['required']:
                errors[key] = 'Please answer this question.'
            continue
        kind = q['type']
        error = None
        if kind in {'short_text', 'long_text', 'email'}:
            limit = 10000 if kind == 'long_text' else 1000 if kind == 'short_text' else 254
            if not isinstance(value, str) or len(value) > limit:
                error = f'Enter text of at most {limit} characters.'
            elif kind == 'email' and (not EMAIL.fullmatch(value) or '..' in value.split('@')[0] or value.startswith('.') or '.@' in value):
                error = 'Enter a valid email address.'
        elif kind == 'number':
            if type(value) not in {int, float} or not math.isfinite(value):
                error = 'Enter a finite number.'
        elif kind == 'yes_no':
            if type(value) is not bool:
                error = 'Choose Yes or No.'
        elif kind == 'rating':
            if type(value) is not int or not 1 <= value <= 5:
                error = 'Choose an integer rating from 1 to 5.'
        elif kind in {'multiple_choice', 'dropdown'}:
            if not isinstance(value, str) or value not in {o['id'] for o in q['options']}:
                error = 'Choose an available option.'
        if error:
            errors[key] = error
        else:
            normalized[key] = value
    if errors:
        raise HTTPException(422, {'message': 'Check your answers.', 'fields': errors})
    return normalized


def acknowledgement(submission):
    return {'submission_id': submission.id, 'version_id': submission.version_id,
            'received_at': submission.created_at}


@router.post('/api/public/{public_id}/submissions')
def submit(public_id: UUID, body: SubmissionInput, request: Request):
    payload = body.model_dump(mode='json')
    payload['answers'].sort(key=lambda answer: answer['question_id'])
    fingerprint = canonical({'public_id': str(public_id), **payload})
    try:
        with request.app.state.sessions.begin() as session:
            # This is also the lock acquired by publish/unpublish: state check and insert
            # have a single serialization point. Successful retries are checked first.
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            existing = session.get(Submission, str(body.submission_id))
            if existing:
                if existing.request_json != fingerprint:
                    raise HTTPException(409, 'This submission ID was already used with different content.')
                return acknowledgement(existing)
            publication = session.scalar(select(Publication).where(Publication.public_id == str(public_id)))
            if publication is None or publication.active_version_id is None:
                raise HTTPException(409, 'This form is no longer accepting responses.')
            version = session.get(FormVersion, str(body.version_id))
            if version is None or version.form_id != publication.form_id:
                raise HTTPException(422, 'Unknown or unrelated form version.')
            answers = validate_answers(json.loads(version.snapshot), body.answers)
            submission = Submission(id=str(body.submission_id), version_id=version.id,
                                    request_json=fingerprint, created_at=now())
            session.add(submission)
            session.flush()
            for question_id, value in answers.items():
                session.add(Answer(submission_id=submission.id, question_id=question_id, value_json=canonical(value)))
            session.flush()
            result = acknowledgement(submission)
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Could not store your response. Keep your answers and retry.') from exc
