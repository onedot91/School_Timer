import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LibraryCompetitionCountFields, LibraryCompetitionTable } from '../components/student/library/LibraryCompetitionTable';

const standings = Array.from({ length: 17 }, (_, index) => ({
  schoolId: `school-${String(index + 1).padStart(2, '0')}`,
  schoolName: `학교${index + 1}`, region: `지역${index + 1}`,
  count: index * 5, reachedAt: '2026-09-05T00:00:00.000Z', rank: index + 1, isOurSchool: index === 2,
}));

test('standings render every school with a non-color own-school marker', () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(LibraryCompetitionTable, { standings }));
  // Then
  assert.equal((markup.match(/data-school-id=/g) ?? []).length, 17);
  assert.match(markup, /aria-current="true"/);
  assert.match(markup, /data-school-id="school-03"/);
  assert.equal((markup.match(/scope="col"/g) ?? []).length, 4);
});

test('teacher count fields never offer an input for the real school', () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(LibraryCompetitionCountFields, {
    standings, counts: Object.fromEntries(standings.map(row => [row.schoolId, String(row.count)])),
    disabled: false, onChange: () => {},
  }));
  // Then
  assert.equal((markup.match(/type="number"/g) ?? []).length, 16);
  assert.equal((markup.match(/min="0" max="100" step="1"/g) ?? []).length, 16);
  assert.doesNotMatch(markup, /<input[^>]*name="school-03"/);
  assert.match(markup, /<output[^>]*>10/);
});

test('teacher inputs remain locked while a save or confirmation is pending', () => {
  const markup = renderToStaticMarkup(createElement(LibraryCompetitionCountFields, {
    standings, counts: {}, disabled: true, onChange: () => {},
  }));
  assert.equal((markup.match(/disabled=""/g) ?? []).length, 16);
});

test('standings render school names as text rather than executable markup', () => {
  const markup = renderToStaticMarkup(createElement(LibraryCompetitionTable, {
    standings: [{ ...standings[0], schoolName: '<script>alert(1)</script>' }],
  }));
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
});
