import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { STORAGE_REGRESSION_FILES, storageRegressionCommand, storageRegressionPassed } from '../../dev/verifyStorage.mjs';

test('필수 저장 검증은 명시된 PostgreSQL 테스트를 강제 활성화한다', () => {
  const invocation = storageRegressionCommand({ STORAGE_AUCTION_PSQL_TEST: '0' });
  assert.equal(invocation.options.env.STORAGE_AUCTION_PSQL_TEST, '1');
  assert.ok(invocation.args.includes('--test-reporter=tap'));
  assert.equal(STORAGE_REGRESSION_FILES.length, 6);
  assert.ok(STORAGE_REGRESSION_FILES.every(file => invocation.args.includes(file)));
});

test('테스트가 빠지거나 건너뛰거나 실패하면 저장 검증은 통과하지 않는다', () => {
  const stdout = '# tests 6\n# pass 6\n# fail 0\n# cancelled 0\n# skipped 0\n';
  assert.equal(storageRegressionPassed({ status: 0, stdout }), true);
  assert.equal(storageRegressionPassed({ status: 1, stdout }), false);
  assert.equal(storageRegressionPassed({ status: 0, stdout: '' }), false);
  assert.equal(storageRegressionPassed({ status: 0, stdout: stdout.replace('# tests 6', '# tests 5').replace('# pass 6', '# pass 5') }), false);
  assert.equal(storageRegressionPassed({ status: 0, stdout: stdout.replace('# skipped 0', '# skipped 1') }), false);
  assert.equal(storageRegressionPassed({ status: 0, stdout: stdout.replace('# fail 0', '# fail 1') }), false);
  const missing = spawnSync(process.execPath, ['dev/verifyStorage.mjs'], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /STORAGE_TEST_POSTGRES_REQUIRED: initdb/);
});

test('배포 전 검증과 기존 release 검증은 실제 저장 회귀 검사를 포함한다', async () => {
  const pkg: unknown = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg && typeof pkg === 'object');
  const scripts: unknown = Reflect.get(pkg, 'scripts');
  assert.ok(scripts && typeof scripts === 'object');
  assert.equal(Reflect.get(scripts, 'test:storage'), 'node dev/verifyStorage.mjs');
  assert.equal(Reflect.get(scripts, 'build'), 'node dev/buildVerified.mjs');
  assert.equal(Reflect.get(scripts, 'verify:predeploy'), 'npm run build');
  assert.match(Reflect.get(scripts, 'verify:checks'), /npm run lint && npm test .*npm run test:storage && npm run test:storage:load/);
  const release = await readFile(new URL('../../dev/verifyRelease.mjs', import.meta.url), 'utf8');
  assert.match(release, /\['storage-regressions', 'npm', \['run', 'test:storage'\]\]/);
});
