import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseSourceBreakdown, releaseSourceHash } from './releaseSourceHash.mjs';
import { verifyDeployment } from './verifyDeployment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0 || result.error) throw new Error('VERIFIED_BUILD_FAILED');
};

try {
  const sourceHash = await releaseSourceHash();
  if (process.env.VERCEL === '1') {
    console.log(`Source fingerprint ${sourceHash}`);
    for (const line of await releaseSourceBreakdown()) console.log(`  ${line}`);
    console.log('Waiting for required storage verification.');
    const result = await verifyDeployment({ sourceHash });
    console.log(`PASS storage verification run ${result.runId}`);
  } else {
    run('npm', ['run', 'verify:checks']);
  }
  if (await releaseSourceHash() !== sourceHash) throw new Error('RELEASE_SOURCE_CHANGED');
  run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
  if (await releaseSourceHash() !== sourceHash) throw new Error('RELEASE_SOURCE_CHANGED');
} catch (error) {
  console.error(error instanceof Error && /^(DEPLOYMENT|VERIFIED|RELEASE)_[A-Z0-9_]+$/.test(error.message) ? error.message : 'VERIFIED_BUILD_FAILED');
  process.exitCode = 1;
}
