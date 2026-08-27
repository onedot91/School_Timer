import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('교사 미션명 입력은 17자와 콘텐츠 폭으로 제한한다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // Then
  assert.match(source, /const AUCTION_MISSION_EDITOR_MAX_LENGTH = 17;/);
  assert.match(source, /maxLength=\{AUCTION_MISSION_EDITOR_MAX_LENGTH\}/);
  assert.match(source, /md:grid-cols-\[minmax\(0,24rem\)_22rem_2\.75rem\]/);
});
