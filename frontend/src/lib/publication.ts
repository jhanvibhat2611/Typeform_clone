import type { Draft, Question } from './drafts';

export type Publication = { public_id: string; active_version_id: string | null; published: boolean };
export type PublicForm = { public_id: string; version_id: string; snapshot: Draft };
export type SubmissionBody = { submission_id: string; version_id: string; answers: { question_id: string; value: string | number | boolean }[] };
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) { super(message); this.status = status; this.fields = fields; }
}
const origin = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  } catch { throw new ApiError('Cannot reach the server. Your answers or edits are still here. Please retry.', 0); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof data?.detail === 'string' ? data.detail :
    data?.detail?.message || 'The server rejected this request. Check the form and retry.', response.status, data?.detail?.fields || {});
  if (!data) throw new ApiError('The server returned an incomplete response. Please retry.', 0);
  return data as T;
}
export const getPublication = (id: string) => api<Publication>('/api/forms/' + encodeURIComponent(id) + '/publication');
export const publishDraft = ({ id, ...draft }: Draft) => api<{ draft: Draft; publication: Publication }>('/api/forms/' + encodeURIComponent(id) + '/publish', draft);
export const unpublishForm = (id: string) => api<Publication>('/api/forms/' + encodeURIComponent(id) + '/unpublish', {});
export const loadPublic = (id: string) => api<PublicForm>('/api/public/' + encodeURIComponent(id));
export const submitPublic = (id: string, body: SubmissionBody) => api<{ submission_id: string; version_id: string; received_at: string }>('/api/public/' + encodeURIComponent(id) + '/submissions', body);

// Same deliberately practical ASCII email policy as the server; no DNS lookup.
const email = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export function answerError(q: Question, value = ''): string {
  if (!value.trim()) return q.required ? 'Please answer this question.' : '';
  const length = Array.from(value).length;
  if (q.type === 'short_text' && length > 1000) return 'Use at most 1,000 characters.';
  if (q.type === 'long_text' && length > 10000) return 'Use at most 10,000 characters.';
  if (q.type === 'email' && (length > 254 || !email.test(value) || value.split('@')[0].includes('..') || value.startsWith('.') || value.includes('.@'))) return 'Enter a valid email address.';
  if (q.type === 'number' && !Number.isFinite(Number(value))) return 'Enter a finite number.';
  if (q.type === 'rating' && !/^[1-5]$/.test(value)) return 'Choose an integer rating from 1 to 5.';
  if (q.type === 'yes_no' && !['yes', 'no'].includes(value)) return 'Choose Yes or No.';
  if (['multiple_choice', 'dropdown'].includes(q.type) && !q.options.some(o => o.id === value)) return 'Choose an available option.';
  return '';
}
export function submissionBody(form: PublicForm, values: Record<string, string>, id: string): SubmissionBody {
  return { submission_id: id, version_id: form.version_id,
    answers: form.snapshot.questions.filter(q => (values[q.id] || '').trim() !== '').map(q => {
      const raw = values[q.id];
      return { question_id: q.id, value: q.type === 'yes_no' ? raw === 'yes' :
        ['number', 'rating'].includes(q.type) ? Number(raw) : raw };
    }) };
}
