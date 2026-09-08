import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';
import { splitStorageState } from '../../src/lib/storageV2Codec.js';

const harness = await startHttpHarness({ name: `storage_http_test_scope_bench_${process.pid}_${Date.now()}`, port: 0 });
try {
  const seed = splitStorageState({ studentLife: { letters: Array.from({ length: 460 }, (_, index) => ({
    id: `benchmark-seed-${index}`, recipient: index % 23 + 1, senderLabel: '합성 교사', senderStudentNumber: null,
    title: '합성 자료', content: '검증용'.repeat(100), createdAt: '2026-09-07T00:00:00Z', readAt: null,
  })) } });
  for (const resource of seed.resources) {
    await harness.query('insert into storage_resources(resource_key,category,owner_number,value,revision) values($1,$2,$3,$4,1) on conflict do nothing', [resource.resource_key, resource.category, resource.owner_number, resource.value]);
  }
  harness.metrics.length = 0;
  const times: number[] = [], responseBytes: number[] = [];
  let notice = '격리 검증 학급';
  for (let round = 0; round < 3; round++) {
    const results = await Promise.all(Array.from({ length: 24 }, async (_, actor) => {
      const requestId = `benchmark-${round}-${actor}`;
      const command = actor === 0
        ? { action: 'teacher.settings.patch', payload: { changes: [{ field: 'scheduleNotice', before: notice, after: `benchmark-${round}` }] } }
        : { action: 'student.letter.send', payload: { recipient: 0, title: '합성', content: '비교용 입력' } };
      const started = performance.now();
      const response = await fetch(`${harness.baseUrl}/api/shared-settings`, { method: 'POST', headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection':'1', 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolVersion: 2, requestId, ...command }) });
      const body = await response.text();
      assert.equal(response.status, 200, JSON.stringify({ body, metrics: harness.metrics.filter(metric => metric.code) }));
      times.push(performance.now() - started); responseBytes.push(Buffer.byteLength(body));
      const receipt = await fetch(`${harness.baseUrl}/api/shared-settings?requestId=${requestId}`, { headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection':'1' } });
      assert.equal(receipt.status, 200); await receipt.arrayBuffer();
      return response.status;
    }));
    assert.equal(results.length, 24); notice = `benchmark-${round}`;
  }
  const sorted = [...times].sort((a,b)=>a-b);
  const reads = harness.metrics.filter(metric => metric.rpc === 'storage_load_snapshot' || metric.rpc === 'storage_load_scope');
  const reconcile = (await harness.query('select storage_reconcile_wallets() result')).rows[0]?.result;
  assert.deepEqual(reconcile, []);
  console.log(JSON.stringify({ database: harness.name, node: process.version, sessions: 24, rounds: 3, commands: times.length,
    p50Ms: Math.round(sorted[Math.floor(sorted.length*.5)]), p95Ms: Math.round(sorted[Math.floor(sorted.length*.95)]),
    apiResponseBytes: responseBytes.reduce((a,b)=>a+b,0), rpcCounts: Object.fromEntries([...new Set(harness.metrics.map(item=>item.rpc))].map(rpc=>[rpc,harness.metrics.filter(item=>item.rpc===rpc).length])),
    rpcLatency: Object.fromEntries([...new Set(harness.metrics.map(item=>item.rpc))].map(rpc=>{ const values=harness.metrics.filter(item=>item.rpc===rpc&&item.milliseconds!==undefined).map(item=>item.milliseconds??0).sort((a,b)=>a-b);return [rpc,{p50:Math.round(values[Math.floor(values.length*.5)]??0),p95:Math.round(values[Math.floor(values.length*.95)]??0)}]; })),
    readRequestBytes: reads.reduce((sum,item)=>sum+(item.requestBytes??0),0), readResponseBytes: reads.reduce((sum,item)=>sum+(item.responseBytes??0),0), readRows: reads.reduce((sum,item)=>sum+(item.rows??0),0), reconciliation: reconcile }, null, 2));
} finally { await harness.stop(); }
