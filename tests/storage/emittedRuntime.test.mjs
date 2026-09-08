import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emitServerModules, runBareNode, writeImportProbe, verifyServerRuntime } from '../../dev/verifyServerRuntime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = async (source, dependency) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'school-runtime-negative-'));
  await mkdir(resolve(directory, 'api'));
  await writeFile(resolve(directory, 'api/main.ts'), source);
  await writeFile(resolve(directory, 'api/dependency.ts'), dependency);
  return emitServerModules({ root: directory, entries: ['api/main.ts'], includeHarness: false });
};

test('bare Node accepts emitted valid imports without loader or specifier rewriting', async () => {
  const emission = await fixture("import { value } from './dependency.js'; export default function handler() { return value; }", 'export const value: number = 7;');
  assert.match(await readFile(resolve(emission.outputDirectory, 'api/main.js'), 'utf8'), /from '\.\/dependency\.js'/);
  const result = runBareNode(await writeImportProbe(emission));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(emission.moduleCount, 2);
});

test('bare Node rejects intentionally missing extension even though TypeScript resolves source', async () => {
  const emission = await fixture("import { value } from './dependency'; export default function handler() { return value; }", 'export const value = 7;');
  assert.match(await readFile(resolve(emission.outputDirectory, 'api/main.js'), 'utf8'), /from '\.\/dependency'/);
  const result = runBareNode(await writeImportProbe(emission));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
});

test('bare Node rejects intentionally missing runtime export', async () => {
  const emission = await fixture("import { absent } from './dependency.js'; export default function handler() { return absent; }", 'export const present = 7;');
  const result = runBareNode(await writeImportProbe(emission));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not provide an export named 'absent'/);
});

test('release runtime command exits nonzero with an actionable missing-driver error', () => {
  const result = spawnSync(process.execPath, ['dev/verifyServerRuntime.mjs'], {
    cwd: root, env: { PATH: process.env.PATH, STORAGE_TEST_PG_MODULE: '/nonexistent-school-runtime-pg-driver' }, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EMITTED_PG_DRIVER_REQUIRED/);
  assert.match(result.stderr, /No runtime gate was skipped/);
});

test('unavailable fixture database is an actionable failure rather than a skipped pass', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'school-runtime-db-negative-'));
  const driver = resolve(directory, 'unavailable-pg.cjs');
  await writeFile(driver, "exports.Client = class { async connect() { throw new Error('ECONNREFUSED'); } async end() {} };\n");
  const result = spawnSync(process.execPath, ['dev/verifyServerRuntime.mjs'], {
    cwd: root, env: { PATH: process.env.PATH, STORAGE_TEST_PG_MODULE: driver }, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EMITTED_FIXTURE_DATABASE_REQUIRED: Start the isolated PostgreSQL fixture/);
  assert.match(result.stderr, /No runtime gate was skipped/);
});

test('all real emitted API handlers run HTTP and PostgreSQL mutations in bare Node', async () => {
  const result = await verifyServerRuntime();
  assert.ok(result.handlerCount > 0);
  assert.ok(result.moduleCount >= result.handlerCount);
  assert.match(result.sourceHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.nodeExecArgv, []);
  assert.equal(result.fullCommandReads, 0);
  assert.deepEqual(result.reconciliation, []);
  console.log(JSON.stringify({ emittedRuntime: result }));
});
