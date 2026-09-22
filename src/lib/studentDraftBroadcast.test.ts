import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import type { StudentDraftDatabase, StudentDraftDatabaseEntry } from './studentDraftDatabase.js';

const scope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'broadcast-test' };

const fixture = (context: TestContext) => {
  const globals = ['window', 'BroadcastChannel'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const channels: FakeBroadcastChannel[] = [];
  class FakeBroadcastChannel {
    onmessage: ((event: { data: string }) => void) | null = null;
    constructor() { channels.push(this); }
    postMessage() {}
    close() {}
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: FakeBroadcastChannel });
  const entries = new Map<string, StudentDraftDatabaseEntry>();
  const pendingReads: { release: () => Promise<void> }[] = [];
  const database: StudentDraftDatabase = {
    readAll: async () => [...entries.values()],
    get: key => {
      const captured = entries.get(key) ?? null;
      let resolveRead: (entry: StudentDraftDatabaseEntry | null) => void = () => {};
      const result = new Promise<StudentDraftDatabaseEntry | null>(resolve => { resolveRead = resolve; });
      pendingReads.push({ release: async () => { resolveRead(captured); await result; } });
      return result;
    },
    getLegacy: async () => null,
    migrateLegacy: async entry => entry,
    insert: async entry => {
      const current = entries.get(entry.key);
      if (current) return current;
      entries.set(entry.key, entry);
      return entry;
    },
    replace: async (entry, expectedId) => {
      const current = entries.get(entry.key);
      if (current && current.requestId !== expectedId) return false;
      entries.set(entry.key, entry);
      return true;
    },
    remove: async (key, requestId) => {
      if (entries.get(key)?.requestId !== requestId) return false;
      entries.delete(key);
      return true;
    },
  };
  let sequence = 0;
  const store = createStudentSaveDraftStore({ database, storage: null, createRequestId: () => `broadcast-${++sequence}` });
  context.after(() => {
    store.dispose();
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  const broadcast = () => {
    const key = [...entries.keys()][0];
    assert.ok(key);
    assert.equal(channels.length, 1);
    channels[0].onmessage?.({ data: key });
    return key;
  };
  return { store, entries, pendingReads, channels, broadcast };
};

test('늦은 탭 알림 조회는 그동안 보관된 최신 로컬 편집을 덮어쓰지 않는다', async context => {
  const { store, pendingReads, broadcast } = fixture(context);
  await store.saveDurable(scope, { text: 'A' });
  broadcast();
  assert.equal(pendingReads.length, 1);
  store.replace(scope, { text: 'B' });
  await store.flush();
  assert.deepEqual(store.load(scope)?.draft.payload, { text: 'B' });
  assert.equal(store.load(scope)?.durable, true);

  await pendingReads[0].release();

  assert.deepEqual(store.load(scope)?.draft.payload, { text: 'B' });
  assert.equal(store.load(scope)?.draft.requestId, 'broadcast-2');
  assert.equal(store.load(scope)?.durable, true);
});

test('오래된 탭 알림 조회는 다른 탭에서 확인되어 제거된 초안을 되살리지 않는다', async context => {
  const { store, entries, pendingReads, channels, broadcast } = fixture(context);
  await store.saveDurable(scope, { text: 'A' });
  const key = broadcast();
  entries.delete(key);
  channels[0].onmessage?.({ data: key });
  assert.equal(pendingReads.length, 2);

  await pendingReads[1].release();
  assert.equal(store.load(scope), null);
  await pendingReads[0].release();

  assert.equal(store.load(scope), null);
  assert.equal(store.list(0).length, 0);
});
