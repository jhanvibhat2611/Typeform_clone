"""Creator results always resolve wording/settings from immutable version snapshots."""
import json
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, func
from .models import Answer, FormVersion, Submission
from .workspace import require_form

router = APIRouter(prefix='/api/forms', tags=['results'])


def versions_for(session, form_id):
    rows = session.execute(select(FormVersion, func.count(Submission.id)).outerjoin(
        Submission, Submission.version_id == FormVersion.id).where(FormVersion.form_id == str(form_id))
        .group_by(FormVersion.id).order_by(FormVersion.created_at, FormVersion.id)).all()
    return [{'id': version.id, 'number': i + 1, 'created_at': version.created_at, 'response_count': count}
            for i, (version, count) in enumerate(rows)]


@router.get('/{form_id}/results')
def result_versions(form_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        form = require_form(session, form_id)
        versions = versions_for(session, form_id)
        return {'form_id': form.id, 'title': form.title, 'versions': versions,
                'response_count': sum(v['response_count'] for v in versions)}


def answer_map(session, submissions):
    values = {s.id: {} for s in submissions}
    if values:
        for answer in session.scalars(select(Answer).where(Answer.submission_id.in_(values))):
            values[answer.submission_id][answer.question_id] = json.loads(answer.value_json)
    return values


def summarize(snapshot, values):
    summaries = []
    total = len(values)
    for question in snapshot['questions']:
        present = [answers[question['id']] for answers in values.values() if question['id'] in answers]
        result = {'question': question, 'answered': len(present), 'unanswered': total - len(present)}
        kind = question['type']
        if kind in {'multiple_choice', 'dropdown'}:
            result['distribution'] = [{'value': o['id'], 'label': o['label'], 'count': present.count(o['id'])}
                                      for o in question['options']]
        elif kind in {'yes_no', 'rating'}:
            items = [(True, 'Yes'), (False, 'No')] if kind == 'yes_no' else [(i, str(i)) for i in range(1, 6)]
            result['distribution'] = [{'value': value, 'label': label, 'count': present.count(value)} for value, label in items]
        else:
            result['values'] = present
            if kind == 'number':
                result['minimum'] = min(present) if present else None
                result['maximum'] = max(present) if present else None
        summaries.append(result)
    return summaries


@router.get('/{form_id}/versions/{version_id}/results')
def version_results(form_id: UUID, version_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        require_form(session, form_id)
        version = session.get(FormVersion, str(version_id))
        if version is None or version.form_id != str(form_id):
            raise HTTPException(404, 'Version not found for this form.')
        snapshot = json.loads(version.snapshot)
        submissions = session.scalars(select(Submission).where(Submission.version_id == version.id)
            .order_by(Submission.created_at.desc(), Submission.id)).all()
        values = answer_map(session, submissions)
        return {'version_id': version.id, 'snapshot': snapshot,
                'submissions': [{'id': s.id, 'version_id': s.version_id, 'created_at': s.created_at, 'answers': values[s.id]}
                                for s in submissions], 'summaries': summarize(snapshot, values)}


@router.get('/{form_id}/submissions/{submission_id}')
def individual_response(form_id: UUID, submission_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        require_form(session, form_id)
        submission = session.get(Submission, str(submission_id))
        version = session.get(FormVersion, submission.version_id) if submission else None
        if version is None or version.form_id != str(form_id):
            raise HTTPException(404, 'Response not found for this form.')
        return {'id': submission.id, 'version_id': version.id, 'created_at': submission.created_at,
                'snapshot': json.loads(version.snapshot), 'answers': answer_map(session, [submission])[submission.id]}
