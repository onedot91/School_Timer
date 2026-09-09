import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStorageSnapshot, loadStorageSnapshotForRead, loadStorageUpdatedAt } from '../../src/server/storageV2Repository.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';

test('overlapping GET snapshots share reads but mutations and later GETs read afresh', async (t) => {
  const configuration = { url: 'https://snapshot-fixture.invalid', key: 'fixture' };
  const fixture = createStorageV2Fixture({ currencyBalances: { 1: 100, 2: 200 } });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    return fixture.fetch(input, init);
  });
  const reads = Array.from({ length: 24 }, () => loadStorageSnapshotForRead(configuration));
  await loadStorageSnapshot(configuration);
  await Promise.all(reads);
  assert.equal(calls, 2);
  await loadStorageSnapshotForRead(configuration);
  assert.equal(calls, 3);
});

test('metadata merges overlapping reads but keeps no completed value across saves', async (t) => {
  const configuration = { url: 'https://metadata-fixture.invalid', key: 'fixture' };
  let finish: (response: Response) => void = () => { throw new Error('No pending read'); };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (input: unknown) => {
    assert.equal(String(input), `${configuration.url}/rest/v1/rpc/storage_load_updated_at`);
    calls += 1;
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  const reads = Array.from({ length: 24 }, () => loadStorageUpdatedAt(configuration));
  assert.equal(calls, 1);
  finish(Response.json('2026-09-09T00:00:00Z'));
  assert.deepEqual(await Promise.all(reads), Array(24).fill('2026-09-09T00:00:00Z'));
  const afterSave = loadStorageUpdatedAt(configuration);
  assert.equal(calls, 2);
  finish(Response.json('2026-09-09T00:00:01Z'));
  assert.equal(await afterSave, '2026-09-09T00:00:01Z');
});

test('metadata failures clear pending reads and malformed responses fail closed', async (t) => {
  const configuration = { url: 'https://metadata-failure.invalid', key: 'fixture' };
  const responses = [Response.json({}, { status: 503 }), Response.json(null), Response.json('not-a-date'), Response.json('2026-09-09T00:00:00Z')];
  t.mock.method(globalThis, 'fetch', async () => responses.shift());
  await assert.rejects(loadStorageUpdatedAt(configuration), /STORAGE_DATABASE_HTTP_503/);
  await assert.rejects(loadStorageUpdatedAt(configuration), /STORAGE_INVALID_RESPONSE/);
  await assert.rejects(loadStorageUpdatedAt(configuration), /STORAGE_INVALID_RESPONSE/);
  assert.equal(await loadStorageUpdatedAt(configuration), '2026-09-09T00:00:00Z');
});

test('metadata does not merge different backend credentials', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls += 1; return Response.json('2026-09-09T00:00:00Z'); });
  await Promise.all(['first', 'second'].map(key => loadStorageUpdatedAt({ url: 'https://metadata-isolation.invalid', key })));
  assert.equal(calls, 2);
});
