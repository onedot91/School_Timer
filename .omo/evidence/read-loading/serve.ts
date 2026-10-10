import { startHttpHarness, fakeClassroom } from '../../../tests/storage/httpHarness.js';
import { readFile, writeFile } from 'node:fs/promises';
const h = await startHttpHarness({ name: 'storage_http_test_read_browser_20261010', port: 3019, weeklyMissions: true,
  initialValue: { ...fakeClassroom(), dailyWriting: { fixture: 'a'.repeat(40000) } } });
await h.query(await readFile('supabase/storage_progressive_reads.sql', 'utf8'));
process.env.STORAGE_PROGRESSIVE_READS = '1';
process.on('SIGUSR2', () => { process.env.STORAGE_PROGRESSIVE_READS = '1'; console.log('PROGRESSIVE_READS_ENABLED'); });
process.on('SIGUSR1', () => { void writeFile('.omo/evidence/read-loading/browser-rpc-metrics.json', JSON.stringify(h.metrics, null, 2)); });
process.once('SIGTERM', () => { void h.stop(); });
console.log(JSON.stringify({ pid: process.pid, url: h.baseUrl }));
