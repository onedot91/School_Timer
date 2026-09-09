import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireBrowserFixture } from '../tests/storage/saveReliabilityBrowser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const releaseSourceHash = async () => {
  const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'index.html'];
  const walk = async (path) => {
    for (const entry of await readdir(resolve(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  for (const folder of ['src', 'api', 'supabase', 'dev', 'tests']) await walk(folder);
  const hash = createHash('sha256');
  for (const file of files.sort()) { hash.update(file); hash.update('\0'); hash.update(await readFile(resolve(root, file))); hash.update('\0'); }
  return hash.digest('hex');
};

const main = async () => {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run verify:release\nRequires STORAGE_TEST_PG_MODULE and STORAGE_TEST_DATABASE_URL pointing to the isolated PostgreSQL fixture at localhost:55439/postgres.\nRequires STORAGE_TEST_BROWSER_MODULE pointing to an installed Playwright module and STORAGE_TEST_CHROMIUM_EXECUTABLE pointing to Chromium. No package is downloaded automatically.\nRuns type checks, all tests, PostgreSQL/HTTP checks, emitted Node runtime, production build and isolated production-built browser save scenarios. Any missing prerequisite or failed check exits nonzero. Logs and source hash are written to a new private temporary directory.');
    return;
  }
  const driverPath = process.env.STORAGE_TEST_PG_MODULE;
  const databaseUrl = process.env.STORAGE_TEST_DATABASE_URL;
  if (!driverPath || !databaseUrl) throw new Error('RELEASE_FIXTURE_REQUIRED: set STORAGE_TEST_PG_MODULE and STORAGE_TEST_DATABASE_URL');
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error('RELEASE_LOCAL_DATABASE_REQUIRED'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.port !== '55439' || url.pathname !== '/postgres') throw new Error('RELEASE_LOCAL_DATABASE_REQUIRED: localhost:55439/postgres');
  let driver;
  try { driver = createRequire(import.meta.url)(driverPath); } catch { throw new Error('RELEASE_PG_DRIVER_UNAVAILABLE'); }
  if (typeof driver.Client !== 'function') throw new Error('RELEASE_PG_DRIVER_UNAVAILABLE');
  await requireBrowserFixture();
  const client = new driver.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try { await client.connect(); await client.query('select 1'); }
  catch { throw new Error('RELEASE_LOCAL_DATABASE_UNAVAILABLE'); }
  finally { await client.end(); }
  if (process.argv.includes('--verify-env')) { console.log('PASS isolated release prerequisites'); return; }
  const directory = await mkdtemp(resolve(tmpdir(), 'school-release-'));
  const sourceHash = await releaseSourceHash();
  const steps = [
    ['typecheck', 'npm', ['run', 'lint']],
    ['unit-api', 'npm', ['test']],
    ['server-dev', process.execPath, ['--import', 'tsx', '--test', 'src/server/storageV2Repository.test.ts', 'src/server/storageScope.test.ts', 'dev/storageCutover.test.ts', 'dev/verifyRelease.test.mjs', 'dev/storageBackup.test.ts']],
    ['storage-sql', process.execPath, ['--import', 'tsx', '--test', 'src/server/storageV2.integration.test.mjs', 'src/server/storageScope.integration.test.mjs']],
    ['reward-sql', process.execPath, ['tests/storage/run-rewards-v2.mjs']],
    ['classword-sql', process.execPath, ['tests/storage/classword-concurrency.mjs']],
    ['http', process.execPath, ['--import', 'tsx', '--test', 'tests/storage/httpHarness.test.ts', 'tests/storage/rewardAudit.test.ts', 'tests/storage/economyScope.integration.test.ts']],
    ['emitted-runtime', process.execPath, ['--test', 'tests/storage/emittedRuntime.test.mjs']],
    ['restore-drill', process.execPath, ['--import', 'tsx', 'dev/storageRestoreDrill.ts']],
    ['production-build', 'npm', ['run', 'build']],
    ['save-browser', process.execPath, ['tests/storage/saveReliabilityBrowser.mjs']],
    ['save-full-stack', process.execPath, ['--import', 'tsx', 'tests/storage/saveReliabilityFullStack.ts']],
  ];
  const results = [];
  for (const [name, command, args] of steps) {
    console.log(`RUN ${name}`);
    const started = Date.now();
    const child = spawnSync(command, args, { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
    await writeFile(resolve(directory, `${name}.log`), `${child.stdout ?? ''}\n${child.stderr ?? ''}`, { mode: 0o600, flag: 'wx' });
    const passed = child.status === 0 && !child.error;
    results.push({ name, passed, milliseconds: Date.now() - started });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
    if (!passed) break;
  }
  const unchanged = sourceHash === await releaseSourceHash();
  const passed = unchanged && results.length === steps.length && results.every(step => step.passed);
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ passed, node: process.version, sourceHash, unchanged, results }, null, 2), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ passed, sourceHash, unchanged, evidence: directory }));
  if (!passed) process.exitCode = 1;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(error => { console.error(error instanceof Error ? error.message : 'RELEASE_FAILED'); process.exitCode = 1; });
}
