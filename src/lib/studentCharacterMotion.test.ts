import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const timerPage = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

test('캐릭터 경로는 과장되지 않은 원래 높낮이를 유지한다', () => {
  const pathDefinitions = timerPage.match(
    /const STUDENT_CHARACTER_WALK_PATHS = \[([\s\S]*?)\] as const;/,
  )?.[1] ?? '';
  const routes = [...pathDefinitions.matchAll(
    /startTop: '(\d+)vh',[\s\S]*?midTopA: '(\d+)vh',[\s\S]*?midTopB: '(\d+)vh',[\s\S]*?endTop: '(\d+)vh'/g,
  )].map((match) => match.slice(1).map(Number));

  assert.deepEqual(routes, [
    [82, 80, 78, 80],
    [80, 81, 83, 82],
    [81, 78, 80, 84],
    [78, 80, 82, 81],
    [83, 84, 81, 79],
  ]);
});

test('캐릭터의 반복 상하 움직임은 천천히 이어진다', () => {
  const pathDefinitions = timerPage.match(
    /const STUDENT_CHARACTER_WALK_PATHS = \[([\s\S]*?)\] as const;/,
  )?.[1] ?? '';
  const bobDurations = [...pathDefinitions.matchAll(/bobDuration: '(\d+)ms'/g)]
    .map((match) => Number(match[1]));

  assert.equal(bobDurations.length, 5);
  assert.ok(bobDurations.every((duration) => duration >= 1_600));
});

test('좁은 화면에서도 캐릭터별 경로의 위아래 이동 폭을 유지한다', () => {
  assert.match(timerPage, /'--student-character-route-start-top': path\.startTop/);
  assert.match(timerPage, /'--student-character-route-mid-top-a': path\.midTopA/);
  assert.match(timerPage, /'--student-character-route-mid-top-b': path\.midTopB/);
  assert.match(timerPage, /'--student-character-route-end-top': path\.endTop/);

  const narrowLayout = css.match(
    /@media \(max-width: 63\.999rem\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? '';
  assert.match(narrowLayout, /--student-character-walk-start-top: calc\(var\(--student-character-route-start-top\) - 32vh \+ var\(--student-character-lane-offset\)\)/);
  assert.match(narrowLayout, /--student-character-walk-mid-top-a: calc\(var\(--student-character-route-mid-top-a\) - 32vh \+ var\(--student-character-lane-offset\)\)/);
  assert.match(narrowLayout, /--student-character-walk-mid-top-b: calc\(var\(--student-character-route-mid-top-b\) - 32vh \+ var\(--student-character-lane-offset\)\)/);
  assert.match(narrowLayout, /--student-character-walk-end-top: calc\(var\(--student-character-route-end-top\) - 32vh \+ var\(--student-character-lane-offset\)\)/);
});

test('동작 줄이기 PC에서도 캐릭터 걸음의 자연스러운 높낮이를 유지한다', () => {
  const reducedMotionPreferences = css.match(
    /\/\* PREFERENCES \*\/[\s\S]*?@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\s*\}\n\n@media \(prefers-reduced-transparency: reduce\)/,
  )?.[1] ?? '';

  assert.match(reducedMotionPreferences, /\.timer-main-shell \.student-character-showcase,[\s\S]*?\.timer-main-shell \.student-character-path \{[\s\S]*?animation-duration: var\(--student-character-walk-duration\) !important;/);
  assert.match(reducedMotionPreferences, /\.timer-main-shell \.student-character-frame \{[\s\S]*?animation: studentCharacterWalkBob var\(--student-character-bob-duration\) ease-in-out infinite !important;/);
  assert.match(reducedMotionPreferences, /\.timer-main-shell \.student-character-speech \{[\s\S]*?animation: none !important;/);
  assert.ok(
    reducedMotionPreferences.indexOf('.timer-main-shell .student-character-showcase')
      > reducedMotionPreferences.indexOf('animation-duration: 0.01ms !important'),
  );
});

test('캐릭터는 화면 안에서 페이드하지 않고 이동 완료 후 교체한다', () => {
  const across = css.match(/@keyframes studentCharacterWalkAcross \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.ok(across.includes('--student-character-walk-start'));
  assert.ok(across.includes('--student-character-walk-end'));
  assert.doesNotMatch(across, /opacity:|filter:/);
  assert.match(timerPage, /event\.target === event\.currentTarget && event\.animationName === 'studentCharacterWalkAcross'/);
  assert.doesNotMatch(timerPage, /animationDelaySeconds: -\(shiftedElapsedSeconds/);
});

test('인사 높이는 이미지 크기가 아닌 같은 이동 경로로 판단한다', () => {
  const stage = readFileSync(new URL('../components/teacher/StudentCharacterStage.tsx', import.meta.url), 'utf8');
  assert.match(timerPage, /data-walk-lane=\{lane\}/);
  assert.match(stage, /shouldCharactersGreet\(/);
  assert.match(stage, /lane: a\.node\.dataset\.walkLane/);
  assert.match(stage, /lane: b\.node\.dataset\.walkLane/);
  assert.doesNotMatch(stage, /Math\.abs\(a\.box\.bottom - b\.box\.bottom\)/);

});

test('새 만남은 이전 인사나 뒤돌아보기 때문에 생략하지 않는다', () => {
  const stage = readFileSync(new URL('../components/teacher/StudentCharacterStage.tsx', import.meta.url), 'utf8');
  const meeting = stage.slice(stage.indexOf('for (let i = 0;'), stage.indexOf('positions.forEach'));
  assert.doesNotMatch(meeting, /greeted\.has|active\.has/);
  assert.match(meeting, /active\.get\(a\.node\)\?\.kind === 'greet'/);
  assert.match(meeting, /clear\(node\);/);
  assert.match(meeting, /encounters\.get\(a\.node\)\?\.has\(b\.node\)/);
});

test('뒤돌아보기는 원래 이미지 변환을 유지한 채 전체를 제자리에서 반전한다', () => {
  assert.match(css, /data-encounter="look"\]\[data-encounter-phase="act"\] \.student-character-gesture \{ transform: scaleX\(-1\); \}/);
  assert.doesNotMatch(timerPage, /--student-character-look-transform/);
  assert.match(css, /\.student-character-gesture \{[^}]*transform-origin: center bottom/);
});
