import { isStorageRecord } from './storageV2Codec.js';

export const REWARD_AUDIT_FEATURES = {
  classwordQuiz: '낱말판 퀴즈', classwordEntry: 'ㄱㄴㄷ 게임', todayFriend: '오늘의 친구',
  emotion: '오늘의 감정', weeklyEmotion: '주간 감정', sudoku: '스도쿠', baseball: '숫자 야구',
  failure: '실패 전시회', bookStack: '책 쌓기', classroomRole: '1인1역', writing: '글쓰기', question: '개인 질문',
} as const;
export type RewardAuditFeature = keyof typeof REWARD_AUDIT_FEATURES;
export interface ExpectedReward {
  readonly id: string;
  readonly studentNumber: number;
  readonly feature: RewardAuditFeature;
  readonly dateKey: string;
  readonly amount: number | null;
  readonly ledgerIds: readonly string[];
  readonly includeSuffix?: boolean;
}
export interface RewardPayment { readonly id: string; readonly studentNumber: number; readonly delta: number }
export interface RewardAuditIssue {
  readonly id: string;
  readonly studentNumber: number;
  readonly feature: RewardAuditFeature;
  readonly dateKey: string;
  readonly expectedAmount: number | null;
  readonly paidAmount: number;
  readonly kind: 'missing' | 'amount_mismatch';
}
export interface WalletMismatch { readonly studentNumber: number; readonly balance: number; readonly expectedBalance: number }
export interface RewardAuditReport {
  readonly checkedAt: string;
  readonly checkedRewards: number;
  readonly issues: readonly RewardAuditIssue[];
  readonly walletMismatches: readonly WalletMismatch[];
  readonly unavailableSources: readonly string[];
}
export const REWARD_AUDIT_STAGES = {
  request: '검사 요청', source: '보상 원본 조회', snapshot: '학급 저장 데이터', ledger: '고마 기록',
  activities: '활동 기록', weeklyRewards: '주간 미션 지급', wordEntries: 'ㄱㄴㄷ 게임 기록', quizCompletions: '낱말판 퀴즈 기록',
  friendSubmissions: '오늘의 친구 제출', friendRewards: '오늘의 친구 지급', report: '검사 결과', response: '검사 응답',
} as const;
export type RewardAuditStage = keyof typeof REWARD_AUDIT_STAGES;
export class RewardAuditError extends Error {
  constructor(readonly code = 'REWARD_AUDIT_INVALID_RESPONSE', readonly stage?: RewardAuditStage) { super(code); this.name = 'RewardAuditError'; }
}
const REWARD_AUDIT_CODE = /^(?:REWARD_AUDIT_(?:INVALID_RESPONSE|UNKNOWN_MISSION|UNAVAILABLE|FAILED|NETWORK|TIMEOUT|CLIENT_TIMEOUT|SOURCE_NETWORK|SOURCE_TIMEOUT|SOURCE_HTTP_[45][0-9]{2})|DEVICE_REGISTRATION_REQUIRED|TEACHER_REQUIRED|TOO_MANY_REQUESTS|SAVE_ALERTS_NOT_CONFIGURED)$/;
export const isRewardAuditStage = (value: unknown): value is RewardAuditStage => typeof value === 'string' && Object.hasOwn(REWARD_AUDIT_STAGES, value);
export const toRewardAuditFailure = (error: unknown, fallbackStage: RewardAuditStage): { readonly code: string; readonly stage: RewardAuditStage } => ({
  code: error instanceof RewardAuditError && REWARD_AUDIT_CODE.test(error.code) ? error.code : 'REWARD_AUDIT_FAILED',
  stage: error instanceof RewardAuditError && error.stage ? error.stage : fallbackStage,
});
// Server-side stages wrap their own validation so the failing section stays visible.
export const inRewardAuditStage = <T>(stage: RewardAuditStage, run: () => T): T => {
  try { return run(); } catch (error) {
    if (error instanceof RewardAuditError && error.stage) throw error;
    throw new RewardAuditError(error instanceof RewardAuditError ? error.code : 'REWARD_AUDIT_INVALID_RESPONSE', stage);
  }
};
export interface RewardAuditFailure { readonly httpStatus: number | null; readonly code: string; readonly stage: RewardAuditStage | null }
export class RewardAuditRequestError extends Error {
  constructor(readonly failure: RewardAuditFailure) { super(failure.code); this.name = 'RewardAuditRequestError'; }
}
export const parseRewardAuditFailureBody = (httpStatus: number, body: unknown): RewardAuditFailure => {
  const record = isStorageRecord(body) ? body : {};
  const code = [record.code, record.error].find((value): value is string => typeof value === 'string' && REWARD_AUDIT_CODE.test(value));
  return { httpStatus, code: code ?? 'REWARD_AUDIT_UNAVAILABLE', stage: isRewardAuditStage(record.stage) ? record.stage : null };
};
export const describeRewardAuditFailure = (failure: RewardAuditFailure): { readonly action: string; readonly detail: string } => ({
  action: failure.httpStatus === 401 || failure.httpStatus === 403 ? '교사 기기 등록을 확인한 뒤 다시 검사해 주세요.'
    : failure.httpStatus === 429 ? '잠시 후 다시 검사해 주세요.' : '다시 검사해 주세요.',
  detail: [failure.httpStatus === null ? '응답 없음' : `HTTP ${failure.httpStatus}`, failure.code,
    ...(failure.stage ? [`단계: ${REWARD_AUDIT_STAGES[failure.stage]}`] : [])].join(' · '),
});
export const compareRewardPayments = ({ expected, ledger }: { readonly expected: readonly ExpectedReward[]; readonly ledger: readonly RewardPayment[] }): RewardAuditIssue[] => {
  const unique = new Map(expected.map(reward => [`${reward.studentNumber}:${reward.id}`, reward]));
  const byStudent = new Map<number, RewardPayment[]>();
  for (const payment of ledger) { const entries = byStudent.get(payment.studentNumber) ?? []; entries.push(payment); byStudent.set(payment.studentNumber, entries); }
  return [...unique.values()].flatMap(reward => {
    const paidAmount = (byStudent.get(reward.studentNumber) ?? []).filter(payment => reward.ledgerIds.some(id => payment.id === id || (reward.includeSuffix && payment.id.startsWith(`${id}:`)))).reduce((sum, payment) => sum + payment.delta, 0);
    if (reward.amount === null ? paidAmount > 0 : paidAmount === reward.amount) return [];
    return [{ id: reward.id, studentNumber: reward.studentNumber, feature: reward.feature, dateKey: reward.dateKey,
      expectedAmount: reward.amount, paidAmount, kind: paidAmount === 0 ? 'missing' as const : 'amount_mismatch' as const }];
  });
};

