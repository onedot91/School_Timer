import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const hash = data => createHash('sha256').update(data).digest('hex');
const files = ['task-6-root-route-qa', 'task-6-shared-browser', 'task-6-readonly-qa', 'task-6-bookcase-modal-qa'];
const receipts = [];
const screenshots = [];
for (const name of files) {
  const receipt = JSON.parse(await readFile(directory + name + '.json', 'utf8'));
  assert.equal(receipt.passed, true, name);
  const sources = receipt.sourceSha256 ?? receipt.sourceSha256End ?? receipt.fullSourceHashesAfter;
  assert.ok(sources && Object.keys(sources).length, name + ' source hashes');
  for (const [path, expected] of Object.entries(sources)) assert.equal(hash(await readFile(root + path)), expected, name + ': ' + path);
  const selected = receipt.screenshots.map(item => typeof item === 'string' ? item : item.path)
    .filter(path => name !== 'task-6-bookcase-modal-qa' || /bookcase-(text-200-picker|keyboard-empty-error)\.png$/.test(path));
  screenshots.push(...selected);
  receipts.push({ path: directory + name + '.json', generatedAt: receipt.generatedAt, selectedCount: selected.length, checks: receipt.checks });
}
assert.equal(screenshots.length, 52);
const captures = [];
for (const path of screenshots) {
  const data = await readFile(path);
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.deepEqual([data.readUInt32BE(16), data.readUInt32BE(20)], [1280, 800]);
  captures.push({ path, sha256: hash(data), width: 1280, height: 800 });
}
const diff = JSON.parse(execFileSync('node', [
  '/Users/ibyeonghyeon/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/skills/visual-qa/scripts/visual-qa.mjs',
  'image-diff', directory + 'task-6-bookcase-modal-before-picker.png', directory + 'task-6-root-route-picker.png',
], { encoding: 'utf8' }));
await writeFile(directory + 'final-visual-diff.json', JSON.stringify(diff, null, 2));
await writeFile(directory + 'final-capture-index.json', JSON.stringify({ generatedAt: new Date().toISOString(), count: captures.length, receipts, captures, diff, target: 'Intent comparison, not a pixel-perfect clone: replace card-grid with real wood shelves/spines; no directional pad.' }, null, 2));
console.log(JSON.stringify({ passed: true, captures: captures.length, dimensionsMatch: diff.dimensionsMatch, index: directory + 'final-capture-index.json' }));
