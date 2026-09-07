import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLabel } from '../src/lib/answers.ts';
import { newQuestion } from '../src/lib/drafts.ts';
test('results distinguish zero, false and omitted optional answers',()=>{
  const n=newQuestion('number'),b=newQuestion('yes_no'),t=newQuestion('short_text');
  assert.equal(answerLabel(n,{[n.id]:0}),'0');
  assert.equal(answerLabel(b,{[b.id]:false}),'No');
  assert.equal(answerLabel(t,{}),'Unanswered (optional)');
});
test('choice labels resolve from the supplied historical snapshot',()=>{
  const q={...newQuestion('dropdown'),options:[{id:'option',label:'Original label'}]};
  assert.equal(answerLabel(q,{[q.id]:'option'}),'Original label');
  assert.equal(answerLabel({...q,options:[{id:'option',label:'Changed label'}]},{[q.id]:'option'}),'Changed label');
});
