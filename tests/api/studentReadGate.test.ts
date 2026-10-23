import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScopedStorageMetadata, loadScopedStorageSnapshotForRead, pollScopedStorageMetadata } from '../../src/server/storageV2Repository.js';
import { StorageReadBusyError } from '../../src/server/storageReadPriority.js';

const scope = { resources: [{ path: '/scheduleNotice' }], wallets: [], history: [], writeResources: [], writeWallets: [] };
const marker = 'a'.repeat(32);
const snapshot = { kind: 'scoped', scope, wallets: [], history: [], deletedKeys: [], resources: [
  { resource_key: '', category: '', owner_number: null, value: { kind: 'object', parentKey: null, member: '' } },
  { resource_key: '/scheduleNotice', category: 'scheduleNotice', owner_number: null, value: { kind: 'value', parentKey: '', member: 'scheduleNotice', data: '합성' } }],
  orderingBounds: {}, revisions: {}, updated_at: '2026-10-23T00:00:00Z' };
const busy = () => Response.json({ code: 'P0001', message: 'STORAGE_READ_BUSY' }, { status: 400 });
const withGate = async (gate: string | undefined, fetcher: typeof fetch, run: () => Promise<void>) => {
  const originalFetch = globalThis.fetch;
  const original = process.env.STORAGE_STUDENT_READ_GATE;
  if (gate === undefined) delete process.env.STORAGE_STUDENT_READ_GATE; else process.env.STORAGE_STUDENT_READ_GATE = gate;
  globalThis.fetch = fetcher;
  try { await run(); }
  finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.STORAGE_STUDENT_READ_GATE; else process.env.STORAGE_STUDENT_READ_GATE = original;
  }
};

test('without the gate flag student reads keep the ungated RPCs', async () => {
  const paths: string[] = [];
  await withGate(undefined, async input => {
    paths.push(new URL(String(input)).pathname);
    return Response.json(snapshot);
  }, async () => {
    await loadScopedStorageSnapshotForRead({ url: 'https://gate-off.test', key: 'fixture' }, scope);
  });
  assert.deepEqual(paths, ['/rest/v1/rpc/storage_load_scope']);
});

test('gated student reads retry a busy classroom gate and then succeed', async () => {
  const paths: string[] = [];
  await withGate('1', async input => {
    paths.push(new URL(String(input)).pathname);
    return paths.length < 3 ? busy() : Response.json(snapshot);
  }, async () => {
    const loaded = await loadScopedStorageSnapshotForRead({ url: 'https://gate-retry.test', key: 'fixture' }, scope);
    assert.equal(loaded.value.scheduleNotice, '합성');
  });
  assert.deepEqual(paths, Array(3).fill('/rest/v1/rpc/storage_load_scope_student'));
});

test('a gate that stays busy ends as STORAGE_READ_BUSY within the wait budget', async () => {
  let calls = 0;
  const started = Date.now();
  await withGate('1', async () => { calls++; return busy(); }, async () => {
    await assert.rejects(loadScopedStorageMetadata({ url: 'https://gate-busy.test', key: 'fixture' }, scope), StorageReadBusyError);
  });
  assert.ok(calls >= 2);
  assert.ok(Date.now() - started < 2600);
});

test('gated polling uses the student poll RPC and keeps other database errors', async () => {
  const paths: string[] = [];
  await withGate('1', async input => {
    paths.push(new URL(String(input)).pathname);
    return Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 });
  }, async () => {
    await assert.rejects(pollScopedStorageMetadata({ url: 'https://gate-error.test', key: 'fixture' }, scope, marker),
      (error: unknown) => error instanceof Error && error.message === 'STORAGE_DATABASE_HTTP_500');
  });
  assert.deepEqual(paths, ['/rest/v1/rpc/storage_poll_scope_student']);
});
