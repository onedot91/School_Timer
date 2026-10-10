import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

const original = process.env.STORAGE_COMBINED_COMMANDS;
const h = await startHttpHarness({ name: `storage_http_test_command_bench_${process.pid}_${Date.now()}`, port: 0, rpcDelayMs: 20 });
const percentile = (values: number[], fraction: number) => Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]);
try {
  for (const file of ['storage_scoped_polling', 'storage_scope_history_read_performance', 'storage_scoped_read_execution', 'storage_snapshot_execution', 'storage_ancestor_locks', 'storage_command_round_trips']) {
    await h.query(await readFile(new URL(`../../supabase/${file}.sql`, import.meta.url), 'utf8'));
  }
  for (const kind of ['letter', 'deposit'] as const) {
    for (const flag of ['0', '1']) {
      process.env.STORAGE_COMBINED_COMMANDS = flag;
      h.metrics.length = 0;
      const times: number[] = [];
      for (let sample = 0; sample < 12; sample++) {
        const id = `bench-${kind}-${flag}-${sample}`;
        const payload = kind === 'letter'
          ? { protocolVersion: 2, requestId: id, action: 'student.letter.send', payload: { recipient: 0, title: 'Synthetic benchmark', content: 'Disposable local fixture' } }
          : { protocolVersion: 2, requestId: id, studentNumber: sample + 1, action: { type: 'deposit', amount: 10 } };
        const started = performance.now();
        const response = await fetch(`${h.baseUrl}/api/${kind === 'letter' ? 'shared-settings' : 'student-economy'}`, { method: 'POST', headers: { Cookie: fixtureCookie(kind === 'letter' ? 1 : sample + 1), 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, body: JSON.stringify(payload) });
        const body: unknown = await response.json();
        assert.equal(response.status, 200, JSON.stringify(body)); assert.ok(isStorageRecord(body));
        times.push(performance.now() - started);
      }
      const counts = Object.fromEntries([...new Set(h.metrics.map(row => row.rpc))].map(rpc => [rpc, h.metrics.filter(row => row.rpc === rpc).length]));
      assert.equal(h.metrics.length, times.length * (flag === '1' ? 2 : 4));
      console.log(JSON.stringify({ scenario: kind, combined: flag === '1', requests: times.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), rpcCounts: counts, totalRpcs: h.metrics.length, syntheticRoundTripMs: 40, realLocalPostgres: true }));
    }
  }
  for (const flag of ['0', '1']) {
    process.env.STORAGE_COMBINED_COMMANDS = flag;
    h.metrics.length = 0;
    const times = await Promise.all(Array.from({ length: 25 }, async (_, client) => {
      const student = client < 23 ? client + 1 : 0;
      const id = `mixed-${flag}-${client}`;
      const payload = student
        ? { protocolVersion: 2, requestId: id, action: 'student.letter.send', payload: { recipient: 0, title: 'Synthetic concurrent benchmark', content: 'Disposable local fixture' } }
        : { protocolVersion: 2, requestId: id, action: 'teacher.currency.adjust', payload: { studentNumbers: [client - 1], amount: 6 } };
      const started = performance.now();
      const response = await fetch(`${h.baseUrl}/api/shared-settings`, { method: 'POST', headers: { Cookie: fixtureCookie(student), 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return performance.now() - started;
    }));
    assert.equal((await h.query('select count(*)::integer count from storage_receipts where request_id like $1', [`mixed-${flag}-%`])).rows[0]?.count, 25);
    assert.equal((await h.query("select count(*)::integer count from storage_resources where resource_key like $1 and not deleted", [`/studentLife/letters/@mixed-${flag}-%`])).rows[0]?.count, 23);
    for (const student of [22, 23]) assert.equal((await h.query('select balance from wallet_accounts where student_number=$1', [student])).rows[0]?.balance, flag === '0' ? 106 : 112);
    assert.deepEqual((await h.query('select storage_reconcile_wallets() result')).rows[0]?.result, []);
    const counts = Object.fromEntries([...new Set(h.metrics.map(row => row.rpc))].map(rpc => [rpc, h.metrics.filter(row => row.rpc === rpc).length]));
    console.log(JSON.stringify({ scenario: '25 simultaneous students23 teachers2', combined: flag === '1', requests: times.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.round(Math.max(...times)), rpcCounts: counts, totalRpcs: h.metrics.length, syntheticRoundTripMs: 40, receipts: 25, letters: 23, reconciliation: [] }));
  }
  assert.equal((await h.query('select balance from wallet_accounts where student_number=1')).rows[0]?.balance, 80);
  assert.deepEqual((await h.query('select storage_reconcile_wallets() result')).rows[0]?.result, []);
} finally {
  if (original === undefined) delete process.env.STORAGE_COMBINED_COMMANDS; else process.env.STORAGE_COMBINED_COMMANDS = original;
  await h.stop();
}
