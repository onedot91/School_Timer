import {
  parseClasswordBoard,
  parseClasswordRounds,
  type ClasswordBoard,
  type ClasswordEntry,
  type ClasswordInitial,
  type ClasswordRoundSummary,
} from '../lib/classword.js';
import type { ClasswordQuizCompletion, ClasswordQuizDefinition } from '../lib/classwordQuiz.js';
import {
  CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  parseWeeklyMissionResult,
  type WeeklyMissionResult,
} from '../lib/weeklyMission.js';

export type ClasswordRepositoryConfiguration = {
  readonly url: string;
  readonly key: string;
};

export type ClasswordEntryWrite = {
  readonly entryId?: string;
  readonly dateKey: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
  readonly studentNumber: number;
};

export type ClasswordRewardClaim = {
  readonly studentNumber: number;
  readonly entryId: string;
  readonly dateKey: string;
};

export type ClasswordQuizRewardResult = {
  readonly awarded: boolean;
  readonly rewardAmount: number;
  readonly balance: number;
};

export class ClasswordRepositoryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ClasswordRepositoryError';
    this.status = status;
    this.code = code;
  }
}

const headers = (key: string, content = false): Record<string, string> => ({
  Accept: 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
  ...(content ? { 'Content-Type': 'application/json' } : {}),
});

