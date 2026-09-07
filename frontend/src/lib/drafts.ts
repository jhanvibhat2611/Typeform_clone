export type Question = {
  id: string;
  type: "short_text";
  prompt: string;
  description: string;
  required: boolean;
};

export type Draft = { id: string; title: string; question: Question };
export type DraftErrors = Partial<Record<"title" | "prompt" | "description", string>>;

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function newDraft(): Draft {
  return {
    id: crypto.randomUUID(), title: "New form",
    question: {
      id: crypto.randomUUID(), type: "short_text", prompt: "What is your name?",
      description: "", required: false,
    },
  };
}

export function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  // Count Unicode code points, matching Python's string length validation.
  if (!draft.title.trim() || Array.from(draft.title).length > 160) errors.title = "Enter a title between 1 and 160 characters.";
  if (!draft.question.prompt.trim() || Array.from(draft.question.prompt).length > 1000) errors.prompt = "Enter a question between 1 and 1,000 characters.";
  if (Array.from(draft.question.description).length > 2000) errors.description = "Keep the description within 2,000 characters.";
  return errors;
}

async function requestDraft(id: string, init?: RequestInit): Promise<Draft> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/forms/${encodeURIComponent(id)}`, {
      ...init, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running, then retry. Your edits are still here.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.detail === "string" ? body.detail : "The server rejected this draft. Check the title and question, then retry.";
    throw new Error(message);
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
