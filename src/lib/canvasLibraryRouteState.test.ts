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

  assert.match(placementSource, /if \(isSupabaseSettingsEnabled\) \{\s*if \(applySharedSettingsValue\(result\.value, result\.updatedAt\)\) \{\s*sharedSettingsUpdatedAtRef.current = result.updatedAt/);
  assert.match(placementSource, /\} else \{\s*setStudentLifeSnapshot\(normalizeStudentLifeState\(result\.value\.studentLife\)\);\s*setCurrencyBalances\(normalizeCurrencyBalances\(result\.value\.currencyBalances\)\);\s*setCurrencyHistory\(normalizeCurrencyHistory\(result\.value\.currencyHistory\)\);/);
  assert.doesNotMatch(placementSource, /setStudentMissionVisibility|setStudentStockMarket/);
});

test('failure mission deep-links to the bookshop board and enters at the board', async () => {
  const [page, library] = await Promise.all([
    readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/student/StudentLibraryPage.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /'library-failure-board': '#student-library-failure-board'/);
  assert.match(page, /onOpenFailureExhibition=\{\(\) => navigateStudentView\('library-failure-board'\)\}/);
  assert.match(page, /initialFailureBoardOpen=\{activeStudentView === 'library-failure-board'\}/);
  assert.match(page, /<StudentLibraryPage\s+key=\{activeStudentView\}/);
  assert.match(library, /spawn: FULL_LIBRARY_ROOM.failureBoard\?\.interactionPoint/);
  assert.match(library, /room=\{initialFailureBoardOpen \? FAILURE_BOARD_ENTRY_ROOM : FULL_LIBRARY_ROOM\}/);
});
