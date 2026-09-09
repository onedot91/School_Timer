import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentSaveDraftStore as createStore, type StudentSaveDraft } from './studentSaveDraft.js';
import type { StudentDraftDatabase, StudentDraftDatabaseEntry } from './studentDraftDatabase.js';
import { canReloadWithDrafts, getUnsafeDraftRecoveryText } from './draftReloadSafety.js';

const stores: ReturnType<typeof createStore>[] = [];
const createStudentSaveDraftStore: typeof createStore = options => { const store = createStore(options); stores.push(store); return store; };
test.afterEach(() => { for (const store of stores.splice(0)) store.dispose(); });

const scope = { studentNumber: 18, feature: 'draft-database-test', entityId: 'compose' };
const fixture = () => {
  const entries = new Map<string, StudentDraftDatabaseEntry>();
  const legacyEntries = new Map<string, StudentDraftDatabaseEntry>();
  let blocked = false;
  let serial = Promise.resolve();
  const transaction = <T>(operation: () => T): Promise<T> => {
    const result = serial.then(() => { if (blocked) throw new Error('database unavailable'); return operation(); });
    serial = result.then(() => {}, () => {});
    return result;
  };
  const database: StudentDraftDatabase = {
    readAll: () => transaction(() => [...entries.values()]),
    get: key => transaction(() => entries.get(key) ?? null),
    getLegacy: (key, requestId) => transaction(() => legacyEntries.get(JSON.stringify([key, requestId])) ?? null),
    migrateLegacy: entry => transaction(() => {
      const marker = JSON.stringify([entry.key, entry.requestId]);
      const migrated = legacyEntries.has(marker);
      if (!migrated) legacyEntries.set(marker, entry);
      if (!migrated && !entries.has(entry.key)) entries.set(entry.key, entry);
      return entries.get(entry.key) ?? null;
    }),
    insert: entry => transaction(() => {
      const current = entries.get(entry.key);
      if (current) return current;
      entries.set(entry.key, entry);
      return entry;
    }),
    replace: (entry, expectedId) => transaction(() => {
      const current = entries.get(entry.key);
      if (current && current.requestId !== expectedId) return false;
      entries.set(entry.key, entry);
      return true;
    }),
    remove: (key, requestId) => transaction(() => {
      if (entries.get(key)?.requestId !== requestId) return false;
      entries.delete(key);
      return true;
    }),
  };
  return { database, entries, block: (value: boolean) => { blocked = value; } };
};

test('두 탭의 같은 제출은 먼저 보관된 요청 ID와 내용으로 수렴한다', async () => {
  const { database, entries } = fixture();
  const first = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'tab-1' });
  const second = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'tab-2' });
  const results = await Promise.all([first.saveDurable(scope, { text: '동일 제출' }), second.saveDurable(scope, { text: '동일 제출' })]);
  for (const result of results) {
    assert.notEqual(result.status, 'invalid');
    if (result.status !== 'invalid') { assert.equal(result.draft.requestId, 'tab-1'); assert.equal(result.durable, true); }
  }
  assert.equal(entries.size, 1);
});

test('두 탭의 서로 다른 제출은 기존 의도를 수정하거나 새 요청을 전송하지 않는다', async () => {
  const { database } = fixture();
  const first = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'first-intent' });
  const second = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'second-intent' });
  await first.ready(); await second.ready();
  const [a, b] = await Promise.all([first.saveDurable(scope, { text: 'A' }), second.saveDurable(scope, { text: 'B' })]);
  assert.equal(a.status, 'saved');
  assert.equal(b.status, 'payload_changed');
  assert.equal(b.draft.requestId, 'first-intent');
});