const request = async (
  configuration: ClasswordRepositoryConfiguration,
  path: string,
  init?: RequestInit,
): Promise<unknown> => {
  const result = await fetch(`${configuration.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(configuration.key, init?.body !== undefined), ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (result.status === 409) throw new ClasswordRepositoryError(409, 'CLASSWORD_ENTRY_CONFLICT');
  if (!result.ok) throw new ClasswordRepositoryError(502, `CLASSWORD_DATABASE_HTTP_${result.status}`);
  if (result.status === 204) return null;
  const body = await result.text();
  return body.length === 0 ? null : JSON.parse(body);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseClasswordQuizRewardResult = (value: unknown): ClasswordQuizRewardResult => {
  if (
    !isRecord(value)
    || value.missionType !== CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE
    || typeof value.awarded !== 'boolean'
    || typeof value.rewardAmount !== 'number'
    || !Number.isInteger(value.rewardAmount)
    || value.rewardAmount < 1
    || value.rewardAmount > 10
    || typeof value.balance !== 'number'
  ) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return {
    awarded: value.awarded,
    rewardAmount: value.rewardAmount,
    balance: value.balance,
  };
};

const mapEntryRow = (row: unknown): ClasswordEntry => {
  if (!isRecord(row)) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return parseClasswordBoard({
    dateKey: row.round_date,
    topic: '',
    entries: [{
      id: row.id,
      dateKey: row.round_date,
      initial: row.initial,
      word: row.word,
      studentNumber: row.student_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }],
  }).entries[0] ?? (() => { throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE'); })();
};

const parseRows = (value: unknown): readonly Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  }
  return value;
};

const mapQuizCompletionRow = (row: unknown): ClasswordQuizCompletion => {
  if (
    !isRecord(row)
    || typeof row.quiz_date !== 'string'
    || typeof row.question_id !== 'string'
    || typeof row.student_number !== 'number'
    || !Number.isInteger(row.student_number)
    || row.student_number < 1
    || row.student_number > 23
    || typeof row.completed_at !== 'string'
  ) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return {
    dateKey: row.quiz_date,
    questionId: row.question_id,
    studentNumber: row.student_number,
    completedAt: row.completed_at,
  };
};

const mapQuizDefinitionRow = (row: unknown): ClasswordQuizDefinition => {
  if (
    !isRecord(row)
    || typeof row.question_id !== 'string'
    || typeof row.initial_hint !== 'string'
    || typeof row.meaning !== 'string'
    || typeof row.answer !== 'string'
    || typeof row.written_prefix !== 'string'
    || typeof row.written_suffix !== 'string'
    || typeof row.spoken_prefix !== 'string'
    || typeof row.spoken_suffix !== 'string'
  ) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return {
    id: row.question_id,
    initialHint: row.initial_hint,
    meaning: row.meaning,
    answer: row.answer,
    examples: [
      { register: 'written', prefix: row.written_prefix, suffix: row.written_suffix },
      { register: 'spoken', prefix: row.spoken_prefix, suffix: row.spoken_suffix },
    ],
  };
};

export const loadClasswordBoard = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<ClasswordBoard> => {
  const encodedDate = encodeURIComponent(dateKey);
  const [roundValue, entriesValue] = await Promise.all([
    request(configuration, `classword_rounds?round_date=eq.${encodedDate}&select=round_date,topic`),
    request(configuration, `classword_entries?round_date=eq.${encodedDate}&select=id,round_date,initial,word,student_number,created_at,updated_at&order=created_at.asc`),
  ]);
  const round = parseRows(roundValue)[0];
  return {
    dateKey,
    topic: round && typeof round.topic === 'string' ? round.topic : '',
    entries: parseRows(entriesValue).map(mapEntryRow),
  };
};

export const loadClasswordRounds = async (
  configuration: ClasswordRepositoryConfiguration,
  monthKey: string,
): Promise<readonly ClasswordRoundSummary[]> => {
  const start = `${monthKey}-01`;
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year ?? 2000, month ?? 1, 1)).toISOString().slice(0, 10);
  const value = await request(
    configuration,
    `classword_rounds?round_date=gte.${start}&round_date=lt.${nextMonth}&select=round_date,topic&order=round_date.asc`,
  );
  return parseClasswordRounds(parseRows(value).map((row) => ({
    dateKey: row.round_date,
    topic: row.topic,
  })));
};

export const loadClasswordUsedTopics = async (
  configuration: ClasswordRepositoryConfiguration,
): Promise<readonly string[]> => {
  const value = await request(
    configuration,
    'classword_rounds?topic=neq.&select=topic',
  );
  return [...new Set(parseRows(value)
    .map((row) => typeof row.topic === 'string' ? row.topic.trim() : '')
    .filter(Boolean))];
};

export const loadClasswordTopic = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<string> => {
  const value = await request(
    configuration,
    `classword_rounds?round_date=eq.${encodeURIComponent(dateKey)}&select=topic`,
  );
  const row = parseRows(value)[0];
  return row && typeof row.topic === 'string' ? row.topic : '';
};

export const loadClasswordQuizCompletions = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  questionId: string,
): Promise<readonly ClasswordQuizCompletion[]> => {
  const value = await request(
    configuration,
    `classword_quiz_completions?quiz_date=eq.${encodeURIComponent(dateKey)}&question_id=eq.${encodeURIComponent(questionId)}&select=quiz_date,question_id,student_number,completed_at&order=student_number.asc`,
  );
  return parseRows(value).map(mapQuizCompletionRow);
};

export const loadClasswordQuizDefinition = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<ClasswordQuizDefinition | null> => {
  const value = await request(
    configuration,
    `classword_quizzes?quiz_date=eq.${encodeURIComponent(dateKey)}&select=question_id,initial_hint,meaning,answer,written_prefix,written_suffix,spoken_prefix,spoken_suffix&limit=1`,
  );
  const row = parseRows(value)[0];
  return row ? mapQuizDefinitionRow(row) : null;
};

export const saveClasswordQuizDefinition = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  question: ClasswordQuizDefinition,
): Promise<void> => {
  await request(configuration, 'classword_quizzes?on_conflict=quiz_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      quiz_date: dateKey,
      question_id: question.id,
      initial_hint: question.initialHint,
      meaning: question.meaning,
      answer: question.answer,
      written_prefix: question.examples[0].prefix,
      written_suffix: question.examples[0].suffix,
      spoken_prefix: question.examples[1].prefix,
      spoken_suffix: question.examples[1].suffix,
    }),
  });
};

export const deleteClasswordQuizDefinition = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<void> => {
  await request(configuration, `classword_quizzes?quiz_date=eq.${encodeURIComponent(dateKey)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
};

export const loadClasswordQuizRewardAmount = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  studentNumber: number,
): Promise<number | null> => {
  const value = await request(
    configuration,
    `weekly_mission_rewards?student_number=eq.${studentNumber}&week_key=eq.${encodeURIComponent(dateKey)}&mission_type=eq.${CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE}&select=reward_amount&limit=1`,
  );
  const rewardAmount = parseRows(value)[0]?.reward_amount;
  return typeof rewardAmount === 'number'
    && Number.isInteger(rewardAmount)
    && rewardAmount >= 1
    && rewardAmount <= 10
    ? rewardAmount
    : null;
};

export const saveClasswordQuizCompletion = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  questionId: string,
  studentNumber: number,
): Promise<ClasswordQuizCompletion> => {
  await request(
    configuration,
    'classword_quiz_completions?on_conflict=quiz_date,question_id,student_number',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        quiz_date: dateKey,
        question_id: questionId,
        student_number: studentNumber,
      }),
    },
  );
  const completions = await loadClasswordQuizCompletions(configuration, dateKey, questionId);
  const completion = completions.find((candidate) => candidate.studentNumber === studentNumber);
  if (!completion) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return completion;
};

