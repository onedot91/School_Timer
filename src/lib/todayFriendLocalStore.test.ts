import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearTodayFriendDeviceDraft,
  todayFriendDeviceDraftVersion,
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
    removeItem: (key: string) => { values.delete(key); },
  };
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');

  // When
  saveLocalTodayFriendState(storage, prepared);
  const restored = loadLocalTodayFriendState(storage);

  // Then
  assert.deepEqual(restored, prepared);
});

test('작성 중인 오늘의 친구 답은 해당 기기의 학생별 미션에만 저장되고 제출 뒤 지울 수 있다', async () => {
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

  await clearTodayFriendDeviceDraft(storage, firstMission, todayFriendDeviceDraftVersion(storage, firstMission) ?? 'missing');
  assert.equal(loadTodayFriendDeviceDraft(storage, firstMission), null);
});

test('기존 기기 자동 저장 값에는 세 번째 답변을 빈 값으로 보완한다', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const mission = getTodayFriendStudentMission(
    ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01'),
    '2026-09-01',
    1,
  );
  const key = `school-timer-today-friend-device-draft-v1:${encodeURIComponent(JSON.stringify([mission.dateKey, mission.studentNumber, mission.partnerNumber, mission.genre, mission.question]))}`;
  values.set(key, JSON.stringify({
    primaryText: '친구가 도와줬어요.',
    secondaryText: '',
    category: 'book',
    declinedToExplain: false,
  }));

  assert.equal(loadTodayFriendDeviceDraft(storage, mission)?.tertiaryText, '');
});

test('old success cannot delete a new Today Friend answer and failed replacement remains in memory', async () => {
  const { canReloadWithDrafts } = await import('./draftReloadSafety');
  const values = new Map<string, string>();
  let fail = false;
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error('quota'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
  const mission = getTodayFriendStudentMission(ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01'), '2026-09-01', 22);
  const before = { primaryText: '처음 답', secondaryText: '', tertiaryText: '', category: 'book' as const, declinedToExplain: false };
  saveTodayFriendDeviceDraft(storage, mission, before);
  const version = todayFriendDeviceDraftVersion(storage, mission);
  assert.ok(version);
  fail = true;
  assert.equal(saveTodayFriendDeviceDraft(storage, mission, { ...before, primaryText: '새 답' }), false);
  assert.equal(loadTodayFriendDeviceDraft(storage, mission)?.primaryText, '새 답');
  assert.equal(canReloadWithDrafts(22), false);
  assert.equal(await clearTodayFriendDeviceDraft(storage, mission, version), false);
  fail = false;
  saveTodayFriendDeviceDraft(storage, mission, { ...before, primaryText: '새 답' });
});
