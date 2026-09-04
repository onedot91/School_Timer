import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('오늘의 친구 조회 실패 뒤에는 로딩 상태가 계속 표시되지 않는다', async () => {
  const source = await readFile(new URL('../components/teacher/TeacherTodayFriendPanel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /isLoading \|\| !state/);
});
