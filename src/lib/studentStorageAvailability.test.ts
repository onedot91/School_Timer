import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStudentStorageCommand, hasUnconfirmedStudentStorageDraft, loadStudentStorageDraft, loadStudentStorageFormDraft, saveStudentStorageFormDraft } from './studentStorageCommand.js';
import { executeTeacherStorageCommand, teacherCommandScope, teacherStorageDrafts } from './teacherStorageClient.js';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { canReloadWithDrafts } from './draftReloadSafety.js';

const success = () => Response.json({ value: {}, updatedAt: '2026-09-08T08:00:00Z', result: { applied: true } });

test('점검 거절은 미확인이 아니며 같은 내용 수동 재시도는 원래 요청 번호를 유지한다', async context => {
  const bodies: Record<string, unknown>[] = []; let reads = 0;
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method !== 'POST') { reads++; return Response.json({ status: 'unknown' }); }
    bodies.push(JSON.parse(String(init.body)));
    return bodies.length === 1 ? Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 }) : success();
  });
  const input = { recipient: 0, title: '합성 초안', content: '합성 내용' };
  await assert.rejects(executeStudentStorageCommand(12, 'student.letter.send', input), /STORAGE_MAINTENANCE/);
  assert.equal(hasUnconfirmedStudentStorageDraft(12, 'student.letter.send'), false);
  assert.deepEqual(loadStudentStorageFormDraft(12, 'student.letter.send'), input);
  const requestId = loadStudentStorageDraft(12, 'student.letter.send')?.requestId;
  assert.equal(typeof requestId, 'string');
  assert.equal(reads, 0); assert.equal(bodies.length, 1);
  await executeStudentStorageCommand(12, 'student.letter.send', input);
  assert.equal(reads, 0); assert.equal(bodies.length, 2);
  assert.equal(bodies[1].requestId, requestId);
  assert.equal(loadStudentStorageDraft(12, 'student.letter.send'), null);
});

test('확실히 중단된 초안은 편집할 수 있고 바뀐 내용은 새 요청으로 저장한다', async context => {
  const bodies: Record<string, unknown>[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.method, 'POST'); bodies.push(JSON.parse(String(init.body)));
    return bodies.length === 1 ? Response.json({ error: 'STORAGE_PROTOCOL_REQUIRED' }, { status: 409 }) : success();
  });
  await assert.rejects(executeStudentStorageCommand(13, 'student.failure.create', { failure: '초안' }), /PROTOCOL/);
  saveStudentStorageFormDraft(13, 'student.failure.create', { failure: '수정' });
  assert.equal(loadStudentStorageFormDraft(13, 'student.failure.create').failure, '수정');
  await executeStudentStorageCommand(13, 'student.failure.create', { failure: '수정' });
  assert.notEqual(bodies[0].requestId, bodies[1].requestId);
});

test('교사 업데이트 거절에서도 편지와 요청 ID를 보관한다', async context => {
  const command = { requestId: 'ignored-client-id', action: 'teacher.mail.send', payload: { recipients: [17], title: '합성', content: '합성 초안' } };
  const bodies: Record<string, unknown>[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.method, 'POST'); bodies.push(JSON.parse(String(init.body)));
    return bodies.length === 1 ? Response.json({ error: 'LEGACY_CLIENT_UPDATE_REQUIRED' }, { status: 426 }) : success();
  });
  await assert.rejects(executeTeacherStorageCommand(command), /UPDATE/);
  const pending = teacherStorageDrafts.load(teacherCommandScope(command));
  assert.deepEqual(pending?.draft.payload, command.payload);
  await executeTeacherStorageCommand(command);
  assert.equal(bodies[1].requestId, pending?.draft.requestId);
  assert.equal(teacherStorageDrafts.load(teacherCommandScope(command)), null);
});

test('새로고침은 초안 실제 보관을 확인하고 저장 공간 오류·변조에는 중단한다', () => {
  const values = new Map<string, string>();
  let fails = false;
  const storage = { getItem: (key: string) => { if (fails) throw new Error('unavailable'); return values.get(key) ?? null; }, setItem: (key: string, value: string) => { if (fails) throw new Error('full'); values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const scope = { studentNumber: 16, feature: 'reload-fixture', entityId: 'form' };
  const store = createStudentSaveDraftStore({ storage });
  const saved = store.save(scope, { title: '합성 초안' });
  assert.notEqual(saved.status, 'invalid');
  assert.equal(canReloadWithDrafts(16), true);
  const reloaded = createStudentSaveDraftStore({ storage });
  assert.deepEqual(reloaded.load(scope)?.draft, store.load(scope)?.draft);
  fails = true;
  assert.equal(canReloadWithDrafts(16), false);
  assert.equal(canReloadWithDrafts(15), true);
  fails = false;
  values.clear(); assert.equal(canReloadWithDrafts(16), false);
  if (saved.status !== 'invalid') store.confirm(scope, saved.draft.requestId);
});
