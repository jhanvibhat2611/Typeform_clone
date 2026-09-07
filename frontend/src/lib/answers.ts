import type { Question } from './drafts';
type Values = Record<string,string|number|boolean>;
export function answerLabel(question:Question, answers:Values):string {
  if (!Object.hasOwn(answers,question.id)) return question.required ? 'Unanswered' : 'Unanswered (optional)';
  const value=answers[question.id];
  if (question.type==='yes_no') return value === true ? 'Yes' : 'No';
  if (['multiple_choice','dropdown'].includes(question.type)) return question.options.find(o=>o.id===value)?.label ?? 'Unknown option';
  return String(value);
}
