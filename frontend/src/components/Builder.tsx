"use client";

import { useEffect, useState } from "react";
import { Draft, DraftErrors, Question, loadDraft, newDraft, saveDraft, validateDraft } from "../lib/drafts";
import { ShortTextQuestion } from "./ShortTextQuestion";

type SaveState = "unsaved" | "saving" | "saved" | "error";
const statusLabels: Record<SaveState, string> = {
  unsaved: "Unsaved changes", saving: "Saving…", saved: "All changes saved", error: "Not saved",
};

function ShortTextBadge() {
  return <span className="type-badge" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M3 7h14M3 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>;
}

export function Builder() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveState>("unsaved");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("form");
    if (!id) {
      setDraft(newDraft());
      return;
    }
    setLoadError("");
    loadDraft(id).then((loaded) => {
      if (!active) return;
      setDraft(loaded); setSavedJson(JSON.stringify(loaded)); setStatus("saved");
    }).catch((error: Error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [reloadKey]);

  const dirty = draft !== null && JSON.stringify(draft) !== savedJson;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(next: Draft) {
    setDraft(next); setStatus(JSON.stringify(next) === savedJson ? "saved" : "unsaved");
    setErrors({}); setMessage("");
  }

  function updateQuestion(changes: Partial<Question>) {
    if (draft) update({ ...draft, question: { ...draft.question, ...changes } });
  }

  function createNew() {
    if (dirty && !window.confirm("Discard unsaved changes and create a new form?")) return;
    window.history.replaceState(null, "", window.location.pathname);
    setDraft(newDraft()); setSavedJson(null); setStatus("unsaved");
    setErrors({}); setMessage(""); setLoadError("");
  }

  async function save() {
    if (!draft || status === "saving") return;
    const validation = validateDraft(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setStatus("error"); setMessage("Check the highlighted fields. Your previous saved draft is unchanged.");
      return;
    }
    setStatus("saving"); setMessage("");
    try {
      const saved = await saveDraft(draft);
      setDraft(saved); setSavedJson(JSON.stringify(saved)); setStatus("saved");
      window.history.replaceState(null, "", `?form=${encodeURIComponent(saved.id)}`);
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Save failed. Please retry.");
    }
  }

  if (!draft) return <main className="loading-screen">
    <div className="load-card"><span className="wordmark">typeform <small>builder</small></span>
      <h1>{loadError ? "We couldn’t load this draft" : "Opening your form…"}</h1>
      {loadError && <><p role="alert">{loadError}</p><button className="primary" onClick={() => setReloadKey((key) => key + 1)}>Retry</button><button className="secondary" onClick={createNew}>New form</button></>}
    </div>
  </main>;

  const busy = status === "saving";
  return (
    <div className="builder-shell">
      <header className="app-header">
        <div className="breadcrumbs"><span className="forms-icon" aria-hidden="true">▤</span><span>Forms</span><span className="chevron" aria-hidden="true">›</span>
          <div className="title-field"><input aria-label="Form title" value={draft.title} disabled={busy} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "title-error" : undefined} onChange={(event) => update({ ...draft, title: event.target.value })} placeholder="Name your form" /></div>
          <span className="draft-tag">Draft</span>
        </div>
        <div className="content-tab">Content</div>
        <div className="header-actions"><span className={`save-status ${status}`} role="status"><span className="status-dot" />{statusLabels[status]}</span>
          <button className="secondary new-form" onClick={createNew} disabled={busy}>New form</button>
          <button className="primary save-button" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</button>
          <span className="avatar" title="Default creator">DC</span>
        </div>
      </header>
      {errors.title && <p className="title-error field-error" id="title-error">{errors.title}</p>}
      {message && <div className="error-banner" role="alert">{message}</div>}
      <main className="builder-grid">
        <aside className="outline" aria-label="Form questions">
          <div className="panel mode-bar"><span aria-hidden="true">▱</span> Universal mode</div>
          <section className="panel pages-panel"><h2>Pages <span className="subtle-count">1</span></h2>
            <div className="question-row" aria-current="true"><span className="numbered-badge"><ShortTextBadge /><span>1</span></span><span className="question-row-prompt">{draft.question.prompt || "Untitled question"}</span></div>
          </section>
          <p className="outline-note">One question. A conversation starts here.</p>
        </aside>
        <section className="canvas" aria-label="Live preview">
          <div className="panel preview-toolbar"><span className="toolbar-label"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M10 18h4" stroke="currentColor" strokeWidth="1.5"/></svg>Live preview</span><span className="preview-indicator"><span />Updates as you type</span></div>
          <div className="preview-stage"><div className="preview-paper"><ShortTextQuestion key={draft.question.id} question={draft.question} /><span className="preview-watermark">Preview only</span></div></div>
          <p className="preview-caption">Try your question here. Preview answers aren’t saved.</p>
        </section>
        <aside className="settings" aria-label="Question settings">
          <section className="panel question-type-panel"><h2>Question</h2><div className="text-mode"><ShortTextBadge /><span>Text</span></div></section>
          <section className="panel settings-panel"><h2>Answer</h2><div className="answer-type"><ShortTextBadge /><span>Short Text</span><span className="type-lock">1 question</span></div>
            <fieldset disabled={busy}><legend className="sr-only">Edit question</legend>
              <div className="setting-field"><label htmlFor="question-prompt">Question prompt</label><textarea id="question-prompt" rows={3} value={draft.question.prompt} aria-invalid={Boolean(errors.prompt)} aria-describedby={errors.prompt ? "prompt-error" : undefined} onChange={(event) => updateQuestion({ prompt: event.target.value })} placeholder="What would you like to ask?" />{errors.prompt && <p id="prompt-error" className="field-error">{errors.prompt}</p>}</div>
              <div className="setting-field"><label htmlFor="question-description">Description <span className="optional">(optional)</span></label><textarea id="question-description" rows={3} value={draft.question.description} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} onChange={(event) => updateQuestion({ description: event.target.value })} placeholder="Add a little context…" />{errors.description && <p id="description-error" className="field-error">{errors.description}</p>}</div>
              <div className="required-row"><label htmlFor="question-required">Required</label><input id="question-required" className="switch" type="checkbox" role="switch" checked={draft.question.required} onChange={(event) => updateQuestion({ required: event.target.checked })} /></div>
            </fieldset>
          </section>
        </aside>
      </main>
    </div>
  );
}
