export const questionTypes = [
  "short_text", "long_text", "multiple_choice", "dropdown",
  "email", "number", "yes_no", "rating",
] as const;

export type QuestionType = typeof questionTypes[number];
export type ChoiceOption = { id: string; label: string };
export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  description: string;
  required: boolean;
  options: ChoiceOption[];
};
export type Draft = { id: string; title: string; questions: Question[] };
export type DraftErrors = Record<string, string>;

export const typeLabels: Record<QuestionType, string> = {
  short_text: "Short Text", long_text: "Long Text", multiple_choice: "Multiple Choice",
  dropdown: "Dropdown", email: "Email", number: "Number", yes_no: "Yes/No", rating: "Rating",
};

export function isChoice(type: QuestionType) {
  return type === "multiple_choice" || type === "dropdown";
}

export function newQuestion(type: QuestionType): Question {
  return { id: crypto.randomUUID(), type, prompt: "", description: "", required: false, options: [] };
}

export function newDraft(): Draft {
  return { id: crypto.randomUUID(), title: "New form", questions: [] };
}

export function changeType(question: Question, type: QuestionType): Question {
  return { ...question, type, options: isChoice(type) ? question.options : [] };
}

export function selectionAfterDelete(questions: Question[], deletedId: string, selectedId: string | null) {
  if (deletedId !== selectedId) return selectedId;
  const index = questions.findIndex((q) => q.id === deletedId);
  return questions[index + 1]?.id ?? questions[index - 1]?.id ?? null;
}

// The signature invalidates preview answers when type or available options change.
export function answerSignature(question: Question) {
  return JSON.stringify([question.type, question.options.map((o) => [o.id, o.label])]);
}

export function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const length = (value: string) => Array.from(value).length;
  if (!draft.title.trim() || length(draft.title) > 160) {
    errors.title = "Enter a title between 1 and 160 characters.";
  }
  if (draft.questions.length > 200) errors.questions = "A draft can have at most 200 questions.";
  const ids = new Set<string>();
  for (const question of draft.questions) {
    if (ids.has(question.id)) errors.questions = "Question and option IDs must be unique.";
    ids.add(question.id);
    if (length(question.prompt) > 1000) errors[question.id + ".prompt"] = "Use at most 1,000 characters.";
    if (length(question.description) > 2000) errors[question.id + ".description"] = "Use at most 2,000 characters.";
    if (!isChoice(question.type) && question.options.length) errors.questions = "This type cannot have options.";
    if (question.options.length > 100) errors.questions = "Use at most 100 options per question.";
    for (const option of question.options) {
      if (ids.has(option.id)) errors.questions = "Question and option IDs must be unique.";
      ids.add(option.id);
      if (length(option.label) > 500) errors[option.id] = "Use at most 500 characters.";
    }
  }
  return errors;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function requestDraft(id: string, init?: RequestInit): Promise<Draft> {
  let response: Response;
  try {
    response = await fetch(apiUrl + "/api/forms/" + encodeURIComponent(id), {
      ...init, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running, then retry. Your edits are still here.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail :
      "The server rejected this draft. Check its settings and lengths, then retry.");
  }
  return response.json();
}

export function loadDraft(id: string) { return requestDraft(id); }

export function saveDraft(draft: Draft) {
  const { id, ...body } = draft;
  return requestDraft(id, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
