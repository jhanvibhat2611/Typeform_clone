"use client";

import { useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { answerSignature, type Question } from "../lib/drafts";
import { QuestionControl } from "./QuestionControl";

type Answers = Record<string, { signature: string; value: string }>;

export function Preview({ questions, selectedId, onSelect }: {
  questions: Question[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const inputId = useId();
  const index = questions.findIndex((q) => q.id === selectedId);
  const question = questions[index];
  // Remove deleted or incompatible answers, including when switching away and back.
  useEffect(() => {
    setAnswers((previous) => {
      const next = Object.fromEntries(Object.entries(previous).filter(([id, answer]) =>
        questions.some((q) => q.id === id && answer.signature === answerSignature(q))));
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [questions]);

  if (!question) return <div className="empty-preview">Add a question to start building your form.</div>;
  const signature = answerSignature(question);
  const answer = answers[question.id];
  const value = answer?.signature === signature ? answer.value : "";
  return (
    <>
      <div className="preview-stage">
        <div className="preview-paper">
          <div className="question-renderer">
            <span className="question-number">{index + 1}<ArrowRight size={12} /></span>
            <div className="preview-prompt" id={inputId + "-label"}>
              {question.prompt.trim() ? question.prompt : "Your question here…"}
              {question.required && <span aria-label="required"> *</span>}
            </div>
            {question.description && <p className="preview-description" id={inputId + "-description"}>{question.description}</p>}
            <QuestionControl key={question.id + signature} question={question} value={value} inputId={inputId}
              onChange={(value) => setAnswers((previous) => ({ ...previous, [question.id]: { signature, value } }))} />
          </div>
        </div>
      </div>
      <div className="preview-navigation">
        <span>Preview only · {index + 1} / {questions.length}</span>
        <button className="icon-button" aria-label="Reset preview answers" onClick={() => setAnswers({})}><RotateCcw size={16} /></button>
        <button className="icon-button" aria-label="Previous question" disabled={index === 0}
          onClick={() => onSelect(questions[index - 1].id)}><ArrowLeft size={17} /></button>
        <button className="icon-button" aria-label="Next question" disabled={index === questions.length - 1}
          onClick={() => onSelect(questions[index + 1].id)}><ArrowRight size={17} /></button>
      </div>
    </>
  );
}
