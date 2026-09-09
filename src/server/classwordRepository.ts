import { randomUUID } from 'node:crypto';
import {
  parseClasswordBoard,
  parseClasswordRounds,
  type ClasswordBoard,
  type ClasswordEntry,
  type ClasswordInitial,
  type ClasswordRoundSummary,
} from '../lib/classword.js';
import type { ClasswordQuizCompletion, ClasswordQuizDefinition, ClasswordQuizPrompt } from '../lib/classwordQuiz.js';
import { getElapsedClasswordTopics, resolveClasswordMonth, resolveClasswordTopic } from '../lib/classwordTopics.js';
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
  readonly requestId: string;
  readonly expectedRevision?: string;
  readonly transportHash?: string;
  readonly expectedStoredTopic?: string | null;
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
  if (result.status === 409 && path.startsWith('classword_entries?')) {
    const body: unknown = await result.json().catch(() => null);
    if (isRecord(body) && body.code === '23505' && typeof body.message === 'string') {
      const constraint = /unique constraint "(classword_entries_(?:student|initial)_day_unique)"/.exec(body.message)?.[1];
      if (constraint === 'classword_entries_student_day_unique') {
        throw new ClasswordRepositoryError(409, 'CLASSWORD_STUDENT_ALREADY_ENTERED');
      }
      if (constraint === 'classword_entries_initial_day_unique') {
        throw new ClasswordRepositoryError(409, 'CLASSWORD_INITIAL_OCCUPIED');
      }
    }
  }
  if (!result.ok) {
    if (path === 'rpc/classword_command_v2') {
      const body: unknown = await result.json().catch(() => null);
      const message = isRecord(body) && typeof body.message === 'string' ? body.message : '';
      const business = ['CLASSWORD_STUDENT_ALREADY_ENTERED', 'CLASSWORD_INITIAL_OCCUPIED', 'CLASSWORD_ENTRY_CHANGED', 'STORAGE_REQUEST_REUSED', 'CLASSWORD_REWARD_LIMIT_EXCEEDED', 'CLASSWORD_TOPIC_CHANGED', 'CLASSWORD_QUIZ_CHANGED'];
      if (business.includes(message)) throw new ClasswordRepositoryError(409, message);
      if (message === 'CLASSWORD_REWARD_EVIDENCE_MISMATCH') throw new ClasswordRepositoryError(409, message);
      if (message === 'CLASSWORD_ENTRY_FORBIDDEN') throw new ClasswordRepositoryError(403, message);
      if (message === 'STORAGE_MAINTENANCE' || message === 'STORAGE_NOT_ACTIVE') throw new ClasswordRepositoryError(503, message);
    }
    throw new ClasswordRepositoryError(502, `CLASSWORD_DATABASE_HTTP_${result.status}`);
  }
  if (result.status === 204) return null;
  const body = await result.text();
  return body.length === 0 ? null : JSON.parse(body);
};


