import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const resultPath = path.join(root, '.omo/evidence/task-6-apple-ui-refresh-plan/complete-current.json');
const result = JSON.parse(await readFile(resultPath, 'utf8'));
const key = (id, viewport) => `${id}|${viewport.width}x${viewport.height}|${viewport.zoom ?? 1}`;
const expectedKeys = new Set(result.screenshotManifest.expectedStateIds.flatMap((id) => result.screenshotManifest.expectedViewports
  .map((viewport) => key(id, viewport))));
const entries = result.screenshots.filter(({ id, viewport }) => expectedKeys.has(key(id, viewport)));
const supplementalScreenshots = result.screenshots.filter(({ id, viewport }) => !expectedKeys.has(key(id, viewport)));

if (entries.length !== result.screenshotManifest.expectedCount) {
  throw new Error(`Expected ${result.screenshotManifest.expectedCount} core screenshots, found ${entries.length}`);
}
if (new Set(entries.map(({ id, viewport }) => key(id, viewport))).size !== entries.length) {
  throw new Error('Core screenshot manifest contains duplicate state×viewport entries');
}

result.screenshotManifest.entries = entries;
result.screenshotManifest.actualCount = entries.length;
result.screenshotManifest.missing = [];
result.screenshotManifest.supplementalScreenshots = supplementalScreenshots;
result.screenshotManifest.normalizedAt = new Date().toISOString();
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
