"""Shared creator workspace operations. No public analytics or authentication claims."""
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select, func
from sqlalchemy.exc import SQLAlchemyError

from .forms import persist_draft, serialize
from .models import Answer, ChoiceOption, DraftQuestion, Form, FormVersion, Publication, Submission
from .schemas import DraftInput

router = APIRouter(prefix='/api/forms', tags=['workspace'])


class FormTitle(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=160)

    @field_validator('title')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Enter a nonblank title.')
        return value


def require_form(session, form_id):
    form = session.get(Form, str(form_id))
    if form is None:
        raise HTTPException(404, 'Form not found.')
    return form


@router.get('')
def list_forms(request: Request):
    with request.app.state.sessions() as session:
        counts = select(FormVersion.form_id, func.count(Submission.id).label('count')).join(
            Submission, Submission.version_id == FormVersion.id).group_by(FormVersion.form_id).subquery()
        rows = session.execute(select(Form, Publication.active_version_id, func.coalesce(counts.c.count, 0))
            .outerjoin(Publication, Publication.form_id == Form.id)
            .outerjoin(counts, counts.c.form_id == Form.id).order_by(Form.title, Form.id)).all()
        return [{'id': form.id, 'title': form.title, 'status': 'published' if active else 'draft',
                 'response_count': count} for form, active, count in rows]


@router.post('')
def create_form(body: FormTitle, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            form = persist_draft(session, str(uuid4()), DraftInput(title=body.title, questions=[]))
            result = serialize(form)
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Could not create the form. Retry.') from exc


@router.patch('/{form_id}')
def rename_form(form_id: UUID, body: FormTitle, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            form = require_form(session, form_id)
            form.title = body.title
            result = {'id': form.id, 'title': form.title}
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Rename failed. The previous title is unchanged.') from exc


@router.post('/{form_id}/duplicate')
def duplicate_form(form_id: UUID, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            source = serialize(require_form(session, form_id)).model_dump(mode='json')
            source.pop('id')
            source['title'] = source['title'][:153] + ' (copy)'
            for q in source['questions']:
                q['id'] = str(uuid4())
                for option in q['options']:
                    option['id'] = str(uuid4())
            form = persist_draft(session, str(uuid4()), DraftInput.model_validate(source))
            result = serialize(form)
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Could not duplicate the form. Retry.') from exc


@router.delete('/{form_id}')
def delete_form(form_id: UUID, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            require_form(session, form_id)
            key = str(form_id)
            versions = select(FormVersion.id).where(FormVersion.form_id == key)
            submissions = select(Submission.id).where(Submission.version_id.in_(versions))
            session.execute(delete(Answer).where(Answer.submission_id.in_(submissions)))
            session.execute(delete(Submission).where(Submission.version_id.in_(versions)))
            # Removing the publication is the explicit prerequisite for deleting history.
            session.execute(delete(Publication).where(Publication.form_id == key))
            session.execute(delete(FormVersion).where(FormVersion.form_id == key))
            questions = select(DraftQuestion.id).where(DraftQuestion.form_id == key)
            session.execute(delete(ChoiceOption).where(ChoiceOption.question_id.in_(questions)))
            session.execute(delete(DraftQuestion).where(DraftQuestion.form_id == key))
            session.execute(delete(Form).where(Form.id == key))
        return {'deleted_id': key}
    except SQLAlchemyError as exc:
        raise HTTPException(503, 'Delete failed. The form and its responses are unchanged.') from exc
