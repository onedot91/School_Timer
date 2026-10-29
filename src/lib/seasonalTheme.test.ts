import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getTeacherSeasonalTheme } from './seasonalTheme';

test('교사 화면 할로윈 테마는 10월 30일과 31일에만 켜진다', () => {
  assert.equal(getTeacherSeasonalTheme(new Date(2026, 9, 29, 23, 59, 59)), null);
  assert.equal(getTeacherSeasonalTheme(new Date(2026, 9, 30, 0, 0, 0)), 'halloween');
  assert.equal(getTeacherSeasonalTheme(new Date(2026, 9, 31, 23, 59, 59)), 'halloween');
  assert.equal(getTeacherSeasonalTheme(new Date(2026, 10, 1, 0, 0, 0)), null);
  assert.equal(getTeacherSeasonalTheme(new Date(2027, 9, 31, 12, 0, 0)), 'halloween');
});

test('잘못된 날짜에서는 계절 테마를 켜지 않는다', () => {
  assert.equal(getTeacherSeasonalTheme(new Date(Number.NaN)), null);
});

test('할로윈 스타일은 할로윈 표시가 붙은 교사 화면과 장식 요소에만 적용된다', async () => {
  const css = await readFile(new URL('../teacherHalloween.css', import.meta.url), 'utf8');
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    .match(/[^{}@]+(?=\{)/g)
    ?.flatMap((group) => group.split(/,(?![^()]*\))/))
    .map((selector) => selector.trim())
    .filter((selector) => selector && !selector.startsWith('(') && !selector.startsWith('media')) ?? [];

  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    assert.match(selector, /^(\.teacher-app\[data-season="halloween"\]|\.halloween-)/, selector);
  }
});
