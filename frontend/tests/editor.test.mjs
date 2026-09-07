import assert from "node:assert/strict";
import test from "node:test";
import {
  answerSignature, changeType, newDraft, newQuestion,
  selectionAfterDelete, validateDraft,
} from "../src/lib/drafts.ts";

test("empty and incomplete drafts are saveable; title remains required", () => {
  const draft = newDraft();
  assert.deepEqual(validateDraft(draft), {});
  draft.questions.push(newQuestion("dropdown"));
  assert.deepEqual(validateDraft(draft), {});
  draft.title = " ";
  assert.ok(validateDraft(draft).title);
});

test("type changes preserve common fields and only retain compatible options", () => {
  const original = { ...newQuestion("multiple_choice"), prompt: "Pick one", description: "Help", required: true,
    options: [{ id: crypto.randomUUID(), label: "A" }] };
  const dropdown = changeType(original, "dropdown");
  assert.deepEqual(dropdown.options, original.options);
  const text = changeType(original, "short_text");
  assert.deepEqual(text, { ...original, type: "short_text", options: [] });
  assert.equal(original.options.length, 1, "source is not mutated");
  assert.notEqual(answerSignature(original), answerSignature(text));
});

test("deleting selected question selects its neighbor, then permits an empty form", () => {
  const a = newQuestion("short_text"), b = newQuestion("email"), c = newQuestion("rating");
  assert.equal(selectionAfterDelete([a, b, c], b.id, b.id), c.id);
  assert.equal(selectionAfterDelete([a, b], b.id, b.id), a.id);
  assert.equal(selectionAfterDelete([a], a.id, a.id), null);
  assert.equal(selectionAfterDelete([a, b], a.id, b.id), b.id);
});

test("preview compatibility ignores prompt changes but detects option changes", () => {
  const question = newQuestion("dropdown");
  assert.equal(answerSignature(question), answerSignature({ ...question, prompt: "Edited" }));
  assert.notEqual(answerSignature(question), answerSignature({ ...question, options: [{ id: "choice", label: "A" }] }));
});

test("length checks count Unicode code points and reject duplicate IDs", () => {
  const draft = newDraft();
  draft.questions = [{ ...newQuestion("short_text"), prompt: "🌱".repeat(1000) }];
  assert.deepEqual(validateDraft(draft), {});
  draft.questions[0].prompt += "x";
  assert.ok(validateDraft(draft)[draft.questions[0].id + ".prompt"]);
  draft.questions.push({ ...draft.questions[0] });
  assert.ok(validateDraft(draft).questions);
});