test('느린 초안 쓰기 중 C를 보존하고 이전 응답 확인은 새 버전에 영향을 주지 않는다', async () => {
  const { database } = fixture();
  let sequence = 0;
  const store = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => `edit-${++sequence}` });
  store.replace(scope, { text: 'A' });
  store.replace(scope, { text: 'B' });
  store.replace(scope, { text: 'C' });
  assert.equal(canReloadWithDrafts(18), false);
  assert.match(getUnsafeDraftRecoveryText(18), /C/);
  await store.flush();
  assert.equal(canReloadWithDrafts(18), true);
  assert.equal(await store.confirmDurable(scope, 'edit-1'), false);
  const reloaded = createStudentSaveDraftStore({ database, storage: null });
  await reloaded.ready();
  assert.deepEqual(reloaded.load(scope)?.draft.payload, { text: 'C' });
  assert.equal(reloaded.load(scope)?.draft.requestId, 'edit-3');
});

test('다른 탭의 최신 편집을 덮지 않고 충돌한 내 입력도 메모리에 보관한다', async () => {
  const { database } = fixture();
  const initial = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'initial' });
  initial.replace(scope, { text: 'initial' }); await initial.flush();
  const first = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'first-edit' });
  const second = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'second-edit' });
  await Promise.all([first.ready(), second.ready()]);
  first.replace(scope, { text: 'first tab' }); await first.flush();
  second.replace(scope, { text: 'second tab' }); await second.flush();
  assert.equal(second.load(scope)?.durable, false);
  assert.deepEqual(second.load(scope)?.draft.payload, { text: 'second tab' });
  const restored = createStudentSaveDraftStore({ database, storage: null });
  await restored.ready();
  assert.deepEqual(restored.load(scope)?.draft.payload, { text: 'first tab' });
});

test('DB 저장 실패에도 최신 초안을 유지하고 복구 후 동일 요청 ID로 보관한다', async () => {
  const { database, block } = fixture();
  const store = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'recover-intent' });
  await store.ready(); block(true);
  const pending = await store.saveDurable(scope, { text: 'unconfirmed' });
  assert.notEqual(pending.status, 'invalid');
  assert.equal(store.load(scope)?.durable, false);
  assert.equal(canReloadWithDrafts(18), false);
  block(false);
  const retried = await store.saveDurable(scope, { text: 'unconfirmed' });
  assert.notEqual(retried.status, 'invalid');
  if (retried.status !== 'invalid') { assert.equal(retried.durable, true); assert.equal(retried.draft.requestId, 'recover-intent'); }
});

test('localStorage v1 초안은 DB 재조회 확인 후 같은 요청 ID로 이전한다', async () => {
  const { database } = fixture();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  const legacy = createStudentSaveDraftStore({ storage, createRequestId: () => 'legacy-id' });
  legacy.save(scope, { text: 'legacy content' });
  assert.equal(values.size, 1);
  const migrated = createStudentSaveDraftStore({ database, storage });
  await migrated.ready();
  assert.equal(values.size, 0);
  assert.equal(migrated.load(scope)?.draft.requestId, 'legacy-id');
  assert.deepEqual(migrated.load(scope)?.draft.payload, { text: 'legacy content' });
  assert.equal(migrated.load(scope)?.durable, true);
});

test('이전 DB 저장이나 재조회 실패에서는 legacy 원본을 지우지 않는다', async () => {
  const { database, block } = fixture();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  createStudentSaveDraftStore({ storage, createRequestId: () => 'legacy-preserved' }).save(scope, { text: 'legacy content' });
  block(true);
  const migrated = createStudentSaveDraftStore({ database, storage });
  await migrated.ready();
  assert.equal(values.size, 1);
  assert.equal(migrated.load(scope)?.draft.requestId, 'legacy-preserved');
});

test('기능별 legacy 요청을 정확한 ID로 import하고 다른 학생 목록에 노출하지 않는다', async () => {
  const { database } = fixture();
  const store = createStudentSaveDraftStore({ database, storage: null });
  const legacy: StudentSaveDraft = { version: 1, scope, requestId: 'legacy-feature-id', createdAt: '2026-09-09T00:00:00Z', payload: { answer: 'draft' } };
  const result = await store.importDurable(legacy);
  assert.notEqual(result.status, 'invalid');
  if (result.status !== 'invalid') { assert.equal(result.durable, true); assert.equal(result.draft.requestId, legacy.requestId); }
  assert.equal(store.list(18).length, 1);
  assert.equal(store.list(17).length, 0);
});

