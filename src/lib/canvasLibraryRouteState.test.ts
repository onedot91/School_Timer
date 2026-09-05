import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('local library placement updates only the atomic book and reward state', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const placeLibraryBook = async');
  const end = source.indexOf('\n\n  useEffect(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const placementSource = source.slice(start, end);

  assert.match(placementSource, /if \(isSupabaseSettingsEnabled\) \{\s*applySharedSettingsValue\(result\.value\)/);
  assert.match(placementSource, /\} else \{\s*setStudentLifeSnapshot\(normalizeStudentLifeState\(result\.value\.studentLife\)\);\s*setCurrencyBalances\(normalizeCurrencyBalances\(result\.value\.currencyBalances\)\);\s*setCurrencyHistory\(normalizeCurrencyHistory\(result\.value\.currencyHistory\)\);/);
  assert.doesNotMatch(placementSource, /setStudentMissionVisibility|setStudentStockMarket/);
});
