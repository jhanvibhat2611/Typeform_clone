"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Columns2, FileText, Plus, Smartphone, Trash2 } from "lucide-react";
import {
  changeType, isChoice, loadDraft, newDraft, newQuestion, saveDraft, selectionAfterDelete,
  validateDraft, type Draft, type DraftErrors, type Question, type QuestionType, typeLabels,
} from "../lib/drafts";
import { Preview } from "./Preview";
import { QuestionPicker } from "./QuestionPicker";
import { QuestionSettings } from "./QuestionSettings";
import { QuestionTypeIcon } from "./QuestionTypeIcon";
import { SortableList } from "./SortableList";
import { ApiError, getPublication, publishDraft, unpublishForm, type Publication } from "../lib/publication";
import { ShareDialog } from "./ShareDialog";
import { ConfirmDialog } from "./ConfirmDialog";

type SaveState = "unsaved" | "saving" | "saved" | "error";
const statusLabels: Record<SaveState, string> = {
  unsaved: "Unsaved changes", saving: "Saving…", saved: "All changes saved", error: "Not saved",
};

export function Builder() {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publicationError, setPublicationError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveState>("unsaved");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(null);

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("form");
    if (!id) { setDraft(newDraft()); return; }
    setLoadError("");
    loadDraft(id).then((loaded) => {
      if (!active) return;
      setDraft(loaded);
      setSelectedId(loaded.questions[0]?.id ?? null);
      setSavedJson(JSON.stringify(loaded));
      setStatus("saved");
      getPublication(loaded.id).then(value => { if (active) setPublication(value); }).catch(() => { if (active) setPublicationError("Could not load publication status. Reload before publishing."); });
    }).catch((error: Error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [reloadKey]);

  const dirty = draft !== null && JSON.stringify(draft) !== savedJson;
  const busy = status === "saving" || publishing;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(next: Draft) {
    setDraft(next);
    setStatus(JSON.stringify(next) === savedJson ? "saved" : "unsaved");
    setErrors({});
    setMessage("");
  }

  function updateQuestion(question: Question) {
    if (draft) update({ ...draft, questions: draft.questions.map((q) => q.id === question.id ? question : q) });
  }

  function addQuestion(type: QuestionType) {
    if (!draft || busy || draft.questions.length >= 200) return;
    const question = newQuestion(type);
    update({ ...draft, questions: [...draft.questions, question] });
    setSelectedId(question.id);
    setPickerOpen(false);
  }

  function deleteQuestion(id: string) {
    if (!draft || busy) return;
    setSelectedId(selectionAfterDelete(draft.questions, id, selectedId));
    update({ ...draft, questions: draft.questions.filter((q) => q.id !== id) });
  }

  function switchType(question: Question, type: QuestionType) {
    if (question.type === type) return;
    if (!isChoice(type) && question.options.length) {
      setConfirmation({
        message: "Changing to " + typeLabels[type] + " removes this question's choices. The prompt, description and required setting will be kept.",
        action: () => updateQuestion(changeType(question, type)),
      });
      return;
    }
    updateQuestion(changeType(question, type));
  }

  function createNew() {
    if (dirty) {
      setConfirmation({ message: "Your unsaved changes will be discarded when you create a new form.", action: resetDraft });
      return;
    }
    resetDraft();
  }

  function resetDraft() {
    setPublication(null);
    setPublicationError("");
    setShareOpen(false);
    window.history.replaceState(null, "", window.location.pathname);
    setDraft(newDraft());
    setSelectedId(null);
    setSavedJson(null);
    setStatus("unsaved");
    setErrors({});
    setMessage("");
    setLoadError("");
  }

  async function save() {
    if (!draft || busy) return;
    const validation = validateDraft(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setStatus("error");
      setMessage("Check the draft: " + Object.values(validation)[0]);
      const invalid = draft.questions.find((q) =>
        validation[q.id + ".prompt"] || validation[q.id + ".description"] ||
        q.options.some((o) => validation[o.id]));
      if (invalid) setSelectedId(invalid.id);
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const saved = await saveDraft(draft);
      setDraft(saved);
      setSavedJson(JSON.stringify(saved));
      setStatus("saved");
      window.history.replaceState(null, "", "?form=" + encodeURIComponent(saved.id));
      getPublication(saved.id).then(setPublication).catch(() => setPublicationError("Could not load publication status. Reload to retry."));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Save failed. Please retry.");
    }
  }

  async function changePublication(unpublish = false) {
    if (!draft || busy) return;
    setPublishing(true);
    setMessage("");
    try {
      if (unpublish) setPublication(await unpublishForm(draft.id));
      else {
        const result = await publishDraft(draft);
        setDraft(result.draft);
        setSavedJson(JSON.stringify(result.draft));
        setStatus("saved");
        setErrors({});
        setPublication(result.publication);
        window.history.replaceState(null, "", "?form=" + encodeURIComponent(draft.id));
        setShareOpen(true);
      }
      setPublicationError("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publication failed. Retry.");
      if (error instanceof ApiError && draft) {
        const invalid = draft.questions.find(q => error.fields[q.id]);
        if (invalid) {
          setSelectedId(invalid.id);
          setMessage(error.message + " " + error.fields[invalid.id]);
        }
      }
    } finally { setPublishing(false); }
  }

  if (!draft) return <main className="loading-screen">
    <h1>{loadError ? "We couldn’t load this draft" : "Opening your form…"}</h1>
    {loadError && <><p role="alert">{loadError}</p>
      <button onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
      <button onClick={createNew}>New form</button></>}
  </main>;

  const selected = draft.questions.find((q) => q.id === selectedId);
  return <div className="builder-shell">
    <header className="app-header">
      <div className="breadcrumbs">
        <FileText size={17} aria-hidden="true" /><a href="/">Forms</a><ChevronRight size={15} />
        <input aria-label="Form title" value={draft.title} disabled={busy}
          aria-invalid={Boolean(errors.title)} placeholder="Name your form"
          onChange={(event) => update({ ...draft, title: event.target.value })} />
        <span className="draft-tag">{publication?.published ? "Published" : "Draft"}</span>
      </div>
      <div className="content-tab">Content</div>
      <div className="header-actions">
        <span className={"save-status " + status} role="status"><span className="status-dot" />{statusLabels[status]}</span>
        <a className="secondary" href={"/forms/" + draft.id + "/results"} aria-disabled={busy || !savedJson} onClick={event => { if (busy || !savedJson) event.preventDefault(); }}>Results</a>
        <button className="secondary" onClick={() => setShareOpen(true)} disabled={busy || !publication}>Share</button>
        <button className="secondary" onClick={createNew} disabled={busy}>New form</button>
        <button className="primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</button>
        {publication?.published && <button className="secondary" disabled={busy} onClick={() => changePublication(true)}>Unpublish</button>}
        <button className="primary" disabled={busy || Boolean(publicationError)} onClick={() => changePublication()}>{publishing ? "Updating…" : publication?.published ? "Republish" : "Publish"}</button>
      </div>
    </header>
    {publicationError && <div className="error-banner" role="alert">{publicationError}</div>}
    {message && <div className="error-banner" role="alert">{message}</div>}
    <main className="builder-grid">
      <aside className="outline" aria-label="Form questions">
        <div className="panel mode-bar"><Columns2 size={18} />Universal mode<ChevronDown size={16} /></div>
        <section className="panel pages-panel">
          <h2>Pages <span>{draft.questions.length}</span></h2>
          <div className="questions-list">
            <SortableList items={draft.questions} disabled={busy}
              label={(_, index) => "question " + (index + 1)}
              onReorder={(questions) => update({ ...draft, questions })}>
              {(question, index) => <div className={"question-row" + (selectedId === question.id ? " selected" : "")}>
                <button className="question-select" aria-current={selectedId === question.id ? "true" : undefined}
                  aria-label={"Select question " + (index + 1) + ": " + (question.prompt || typeLabels[question.type])}
                  onClick={() => setSelectedId(question.id)}>
                  <span className="numbered-badge"><QuestionTypeIcon type={question.type} /><span>{index + 1}</span></span>
                  <span className="question-row-prompt">{question.prompt || typeLabels[question.type]}</span>
                </button>
                <button className="icon-button question-delete" aria-label={"Delete question " + (index + 1)}
                  disabled={busy} onClick={() => deleteQuestion(question.id)}><Trash2 size={14} /></button>
              </div>}
            </SortableList>
            {!draft.questions.length && <p className="empty-hint">No questions yet.</p>}
          </div>
          <button className="text-button" disabled={busy || draft.questions.length >= 200} onClick={() => setPickerOpen(true)}>
            <Plus size={16} />Add content
          </button>
        </section>
      </aside>
      <section className="canvas" aria-label="Live preview">
        <div className="panel preview-toolbar">
          <button className="primary add-content" disabled={busy || draft.questions.length >= 200} onClick={() => setPickerOpen(true)}>
            <Plus size={17} />Add content
          </button>
          <span className="toolbar-divider" /><Smartphone size={18} aria-hidden="true" /><span>Live preview</span>
        </div>
        <Preview key={draft.id} questions={draft.questions} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
      <aside className="panel settings" aria-label="Question settings">
        {selected ? <QuestionSettings question={selected} disabled={busy} errors={errors}
          onChange={updateQuestion} onTypeChange={(type) => switchType(selected, type)} /> :
          <p className="empty-hint">Select or add a question to edit its settings.</p>}
        <section className="settings-placeholders" aria-label="Form settings">
          <h2>Form settings</h2>
          <button type="button" aria-disabled="true">Theme <span>Coming Soon</span></button>
          <button type="button" aria-disabled="true">Thank-you screen <span>Coming Soon</span></button>
        </section>
      </aside>
    </main>
    {shareOpen && publication && <ShareDialog publication={publication} onClose={() => setShareOpen(false)} />}
    {pickerOpen && <QuestionPicker onChoose={addQuestion} onClose={() => setPickerOpen(false)} />}
    {confirmation && <ConfirmDialog message={confirmation.message}
      onCancel={() => setConfirmation(null)}
      onConfirm={() => { confirmation.action(); setConfirmation(null); }} />}
  </div>;
}
