"use client";

import { useLayoutEffect, useRef } from "react";
import { ChoiceDropdown } from "./ChoiceDropdown";
import { Star } from "lucide-react";
import type { Question } from "../lib/drafts";

export type PreviewAnswer = string;

// Controlled inputs can later be reused by the respondent flow. No network access.
export function QuestionControl({ question, value, onChange, inputId, error }: {
  question: Question; error?: string; value: PreviewAnswer; onChange: (answer: PreviewAnswer) => void; inputId: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;
    const grow = () => {
      element.style.height = 'auto';
      const style = getComputedStyle(element);
      const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      element.style.height = Math.min(element.scrollHeight + borders, 240) + 'px';
    };
    grow();
    window.addEventListener('resize', grow);
    return () => window.removeEventListener('resize', grow);
  }, [value, question.type]);
  const common = {
    id: inputId, value, required: question.required,
    "aria-labelledby": inputId + "-label",
    "aria-invalid": Boolean(error),
    "aria-describedby": [question.description ? inputId + "-description" : "", error ? inputId + "-error" : ""].filter(Boolean).join(" ") || undefined,
  };
  if (question.type === "multiple_choice" || question.type === "yes_no" || question.type === "rating") {
    const options = question.type === "yes_no" ? [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] :
      question.type === "rating" ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) })) : question.options;
    return <div role="radiogroup" aria-labelledby={inputId + "-label"}
      aria-required={question.required} aria-invalid={Boolean(error)} aria-describedby={common["aria-describedby"]} className={question.type === "rating" ? "rating-control" : "choice-control"}>
      {options.map((option, index) => <label key={option.id} className={"choice-answer" + (value === option.id ? " checked" : "")}>
        <input type="radio" name={inputId} value={option.id} checked={value === option.id}
          aria-invalid={Boolean(error)} aria-describedby={common["aria-describedby"]}
          aria-label={option.label || "Choice " + (index + 1)} onChange={() => onChange(option.id)} />
        {question.type === "rating" ? <Star size={24} fill={Number(value) >= index + 1 ? "currentColor" : "none"} /> :
          <span className="choice-letter">{String.fromCharCode(65 + index % 26)}</span>}
        <span>{option.label || "Choice " + (index + 1)}</span>
      </label>)}
      {options.length === 0 && <p className="empty-hint">Add choices to preview this question.</p>}
    </div>;
  }
  if (question.type === "dropdown") {
    return <ChoiceDropdown question={question} value={value} onChange={onChange} inputId={inputId} error={error}/>;
  }
  if (question.type === "long_text") {
    return <textarea ref={textarea} {...common} className="preview-answer long-answer" rows={1}
      placeholder="Type your answer here…" onChange={(event) => onChange(event.target.value)} />;
  }
  return <input {...common} className="preview-answer"
    type={question.type === "email" ? "email" : question.type === "number" ? "number" : "text"}
    step={question.type === "number" ? "any" : undefined}
    placeholder={question.type === "email" ? "name@example.com" : "Type your answer here…"}
    autoComplete="off" onChange={(event) => onChange(event.target.validity.badInput ? "invalid-number" : event.target.value)} />;
}
