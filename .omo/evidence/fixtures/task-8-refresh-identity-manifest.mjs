import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const relative = {
  timer: 'src/pages/TimerPage.tsx',
  random: 'src/pages/RandomDrawPage.tsx',
  auction: 'src/pages/AuctionPage.tsx',
  exact: '.omo/evidence/task-5-apple-ui-refresh-plan/complete-current-oracle.json',
  full: '.omo/evidence/task-6-apple-ui-refresh-plan/complete-current.json',
  material: '.omo/evidence/task-8-apple-ui-refresh-plan/material-motion-runtime.json',
  motion: '.omo/evidence/task-8-apple-ui-refresh-plan/motion-actionability-matrix.json',
};
const bytes = {};
for (const [key, file] of Object.entries(relative)) bytes[key] = await readFile(path.join(root, file));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exact = JSON.parse(bytes.exact);
const full = JSON.parse(bytes.full);
const material = JSON.parse(bytes.material);
const motion = JSON.parse(bytes.motion);
const manifest = {
  status: exact.success && full.success && material.success && motion.status === 'PASS' ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
  productSources: Object.fromEntries(['timer', 'random', 'auction'].map((key) => [key, { source: relative[key], sha256: sha256(bytes[key]) }])),
  exactVisibleText: {
    source: relative.exact,
    sha256: sha256(bytes.exact),
    completedAt: exact.completedAt,
    expectedRecords: exact.expectedRecordCount,
    actualRecords: exact.actualRecordCount,
    success: exact.success,
  },
  fullPngMatrix: {
    source: relative.full,
    sha256: sha256(bytes.full),
    completedAt: full.completedAt,
    expectedEntries: full.screenshotManifest?.expectedCount,
    actualEntries: full.screenshotManifest?.actualCount,
    supplementalEntries: full.screenshotManifest?.supplementalScreenshots?.length,
    success: full.success,
  },
  materialRuntime: { source: relative.material, sha256: sha256(bytes.material), completedAt: material.completedAt, success: material.success },
  motionActionability: { source: relative.motion, sha256: sha256(bytes.motion), generatedAt: motion.generatedAt, status: motion.status },
  liveClassroomDataMutations: 0,
};
await writeFile(path.join(root, '.omo/evidence/task-8-apple-ui-refresh-plan/pending-run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
