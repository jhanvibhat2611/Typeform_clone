from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

QuestionType = Literal[
    "short_text", "long_text", "multiple_choice", "dropdown",
    "email", "number", "yes_no", "rating",
]


class OptionDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    label: str = Field(max_length=500)


class QuestionDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    type: QuestionType
    prompt: str = Field(max_length=1000)
    description: str = Field(max_length=2000)
    required: StrictBool
    options: list[OptionDraft] = Field(max_length=100)

    @model_validator(mode="after")
    def compatible_options(self):
        if self.type not in {"multiple_choice", "dropdown"} and self.options:
            raise ValueError("Only multiple choice and dropdown questions may have options.")
        return self


class DraftInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    questions: list[QuestionDraft] = Field(max_length=200)

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Form title must not be blank.")
        return value

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [question.id for question in self.questions]
        ids.extend(option.id for question in self.questions for option in question.options)
        if len(ids) != len(set(ids)):
            raise ValueError("Question and option IDs must be unique throughout the draft.")
        return self


class DraftOutput(DraftInput):
    id: UUID
