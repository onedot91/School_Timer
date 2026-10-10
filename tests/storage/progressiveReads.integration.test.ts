import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fixtureCookie, startHttpHarness, fakeClassroom } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { StorageResponseOrder } from '../../src/lib/storageResponseOrder.js';
import { parseStorageProjectionPatch } from '../../src/lib/storageProjectionPatch.js';

test('teacher revision manifests transfer changed fields and retain late commits, deletions and student isolation', async () => {
  const h = await startHttpHarness({ name: `storage_http_test_reads_${process.pid}_${Date.now()}`, port: 0,
    initialValue: { ...fakeClassroom(), dailyWriting: { fixture: 'a'.repeat(40000) }, scheduleNotice: 'before' } });
  const previous = process.env.STORAGE_PROGRESSIVE_READS;
  const evidence: unknown[] = [];
  try {
    await h.query(await readFile(new URL('../../supabase/storage_progressive_reads.sql', import.meta.url), 'utf8'));
    process.env.STORAGE_PROGRESSIVE_READS = '1';
    const order = new StorageResponseOrder(), context = order.capture('0');
    let manifest: Record<string, unknown> | undefined;
    const get = async (actor = 0, extra: Record<string, string> = {}, query = 'changes=1') => {
      const started = performance.now(), count = h.metrics.length;
      const response = await fetch(`${h.baseUrl}/api/shared-settings?${query}`, { headers: {
        Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1',
        ...(manifest ? { 'X-Storage-Read-Manifest': JSON.stringify(manifest) } : {}), ...extra,
      } });
      const text = await response.text(), body: unknown = JSON.parse(text);
      assert.equal(response.status, 200, text); assert.ok(isStorageRecord(body));
      evidence.push({ actor, query, bytes: Buffer.byteLength(text), milliseconds: performance.now() - started, rpc: h.metrics.slice(count) });
      return body;
    };
    const accept = (body: Record<string, unknown>) => {
      assert.ok(isStorageRecord(body.value)); assert.equal(typeof body.updated_at, 'string'); assert.ok(isStorageRecord(body.readManifest));
      manifest = body.readManifest;
      return order.accept(context, { value: body.value, updatedAt: String(body.updated_at), scope: 'full', storagePatch: parseStorageProjectionPatch(body.storagePatch) }, '0').value;
    };
    const first = await get(); accept(first);
    manifest = undefined;
    const compactTeacher = await get(0, { 'X-Storage-Compact': '1' });
    assert.equal(compactTeacher.encoding, 'storage-patch');
    assert.equal(compactTeacher.value, undefined);
    assert.equal(parseStorageProjectionPatch(compactTeacher.storagePatch).complete, true);
    assert.ok(isStorageRecord(compactTeacher.readManifest));
    manifest = compactTeacher.readManifest;
    const idle = await get(); const idleValue = accept(idle);
    assert.equal(idleValue.scheduleNotice, 'before');
    assert.ok(JSON.stringify(idle).length < JSON.stringify(first).length / 5);
    await h.query("update storage_resources set value=jsonb_set(value,'{data}','null'::jsonb),revision=revision+1,updated_at='2000-01-01' where resource_key='/scheduleNotice'");
    const changed = await get(); const changedValue = accept(changed);
    assert.equal(changedValue.scheduleNotice, null);
    assert.deepEqual(changedValue.dailyWriting, { fixture: 'a'.repeat(40000) });
    assert.equal(isStorageRecord(changed.value) && Object.hasOwn(changed.value, 'dailyWriting'), false);
    await h.query("update storage_resources set deleted=true,revision=revision+1,updated_at='2000-01-01' where resource_key='/scheduleNotice'");
    const deleted = accept(await get()); assert.equal(Object.hasOwn(deleted, 'scheduleNotice'), false);
    const student = await get(7, { 'X-Storage-Compact': '1' });
    assert.equal(student.readManifest, undefined); assert.equal(student.value, undefined);
    assert.equal(student.encoding, 'storage-patch');
    const studentPatch = parseStorageProjectionPatch(student.storagePatch);
    assert.deepEqual(studentPatch.wallets.map(wallet => wallet.student_number), [7]);
    const overview = await get(7, {}, 'overview=1');
    assert.equal(overview.readScope, 'overview');
    const overviewPatch = parseStorageProjectionPatch(overview.storagePatch);
    assert.equal(overviewPatch.complete, false);
    assert.equal(overviewPatch.history.length, 0);
    assert.ok(!overviewPatch.resources.some(resource => resource.category === 'dailyWriting'));
    assert.ok(JSON.stringify(overview).length < JSON.stringify(student).length / 3);
    await h.query("insert into storage_resources(resource_key,category,owner_number,value) values('/legacy_field','legacy_field',null,'{\"kind\":\"value\",\"parentKey\":\"\",\"member\":\"legacy_field\",\"data\":\"preserve\"}')");
    const legacy = await get();
    assert.equal(parseStorageProjectionPatch(legacy.storagePatch).complete, true);
    assert.equal(accept(legacy).legacy_field, 'preserve');
    const permissions = await h.query("select provolatile,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service_role from pg_proc where proname='storage_load_teacher_changes'");
    assert.deepEqual(permissions.rows, [{ provolatile: 's', anon: false, authenticated: false, service_role: true }]);
    await mkdir('.omo/evidence/read-loading', { recursive: true });
    await writeFile('.omo/evidence/read-loading/postgres-metrics.json', JSON.stringify(evidence, null, 2));
  } finally {
    if (previous === undefined) delete process.env.STORAGE_PROGRESSIVE_READS; else process.env.STORAGE_PROGRESSIVE_READS = previous;
    await h.stop();
  }
});
