import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { StudentReadQueue } from '../../src/server/storageReadPriority.js';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';

const beforePriority = process.env.STORAGE_TEACHER_PRIORITY, beforeProgressive = process.env.STORAGE_PROGRESSIVE_READS;
const h = await startHttpHarness({ name: `storage_http_test_priority_${process.pid}_${Date.now()}`, port: 0,
  initialValue: fakeClassroom(), rpcDelayMs: 40 });
const fetcher = globalThis.fetch;
const upstream = new StudentReadQueue(6, 128, 8000);
let activeStudents = 0, peakStudents = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.port !== String(h.gatewayPort)) return fetcher(input, init);
  const student = url.pathname.endsWith('/storage_load_scope');
  if (student) { activeStudents += 1; peakStudents = Math.max(peakStudents, activeStudents); }
  try {
    return await upstream.run(async () => {
      const response = await fetcher(input, init);
      return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    });
  } finally { if (student) activeStudents -= 1; }
};
const samples: Record<string, unknown>[] = [];
const get = async (actor: number) => {
  const started = performance.now();
  const response = await fetch(`${h.baseUrl}/api/shared-settings?${actor ? 'overview=1' : 'changes=1'}`, {
    headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1', 'X-Storage-Compact': '1' },
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  return performance.now() - started;
};
try {
  for (const file of ['storage_scoped_polling', 'storage_scope_history_read_performance', 'storage_scoped_read_execution',
    'storage_snapshot_execution', 'storage_ancestor_locks', 'storage_progressive_reads']) {
    await h.query(await readFile(new URL(`../../supabase/${file}.sql`, import.meta.url), 'utf8'));
  }
  process.env.STORAGE_PROGRESSIVE_READS = '1';
  for (const priority of ['0', '1']) {
    process.env.STORAGE_TEACHER_PRIORITY = priority;
    for (let round = 0; round < 3; round++) {
      h.metrics.length = 0; peakStudents = 0;
      const students = Array.from({ length: 23 }, (_, index) => get(index + 1));
      await new Promise(resolve => setTimeout(resolve, 25));
      const teachers = await Promise.all([get(0), get(0)]);
      const studentTimes = await Promise.all(students);
      assert.equal(h.metrics.length, 24);
      if (priority === '1') assert.ok(peakStudents <= 2);
      samples.push({ priority: priority === '1', round, teacherMs: teachers,
        studentMaxMs: Math.max(...studentTimes), peakStudentUpstreamRequests: peakStudents, rpc: h.metrics.length });
    }
  }
  await mkdir('.omo/evidence/teacher-priority', { recursive: true });
  await writeFile('.omo/evidence/teacher-priority/benchmark.json', JSON.stringify({
    fixture: '23 student reads followed 25ms later by 2 teachers; local PostgreSQL; synthetic 6-slot upstream, 80ms RPC round trip', samples,
  }, null, 2));
  console.log(JSON.stringify(samples, null, 2));
} finally {
  globalThis.fetch = fetcher;
  if (beforePriority === undefined) delete process.env.STORAGE_TEACHER_PRIORITY; else process.env.STORAGE_TEACHER_PRIORITY = beforePriority;
  if (beforeProgressive === undefined) delete process.env.STORAGE_PROGRESSIVE_READS; else process.env.STORAGE_PROGRESSIVE_READS = beforeProgressive;
  await h.stop();
}
