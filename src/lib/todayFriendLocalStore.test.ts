import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearTodayFriendDeviceDraft,
  loadLocalTodayFriendState,
  loadTodayFriendDeviceDraft,
  saveLocalTodayFriendState,
  saveTodayFriendDeviceDraft,
} from './todayFriendLocalStore';
import { ensureTodayFriendDay, getTodayFriendStudentMission, TODAY_FRIEND_INITIAL_STATE } from './todayFriendState';

test('로컬 저장소는 준비된 주간 배정과 파트너를 보존한다', () => {
  // Given
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');

  // When
  saveLocalTodayFriendState(storage, prepared);
  const restored = loadLocalTodayFriendState(storage);

  // Then
  assert.deepEqual(restored, prepared);
});

test('작성 중인 오늘의 친구 답은 해당 기기의 학생별 미션에만 저장되고 제출 뒤 지울 수 있다', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');
  const firstMission = getTodayFriendStudentMission(prepared, '2026-09-01', 1);
  const secondMission = getTodayFriendStudentMission(prepared, '2026-09-01', 2);
  const draft = {
    primaryText: '친구가 줄넘기를 연습하고 있다고 말했습니다.',
    secondaryText: '',
    tertiaryText: '',
    category: 'book' as const,
    declinedToExplain: false,
  };

  saveTodayFriendDeviceDraft(storage, firstMission, draft);

  assert.deepEqual(loadTodayFriendDeviceDraft(storage, firstMission), draft);
  assert.equal(loadTodayFriendDeviceDraft(storage, secondMission), null);

  clearTodayFriendDeviceDraft(storage, firstMission);
  assert.equal(loadTodayFriendDeviceDraft(storage, firstMission), null);
});

test('기존 기기 자동 저장 값에는 세 번째 답변을 빈 값으로 보완한다', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const mission = getTodayFriendStudentMission(
    ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01'),
    '2026-09-01',
    1,
  );
  saveTodayFriendDeviceDraft(storage, mission, {
    primaryText: '친구가 도와줬어요.',
    secondaryText: '고마웠어요.',
    tertiaryText: '정말 고마워!',
    category: 'book',
    declinedToExplain: false,
  });
  const key = values.keys().next().value;
  assert.equal(typeof key, 'string');
  if (typeof key !== 'string') throw new Error('device draft key was not created');
  values.set(key, JSON.stringify({
    primaryText: '친구가 도와줬어요.',
    secondaryText: '',
    category: 'book',
    declinedToExplain: false,
  }));

  assert.equal(loadTodayFriendDeviceDraft(storage, mission)?.tertiaryText, '');
});
