import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('a failed background auction refresh keeps the current student screen usable', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const refreshStart = source.indexOf('const refreshAuctionState = useCallback');
  const refreshEnd = source.indexOf('\n  useEffect(() => {', refreshStart);
  const refreshSource = source.slice(refreshStart, refreshEnd);
  const failureHandler = refreshSource.slice(refreshSource.indexOf('} catch (error) {'));

  assert.doesNotMatch(failureHandler, /setAuctionMissions\(\[\]\)/);
  assert.doesNotMatch(failureHandler, /showStatusMessage\(/);
});

test('student sync checks settings metadata before requesting the full settings value', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /loadSharedSettingsUpdatedAt\(\)/);
  assert.match(source, /shouldLoadFullStudentSettings\(/);
  assert.doesNotMatch(source, /}, 3000\)/);
});
