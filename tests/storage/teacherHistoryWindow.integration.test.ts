import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fixtureCookie, startHttpHarness, fakeClassroom } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { parseStorageProjectionPatch } from '../../src/lib/storageProjectionPatch.js';

const entry = (id: string, studentNumber: number, createdAt: string) => ({
  id, studentNumber, delta: 1, before: 100, after: 101, reason: 'manual', createdAt,
});

test('teacher first reads send only recent ledger rows and fall back to the full read before the SQL is applied', async () => {
  const recent = new Date().toISOString();
  const classroom = fakeClassroom();
  const h = await startHttpHarness({ name: `storage_http_test_history_window_${process.pid}_${Date.now()}`, port: 0, initialValue: {
    ...classroom,
    currencyHistory: { ...(isStorageRecord(classroom.currencyHistory) ? classroom.currencyHistory : {}),
      3: [entry('recent-3', 3, recent), entry('old-3', 3, '2026-01-05T00:00:00Z')],
      5: [entry('old-5', 5, '2026-02-01T00:00:00Z')] },
  } });
  const previous = process.env.STORAGE_PROGRESSIVE_READS;
  try {
    await h.query(await readFile(new URL('../../supabase/storage_progressive_reads.sql', import.meta.url), 'utf8'));
    await h.query(await readFile(new URL('../../supabase/storage_teacher_history_window.sql', import.meta.url), 'utf8'));
    process.env.STORAGE_PROGRESSIVE_READS = '1';
    const get = async (manifest?: unknown) => {
      const response = await fetch(`${h.baseUrl}/api/shared-settings?changes=1`, { headers: {
        Cookie: fixtureCookie(0), 'X-Storage-Projection': '1', 'X-Storage-Compact': '1',
        ...(manifest ? { 'X-Storage-Read-Manifest': JSON.stringify(manifest) } : {}),
      } });
      const text = await response.text(), body: unknown = JSON.parse(text);
      assert.equal(response.status, 200, text); assert.ok(isStorageRecord(body));
      return { body, timing: response.headers.get('server-timing'), patch: parseStorageProjectionPatch(body.storagePatch) };
    };
    const ids = (patch: ReturnType<typeof parseStorageProjectionPatch>) => patch.history.map(row => row.entry_id).sort();

    const first = await get();
    assert.match(first.timing ?? '', /^app;dur=\d+(\.\d)?, storage;dur=\d+(\.\d)?;desc="1 RPC"$/);
    assert.equal(first.patch.complete, true);
    assert.deepEqual(ids(first.patch), ['recent-3']);
    assert.equal(typeof first.body.historySince, 'string');
    const since = Date.parse(String(first.body.historySince));
    assert.ok(Date.now() - since > 13 * 86_400_000 && Date.now() - since <= 14 * 86_400_000);
    assert.deepEqual(Object.keys(first.patch.history[0] ?? {}).sort(), ['entry_id', 'resource_key', 'sort_order', 'student_number', 'value']);

    await h.query('update wallet_accounts set revision=revision+1 where student_number in (3,5)');
    const changed = await get(first.body.readManifest);
    assert.equal(changed.patch.complete, false);
    assert.deepEqual([...changed.patch.historyStudents].sort(), [3, 5]);
    assert.deepEqual(ids(changed.patch), ['recent-3']);

    const ledger = await h.query('select count(*)::integer count from wallet_ledger');
    assert.equal(ledger.rows[0]?.count, 3);
    const permissions = await h.query("select proname,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service_role from pg_proc where proname in ('storage_load_teacher_changes_v2','storage_load_snapshot_recent_history','storage_recent_history_rows','storage_teacher_history_since') order by proname");
    assert.equal(permissions.rows.length, 4);
    for (const row of permissions.rows) assert.deepEqual({ anon: row.anon, authenticated: row.authenticated, service_role: row.service_role }, { anon: false, authenticated: false, service_role: true });

    await h.query('drop function public.storage_load_teacher_changes_v2(jsonb)');
    const fallback = await get();
    assert.equal(fallback.body.historySince, undefined);
    assert.deepEqual(ids(fallback.patch), ['old-3', 'old-5', 'recent-3']);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_PROGRESSIVE_READS; else process.env.STORAGE_PROGRESSIVE_READS = previous;
    await h.stop();
  }
});
