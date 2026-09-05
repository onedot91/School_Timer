import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCompetitionHistoryResponse, parseCompetitionResponse } from './libraryCompetitionResponse.js';

test('competition transport accepts an inactive read without inventing a season', () => {
  const value = { competition: { state: null, standings: [], serverAt: '2026-09-05T00:00:00.000Z' }, value: {}, updatedAt: null, rolledOver: false };
  const result = parseCompetitionResponse(value);
  assert.deepEqual(result, value);
});
test('competition transport rejects an invalid clock or forged standings without a state', () => {
  for (const competition of [{ state: null, standings: [], serverAt: 'bad' }, { state: null, standings: [{ count: 999 }], serverAt: '2026-09-05T00:00:00.000Z' }]) {
    assert.equal(parseCompetitionResponse({ competition, value: {}, updatedAt: null, rolledOver: false }), null);
  }
});
test('empty history is a valid read-only history response', () => {
  assert.deepEqual(parseCompetitionHistoryResponse({ months: [], archive: null }), { months: [], archive: null });
});
test('history rejects impossible months and malformed archives', () => {
  assert.equal(parseCompetitionHistoryResponse({ months: [{ seasonId: '2026-99', archivedAt: '2026-09-05T00:00:00.000Z' }], archive: null }), null);
  assert.equal(parseCompetitionHistoryResponse({ months: [], archive: { books: [] } }), null);
});
