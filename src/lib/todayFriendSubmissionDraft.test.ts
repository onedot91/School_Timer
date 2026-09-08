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

test('Today Friend 새로고침 후 수동 재시도는 원 요청과 revision을 유지한다', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const before = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage }));
  const pending = before.prepare(mission, { kind: 'interview', answer: '보존할 답변' }, true);
  assert.ok(pending);
  const after = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage }));
  const retry = after.prepare({ ...mission, planningRevision: 'planning-new' }, { kind: 'interview', answer: '다른 답변' }, false);
  assert.deepEqual(retry, pending);
  assert.equal(retry?.expectedRevision, 0);
  assert.equal(retry?.planningRevision, 'planning-original');
  assert.equal(after.confirm(mission, 'older-response'), false);
  assert.equal(after.confirm(mission, pending.requestId), true);
  assert.equal(after.load(mission), null);
});

test('다른 학생·날짜·친구·질문의 요청 초안을 복원하지 않는다', () => {
  const store = createTodayFriendSubmissionDraftStore(createStudentSaveDraftStore({ storage: null }));
  store.prepare(mission, { kind: 'interview', answer: '내용' }, true);
  for (const other of [
    { ...mission, studentNumber: 2 }, { ...mission, dateKey: '2026-09-09' },
    { ...mission, partnerNumber: 3 }, { ...mission, question: '새 질문' },
  ]) assert.equal(store.load(other), null);
  assert.equal(store.prepare(mission, { kind: 'emotion', emotion: '기쁨', reason: '', declinedToExplain: true }, true)?.payload.kind, 'interview');
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
