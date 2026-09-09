import assert from 'node:assert/strict';
import test from 'node:test';
import { finishClasswordRequest, prepareClasswordRequest } from './classwordRequestStore';

test('manual retry retains request identity and original edit revision until confirmed or rejected', async () => {
 const values=new Map<string,string>();
 const storage:Storage={get length(){return values.size;},clear:()=>values.clear(),getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)},removeItem:key=>{values.delete(key)},key:index=>[...values.keys()][index]??null};
 const body={action:'save_entry',dateKey:'2099-09-08',entryId:'test-entry',initial:'ㄱ',word:'강아지',expectedRevision:'2026-09-08T01:00:00Z'};
 const first=await prepareClasswordRequest(storage,2,body);
 assert.equal(first.expectedStudentNumber,2);
 const retry=await prepareClasswordRequest(storage,2,{...body,expectedRevision:'2026-09-08T02:00:00Z'});
 assert.equal(retry.requestId,first.requestId);
 assert.equal(retry.expectedRevision,body.expectedRevision);
 assert.notEqual((await prepareClasswordRequest(storage,4,body)).requestId,first.requestId);
 await finishClasswordRequest(storage,2,'save_entry',first.requestId);
 assert.notEqual((await prepareClasswordRequest(storage,2,body)).requestId,first.requestId);
});

test('two unconfirmed classword payloads keep separate immutable requests and survive a store read', async () => {
  const { listClasswordRequests } = await import('./classwordRequestStore');
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, clear: () => values.clear(), key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  const body = { action: 'save_entry', dateKey: '2026-09-09', initial: 'ㄱ', word: '가방' };
  const first = await prepareClasswordRequest(storage, 6, body);
  const next = await prepareClasswordRequest(storage, 6, { ...body, word: '강아지' });
  assert.notEqual(first.requestId, next.requestId);
  assert.equal((await listClasswordRequests(storage, 6)).length, 2);
  await finishClasswordRequest(storage, 6, 'save_entry', first.requestId);
  assert.equal((await listClasswordRequests(storage, 6))[0]?.body.word, '강아지');
});

test('legacy pending request migrates with its original ID and old transport contract', async () => {
  const { listClasswordRequests } = await import('./classwordRequestStore');
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, clear: () => values.clear(), key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  const key = 'school-timer-classword-request-v2:7:answer_quiz';
  storage.setItem(key, JSON.stringify({ fingerprint: JSON.stringify({ action: 'answer_quiz', dateKey: '2026-09-09', answer: '협동' }), requestId: 'legacy-request-fixture' }));
  const requests = await listClasswordRequests(storage, 7);
  assert.equal(requests[0]?.draft.requestId, 'legacy-request-fixture');
  assert.equal(requests[0]?.transportHash, false);
  assert.equal(storage.getItem(key), null);
  const retry = await prepareClasswordRequest(storage, 7, {
    action: 'answer_quiz', dateKey: '2026-09-09', answer: '협동', expectedQuestionId: 'new-client-question-context',
  });
  assert.equal(retry.requestId, 'legacy-request-fixture');
  assert.equal(retry.expectedQuestionId, undefined);
  assert.equal(retry.expectedStudentNumber, undefined);
  assert.equal((await listClasswordRequests(storage, 7)).length, 1);
});
