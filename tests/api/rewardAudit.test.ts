import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRewardAudit } from '../../src/server/rewardAuditRepository.js';
import { splitStorageState } from '../../src/lib/storageV2Codec.js';

const source = () => ({ checkedAt: '2026-09-08T06:00:00Z', snapshot: { ...splitStorageState({ currencyBalances: { 17: 335 }, currencyHistory: {} }), revisions: {}, updated_at: '2026-09-08T06:00:00Z' }, walletMismatches: [], weeklyRewards: [], wordEntries: [], quizCompletions: [], friendSubmissions: [], friendRewards: [] });
test('교사가 추가 정산 없이 종결한 7월 여섯 건만 경고에서 제외한다', () => {
  const closed = [
    { student_number: 21, week_key: '2026-29', mission_type: 'personal_question', reward_amount: 5 },
    { student_number: 12, week_key: '2026-29', mission_type: 'personal_question', reward_amount: 5 },
    { student_number: 12, week_key: '2026-29', mission_type: 'classword_quiz_correct', reward_amount: 5 },
    { student_number: 16, week_key: '2026-29', mission_type: 'personal_question', reward_amount: 5 },
    { student_number: 18, week_key: '2026-29', mission_type: 'personal_question', reward_amount: 5 },
    { student_number: 13, week_key: '2026-30', mission_type: 'classword_word_entry', reward_amount: 5 },
  ];
  const input = { ...source(), weeklyRewards: [...closed, { ...closed[0], week_key: '2026-37' }, { ...closed[0], student_number: 22 }] };
  const before = structuredClone(input);
  const report = buildRewardAudit(input);
  assert.deepEqual(report.issues.map(issue => issue.id), ['weekly-mission-21-2026-37', 'weekly-mission-22-2026-29']);
  assert.ok(report.unavailableSources.some(message => message.includes('추가 정산 없이 종결')));
  assert.deepEqual(input, before);
  assert.equal(buildRewardAudit({ ...source(), weeklyRewards: [{ ...closed[0], reward_amount: 10 }] }).issues.length, 1);
});
test('개인 질문 기본 10과 동일 학생·주차의 추가 5 지급을 합산한다', () => {
  const history = [
    { id: 'weekly-mission-17-2026-36', studentNumber: 17, delta: 10 },
    { id: 'weekly-mission-correction-5-17-2026-36', studentNumber: 17, delta: 5 },
    { id: 'weekly-mission-correction-5-17-2026-35', studentNumber: 17, delta: 5 },
  ];
  const input = { ...source(), weeklyRewards: [{ student_number: 17, week_key: '2026-36', mission_type: 'personal_question', reward_amount: 15 }], snapshot: { ...splitStorageState({ currencyBalances: { 17: 335 }, currencyHistory: { 17: history } }), revisions: {}, updated_at: '2026-09-08T06:00:00Z' } };
  assert.deepEqual(buildRewardAudit(input).issues, []);
  const withoutCorrection = { ...input, snapshot: { ...splitStorageState({ currencyBalances: { 17: 335 }, currencyHistory: { 17: history.filter(item => item.id !== 'weekly-mission-correction-5-17-2026-36') } }), revisions: {}, updated_at: '2026-09-08T06:00:00Z' } };
  assert.equal(buildRewardAudit(withoutCorrection).issues[0].paidAmount, 10);
  const missing = Array.from({ length: 6 }, (_, index) => ({ student_number: index + 1, week_key: '2026-29', mission_type: 'personal_question', reward_amount: 5 }));
  const report = buildRewardAudit({ ...input, weeklyRewards: [...input.weeklyRewards, ...missing] });
  assert.deepEqual(report.issues.map(issue => issue.id).sort(), missing.map(row => `weekly-mission-${row.student_number}-2026-29`).sort());
  assert.ok(report.issues.every(issue => issue.paidAmount === 0 && issue.expectedAmount === 5));
});
test('지급 표식 +6은 실제 원장 지급을 대신하지 않으며 정답 중복은 하루 한 번만 센다', () => {
  const input = { ...source(), weeklyRewards: [{ student_number: 17, week_key: '2026-09-08', mission_type: 'classword_quiz_correct', reward_amount: 6 }], quizCompletions: [{ student_number: 17, quiz_date: '2026-09-08', id: 'answer1' }, { student_number: 17, quiz_date: '2026-09-08', id: 'answer2' }] };
  const report = buildRewardAudit(input);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].expectedAmount, 6);
  assert.equal(report.issues[0].paidAmount, 0);
});
test('승인 전 친구 제출과 오늘의 확정 전 낱말을 미지급으로 취급하지 않는다', () => {
  const report = buildRewardAudit({ ...source(), friendSubmissions: [{ id: 'draft', student_number: 17, submission_date: '2026-09-08', status: 'submitted' }], wordEntries: [{ id: 'entry', student_number: 17, round_date: '2026-09-08' }] });
  assert.deepEqual(report.issues, []);
});
test('과거 원장에 보상이 있으면 정상이며 누락된 claim 자체로 추가 지급을 요구하지 않는다', () => {
  const id = 'weekly-mission-classword_quiz_correct-17-2026-09-07';
  const state = { currencyBalances: { 17: 335 }, currencyHistory: { 17: [{ id, studentNumber: 17, delta: 6, before: 329, after: 335, reason: 'weekly_mission', createdAt: '2026-09-07T01:00:00Z' }] } };
  const report = buildRewardAudit({ ...source(), snapshot: { ...splitStorageState(state), revisions: {}, updated_at: '2026-09-08T06:00:00Z' }, quizCompletions: [{ student_number: 17, quiz_date: '2026-09-07', id: 'answer' }] });
  assert.deepEqual(report.issues, []);
});
test('일부 테이블 누락이나 잘못된 학생 번호는 성공한 0건 감사로 바뀌지 않는다', () => {
  assert.throws(() => buildRewardAudit({ ...source(), weeklyRewards: null }));
  assert.throws(() => buildRewardAudit({ ...source(), wordEntries: [{ id: 'bad', student_number: 24, round_date: '2026-09-07' }] }));
});
test('서버 시간대와 무관하게 한국 자정에 전날 낱말을 대조한다', () => {
  const report = buildRewardAudit({ ...source(), checkedAt: '2026-09-07T15:30:00Z', wordEntries: [{ id: 'entry', student_number: 17, round_date: '2026-09-07' }] });
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].dateKey, '2026-09-07');
});
