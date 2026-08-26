import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('타이머 얼굴은 동작 줄이기 설정에서도 원 중앙에 고정된다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // When
  const hasCenteredAnchor = /\.timer-watch-face\s*\{[^}]*inset:\s*50% auto auto 50%;/s.test(css);
  const preservesReducedMotionCenter = /\.timer-main-shell \.timer-watch-face\s*\{[^}]*animation:\s*none !important;[^}]*transform:\s*translate\(-50%, -50%\) !important;[^}]*transition:\s*none !important;/s.test(css);

  // Then
  assert.equal(hasCenteredAnchor, true);
  assert.equal(preservesReducedMotionCenter, true);
});
