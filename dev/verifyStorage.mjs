import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const STORAGE_REGRESSION_FILES = [
  'tests/storage/auctionFinalization.integration.test.ts',
  'tests/storage/settingsAndFailureScopes.integration.test.ts',
  'tests/storage/librarySaveContract.integration.test.ts',
  'tests/storage/auctionBidAtomic.integration.test.ts',
  'tests/storage/scopeReadBuffers.integration.test.ts',
  'tests/storage/studentReadGate.integration.test.ts',
];

export const storageRegressionCommand = (env = process.env) => ({
  command: process.execPath,
  args: ['--import', 'tsx', '--test', '--test-reporter=tap', ...STORAGE_REGRESSION_FILES],
  options: { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...env, STORAGE_AUCTION_PSQL_TEST: '1' },
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
});

export const storageRegressionPassed = (result) => {
  const count = (name) => Number(new RegExp(`^# ${name} (\\d+)\\s*$`, 'm').exec(result.stdout ?? '')?.[1] ?? NaN);
  return result.status === 0 && !result.error && count('tests') >= STORAGE_REGRESSION_FILES.length
    && count('pass') === count('tests') && count('fail') === 0 && count('skipped') === 0 && count('cancelled') === 0;
};

export const runStorageRegressions = (run = spawnSync) => {
  for (const program of ['initdb', 'pg_ctl', 'psql']) {
    const available = run(program, ['--version'], { encoding: 'utf8' });
    if (available.error || available.status !== 0) throw new Error(`STORAGE_TEST_POSTGRES_REQUIRED: ${program}`);
  }
  const { command, args, options } = storageRegressionCommand();
  const result = run(command, args, options);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (!storageRegressionPassed(result)) throw new Error('STORAGE_REGRESSION_FAILED: required PostgreSQL tests must pass without skips');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runStorageRegressions(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'STORAGE_REGRESSION_FAILED'); process.exitCode = 1; }
}
