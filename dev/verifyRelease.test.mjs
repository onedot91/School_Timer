import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { requireBrowserFixture } from '../tests/storage/saveReliabilityBrowser.mjs';

const run = (args, env) => spawnSync(process.execPath, ['dev/verifyRelease.mjs', ...args], { encoding: 'utf8', env });
test('release gate documents prerequisites and fails closed without them', () => {
  const help = run(['--help'], {});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /STORAGE_TEST_BROWSER_MODULE/);
  assert.match(help.stdout, /STORAGE_TEST_CHROMIUM_EXECUTABLE/);
  const result = run(['--verify-env'], {});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_FIXTURE_REQUIRED/);
});
test('browser release gate fails closed when browser prerequisites are missing', async () => {
  const modulePath = process.env.STORAGE_TEST_BROWSER_MODULE;
  const executablePath = process.env.STORAGE_TEST_CHROMIUM_EXECUTABLE;
  delete process.env.STORAGE_TEST_BROWSER_MODULE;
  delete process.env.STORAGE_TEST_CHROMIUM_EXECUTABLE;
  try { await assert.rejects(requireBrowserFixture(), /RELEASE_BROWSER_REQUIRED/); }
  finally {
    if (modulePath !== undefined) process.env.STORAGE_TEST_BROWSER_MODULE = modulePath;
    if (executablePath !== undefined) process.env.STORAGE_TEST_CHROMIUM_EXECUTABLE = executablePath;
  }
});
test('release gate rejects nonlocal databases before loading a driver', () => {
  const result = run(['--verify-env'], { STORAGE_TEST_PG_MODULE: '/missing', STORAGE_TEST_DATABASE_URL: 'postgresql://example.com:55439/postgres' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_LOCAL_DATABASE_REQUIRED/);
});
test('release gate rejects missing drivers without skipping checks', () => {
  const result = run(['--verify-env'], { STORAGE_TEST_PG_MODULE: '/missing', STORAGE_TEST_DATABASE_URL: 'postgresql://127.0.0.1:55439/postgres' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_PG_DRIVER_UNAVAILABLE/);
});
