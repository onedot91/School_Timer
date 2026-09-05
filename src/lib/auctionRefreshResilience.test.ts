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

test('student economy saves refresh the full row instead of treating a partial response as synchronized', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const actionStart = source.indexOf('const runStudentEconomyAction = async');
  const actionEnd = source.indexOf('\n  const currentLayoutMode', actionStart);
  const actionSource = source.slice(actionStart, actionEnd);

  assert.match(actionSource, /sharedSettingsUpdatedAtRef\.current = null/);
  assert.match(actionSource, /refreshAuctionState\(\{ forceFull: true \}\)/);
  assert.doesNotMatch(actionSource, /sharedSettingsUpdatedAtRef\.current = result\.updatedAt/);
});

test('a forced full refresh is queued when a metadata refresh is already running', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const refreshStart = source.indexOf('const refreshAuctionState = useCallback');
  const refreshEnd = source.indexOf('\n  useEffect(() => {', refreshStart);
  const refreshSource = source.slice(refreshStart, refreshEnd);

  assert.match(refreshSource, /if \(forceFull\) pendingFullSettingsRefreshRef\.current = true/);
  assert.match(refreshSource, /do \{/);
  assert.match(refreshSource, /shouldForceFull = pendingFullSettingsRefreshRef\.current/);
  assert.match(refreshSource, /while \(shouldForceFull\)/);
});

test('student economy actions take an immediate ref lock before React rerenders', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const actionStart = source.indexOf('const runStudentEconomyAction = async');
  const actionEnd = source.indexOf('\n  const currentLayoutMode', actionStart);
  const actionSource = source.slice(actionStart, actionEnd);

  assert.match(actionSource, /if \(isEconomySavingRef\.current\) return false/);
  assert.match(actionSource, /isEconomySavingRef\.current = true;\n\s+setIsEconomySaving\(true\)/);
  assert.match(actionSource, /finally \{\n\s+isEconomySavingRef\.current = false;\n\s+setIsEconomySaving\(false\)/);
});

test('local failure story creation keeps the saved student life in the combined pet snapshot', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const creationStart = source.indexOf('const createStudentFailureStory = async');
  const creationEnd = source.indexOf('\n\n  const stampStudentFailureStory', creationStart);
  const creationSource = source.slice(creationStart, creationEnd);

  assert.match(creationSource, /storeStudentLifeState\(result\.studentLife\)/);
  assert.match(creationSource, /storeStudentPetSnapshot\(\{\s*\.\.\.snapshot,\s*studentLife: result\.studentLife,/);
});
