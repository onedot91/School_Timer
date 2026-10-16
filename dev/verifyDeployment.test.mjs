import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyDeployment } from './verifyDeployment.mjs';
import { releaseSourceHash } from './releaseSourceHash.mjs';
import { verifyClassroomTimings } from './storageBudgets.mjs';

const sha = 'a'.repeat(40), sourceHash = 'b'.repeat(64);
const env = { VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'fixture', VERCEL_GIT_REPO_SLUG: 'school-timer',
  VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_REF: 'main' };
const run = (overrides = {}) => ({ id: 31, head_sha: sha, head_branch: 'main', event: 'push',
  path: '.github/workflows/storage-verify.yml', head_repository: { full_name: 'fixture/school-timer' },
  status: 'completed', conclusion: 'success', ...overrides });
const job = (overrides = {}) => ({ name: 'Storage verification', head_sha: sha, status: 'completed', conclusion: 'success',
  steps: [{ name: `verified-source-${sourceHash}`, status: 'completed', conclusion: 'success' }], ...overrides });
const fake = (runs = [run()], jobs = [job()]) => async url => Response.json(String(url).includes('/jobs?') ? { jobs } : { workflow_runs: runs });

test('only successful verification of this commit and uploaded source permits the build', async () => {
  assert.deepEqual(await verifyDeployment({ env, sourceHash, fetcher: fake() }), { repository: 'fixture/school-timer', sha, sourceHash, runId: 31 });
});

for (const [name, overrides] of [
  ['different commit', { head_sha: 'c'.repeat(40) }], ['different branch', { head_branch: 'other' }],
  ['pull request run', { event: 'pull_request' }], ['other workflow', { path: '.github/workflows/other.yml' }],
  ['fork run', { head_repository: { full_name: 'other/school-timer' } }],
]) {
  test(`${name} cannot approve this deployment`, async () => {
    let clock = 0;
    await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: fake([run(overrides)]), now: () => clock,
      wait: async ms => { clock += ms; }, timeoutMs: 10 }), /DEPLOYMENT_VERIFICATION_TIMEOUT/);
  });
}

for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral']) {
  test(`${conclusion} verification blocks the build immediately`, async () => {
    await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: fake([run({ conclusion })]) }), /DEPLOYMENT_VERIFICATION_FAILED/);
  });
}

test('a later failed run cannot reuse an earlier successful run', async () => {
  await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: fake([run(), run({ id: 32, conclusion: 'failure' })]) }), /DEPLOYMENT_VERIFICATION_FAILED/);
});

for (const jobs of [[], [job({ conclusion: 'skipped' })], [job({ head_sha: 'c'.repeat(40) })],
  [job({ steps: [{ name: `verified-source-${'d'.repeat(64)}`, status: 'completed', conclusion: 'success' }] })],
  [job({ steps: [{ name: `verified-source-${sourceHash}`, status: 'completed', conclusion: 'skipped' }] })]]) {
  test('missing, stale, or skipped source proof blocks the build', async () => {
    await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: fake([run()], jobs) }), /DEPLOYMENT_SOURCE_NOT_VERIFIED/);
  });
}

test('queued verification is checked automatically without user approval', async () => {
  let clock = 0, reads = 0;
  const fetcher = async url => {
    if (!String(url).includes('/jobs?') && reads++ === 0) return Response.json({ workflow_runs: [run({ status: 'queued', conclusion: null })] });
    return fake()(url);
  };
  assert.equal((await verifyDeployment({ env, sourceHash, fetcher, now: () => clock, wait: async ms => { clock += ms; } })).runId, 31);
  assert.equal(clock, 15_000);
});

