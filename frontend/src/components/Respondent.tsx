"use client";
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { flushSync } from 'react-dom';
import { QuestionControl } from './QuestionControl';
import { ApiError, answerError, loadPublic, submissionBody, submitPublic, type PublicForm, type SubmissionBody } from '../lib/publication';

export function Respondent({ publicId }: { publicId: string }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [index, setIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState<SubmissionBody | null>(null);
  const attemptId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const controls = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const navigationLocked = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const outgoing = useRef<HTMLDivElement>(null);
  const [exitIndex, setExitIndex] = useState<number | null>(null);
  const animations = useRef<Animation[]>([]);
  const startButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { animations.current.forEach(animation => animation.cancel()); }, []);
  const question = form?.snapshot.questions[index];

  useEffect(() => {
    let active = true;
    setLoadError(''); setUnavailable(false);
    loadPublic(publicId).then(value => { if (active) setForm(value); }).catch(error => {
      if (active) { setLoadError(error.message); setUnavailable(error instanceof ApiError && [404, 422].includes(error.status)); }
    });
    return () => { active = false; };
  }, [publicId, reload]);
  function focusAnswer() { controls.current?.querySelector<HTMLElement>('input, textarea, select, [role=combobox]')?.focus({ preventScroll: true }); }
  useEffect(() => { if (!busy && !moving) { if (question) focusAnswer(); else if (index === -1) startButton.current?.focus({ preventScroll: true }); } }, [index, form, busy, moving]);
  useEffect(() => {
    if (success || !Object.values(answers).some(Boolean)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [answers, success]);

  async function moveTo(next: number) {
    if (!form || navigationLocked.current || inFlight.current || pending || next === index || next < 0 || next >= form.snapshot.questions.length) return;
    navigationLocked.current = true;
    const previousScroll = panel.current?.scrollTop ?? 0;
    const direction = next > index ? 1 : -1;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.activeElement instanceof HTMLElement && panel.current?.contains(document.activeElement)) document.activeElement.blur();
    // Both panels exist in the same render; answers remain above either panel.
    flushSync(() => { setMoving(true); setMessage(''); setExitIndex(index); setIndex(next); });
    if (outgoing.current) outgoing.current.scrollTop = previousScroll;
    try {
      if (!reduced && panel.current && outgoing.current) {
        const timing = { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' as const };
        animations.current = [
          outgoing.current.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-direction * 100}%)` }], timing),
          panel.current.animate([{ transform: `translateY(${direction * 100}%)` }, { transform: 'translateY(0)' }], timing),
        ];
        await Promise.all(animations.current.map(animation => animation.finished));
      } else {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    } catch { /* Unmount cancels both panels. */ }
    finally {
      flushSync(() => { setExitIndex(null); setMoving(false); });
      animations.current.forEach(animation => animation.cancel());
      animations.current = []; navigationLocked.current = false;
    }
  }
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
    if (!form || !question || busy || inFlight.current || navigationLocked.current) return;
    if (pending) { void send(pending); return; }
    const error = answerError(question, answers[question.id]);
    if (error) { setErrors(previous => ({ ...previous, [question.id]: error })); focusAnswer(); return; }
    setMessage('');
    if (index < form.snapshot.questions.length - 1) { void moveTo(index + 1); return; }
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
    <CheckCircle2 size={112} strokeWidth={1.3} aria-hidden="true"/>
    <h1>Thanks for completing this form</h1><p>Your response has been received.</p><a className="primary" href="/">Create a form</a>
  </main>;
  if (!question && index !== -1) return <main className="respondent-state"><h1>This form is unavailable</h1></main>;
  const final = index === form.snapshot.questions.length - 1;
  function renderPanel(panelIndex: number, leaving: boolean) {
    const current = form!.snapshot.questions[panelIndex];
    const inputId = leaving ? 'outgoing-answer' : 'public-answer';
    return <div ref={leaving ? outgoing : panel} className={'respondent-body' + (panelIndex === -1 ? ' welcome-body' : '')}
      key={panelIndex} data-panel={leaving ? 'outgoing' : 'active'} aria-hidden={leaving || undefined} inert={leaving || undefined}>
      {panelIndex === -1 ? <section className="respondent-welcome" aria-labelledby="welcome-title">
        <h1 id={leaving ? undefined : 'welcome-title'}>{form!.snapshot.title}</h1>
        <p>Please take a moment to share your answers.<br/>Select Start when you are ready.</p>
        <button ref={leaving ? undefined : startButton} className="primary" disabled={moving || leaving} onClick={() => void moveTo(0)}>Start</button>
      </section> : <section className="respondent-question" aria-busy={moving || busy} aria-label={'Question ' + (panelIndex + 1)}>
        <div className="respondent-number" aria-hidden="true">{panelIndex + 1}</div>
        <h1 className="preview-prompt" id={inputId + '-label'}>{current.prompt}{current.required && <span aria-label="required"> *</span>}</h1>
        {current.description && <p className="preview-description" id={inputId + '-description'}>{current.description}</p>}
        <fieldset disabled={busy || moving || leaving || Boolean(pending)} className="respondent-inputs"><legend className="sr-only">Your answer</legend>
          <div ref={leaving ? undefined : controls}><QuestionControl question={current} value={answers[current.id] || ''} inputId={inputId}
            error={errors[current.id]} onChange={value => {
              setAnswers(previous => ({ ...previous, [current.id]: value }));
              setErrors(previous => ({ ...previous, [current.id]: '' }));
            }}/></div>
        </fieldset>
        {errors[current.id] && <p className="respondent-error" id={inputId + '-error'} role={leaving ? undefined : 'alert'}>{errors[current.id]}</p>}
        <div className="respondent-actions">
          <button className="primary advance" disabled={busy || moving || leaving} onClick={advance}>{busy ? 'Submitting…' : pending ? 'Retry submission' : panelIndex === form!.snapshot.questions.length - 1 ? 'Submit' : 'OK'}</button>
        </div>
        <p className="keyboard-hint">{current.type === 'long_text' ? 'Enter for a new line · Ctrl + Enter to continue' : ['short_text', 'email', 'number'].includes(current.type) ? 'Press Enter to continue' : 'Choose an answer, then use ' + (panelIndex === form!.snapshot.questions.length - 1 ? 'Submit' : 'OK') + ' to continue'}</p>
        {message && !leaving && <p className="respondent-error" role="alert">{message}</p>}
        {pending && !busy && <p>Receipt is uncertain. Retry sends the same answers safely.</p>}
      </section>}
    </div>;
  }
  // Arrow navigation never submits or retries: only the explicit answer action does.
  function nextQuestion() { if (!final && !pending && index >= 0) advance(); }
  return <main className="respondent-shell" onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (event.nativeEvent.isComposing || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (index === -1 && event.key === 'Enter' && !event.repeat) { event.preventDefault(); void moveTo(0); return; }
    if (event.repeat) {
      if (target.closest('button') && ['Enter', ' '].includes(event.key)) event.preventDefault();
      return;
    }
    // Native controls own their arrows (caret, number stepping, option/radio selection).
    if (target.closest('input, textarea, select, [role="radio"], [role="combobox"], [contenteditable="true"]')) return;
    if (event.key === 'ArrowUp') { event.preventDefault(); void moveTo(index - 1); }
    if (event.key === 'ArrowDown') { event.preventDefault(); nextQuestion(); }
  }}>
    <header className="sr-only"><span>{form.snapshot.title}</span><span aria-live="polite">{index === -1 ? 'Welcome' : `Question ${index + 1} of ${form.snapshot.questions.length}`}</span></header>
    {index >= 0 && <progress className="respondent-progress" aria-label="Form progress" max={form.snapshot.questions.length} value={index}/>}
    <div className="respondent-viewport" onKeyDown={event => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat || event.altKey || event.metaKey || busy || pending) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        if (event.ctrlKey) { event.preventDefault(); advance(); }
      } else if (target instanceof HTMLInputElement && ['text', 'email', 'number'].includes(target.type) && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault(); advance();
      }
    }}>
      {exitIndex !== null && renderPanel(exitIndex, true)}
      {renderPanel(index, false)}
    </div>
    {index >= 0 && <nav className="respondent-navigation" aria-label="Question navigation" aria-describedby="navigation-help">
      <span className="sr-only" id="navigation-help">Use Up and Down here to navigate questions. Tab moves between controls; Enter or Space activates buttons.</span>
      <button className="primary" aria-label="Previous question" disabled={index === 0 || busy || moving || Boolean(pending)} onClick={() => void moveTo(index - 1)}><ChevronUp size={26}/></button>
      <button className="primary" aria-label="Next question" disabled={final || busy || moving || Boolean(pending)} onClick={nextQuestion}><ChevronDown size={26}/></button>
    </nav>}
  </main>;
}
