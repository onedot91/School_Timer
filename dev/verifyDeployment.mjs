import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { releaseSourceHash } from './releaseSourceHash.mjs';

const workflow = 'storage-verify.yml';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const terminalFailure = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'skipped', 'neutral', 'stale']);

export const verifyDeployment = async ({ env = process.env, sourceHash, fetcher = fetch,
  now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 240_000 } = {}) => {
  const owner = env.VERCEL_GIT_REPO_OWNER, repo = env.VERCEL_GIT_REPO_SLUG;
  const sha = env.VERCEL_GIT_COMMIT_SHA, branch = env.VERCEL_GIT_COMMIT_REF;
  if (env.VERCEL_GIT_PROVIDER !== 'github' || !/^[a-zA-Z0-9_.-]+$/.test(owner ?? '')
    || !/^[a-zA-Z0-9_.-]+$/.test(repo ?? '') || !/^[a-f0-9]{40}$/.test(sha ?? '')
    || typeof branch !== 'string' || !branch || !/^[a-f0-9]{64}$/.test(sourceHash ?? '')) {
    throw new Error('DEPLOYMENT_GIT_IDENTITY_REQUIRED');
  }
  const repository = `${owner}/${repo}`;
  const base = `https://api.github.com/repos/${repository}/actions`;
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
  if (env.DEPLOYMENT_GITHUB_TOKEN) headers.Authorization = `Bearer ${env.DEPLOYMENT_GITHUB_TOKEN}`;
  const request = async url => {
    let response;
    try { response = await fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
    catch { throw new Error('DEPLOYMENT_CHECK_UNAVAILABLE'); }
    if (!response.ok) throw new Error(`DEPLOYMENT_CHECK_HTTP_${response.status}`);
    try { return await response.json(); } catch { throw new Error('DEPLOYMENT_CHECK_INVALID_RESPONSE'); }
  };
  const started = now();
  while (now() - started < timeoutMs) {
    const params = new URLSearchParams({ head_sha: sha, branch, event: 'push', per_page: '100' });
    const result = await request(`${base}/workflows/${workflow}/runs?${params}`);
    if (!record(result) || !Array.isArray(result.workflow_runs)) throw new Error('DEPLOYMENT_CHECK_INVALID_RESPONSE');
    const runs = result.workflow_runs.filter(run => record(run) && run.head_sha === sha && run.head_branch === branch
      && run.event === 'push' && run.path === `.github/workflows/${workflow}`
      && record(run.head_repository) && run.head_repository.full_name === repository
      && Number.isSafeInteger(run.id) && run.id > 0);
    const run = runs.sort((left, right) => right.id - left.id)[0];
    if (run && terminalFailure.has(run.conclusion)) throw new Error('DEPLOYMENT_VERIFICATION_FAILED');
    if (run?.status === 'completed' && run.conclusion === 'success') {
      const result = await request(`${base}/runs/${run.id}/jobs?filter=latest&per_page=100`);
      if (!record(result) || !Array.isArray(result.jobs)) throw new Error('DEPLOYMENT_CHECK_INVALID_RESPONSE');
      const job = result.jobs.find(job => record(job) && job.name === 'Storage verification' && job.head_sha === sha
        && job.status === 'completed' && job.conclusion === 'success' && Array.isArray(job.steps)
        && job.steps.some(step => record(step) && step.name === `verified-source-${sourceHash}`
          && step.status === 'completed' && step.conclusion === 'success'));
      if (!job) throw new Error('DEPLOYMENT_SOURCE_NOT_VERIFIED');
      return { repository, sha, sourceHash, runId: run.id };
    }
    await wait(Math.min(15_000, Math.max(0, timeoutMs - (now() - started))));
  }
  throw new Error('DEPLOYMENT_VERIFICATION_TIMEOUT');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log('Checking required PostgreSQL verification for this deployment.');
    const result = await verifyDeployment({ sourceHash: await releaseSourceHash() });
    console.log(`PASS storage verification run ${result.runId} for ${result.sha}`);
  } catch (error) {
    console.error(error instanceof Error && /^DEPLOYMENT_[A-Z0-9_]+$/.test(error.message) ? error.message : 'DEPLOYMENT_CHECK_FAILED');
    process.exitCode = 1;
  }
}
