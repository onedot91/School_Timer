import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { parseSaveFailureAlert, parseSaveFailureDiagnostics } from './saveFailure.js';
import { SAVE_FAILURE_STORAGE_KEY } from './saveFailureClient.js';
import { canReloadWithDrafts } from './draftReloadSafety.js';
import type { StudentDraftDatabase, StudentDraftDatabaseEntry } from './studentDraftDatabase.js';

test('임시 보관 실패는 원인과 요청을 남기되 내용·저장 키를 수집하거나 반복 편집마다 신고하지 않는다', async t => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: storage, location: { hash: '' } }) });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); });
  let sequence = 0;
  const store = createStudentSaveDraftStore({ storage: { ...storage, setItem: () => { throw new DOMException('private answer token=secret', 'QuotaExceededError'); } },
    createRequestId: () => `draft-diagnostic-${++sequence}` });
  t.after(() => store.dispose());
  const scope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'private entity' };
  store.replace(scope, { answer: 'private student text' });
  await store.flush();
  const raw: unknown = JSON.parse(values.get(SAVE_FAILURE_STORAGE_KEY) ?? '[]');
  assert.ok(Array.isArray(raw));
  assert.equal(raw.length, 1);
  const report = parseSaveFailureAlert(raw[0]);
  assert.equal(report?.code, 'storage');
  assert.equal(report?.diagnostics?.causeCode, 'LOCAL_DRAFT_QUOTA_EXCEEDED');
  assert.equal(report?.diagnostics?.requestId, 'draft-diagnostic-1');
  assert.equal(report?.diagnostics?.stage, 'draft');
  assert.equal(Reflect.get(report?.diagnostics ?? {}, 'storageBackend'), 'localStorage');
  assert.equal(Reflect.get(report?.diagnostics ?? {}, 'storageOperation'), 'write');
  assert.doesNotMatch(JSON.stringify(raw), /private|secret|answer|entity/);
  store.replace(scope, { answer: 'private student text updated' });
  await store.flush();
  assert.equal(JSON.parse(values.get(SAVE_FAILURE_STORAGE_KEY) ?? '[]').length, 1);
  assert.equal(canReloadWithDrafts(0), false);
});

test('임시 저장 진단은 허용된 저장소·단계·시간만 통과시킨다', () => {
  assert.deepEqual(parseSaveFailureDiagnostics({ storageBackend: 'indexedDB', storageOperation: 'replace', elapsedMs: 512, errorName: 'SecurityError' }),
    { storageBackend: 'indexedDB', storageOperation: 'replace', elapsedMs: 512, errorName: 'SecurityError' });
  assert.equal(parseSaveFailureDiagnostics({ storageBackend: 'private-url', storageOperation: 'private answer', elapsedMs: Infinity, errorName: 'secret' }), undefined);
});

test('저장 대기와 같은 큐에서 복구된 실패는 오류 알림으로 남지 않는다', async t => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
    location: { hash: '' },
  }) });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); });
  let complete = (_value: StudentDraftDatabaseEntry): void => {};
  const pending = new Promise<StudentDraftDatabaseEntry>(resolve => { complete = resolve; });
  let entered = (): void => {};
  const started = new Promise<void>(resolve => { entered = resolve; });
  let saved: StudentDraftDatabaseEntry | null = null;
  const database: StudentDraftDatabase = {
    readAll: async () => [], get: async () => saved, getLegacy: async () => null, migrateLegacy: async () => null,
    insert: async entry => { saved = entry; entered(); return pending; },
    replace: async () => false, remove: async () => false,
  };
  const scope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'synthetic' };
  const store = createStudentSaveDraftStore({ database, storage: null });
  t.after(() => store.dispose());
  store.save(scope, { text: 'synthetic' });
  await started;
  assert.equal(canReloadWithDrafts(0), false);
  assert.equal(values.get(SAVE_FAILURE_STORAGE_KEY), undefined);
  assert.ok(saved);
  complete(saved);
  await store.flush();
  assert.equal(canReloadWithDrafts(0), true);
  assert.equal(values.get(SAVE_FAILURE_STORAGE_KEY), undefined);
  let writes = 0;
  const recovering = createStudentSaveDraftStore({ database: { ...database, readAll: async () => [], insert: async entry => {
    if (++writes === 1) throw new DOMException('transient', 'AbortError');
    return entry;
  } }, storage: null });
  t.after(() => recovering.dispose());
  const result = await recovering.saveDurable({ ...scope, entityId: 'recovering' }, { text: 'synthetic' });
  assert.notEqual(result.status, 'invalid');
  assert.equal(canReloadWithDrafts(0), true);
  assert.equal(values.get(SAVE_FAILURE_STORAGE_KEY), undefined);
});