export const saveClasswordEntry = async (
  configuration: ClasswordRepositoryConfiguration,
  input: ClasswordEntryWrite,
): Promise<ClasswordEntry> => {
  const value = await request(
    configuration,
    input.entryId
      ? `classword_entries?id=eq.${encodeURIComponent(input.entryId)}&student_number=eq.${input.studentNumber}&round_date=eq.${encodeURIComponent(input.dateKey)}&select=id,round_date,initial,word,student_number,created_at,updated_at`
      : 'classword_entries?select=id,round_date,initial,word,student_number,created_at,updated_at',
    {
      method: input.entryId ? 'PATCH' : 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        round_date: input.dateKey,
        initial: input.initial,
        word: input.word,
        student_number: input.studentNumber,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const entry = parseRows(value)[0];
  if (!entry) throw new ClasswordRepositoryError(input.entryId ? 403 : 502, input.entryId ? 'CLASSWORD_ENTRY_FORBIDDEN' : 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return mapEntryRow(entry);
};

export const deleteClasswordEntry = async (
  configuration: ClasswordRepositoryConfiguration,
  entryId: string,
  studentNumber: number | null,
  dateKey: string | null = null,
): Promise<void> => {
  const studentFilter = studentNumber === null ? '' : `&student_number=eq.${studentNumber}`;
  const dateFilter = dateKey === null ? '' : `&round_date=eq.${encodeURIComponent(dateKey)}`;
  const value = await request(
    configuration,
    `classword_entries?id=eq.${encodeURIComponent(entryId)}${studentFilter}${dateFilter}&select=id`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } },
  );
  if (parseRows(value).length === 0) {
    throw new ClasswordRepositoryError(403, 'CLASSWORD_ENTRY_FORBIDDEN');
  }
};

export const saveClasswordTopic = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  topic: string,
): Promise<void> => {
  await request(configuration, 'classword_rounds?on_conflict=round_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ round_date: dateKey, topic }),
  });
};

export const deleteClasswordDateEntries = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<void> => {
  await request(configuration, `classword_entries?round_date=eq.${encodeURIComponent(dateKey)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
};

export const pruneClasswordEntries = async (
  configuration: ClasswordRepositoryConfiguration,
  cutoffDateKey: string,
): Promise<void> => {
  await request(
    configuration,
    `classword_entries?round_date=lt.${encodeURIComponent(cutoffDateKey)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
};

export const claimClasswordReward = async (
  configuration: ClasswordRepositoryConfiguration,
  claim: ClasswordRewardClaim,
): Promise<WeeklyMissionResult> => parseWeeklyMissionResult(await request(
  configuration,
  'rpc/claim_weekly_mission_reward',
  {
    method: 'POST',
    body: JSON.stringify({
      p_student_number: claim.studentNumber,
      p_week_key: claim.dateKey,
      p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      p_source_event_id: claim.entryId,
    }),
  },
));

export const claimClasswordQuizReward = async (
  configuration: ClasswordRepositoryConfiguration,
  claim: ClasswordRewardClaim,
): Promise<ClasswordQuizRewardResult> => parseClasswordQuizRewardResult(await request(
  configuration,
  'rpc/claim_weekly_mission_reward',
  {
    method: 'POST',
    body: JSON.stringify({
      p_student_number: claim.studentNumber,
      p_week_key: claim.dateKey,
      p_mission_type: CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
      p_source_event_id: claim.entryId,
    }),
  },
));
