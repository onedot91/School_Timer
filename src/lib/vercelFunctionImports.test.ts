import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const SERVER_MODULES = [
  'api/announcement-notes.ts',
  'api/class-donation.ts',
  'api/device-session.ts',
  'api/shared-settings.ts',
  'api/weekly-mission.ts',
  'api/weekly-missions.ts',
  'src/lib/weeklyMission.ts',
  'src/server/deviceSession.ts',
  'src/server/requestRateLimit.ts',
] as const;

test('Vercel ESM server dependencies use explicit JavaScript extensions', async () => {
  const modules = await Promise.all(SERVER_MODULES.map((path) => readFile(path, 'utf8')));
  const extensionlessRelativeImport = /from\s+['"]\.\.?\/[^'"]+(?<!\.js)['"]/;

  for (const [index, source] of modules.entries()) {
    assert.doesNotMatch(source, extensionlessRelativeImport, SERVER_MODULES[index]);
  }
});

test('Vercel api directory contains at most twelve deployable handlers', async () => {
  const functionFiles = (await readdir('api')).filter((fileName) => fileName.endsWith('.ts'));

  assert.ok(
    functionFiles.length <= 12,
    `Vercel Hobby allows at most 12 direct functions, but api/ contains ${functionFiles.length}`,
  );
  for (const fileName of functionFiles) {
    const source = await readFile(`api/${fileName}`, 'utf8');
    assert.match(source, /export default (?:async )?function handler/, `${fileName} is not a deployable handler`);
  }
});
