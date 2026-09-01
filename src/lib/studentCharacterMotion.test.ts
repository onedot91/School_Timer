import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const timerPage = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

test('모든 캐릭터 경로는 직선처럼 보이지 않도록 충분한 상하 진폭을 가진다', () => {
  const pathDefinitions = timerPage.match(
    /const STUDENT_CHARACTER_WALK_PATHS = \[([\s\S]*?)\] as const;/,
  )?.[1] ?? '';
  const routes = [...pathDefinitions.matchAll(
    /startTop: '(\d+)vh',[\s\S]*?midTopA: '(\d+)vh',[\s\S]*?midTopB: '(\d+)vh',[\s\S]*?endTop: '(\d+)vh'/g,
  )].map((match) => match.slice(1).map(Number));

  assert.equal(routes.length, 5);
  routes.forEach((route) => {
    assert.ok(
      Math.max(...route) - Math.min(...route) >= 14,
      `캐릭터 경로 진폭이 ${Math.max(...route) - Math.min(...route)}vh로 너무 작습니다: ${route.join(' → ')}vh`,
    );
  });
});

test('좁은 화면에서도 캐릭터별 경로의 위아래 이동 폭을 유지한다', () => {
  assert.match(timerPage, /'--student-character-route-start-top': path\.startTop/);
  assert.match(timerPage, /'--student-character-route-mid-top-a': path\.midTopA/);
  assert.match(timerPage, /'--student-character-route-mid-top-b': path\.midTopB/);
  assert.match(timerPage, /'--student-character-route-end-top': path\.endTop/);

  const narrowLayout = css.match(
    /@media \(max-width: 63\.999rem\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? '';
  assert.match(narrowLayout, /--student-character-walk-start-top: calc\(var\(--student-character-route-start-top\) - 32vh\)/);
  assert.match(narrowLayout, /--student-character-walk-mid-top-a: calc\(var\(--student-character-route-mid-top-a\) - 32vh\)/);
  assert.match(narrowLayout, /--student-character-walk-mid-top-b: calc\(var\(--student-character-route-mid-top-b\) - 32vh\)/);
  assert.match(narrowLayout, /--student-character-walk-end-top: calc\(var\(--student-character-route-end-top\) - 32vh\)/);
});

test('동작 줄이기 PC에서도 캐릭터 이동은 유지하고 흔들림만 제거한다', () => {
  const reducedMotionPreferences = css.match(
    /\/\* PREFERENCES \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\s*\}\n\n@media \(prefers-reduced-transparency: reduce\)/,
  )?.[1] ?? '';

  assert.match(reducedMotionPreferences, /\.timer-main-shell \.student-character-showcase,[\s\S]*?\.timer-main-shell \.student-character-path \{[\s\S]*?animation-duration: var\(--student-character-walk-duration\) !important;/);
  assert.match(reducedMotionPreferences, /\.timer-main-shell \.student-character-frame,[\s\S]*?\.timer-main-shell \.student-character-speech \{[\s\S]*?animation: none !important;/);
  assert.ok(
    reducedMotionPreferences.indexOf('.timer-main-shell .student-character-showcase')
      > reducedMotionPreferences.indexOf('animation-duration: 0.01ms !important'),
  );
});
