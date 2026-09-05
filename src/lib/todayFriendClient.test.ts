import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadStudentTodayFriendMission } from './todayFriendClient';

test('주말에는 저장소나 서버를 조회하지 않고 미션 없음으로 반환한다', async () => {
  assert.equal(await loadStudentTodayFriendMission(1, '2026-09-05'), null);
  assert.equal(await loadStudentTodayFriendMission(1, '2026-09-06'), null);
});

test('금요일과 다음 월요일에는 해당 날짜의 미션을 정상적으로 준비한다', async () => {
  const memory = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    } },
  });
  try {
    for (const dateKey of ['2026-09-04', '2026-09-07']) {
      const mission = await loadStudentTodayFriendMission(1, dateKey);
      assert.ok(mission);
      assert.equal(mission.dateKey, dateKey);
      assert.equal(mission.studentNumber, 1);
      assert.notEqual(mission.partnerNumber, 1);
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
