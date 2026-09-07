from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


class QuestionDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["short_text"]
    prompt: str = Field(min_length=1, max_length=1000)
    description: str = Field(max_length=2000)
    required: StrictBool

    @field_validator("prompt")
    @classmethod
    def nonblank_prompt(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question prompt must not be blank.")
        return value


class DraftInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=160)
    question: QuestionDraft

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Form title must not be blank.")
        return value


class DraftOutput(DraftInput):
    id: UUID
