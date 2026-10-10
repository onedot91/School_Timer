import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startHttpHarness, fakeClassroom } from '../../../tests/storage/httpHarness.js';

const h = await startHttpHarness({ name: `storage_http_test_teacher_priority_browser_${process.pid}`, port: Number(process.env.SCHOOL_PRIORITY_QA_PORT ?? '3021'),
  staticDirectory: resolve('.omo/evidence/teacher-priority/dist'), publicDirectory: resolve('public'), weeklyMissions: true,
  initialValue: fakeClassroom() });
for (const file of ['storage_scoped_polling', 'storage_scope_history_read_performance', 'storage_scoped_read_execution',
  'storage_snapshot_execution', 'storage_ancestor_locks', 'storage_progressive_reads', 'storage_command_round_trips']) {
  await h.query(await readFile(`supabase/${file}.sql`, 'utf8'));
}
process.env.STORAGE_PROGRESSIVE_READS = '1';
process.env.STORAGE_TEACHER_PRIORITY = '1';
process.env.STORAGE_COMBINED_COMMANDS = '1';
const fetcher = globalThis.fetch;
let offline = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (offline && url.port === String(h.gatewayPort)) return Response.json({ code: 'FIXTURE_OFFLINE' }, { status: 503 });
  return fetcher(input, init);
};
process.on('SIGUSR2', () => { offline = !offline; console.log(JSON.stringify({ offline })); });
process.on('SIGUSR1', () => { void h.query("update storage_resources set value=jsonb_set(value,'{data}',to_jsonb('교사 자동 갱신 확인'::text)),revision=revision+1,updated_at='2000-01-01' where resource_key='/scheduleNotice'")
  .then(() => writeFile('.omo/evidence/teacher-priority/browser-rpc-metrics.json', JSON.stringify(h.metrics, null, 2)))
  .then(() => console.log('SYNTHETIC_NOTICE_CHANGED')); });
process.once('SIGTERM', () => { void h.stop(); });
console.log(JSON.stringify({ pid: process.pid, url: h.baseUrl }));
