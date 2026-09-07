import assert from 'node:assert/strict';
import test from 'node:test';
import { newDraft, newQuestion } from '../src/lib/drafts.ts';
import { answerError, submissionBody } from '../src/lib/publication.ts';

test('respondent validation preserves zero/false and rejects invalid types', () => {
  assert.equal(answerError({...newQuestion('number'), required:true}, '0'), '');
  assert.equal(answerError({...newQuestion('yes_no'), required:true}, 'no'), '');
  assert.ok(answerError(newQuestion('number'), 'Infinity'));
  assert.ok(answerError(newQuestion('rating'), '1.5'));
  assert.ok(answerError(newQuestion('email'), 'a..b@example.com'));
  assert.ok(answerError(newQuestion('dropdown'), 'unrelated-option'));
  assert.ok(answerError({...newQuestion('short_text'), required:true}, ' '));
  assert.equal(answerError(newQuestion('short_text'), ''), '');
});

test('submission encoding omits empty optionals and binds the exact version and attempt', () => {
  const questions = [newQuestion('number'), newQuestion('yes_no'), newQuestion('long_text')];
  const form = {public_id:'public', version_id:'v1', snapshot:{...newDraft(), questions}};
  const answers = {[questions[0].id]:'0', [questions[1].id]:'no', [questions[2].id]:''};
  const body = submissionBody(form, answers, 'attempt');
  assert.deepEqual(body, {submission_id:'attempt', version_id:'v1', answers:[
    {question_id:questions[0].id, value:0}, {question_id:questions[1].id, value:false}
  ]});
  assert.deepEqual(submissionBody(form, answers, 'attempt'), body);
});
