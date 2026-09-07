from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    question: Mapped["DraftQuestion"] = relationship(
        back_populates="form", cascade="all, delete-orphan", uselist=False
    )


class DraftQuestion(Base):
    __tablename__ = "draft_questions"
    __table_args__ = (
        CheckConstraint("type = 'short_text'", name="stage_one_question_type"),
        CheckConstraint("position = 0", name="stage_one_question_position"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    form_id: Mapped[str] = mapped_column(
        ForeignKey("forms.id", ondelete="CASCADE"), unique=True
    )
    type: Mapped[str] = mapped_column(String(30), default="short_text")
    position: Mapped[int] = mapped_column(default=0)
    prompt: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    form: Mapped[Form] = relationship(back_populates="question")
