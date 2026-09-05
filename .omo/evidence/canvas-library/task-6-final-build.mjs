import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../../', import.meta.url).pathname;
const directory = new URL('./', import.meta.url).pathname;
const hashes = async () => {
  const paths = execFileSync('rg', ['--files', 'src', 'api'], { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(root + path)).digest('hex')])));
};
const before = await hashes();
const build = spawnSync('npm', ['run', 'build', '--', '--outDir', '.omo/evidence/canvas-library/shared-dist'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 120000,
  env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:3036/fake', VITE_SUPABASE_ANON_KEY: 'synthetic-qa-anon', VITE_YOUTUBE_API_KEY: '' },
});
await writeFile(directory + 'task-6-final-build.log', (build.stdout ?? '') + (build.stderr ?? ''));
assert.equal(build.status, 0, 'Synthetic local preview build must succeed');
assert.deepEqual(await hashes(), before, 'Sources changed while building; repeat after source freeze');
await writeFile(directory + 'task-6-final-build-manifest.json', JSON.stringify(before, null, 2));
console.log(JSON.stringify({ passed: true, sourceFiles: Object.keys(before).length, manifest: directory + 'task-6-final-build-manifest.json', deployment: false }));
