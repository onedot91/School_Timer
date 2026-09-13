import { compareRewardPayments, parseRewardAuditReport, RewardAuditError, type ExpectedReward, type RewardAuditFeature, type RewardAuditReport, type RewardPayment } from '../lib/rewardAudit.js';
import { isStorageRecord } from '../lib/storageV2Codec.js';
import { getKoreanDateKey } from '../lib/classword.js';
import { parseStorageSnapshot, type StorageConfiguration } from './storageV2Repository.js';
import { collectActivityRewardExpectations } from './rewardAuditActivities.js';
import { getKoreanIsoWeekKey } from '../lib/weeklyMission.js';
import { loadNewspaperData } from './newspaperRepository.js';
import { historicalRewardResolution, isResolvedHistoricalReward } from './rewardAuditResolutions.js';

const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isStorageRecord)) throw new RewardAuditError();
  return value;
};
const text = (value: unknown): string => { if (typeof value !== 'string' || !value || value.length > 300) throw new RewardAuditError(); return value; };
const student = (value: unknown): number => { if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 23) throw new RewardAuditError(); return value; };
const amount = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new RewardAuditError(); return value; };
interface QuestionAudit { readonly expected: readonly ExpectedReward[]; readonly unavailableSources: readonly string[] }
const missionFeature = (mission: string): RewardAuditFeature => {
  switch (mission) {
    case 'personal_question': return 'question';
    case 'classword_word_entry': return 'classwordEntry';
    case 'classword_quiz_correct': return 'classwordQuiz';
    case 'failure_exhibition': return 'failure';
    case 'book_stack': return 'bookStack';
    default: throw new RewardAuditError('REWARD_AUDIT_UNKNOWN_MISSION');
  }
};
const weeklyId = (number: number, period: string, mission: string): string => mission === 'personal_question'
  ? `weekly-mission-${number}-${period}` : `weekly-mission-${mission}-${number}-${period}`;

export const buildRewardAudit = (input: unknown, questions: QuestionAudit = { expected: [], unavailableSources: ['개인 질문 완료 원본을 조회하지 않았습니다.'] }): RewardAuditReport => {
  if (!isStorageRecord(input)) throw new RewardAuditError();
  const checkedAt = text(input.checkedAt);
  if (!Number.isFinite(Date.parse(checkedAt))) throw new RewardAuditError();
  const today = getKoreanDateKey(new Date(checkedAt));
  const snapshot = parseStorageSnapshot(input.snapshot);
  const activities = collectActivityRewardExpectations(snapshot.value);
  const expected = new Map<string, ExpectedReward>();
  const add = (reward: ExpectedReward) => { const key = `${reward.studentNumber}:${reward.id}`; if (!expected.has(key) || reward.amount !== null) expected.set(key, reward); };
  for (const reward of [...activities.expected, ...questions.expected]) add(reward);
  for (const row of rows(input.weeklyRewards)) {
    const number = student(row.student_number), period = text(row.week_key), mission = text(row.mission_type), id = weeklyId(number, period, mission);
    const ledgerIds = mission === 'personal_question' ? [id, `weekly-mission-correction-5-${number}-${period}`] : [id];
    add({ id, studentNumber: number, feature: missionFeature(mission), dateKey: period, amount: amount(row.reward_amount), ledgerIds });
  }
  for (const row of rows(input.wordEntries)) {
    const number = student(row.student_number), period = text(row.round_date);
    if (period >= today) continue;
    const id = weeklyId(number, period, 'classword_word_entry');
    add({ id, studentNumber: number, feature: 'classwordEntry', dateKey: period, amount: 5, ledgerIds: [id] });
  }
  for (const row of rows(input.quizCompletions)) {
    const number = student(row.student_number), period = text(row.quiz_date), id = weeklyId(number, period, 'classword_quiz_correct');
    add({ id, studentNumber: number, feature: 'classwordQuiz', dateKey: period, amount: null, ledgerIds: [id] });
  }
  const friends = rows(input.friendSubmissions);
  for (const row of friends) {
    const number = student(row.student_number), dateKey = text(row.submission_date);
    if (row.status !== 'approved') continue;
    const id = `today-friend-reward-${text(row.id)}`;
    add({ id, studentNumber: number, feature: 'todayFriend', dateKey, amount: 15, ledgerIds: [id] });
  }
  for (const row of rows(input.friendRewards)) {
    const number = student(row.student_number), submissionId = text(row.submission_id), id = `today-friend-reward-${submissionId}`;
    const submission = friends.find(item => item.id === submissionId && item.student_number === number);
    add({ id, studentNumber: number, feature: 'todayFriend', dateKey: typeof submission?.submission_date === 'string' ? submission.submission_date : '날짜 확인 필요', amount: amount(row.reward_amount), ledgerIds: [id] });
  }
  const ledger: RewardPayment[] = [];
  if (!isStorageRecord(snapshot.value.currencyHistory)) throw new RewardAuditError();
  for (const [key, entries] of Object.entries(snapshot.value.currencyHistory)) {
    const number = student(Number(key));
    for (const entry of rows(entries)) {
      if (typeof entry.delta !== 'number' || !Number.isSafeInteger(entry.delta)) throw new RewardAuditError();
      ledger.push({ id: text(entry.id), studentNumber: number, delta: entry.delta });
    }
  }
  return parseRewardAuditReport({ checkedAt, checkedRewards: expected.size,
    issues: compareRewardPayments({ expected: [...expected.values()], ledger }).filter(issue => !isResolvedHistoricalReward(issue)), walletMismatches: input.walletMismatches,
    unavailableSources: [...new Set([...activities.unavailableSources, ...questions.unavailableSources,
      `${historicalRewardResolution.decidedOn} ${historicalRewardResolution.decision}`,
      '삭제되거나 보존 기간이 지난 활동은 완료 여부를 확인할 수 없습니다.',
      '별도 ID로 복구한 지급은 원래 보상과의 연결 확인이 필요할 수 있습니다.'])] });
};

const loadQuestionAudit = async (configuration: StorageConfiguration): Promise<QuestionAudit> => {
  const weekKey = getKoreanIsoWeekKey();
  try {
    const data = await loadNewspaperData(configuration, 0, weekKey);
    const expected: ExpectedReward[] = data.questions.filter(row => row.question_type === 'personal' && row.week_key === weekKey).map(row => {
      const studentNumber = row.student_number;
      const id = weeklyId(studentNumber, weekKey, 'personal_question');
      return { id, studentNumber, feature: 'question', dateKey: weekKey, amount: 15, ledgerIds: [id] };
    });
    return { expected, unavailableSources: ['개인 질문 완료 원본은 이번 주만 조회합니다.'] };
  } catch { return { expected: [], unavailableSources: ['신문 개인 질문 원본 조회 실패'] }; }
};
export const loadRewardAudit = async (configuration: StorageConfiguration): Promise<RewardAuditReport> => {
  const questions = await loadQuestionAudit(configuration);
  const response = await fetch(`${configuration.url.replace(/\/$/, '')}/rest/v1/rpc/storage_reward_audit_source`, {
    method: 'POST', headers: { apikey: configuration.key, Authorization: `Bearer ${configuration.key}`, 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new RewardAuditError('REWARD_AUDIT_UNAVAILABLE');
  return buildRewardAudit(await response.json(), questions);
};
