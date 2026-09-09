import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentSaveDraftStore } from './studentSaveDraft';
import { createTodayFriendSubmissionDraftStore, selectLatestTodayFriendSubmission } from './todayFriendSubmissionDraft';
import type { TodayFriendSubmission } from './todayFriend';
import type { TodayFriendStudentMission } from './todayFriendState';

const mission: TodayFriendStudentMission = {
  dateKey: '2026-09-08', studentNumber: 17, partnerNumber: 2,
  genre: 'interview', question: '질문', submission: null, planningRevision: 'planning-original',
};

test('Today Friend 새로고침 후 수동 재시도는 원 요청과 revision을 유지한다', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const before = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage }));
  const pending = await before.prepare(mission, { kind: 'interview', answer: '보존할 답변' }, true);
  assert.ok(pending);
  const after = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage }));
  const retry = await after.prepare({ ...mission, planningRevision: 'planning-new' }, { kind: 'interview', answer: '다른 답변' }, false);
  assert.deepEqual(retry, pending);
  assert.equal(retry?.expectedRevision, 0);
  assert.equal(retry?.planningRevision, 'planning-original');
  assert.equal(retry?.expectedStudentNumber, 17);
  assert.equal(await after.confirm(mission, 'older-response'), false);
  assert.equal(await after.confirm(mission, pending.requestId), true);
  assert.equal(after.load(mission), null);
});

test('기존 미확인 요청은 대상 학생 필드를 소급 추가하지 않고 원본 ID를 유지한다', async () => {
  const common = createStudentSaveDraftStore({ storage: null, createRequestId: () => 'legacy-friend-identity' });
  await common.saveDurable({ studentNumber: mission.studentNumber, feature: 'todayFriend',
    entityId: JSON.stringify([mission.dateKey, mission.partnerNumber, mission.genre, mission.question]) }, {
    payload: { kind: 'interview', answer: '이전 제출' }, submit: true, expectedRevision: 0,
  });
  const store = createTodayFriendSubmissionDraftStore(common);
  const pending = await store.prepare(mission, { kind: 'interview', answer: '다른 내용' }, true);
  assert.equal(pending?.requestId, 'legacy-friend-identity');
  assert.equal(pending?.expectedStudentNumber, null);
  assert.deepEqual(pending?.payload, { kind: 'interview', answer: '이전 제출' });
});

test('다른 학생·날짜·친구·질문의 요청 초안을 복원하지 않는다', async () => {
  const store = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage: null }));
  await store.prepare(mission, { kind: 'interview', answer: '내용' }, true);
  for (const other of [
    { ...mission, studentNumber: 2 }, { ...mission, dateKey: '2026-09-09' },
    { ...mission, partnerNumber: 3 }, { ...mission, question: '새 질문' },
  ]) assert.equal(store.load(other), null);
  assert.equal((await store.prepare(mission, { kind: 'emotion', emotion: '기쁨', reason: '', declinedToExplain: true }, true))?.payload.kind, 'interview');
});

test('이전 요청의 확인 영수증이 나중에 도착해도 최신 승인 상태를 되돌리지 않는다', () => {
  const confirmed: TodayFriendSubmission = {
    id: 'today-friend-fixture', dateKey: mission.dateKey, studentNumber: mission.studentNumber,
    partnerNumber: mission.partnerNumber, genre: mission.genre, payload: { kind: 'interview', answer: '답변' },
    revision: 1, storageRevision: 1, status: 'submitted', teacherFeedback: null,
    submittedAt: '2026-09-08T00:00:00.000Z', reviewedAt: null, rewardStatus: 'pending',
  };
  const latest: TodayFriendSubmission = { ...confirmed, storageRevision: 2, status: 'approved', rewardStatus: 'paid' };
  assert.equal(selectLatestTodayFriendSubmission(latest, confirmed), latest);
  assert.equal(selectLatestTodayFriendSubmission(confirmed, latest), latest);
  assert.equal(selectLatestTodayFriendSubmission(null, confirmed), confirmed);
});