const command = (configuration: ClasswordRepositoryConfiguration, actor: number, action: string, payload: unknown, requestId: string = randomUUID()): Promise<unknown> => request(configuration, 'rpc/classword_command_v2', {
  method: 'POST', body: JSON.stringify({ p_actor: actor, p_request_id: requestId, p_action: action, p_payload: payload, p_protocol_version: 2 }),
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseClasswordQuizRewardResult = (value: unknown): ClasswordQuizRewardResult => {
  if (
    !isRecord(value)
    || value.completed !== true
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
    ...resolveClasswordTopic(dateKey, round && typeof round.topic === 'string' ? round.topic : ''),
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
  return resolveClasswordMonth(monthKey, parseClasswordRounds(parseRows(value).map((row) => ({
    dateKey: row.round_date,
    topic: row.topic,
  }))));
};

export const loadClasswordUsedTopics = async (
  configuration: ClasswordRepositoryConfiguration,
): Promise<readonly string[]> => {
  const value = await request(
    configuration,
    'classword_rounds?topic=neq.&select=topic',
  );
  const storedTopics = parseRows(value)
    .map((row) => typeof row.topic === 'string' ? row.topic.trim() : '')
    .filter(Boolean);
  return [...new Set([...storedTopics, ...getElapsedClasswordTopics()])];
};

export const loadClasswordTopic = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<string> => (await loadClasswordTopicContext(configuration, dateKey)).topic;

export const loadClasswordTopicContext = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
): Promise<{ readonly topic: string; readonly storedTopic: string | null }> => {
  const value = await request(
    configuration,
    `classword_rounds?round_date=eq.${encodeURIComponent(dateKey)}&select=topic`,
  );
  const row = parseRows(value)[0];
  const storedTopic = row && typeof row.topic === 'string' ? row.topic : null;
  return { topic: resolveClasswordTopic(dateKey, storedTopic ?? '').topic, storedTopic };
};

const parseClasswordReceiptResult = (row: Record<string, unknown>): unknown => {
  if (!isRecord(row.result)) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  if (row.action === 'classword:save_entry') return { entry: mapEntryRow(row.result.entry), ...parseWeeklyMissionResult(row.result.reward) };
  if (row.action === 'classword:complete_quiz') {
    const completion = mapQuizCompletionRow(row.result.completion);
    const reward = parseClasswordQuizRewardResult(row.result.reward);
    return { correct: true, ...reward, state: {
      dateKey: completion.dateKey, question: row.result.question, completed: true,
      completedAt: completion.completedAt, rewardAmount: reward.rewardAmount,
    } };
  }
  return row.result;
};

export const loadClasswordRequestReceipt = async (
  configuration: ClasswordRepositoryConfiguration, actor: number, requestId: string,
) => {
  const rows = parseRows(await request(configuration,
    `storage_receipts?actor_key=eq.${encodeURIComponent(`classword:${actor}`)}&request_id=eq.${encodeURIComponent(requestId)}&select=action,payload_hash,committed_at,result&limit=1`,
  ));
  const row = rows[0];
  if (!row) return null;
  if (typeof row.action !== 'string' || typeof row.payload_hash !== 'string' || typeof row.committed_at !== 'string')
    throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  const transportHash = isRecord(row.result) && typeof row.result.transportHash === 'string'
    && /^[a-f0-9]{64}$/.test(row.result.transportHash) ? row.result.transportHash : null;
  return { status: 'committed' as const, action: row.action, payloadHash: transportHash ?? row.payload_hash,
    hashAlgorithm: transportHash ? 'sha256-transport-v1' as const : 'md5-postgres-jsonb' as const,
    ...(!transportHash ? { legacy: true as const } : {}),
    committedAt: row.committed_at, result: parseClasswordReceiptResult(row) };
};

export const loadClasswordRequestResult = async (
  configuration: ClasswordRepositoryConfiguration, actor: number, requestId: string,
): Promise<unknown | null> => {
  const rows = parseRows(await request(configuration,
    `storage_receipts?actor_key=eq.${encodeURIComponent(`classword:${actor}`)}&request_id=eq.${encodeURIComponent(requestId)}&select=action,result&limit=1`,
  ));
  const row = rows[0];
  if (!row) return null;
  return parseClasswordReceiptResult(row);
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
  try {
    const value = await request(
      configuration,
      `classword_quizzes?quiz_date=eq.${encodeURIComponent(dateKey)}&select=question_id,initial_hint,meaning,answer,written_prefix,written_suffix,spoken_prefix,spoken_suffix&limit=1`,
    );
    const row = parseRows(value)[0];
    return row ? mapQuizDefinitionRow(row) : null;
  } catch (error) {
    if (error instanceof ClasswordRepositoryError && error.code === 'CLASSWORD_DATABASE_HTTP_404') return null;
    throw error;
  }
};

export const saveClasswordQuizDefinition = async (
  configuration: ClasswordRepositoryConfiguration,
  dateKey: string,
  question: ClasswordQuizDefinition,
  requestId?: string,
): Promise<void> => {
  await command(configuration, 0, 'save_quiz', {
      quiz_date: dateKey,
      question_id: question.id,
      initial_hint: question.initialHint,
      meaning: question.meaning,
      answer: question.answer,
      written_prefix: question.examples[0].prefix,
      written_suffix: question.examples[0].suffix,
      spoken_prefix: question.examples[1].prefix,
      spoken_suffix: question.examples[1].suffix,
  }, requestId);
};

export const deleteClasswordQuizDefinition = async (
  configuration: ClasswordRepositoryConfiguration, dateKey: string, requestId?: string,
): Promise<void> => { await command(configuration, 0, 'delete_quiz', { dateKey }, requestId); };

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
  if (typeof rewardAmount !== 'number' || !Number.isInteger(rewardAmount)
    || rewardAmount < 1 || rewardAmount > 10) return null;
  const entryId = `weekly-mission-classword_quiz_correct-${studentNumber}-${dateKey}`;
  const ledger = parseRows(await request(configuration,
    `wallet_ledger?student_number=eq.${studentNumber}&entry_id=eq.${encodeURIComponent(entryId)}&select=delta,reason,balance_before,balance_after&limit=2`,
  ));
  const entry = ledger[0];
  return ledger.length === 1 && entry?.delta === rewardAmount && entry.reason === 'weekly_mission'
    && typeof entry.balance_before === 'number' && typeof entry.balance_after === 'number'
    && entry.balance_after - entry.balance_before === rewardAmount ? rewardAmount : null;
};

export const saveClasswordQuizCompletion = async (
  configuration: ClasswordRepositoryConfiguration, dateKey: string, questionId: string, studentNumber: number, requestId: string, question: ClasswordQuizPrompt, transportHash?: string, expectedStoredQuestionId?: string | null,
): Promise<{ readonly completion: ClasswordQuizCompletion; readonly reward: ClasswordQuizRewardResult }> => {
  const value = await command(configuration, studentNumber, 'complete_quiz', { dateKey, questionId, question,
    ...(transportHash ? { transportHash } : {}), ...(expectedStoredQuestionId !== undefined ? { expectedStoredQuestionId } : {}) }, requestId);
  if (!isRecord(value)) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return { completion: mapQuizCompletionRow(value.completion), reward: parseClasswordQuizRewardResult(value.reward) };
};

export const saveClasswordEntry = async (
  configuration: ClasswordRepositoryConfiguration,
  input: ClasswordEntryWrite,
): Promise<{ readonly entry: ClasswordEntry; readonly reward: WeeklyMissionResult }> => {
  const value = await command(configuration, input.studentNumber, 'save_entry', {
    dateKey: input.dateKey, initial: input.initial, word: input.word,
    ...(input.entryId ? { entryId: input.entryId, expectedRevision: input.expectedRevision } : {}),
    ...(input.transportHash ? { transportHash: input.transportHash } : {}),
    ...(input.expectedStoredTopic !== undefined ? { expectedStoredTopic: input.expectedStoredTopic } : {}),
  }, input.requestId);
  if (!isRecord(value)) throw new ClasswordRepositoryError(502, 'CLASSWORD_DATABASE_INVALID_RESPONSE');
  return { entry: mapEntryRow(value.entry), reward: parseWeeklyMissionResult(value.reward) };
};

export const deleteClasswordEntry = async (
  configuration: ClasswordRepositoryConfiguration, entryId: string, studentNumber: number | null, dateKey: string | null = null, requestId?: string,
): Promise<void> => { await command(configuration, studentNumber ?? 0, 'delete_entry', { entryId, dateKey }, requestId); };

export const saveClasswordTopic = async (
  configuration: ClasswordRepositoryConfiguration, dateKey: string, topic: string, requestId?: string,
): Promise<void> => { await command(configuration, 0, 'save_topic', { dateKey, topic }, requestId); };

export const deleteClasswordDateEntries = async (
  configuration: ClasswordRepositoryConfiguration, dateKey: string, requestId?: string,
): Promise<void> => { await command(configuration, 0, 'delete_date_entries', { dateKey }, requestId); };

export const pruneClasswordEntries = async (
  configuration: ClasswordRepositoryConfiguration, cutoffDateKey: string,
): Promise<void> => { await command(configuration, 0, 'prune', { dateKey: cutoffDateKey }); };

export const claimClasswordReward = async (
  configuration: ClasswordRepositoryConfiguration,
  claim: ClasswordRewardClaim,
): Promise<WeeklyMissionResult> => parseWeeklyMissionResult(await request(
  configuration,
  'rpc/claim_weekly_mission_reward_v2',
  {
    method: 'POST',
    body: JSON.stringify({
      p_protocol_version: 2,
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
  'rpc/claim_weekly_mission_reward_v2',
  {
    method: 'POST',
    body: JSON.stringify({
      p_protocol_version: 2,
      p_student_number: claim.studentNumber,
      p_week_key: claim.dateKey,
      p_mission_type: CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
      p_source_event_id: claim.entryId,
    }),
  },
));
