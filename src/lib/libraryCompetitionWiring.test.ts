import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('student page passes its authoritative season to placements and the game', () => {
  const source = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /placeCanvasLibraryBook\(draft, slotId, competitionSeasonId/);
  assert.match(source, /competitionSeasonId=\{competitionSeasonId\}/);
  assert.match(source, /onCompetitionSnapshot=\{applyCompetitionSnapshot\}/);
});
