import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('좌측 상단 배경 음악 버튼은 넓은 감지 면 안에서 커서를 옮겨도 유지된다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // Then
  assert.match(css, /\.bgm-reveal-zone\s*\{[^}]*z-index:\s*70;[^}]*min-inline-size:\s*calc\(/s);
  assert.match(css, /\.bgm-reveal-zone::before\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(css, /\.bgm-reveal-zone \.sound-toggle\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s);
});

test('마우스로 누른 뒤에는 hover를 벗어나면 숨고 키보드 포커스에서는 유지된다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const timerPage = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // Then
  assert.match(css, /\.bgm-reveal-zone \.sound-toggle:focus-visible\s*\{/s);
  assert.doesNotMatch(css, /\.bgm-reveal-zone:focus-within \.sound-toggle/s);
  assert.match(timerPage, /onPointerUp=\{\(event\) => event\.currentTarget\.blur\(\)\}/);
});
