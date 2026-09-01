import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

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