test('missing checks and unavailable GitHub fail closed without exposing credentials', async () => {
  let clock = 0;
  await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: fake([]), now: () => clock,
    wait: async ms => { clock += ms; }, timeoutMs: 20 }), /DEPLOYMENT_VERIFICATION_TIMEOUT/);
  for (const status of [401, 403, 404, 429, 500]) {
    await assert.rejects(verifyDeployment({ env: { ...env, DEPLOYMENT_GITHUB_TOKEN: 'private-token' }, sourceHash,
      fetcher: async (url, options) => {
        assert.equal(new URL(url).origin, 'https://api.github.com');
        assert.equal(options.redirect, 'error');
        return new Response('private body', { status });
      } }), new RegExp(`^Error: DEPLOYMENT_CHECK_HTTP_${status}$`));
  }
  await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: async () => { throw new Error('private network details'); } }), /^Error: DEPLOYMENT_CHECK_UNAVAILABLE$/);
  await assert.rejects(verifyDeployment({ env, sourceHash, fetcher: async () => Response.json({}) }), /DEPLOYMENT_CHECK_INVALID_RESPONSE/);
  await assert.rejects(verifyDeployment({ env: {}, sourceHash, fetcher: async () => assert.fail('must reject before network') }), /DEPLOYMENT_GIT_IDENTITY_REQUIRED/);
});

test('the source fingerprint changes with runtime assets, SQL and workflow, but excludes local metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-source-hash-'));
  for (const folder of ['src', 'api', 'public', 'supabase', 'dev', 'tests', '.github/workflows']) await mkdir(join(directory, folder), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'index.html', '.vercelignore']) await writeFile(join(directory, file), '{}');
  let hash = await releaseSourceHash(directory);
  for (const file of ['public/timer.svg', 'supabase/storage.sql', '.github/workflows/storage-verify.yml']) {
    await writeFile(join(directory, file), 'fixture');
    const changed = await releaseSourceHash(directory);
    assert.notEqual(changed, hash);
    hash = changed;
  }
  await writeFile(join(directory, 'public/.DS_Store'), 'local metadata');
  assert.equal(await releaseSourceHash(directory), hash);
});

test('an actual Vercel build exits nonzero before Vite when Git identity is missing', () => {
  const result = spawnSync(process.execPath, ['dev/buildVerified.mjs'], { encoding: 'utf8',
    env: { ...process.env, VERCEL: '1', VERCEL_GIT_PROVIDER: '', VERCEL_GIT_COMMIT_SHA: '' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEPLOYMENT_GIT_IDENTITY_REQUIRED/);
  assert.doesNotMatch(result.stdout, /building for production/);
});

test('missing load scenarios, slow saves, and excessive bid retries fail verification', () => {
  const samples = [{ action: 'teacher.settings.patch', ms: 100 },
    ...Array.from({ length: 23 }, () => ({ action: 'student.auction.bid', ms: 500 })),
    ...Array.from({ length: 23 }, () => ({ action: 'student.failure.create', ms: 300 }))];
  assert.doesNotThrow(() => verifyClassroomTimings(samples));
  const slowBids = samples.map(sample => ({ ...sample, ms: sample.action === 'student.auction.bid' ? 3000 : sample.ms }));
  assert.throws(() => verifyClassroomTimings(slowBids), /STORAGE_LOAD_TIME_BUDGET/);
  assert.doesNotThrow(() => verifyClassroomTimings(slowBids, { atomicBids: false }));
  const failureStoriesAt = ms => samples.map(sample => ({ ...sample, ms: sample.action === 'student.failure.create' ? ms : sample.ms }));
  assert.doesNotThrow(() => verifyClassroomTimings(failureStoriesAt(7000)), 'temporary failure-story budget');
  assert.throws(() => verifyClassroomTimings(failureStoriesAt(10_500)), /STORAGE_LOAD_TIME_BUDGET/);
  assert.throws(() => verifyClassroomTimings(samples.slice(1)), /STORAGE_LOAD_SAMPLES_REQUIRED/);
  for (const action of ['teacher.settings.patch', 'student.failure.create', 'student.auction.bid']) {
    assert.throws(() => verifyClassroomTimings(samples.map(sample => ({ ...sample, ms: sample.action === action ? 20_000 : sample.ms }))), /STORAGE_LOAD_TIME_BUDGET/);
  }
});
