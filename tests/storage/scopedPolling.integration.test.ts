import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

test('scoped polling migration preserves all 23 HTTP projections and can be applied twice or reverted', async () => {
  const harness = await startHttpHarness({ name: `storage_http_test_polling_${process.pid}_${Date.now()}`, port: 0 });
  const previous = process.env.STORAGE_SCOPED_POLLING;
  const read = async (student: number, metadata = false): Promise<Record<string, unknown>> => {
    const response = await fetch(`${harness.baseUrl}/api/shared-settings${metadata ? '?metadata=1&scoped=1' : ''}`, { headers: { Cookie: fixtureCookie(student), 'X-Storage-Projection': '1' } });
    assert.equal(response.status, 200);
    const body: unknown = await response.json(); assert.ok(isStorageRecord(body)); return body;
  };
  try {
    const oldSql = await readFile(new URL('../../supabase/storage_scope_read_performance.sql', import.meta.url), 'utf8');
    const newSql = await readFile(new URL('../../supabase/storage_scoped_polling.sql', import.meta.url), 'utf8');
    await harness.query(oldSql);
    const students = Array.from({ length: 23 }, (_, index) => index + 1);
    const before = await Promise.all(students.map(student => read(student)));
    await harness.query(newSql);
    await harness.query(newSql);
    process.env.STORAGE_SCOPED_POLLING = '1';
    const after = await Promise.all(students.map(student => read(student)));
    after.forEach((row, index) => {
      assert.match(String(row.readVersion), /^[a-f0-9]{32}$/);
      const { readVersion: _version, ...projection } = row;
      assert.deepEqual(projection, before[index]);
    });
    const metadata = await Promise.all(students.map(student => read(student, true)));
    metadata.forEach((row, index) => assert.equal(row.readVersion, after[index].readVersion));
    delete process.env.STORAGE_SCOPED_POLLING;
    await harness.query(oldSql);
    assert.deepEqual(await Promise.all(students.map(student => read(student))), before);
    assert.equal((await read(1, true)).readVersion, undefined);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_SCOPED_POLLING; else process.env.STORAGE_SCOPED_POLLING = previous;
    await harness.stop();
  }
});
