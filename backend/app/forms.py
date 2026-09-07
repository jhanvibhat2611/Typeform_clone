"""The only write operation in Stage 1 is an atomic draft save."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .models import DraftQuestion, Form
from .schemas import DraftInput, DraftOutput, QuestionDraft

router = APIRouter(prefix="/api/forms", tags=["drafts"])


def serialize(form: Form) -> DraftOutput:
    question = form.question
    return DraftOutput(
        id=form.id,
        title=form.title,
        question=QuestionDraft(
            id=question.id, type=question.type, prompt=question.prompt,
            description=question.description, required=question.required,
        ),
    )


@router.get("/{form_id}", response_model=DraftOutput)
def get_draft(form_id: UUID, request: Request):
    with request.app.state.sessions() as session:
        form = session.get(Form, str(form_id))
        if form is None:
            raise HTTPException(404, "Draft not found. Check the URL or create a new form.")
        return serialize(form)


@router.put("/{form_id}", response_model=DraftOutput)
def save_draft(form_id: UUID, draft: DraftInput, request: Request):
    # Client-generated UUIDs make retrying the same create/save safe: PUT is idempotent.
    try:
        with request.app.state.sessions.begin() as session:
            form = session.get(Form, str(form_id))
            if form is None:
                form = Form(id=str(form_id), title=draft.title)
                form.question = DraftQuestion(
                    id=str(draft.question.id), type="short_text", position=0
                )
                session.add(form)
            elif form.question.id != str(draft.question.id):
                raise HTTPException(409, "The question ID does not belong to this draft.")

            form.title = draft.title
            form.question.prompt = draft.question.prompt
            form.question.description = draft.question.description
            form.question.required = draft.question.required
            session.flush()
            result = serialize(form)
        # The context manager commits before a success response can be returned.
        return result
    except IntegrityError as exc:
        raise HTTPException(409, "Draft conflict. Reload the saved draft before retrying.") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(503, "Save failed. Your previous saved draft is unchanged. Please retry.") from exc
