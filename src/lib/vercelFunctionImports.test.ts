import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SERVER_MODULES = [
  'api/weekly-mission.ts',
  'api/weekly-missions.ts',
  'src/lib/weeklyMission.ts',
] as const;

test('Vercel ESM server dependencies use explicit JavaScript extensions', async () => {
  const modules = await Promise.all(SERVER_MODULES.map((path) => readFile(path, 'utf8')));
  const extensionlessRelativeImport = /from\s+['"]\.\.?\/[^'"]+(?<!\.js)['"]/;

  for (const [index, source] of modules.entries()) {
    assert.doesNotMatch(source, extensionlessRelativeImport, SERVER_MODULES[index]);
  }
});
