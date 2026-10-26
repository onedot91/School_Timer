import assert from 'node:assert/strict';
import test from 'node:test';
import { compareRewardPayments, describeRewardAuditFailure, parseRewardAuditFailureBody, parseRewardAuditReport } from './rewardAudit.js';

test('완료 기록과 +6 지급 표식이 있어도 원장에 없으면 누락으로 표시한다', () => {
  const result = compareRewardPayments({ expected: [{ id: 'quiz-17', studentNumber: 17, feature: 'classwordQuiz', dateKey: '2026-09-08', amount: 6, ledgerIds: ['quiz-17'] }], ledger: [] });
  assert.deepEqual(result, [{ id: 'quiz-17', studentNumber: 17, feature: 'classwordQuiz', dateKey: '2026-09-08', expectedAmount: 6, paidAmount: 0, kind: 'missing' }]);
});

test('실제 지급과 취소·재지급의 순액을 계산하며 같은 번호의 다른 지급을 혼동하지 않는다', () => {
  const expected = [{ id: 'writing-17', studentNumber: 17, feature: 'writing', dateKey: '2026-09-08', amount: 25, ledgerIds: ['writing-17'], includeSuffix: true }] as const;
  const ledger = [{ id: 'writing-17', studentNumber: 17, delta: 25 }, { id: 'writing-17:cancel', studentNumber: 17, delta: -25 }, { id: 'writing-17:again', studentNumber: 17, delta: 25 }, { id: 'writing-17', studentNumber: 2, delta: 25 }];
  assert.deepEqual(compareRewardPayments({ expected, ledger }), []);
  assert.equal(compareRewardPayments({ expected, ledger: ledger.slice(0, 2) })[0]?.kind, 'missing');
});

test('추첨 금액이 기록되기 전에는 임의로 +6 또는 +10을 복구 금액으로 정하지 않는다', () => {
  const expected = [{ id: 'random', studentNumber: 1, feature: 'classwordQuiz', dateKey: '2026-09-08', amount: null, ledgerIds: ['random'] }] as const;
  assert.equal(compareRewardPayments({ expected, ledger: [] })[0]?.expectedAmount, null);
  assert.deepEqual(compareRewardPayments({ expected, ledger: [{ id: 'random', studentNumber: 1, delta: 7 }] }), []);
});

test('중복 자격은 한 건으로 표시하고 부분 지급과 초과 지급도 찾는다', () => {
  const reward = { id: 'reward', studentNumber: 1, feature: 'emotion', dateKey: '2026-09-08', amount: 5, ledgerIds: ['reward'] } as const;
  assert.equal(compareRewardPayments({ expected: [reward, reward], ledger: [] }).length, 1);
  assert.equal(compareRewardPayments({ expected: [reward], ledger: [{ id: 'reward', studentNumber: 1, delta: 2 }] })[0]?.kind, 'amount_mismatch');
});

test('감사 응답의 학생 범위와 금액을 검증하고 임의 필드는 전달하지 않는다', () => {
  const report = { checkedAt: '2026-09-08T00:00:00Z', checkedRewards: 0, issues: [], walletMismatches: [], unavailableSources: [] };
  assert.deepEqual(parseRewardAuditReport({ ...report, studentAnswers: 'private' }), report);
  assert.throws(() => parseRewardAuditReport({ ...report, checkedRewards: -1 }));
});

test('보상 점검 실패 응답은 허용된 코드·단계만 받아 HTTP 상태와 함께 표시한다', () => {
  const failure = parseRewardAuditFailureBody(502, { error: 'REWARD_AUDIT_UNAVAILABLE', code: 'REWARD_AUDIT_SOURCE_TIMEOUT', stage: 'source' });
  assert.deepEqual(failure, { httpStatus: 502, code: 'REWARD_AUDIT_SOURCE_TIMEOUT', stage: 'source' });
  assert.deepEqual(describeRewardAuditFailure(failure), { action: '다시 검사해 주세요.', detail: 'HTTP 502 · REWARD_AUDIT_SOURCE_TIMEOUT · 단계: 보상 원본 조회' });
  assert.deepEqual(parseRewardAuditFailureBody(401, { error: 'DEVICE_REGISTRATION_REQUIRED' }), { httpStatus: 401, code: 'DEVICE_REGISTRATION_REQUIRED', stage: null });
  assert.match(describeRewardAuditFailure({ httpStatus: 401, code: 'DEVICE_REGISTRATION_REQUIRED', stage: null }).action, /교사 기기 등록/);
  assert.deepEqual(parseRewardAuditFailureBody(500, { code: 'raw message here', stage: 'evil' }), { httpStatus: 500, code: 'REWARD_AUDIT_UNAVAILABLE', stage: null });
  assert.equal(describeRewardAuditFailure({ httpStatus: null, code: 'REWARD_AUDIT_NETWORK', stage: 'request' }).detail, '응답 없음 · REWARD_AUDIT_NETWORK · 단계: 검사 요청');
  assert.deepEqual(describeRewardAuditFailure(parseRewardAuditFailureBody(503, { error: 'REWARD_AUDIT_UNAVAILABLE', code: 'REWARD_AUDIT_BUSY', stage: 'source' })), { action: '잠시 후 다시 검사해 주세요.', detail: 'HTTP 503 · REWARD_AUDIT_BUSY · 단계: 보상 원본 조회' });
});
