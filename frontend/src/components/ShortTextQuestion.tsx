"use client";

import { useId, useState } from "react";
import type { Question } from "../lib/drafts";

/** Presentation-only control: it has no API client and cannot persist an answer. */
export function ShortTextQuestion({ question }: { question: Question }) {
  const inputId = useId();
  const [answer, setAnswer] = useState("");
  return (
    <div className="question-renderer">
      <span className="question-number">1 <span aria-hidden="true">→</span></span>
      <label className="preview-prompt" htmlFor={inputId}>
        {question.prompt || "Your question goes here"}{question.required && <span aria-label="required"> *</span>}
      </label>
      {question.description && <p className="preview-description" id={`${inputId}-help`}>{question.description}</p>}
      <input
        id={inputId} className="preview-answer" type="text" placeholder="Type your answer here…"
        value={answer} onChange={(event) => setAnswer(event.target.value)}
        required={question.required} aria-describedby={question.description ? `${inputId}-help` : undefined}
        autoComplete="off"
      />
    </div>
  );
}
