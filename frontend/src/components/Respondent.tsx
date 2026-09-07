"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { QuestionControl } from './QuestionControl';
import { ApiError, answerError, loadPublic, submissionBody, submitPublic, type PublicForm, type SubmissionBody } from '../lib/publication';

export function Respondent({ publicId }: { publicId: string }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState<SubmissionBody | null>(null);
  const attemptId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const controls = useRef<HTMLDivElement>(null);
  const question = form?.snapshot.questions[index];

  useEffect(() => {
    let active = true;
    setLoadError(''); setUnavailable(false);
    loadPublic(publicId).then(value => { if (active) setForm(value); }).catch(error => {
      if (active) { setLoadError(error.message); setUnavailable(error instanceof ApiError && [404, 422].includes(error.status)); }
    });
    return () => { active = false; };
  }, [publicId, reload]);
  function focusAnswer() { controls.current?.querySelector<HTMLElement>('input, textarea, select')?.focus(); }
  useEffect(() => { if (question && !busy) focusAnswer(); }, [index, form, busy]);
  useEffect(() => {
    if (success || !Object.values(answers).some(Boolean)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [answers, success]);

  async function send(payload: SubmissionBody) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage(''); setPending(payload);
    try {
      const acknowledgement = await submitPublic(publicId, payload);
      if (acknowledgement.submission_id !== payload.submission_id || acknowledgement.version_id !== payload.version_id) {
        throw new ApiError('Could not confirm the response. Retry the same submission.', 0);
      }
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed. Please retry.');
      if (error instanceof ApiError && [409, 422].includes(error.status)) {
        setPending(null); // Only definite validation/state rejection unlocks editing; uncertain failures retry exactly.
        setErrors(error.fields);
        const badIndex = form?.snapshot.questions.findIndex(q => error.fields[q.id]) ?? -1;
        if (badIndex >= 0) setIndex(badIndex);
      }
    } finally { inFlight.current = false; setBusy(false); }
  }
  function advance() {
    if (!form || !question || busy || inFlight.current) return;
    if (pending) { void send(pending); return; }
    const error = answerError(question, answers[question.id]);
    if (error) { setErrors(previous => ({ ...previous, [question.id]: error })); focusAnswer(); return; }
    setMessage('');
    if (index < form.snapshot.questions.length - 1) { setIndex(index + 1); return; }
    const allErrors = Object.fromEntries(form.snapshot.questions.map(q => [q.id, answerError(q, answers[q.id])]).filter(([, value]) => value));
    if (Object.keys(allErrors).length) {
      setErrors(allErrors); setIndex(form.snapshot.questions.findIndex(q => allErrors[q.id])); focusAnswer(); return;
    }
    attemptId.current ??= crypto.randomUUID();
    void send(submissionBody(form, answers, attemptId.current));
  }
  if (!form) return <main className="respondent-state">
    <h1>{loadError ? unavailable ? 'This form is unavailable' : 'Unable to load the form' : 'Loading your form…'}</h1>
    {loadError && <><p role="alert">{loadError}</p><button className="primary" onClick={() => setReload(value => value + 1)}>Retry</button></>}
  </main>;
  if (success) return <main className="respondent-state thank-you">
    <CheckCircle2 size={88} strokeWidth={1.3} aria-hidden="true"/>
    <h1>Thanks for completing<br/>this form</h1><p>Your response has been received.</p>
  </main>;
  if (!question) return <main className="respondent-state"><h1>This form is unavailable</h1></main>;
  const final = index === form.snapshot.questions.length - 1;
  const inputId = 'public-answer';
  return <main className="respondent-shell">
    <header className="respondent-header"><span>{form.snapshot.title}</span><span>{index + 1} / {form.snapshot.questions.length}</span></header>
    <progress className="respondent-progress" aria-label="Form progress" max={form.snapshot.questions.length} value={index}/>
    <div className="respondent-body" onKeyDown={event => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat || event.altKey || event.metaKey || busy || pending) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        if (event.ctrlKey) { event.preventDefault(); advance(); }
      } else if (target instanceof HTMLInputElement && ['text', 'email', 'number'].includes(target.type) && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault(); advance();
      }
    }}>
      <section key={question.id} className="respondent-question" aria-label={'Question ' + (index + 1)}>
        <div className="question-number">{index + 1}<ArrowRight size={15}/></div>
        <h1 className="preview-prompt" id={inputId + '-label'}>{question.prompt}{question.required && <span aria-label="required"> *</span>}</h1>
        {question.description && <p className="preview-description" id={inputId + '-description'}>{question.description}</p>}
        <fieldset disabled={busy || Boolean(pending)} className="respondent-inputs"><legend className="sr-only">Your answer</legend>
          <div ref={controls}><QuestionControl question={question} value={answers[question.id] || ''} inputId={inputId}
            error={errors[question.id]} onChange={value => {
              setAnswers(previous => ({ ...previous, [question.id]: value }));
              setErrors(previous => ({ ...previous, [question.id]: '' }));
            }}/></div>
        </fieldset>
        {errors[question.id] && <p className="respondent-error" id={inputId + '-error'} role="alert">{errors[question.id]}</p>}
        <div className="respondent-actions">
          <button className="primary" aria-label="Previous question" disabled={index === 0 || busy || Boolean(pending)} onClick={() => { setIndex(index - 1); setMessage(''); }}><ArrowLeft size={19}/></button>
          <button className="primary advance" disabled={busy} onClick={advance}>{busy ? 'Submitting…' : pending ? 'Retry submission' : final ? 'Submit' : 'OK'}{!busy && <ArrowRight size={17}/>}</button>
        </div>
        <p className="keyboard-hint">{question.type === 'long_text' ? 'Enter for a new line · Ctrl + Enter to continue' : ['short_text', 'email', 'number'].includes(question.type) ? 'Press Enter to continue' : 'Choose an answer, then use ' + (final ? 'Submit' : 'OK') + ' to continue'}</p>
        {message && <p className="respondent-error" role="alert">{message}</p>}
        {pending && !busy && <p>Receipt is uncertain. Retry sends the same answers safely.</p>}
      </section>
    </div>
  </main>;
}