test('실패한 중간 편집 뒤 최신 편집은 마지막 확인 버전을 기준으로 다시 보관한다', async () => {
  const { database, block } = fixture();
  let sequence = 0;
  const store = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => `recovery-edit-${++sequence}` });
  store.replace(scope, { text: 'A' }); await store.flush();
  block(true); store.replace(scope, { text: 'B' }); await store.flush();
  block(false); store.replace(scope, { text: 'C' }); await store.flush();
  assert.equal(store.load(scope)?.durable, true);
  const restored = createStudentSaveDraftStore({ database, storage: null });
  await restored.ready();
  assert.deepEqual(restored.load(scope)?.draft.payload, { text: 'C' });
});

test('다른 store의 정상 조회가 충돌한 내 입력의 새로고침 보호를 해제하지 않는다', async () => {
  const { database } = fixture();
  let version = 0;
  const first = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => `origin-${++version}` });
  first.replace(scope, { text: 'original' }); await first.flush();
  const stale = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'stale' });
  await stale.ready();
  first.replace(scope, { text: 'current' }); await first.flush();
  stale.replace(scope, { text: 'unsaved in other store' }); await stale.flush();
  const reader = createStudentSaveDraftStore({ database, storage: null });
  await reader.ready();
  assert.equal(canReloadWithDrafts(18), false);
  assert.match(getUnsafeDraftRecoveryText(18), /unsaved in other store/);
});

test('legacy 삭제가 차단되어도 확인 완료한 ID를 새 store가 되살리지 않는다', async () => {
  const { database } = fixture();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: () => { throw new Error('legacy deletion blocked'); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  createStudentSaveDraftStore({ storage, createRequestId: () => 'confirmed-legacy' }).save(scope, { text: 'old submitted text' });
  const migrated = createStudentSaveDraftStore({ database, storage }); await migrated.ready();
  assert.equal(await migrated.confirmDurable(scope, 'confirmed-legacy'), true);
  assert.equal(migrated.load(scope), null);
  assert.equal(values.size, 1);
  const restored = createStudentSaveDraftStore({ database, storage }); await restored.ready();
  assert.equal(restored.load(scope), null);
  assert.equal(restored.list(18).length, 0);
});

test('legacy A와 최신 DB B를 모두 보관하되 B 확인 뒤 A를 미확인 요청으로 재생성하지 않는다', async () => {
  const { database, entries } = fixture();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: () => { throw new Error('legacy deletion blocked'); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  createStudentSaveDraftStore({ storage, createRequestId: () => 'legacy-A' }).save(scope, { text: 'A' });
  const newer = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => 'current-B' });
  await newer.saveDurable(scope, { text: 'B' });
  const key = [...entries.keys()][0];
  const migrated = createStudentSaveDraftStore({ database, storage }); await migrated.ready();
  assert.equal(migrated.load(scope)?.draft.requestId, 'current-B');
  assert.equal((await database.getLegacy(key, 'legacy-A'))?.requestId, 'legacy-A');
  assert.equal(await migrated.confirmDurable(scope, 'current-B'), true);
  const restored = createStudentSaveDraftStore({ database, storage }); await restored.ready();
  assert.equal(restored.load(scope), null);
});

test('기능별 legacy 재import도 확인 완료 요청을 활성 슬롯에 되살리지 않는다', async () => {
  const { database } = fixture();
  const store = createStudentSaveDraftStore({ database, storage: null });
  const legacy: StudentSaveDraft = { version: 1, scope, requestId: 'own-key-confirmed', createdAt: '2026-09-09T00:00:00Z', payload: { answer: 'old answer' } };
  await store.importDurable(legacy);
  assert.equal(await store.confirmDurable(scope, legacy.requestId), true);
  const importedAgain = await store.importDurable(legacy);
  assert.equal(importedAgain.status, 'already_migrated');
  assert.equal(store.load(scope), null);
  assert.equal(store.list(18).length, 0);
});
