from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Form(Base):
    __tablename__ = "forms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    questions: Mapped[list["DraftQuestion"]] = relationship(
        back_populates="form", cascade="all, delete-orphan",
        order_by="DraftQuestion.position",
    )


class DraftQuestion(Base):
    __tablename__ = "draft_questions"
    __table_args__ = (CheckConstraint("position >= 0"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(30))
    position: Mapped[int] = mapped_column()
    prompt: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    form: Mapped[Form] = relationship(back_populates="questions")
    options: Mapped[list["ChoiceOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan",
        order_by="ChoiceOption.position",
    )


class ChoiceOption(Base):
    __tablename__ = "choice_options"
    __table_args__ = (CheckConstraint("position >= 0"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("draft_questions.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column()
    question: Mapped[DraftQuestion] = relationship(back_populates="options")


class FormVersion(Base):
    __tablename__ = "form_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id"))
    snapshot: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String)


class Publication(Base):
    __tablename__ = "publications"
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id"), primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True)
    active_version_id: Mapped[str | None] = mapped_column(ForeignKey("form_versions.id"))


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("form_versions.id"))
    request_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String)


class Answer(Base):
    __tablename__ = "answers"
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), primary_key=True)
    question_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    value_json: Mapped[str] = mapped_column(Text)