const integer = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new RewardAuditError();
  return value;
};
const student = (value: unknown): number => { const result = integer(value); if (result < 1 || result > 23) throw new RewardAuditError(); return result; };
const text = (value: unknown): string => { if (typeof value !== 'string' || !value || value.length > 300) throw new RewardAuditError(); return value; };
const feature = (value: unknown): RewardAuditFeature => {
  for (const key of Object.keys(REWARD_AUDIT_FEATURES)) if (key === value && isRewardAuditFeature(key)) return key;
  throw new RewardAuditError();
};
const isRewardAuditFeature = (value: string): value is RewardAuditFeature => Object.hasOwn(REWARD_AUDIT_FEATURES, value);
export const parseRewardAuditReport = (value: unknown): RewardAuditReport => {
  if (!isStorageRecord(value) || !Array.isArray(value.issues) || !Array.isArray(value.walletMismatches) || !Array.isArray(value.unavailableSources)) throw new RewardAuditError();
  const checkedAt = text(value.checkedAt), checkedRewards = integer(value.checkedRewards);
  if (!Number.isFinite(Date.parse(checkedAt)) || checkedRewards < 0) throw new RewardAuditError();
  const issues = value.issues.map((issue): RewardAuditIssue => {
    if (!isStorageRecord(issue) || (issue.kind !== 'missing' && issue.kind !== 'amount_mismatch')) throw new RewardAuditError();
    const expectedAmount = issue.expectedAmount === null ? null : integer(issue.expectedAmount);
    if (expectedAmount !== null && expectedAmount < 1) throw new RewardAuditError();
    return { id: text(issue.id), studentNumber: student(issue.studentNumber), feature: feature(issue.feature), dateKey: text(issue.dateKey), expectedAmount, paidAmount: integer(issue.paidAmount), kind: issue.kind };
  });
  const walletMismatches = value.walletMismatches.map((row): WalletMismatch => {
    if (!isStorageRecord(row)) throw new RewardAuditError();
    return { studentNumber: student(row.studentNumber), balance: integer(row.balance), expectedBalance: integer(row.expectedBalance) };
  });
  return { checkedAt, checkedRewards, issues, walletMismatches, unavailableSources: value.unavailableSources.map(text) };
};
