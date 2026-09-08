import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const run = (args, env) => spawnSync(process.execPath, ['dev/verifyRelease.mjs', ...args], { encoding: 'utf8', env });
test('release gate documents prerequisites and fails closed without them', () => {
  assert.equal(run(['--help'], {}).status, 0);
  const result = run(['--verify-env'], {});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_FIXTURE_REQUIRED/);
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
