"use client";

import { Plus, Trash2 } from "lucide-react";
import { isChoice, questionTypes, typeLabels, type DraftErrors, type Question, type QuestionType } from "../lib/drafts";
import { QuestionTypeIcon } from "./QuestionTypeIcon";
import { SortableList } from "./SortableList";

export function QuestionSettings({ question, disabled, errors, onChange, onTypeChange }: {
  question: Question; disabled: boolean; errors: DraftErrors;
  onChange: (question: Question) => void; onTypeChange: (type: QuestionType) => void;
}) {
  const update = (changes: Partial<Question>) => onChange({ ...question, ...changes });
  return (
    <fieldset className="settings-fields" disabled={disabled}>
      <legend className="sr-only">Question settings</legend>
      <h2>Answer</h2>
      <label className="answer-type"><QuestionTypeIcon type={question.type} />
        <select aria-label="Question type" value={question.type}
          onChange={(event) => onTypeChange(event.target.value as QuestionType)}>
          {questionTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
        </select>
      </label>
      <div className="setting-field">
        <label htmlFor="question-prompt">Question prompt</label>
        <textarea id="question-prompt" rows={2} placeholder="Your question here…"
          value={question.prompt} onChange={(event) => update({ prompt: event.target.value })}
          aria-invalid={Boolean(errors[question.id + ".prompt"])} />
        {errors[question.id + ".prompt"] && <p className="field-error">{errors[question.id + ".prompt"]}</p>}
      </div>
      <div className="setting-field">
        <label htmlFor="question-description">Description <span>(optional)</span></label>
        <textarea id="question-description" rows={2} placeholder="Description (optional)"
          value={question.description} onChange={(event) => update({ description: event.target.value })}
          aria-invalid={Boolean(errors[question.id + ".description"])} />
        {errors[question.id + ".description"] && <p className="field-error">{errors[question.id + ".description"]}</p>}
      </div>
      <div className="required-row">
        <label htmlFor="question-required">Required</label>
        <input id="question-required" className="switch" role="switch" type="checkbox"
          checked={question.required} onChange={(event) => update({ required: event.target.checked })} />
      </div>
      {isChoice(question.type) && <section className="options-editor" aria-label="Choice options">
        <h3>Choices <span>Single selection</span></h3>
        <SortableList items={question.options} disabled={disabled}
          label={(_, index) => "option " + (index + 1)}
          onReorder={(options) => update({ options })}>
          {(option, index) => <div className="option-editor">
            <input aria-label={"Option " + (index + 1)} placeholder="Choice"
              value={option.label} aria-invalid={Boolean(errors[option.id])}
              onChange={(event) => update({
                options: question.options.map((o) => o.id === option.id ? { ...o, label: event.target.value } : o),
              })} />
            <button className="icon-button" type="button" aria-label={"Delete option " + (index + 1)}
              onClick={() => update({ options: question.options.filter((o) => o.id !== option.id) })}>
              <Trash2 size={14} />
            </button>
            {errors[option.id] && <p className="field-error">{errors[option.id]}</p>}
          </div>}
        </SortableList>
        <button type="button" className="text-button" disabled={question.options.length >= 100}
          onClick={() => update({ options: [...question.options, { id: crypto.randomUUID(), label: "" }] })}>
          <Plus size={15} /> Add choice
        </button>
      </section>}
      {question.type === "rating" && <p className="setting-note">Rating scale: 1–5</p>}
    </fieldset>
  );
}
