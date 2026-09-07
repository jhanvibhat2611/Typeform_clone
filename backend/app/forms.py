"""Whole-draft persistence with structural validation and atomic writes."""
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .models import ChoiceOption, DraftQuestion, Form, Publication
from .schemas import DraftInput, DraftOutput, OptionDraft, QuestionDraft

router = APIRouter(prefix="/api/forms", tags=["drafts"])


def serialize(form: Form) -> DraftOutput:
    return DraftOutput(
        id=form.id, title=form.title,
        questions=[QuestionDraft(
            id=q.id, type=q.type, prompt=q.prompt, description=q.description,
            required=q.required,
            options=[OptionDraft(id=o.id, label=o.label)
                     for o in sorted(q.options, key=lambda o: o.position)],
        ) for q in sorted(form.questions, key=lambda q: q.position)],
    )


@router.get("/{form_id}", response_model=DraftOutput)
def get_draft(form_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        form = session.get(Form, str(form_id))
        if form is None:
            raise HTTPException(404, "Draft not found. Check the URL or create a new form.")
        return serialize(form)


def check_ownership(session, form_id: str, draft: DraftInput) -> None:
    question_ids = {str(q.id) for q in draft.questions}
    option_parents = {str(o.id): str(q.id) for q in draft.questions for o in q.options}
    all_ids = question_ids | option_parents.keys()
    for question in session.scalars(select(DraftQuestion).where(DraftQuestion.id.in_(all_ids))):
        if question.id not in question_ids or question.form_id != form_id:
            raise HTTPException(409, "A question ID belongs to another form or is used as an option.")
    for option in session.scalars(select(ChoiceOption).where(ChoiceOption.id.in_(all_ids))):
        if option_parents.get(option.id) != option.question_id:
            raise HTTPException(409, "An option ID belongs to another question or is used as a question.")


@router.put("/{form_id}", response_model=DraftOutput)
def save_draft(form_id: UUID, draft: DraftInput, request: Request):
    try:
        with request.app.state.sessions.begin() as session:
            # Serialize writes before ownership reads to prevent a concurrent stale check.
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            form = persist_draft(session, str(form_id), draft)
            result = serialize(form)
        return result
    except IntegrityError as exc:
        raise HTTPException(409, "Draft conflict. Reload the saved draft before retrying.") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(503, "Save failed. Your previous saved draft is unchanged. Please retry.") from exc


def persist_draft(session, form_id: str, draft: DraftInput) -> Form:
    check_ownership(session, form_id, draft)
    form = session.get(Form, form_id)
    if form is None:
        form = Form(id=form_id, title=draft.title)
        session.add(form)
        session.flush()
        session.add(Publication(form_id=form_id, public_id=str(uuid4())))
    form.title = draft.title
    existing = {q.id: q for q in form.questions}
    ordered_questions = []
    for position, incoming in enumerate(draft.questions):
        question = existing.get(str(incoming.id)) or DraftQuestion(id=str(incoming.id))
        question.type = incoming.type
        question.position = position
        question.prompt = incoming.prompt
        question.description = incoming.description
        question.required = incoming.required
        options = {o.id: o for o in question.options}
        ordered_options = []
        for option_position, incoming_option in enumerate(incoming.options):
            option = options.get(str(incoming_option.id)) or ChoiceOption(id=str(incoming_option.id))
            option.label = incoming_option.label
            option.position = option_position
            ordered_options.append(option)
        question.options = ordered_options
        ordered_questions.append(question)
    # delete-orphan removes omitted questions/options in this same transaction.
    form.questions = ordered_questions
    session.flush()
    return form
