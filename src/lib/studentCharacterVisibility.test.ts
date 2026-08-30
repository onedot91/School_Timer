import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('알림장 작성 중에는 이동하는 학생 캐릭터를 만들지 않는다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // When
  const visibilityCondition = source.match(
    /const canShowStudentCharacter\s*=([\s\S]*?);\n\s*const studentCharacterElapsedSeconds/,
  )?.[1] ?? '';

  // Then
  assert.match(visibilityCondition, /!isAnnouncementOpen/);
});

test('안내 화면이 떠 있는 동안에는 이동하는 학생 캐릭터를 만들지 않는다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // When
  const visibilityCondition = source.match(
    /const canShowStudentCharacter\s*=([\s\S]*?);\n\s*const studentCharacterElapsedSeconds/,
  )?.[1] ?? '';

  // Then
  assert.match(visibilityCondition, /!showTimerNotification/);
});
