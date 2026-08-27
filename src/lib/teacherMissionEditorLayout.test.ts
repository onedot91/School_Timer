import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('교사 미션명 입력은 폭과 글자 수를 제한하지 않고 권장 길이를 안내한다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // Then
  assert.match(source, /const AUCTION_MISSION_RECOMMENDED_LENGTH = 18;/);
  assert.match(source, /Array\.from\(mission\.content\)\.length/);
  assert.match(source, /\{contentLength\}\/\{AUCTION_MISSION_RECOMMENDED_LENGTH\}/);
  assert.match(source, /absolute inset-y-0 right-3/);
  assert.match(source, /md:grid-cols-\[minmax\(0,1fr\)_22rem_2\.75rem\]/);
  assert.doesNotMatch(source, /maxLength=\{AUCTION_MISSION_EDITOR_MAX_LENGTH\}/);
  assert.doesNotMatch(source, /nextContent\.slice/);
});
