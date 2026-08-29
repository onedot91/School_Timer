import {
  parseClasswordBoard,
  parseClasswordRounds,
  type ClasswordBoard,
  type ClasswordEntry,
  type ClasswordInitial,
  type ClasswordRoundSummary,
} from '../lib/classword.js';
import {
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  getKoreanIsoWeekKey,
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
  return result.json();
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

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
  studentNumber: number,
  entryId: string,
): Promise<WeeklyMissionResult> => parseWeeklyMissionResult(await request(
  configuration,
  'rpc/claim_weekly_mission_reward',
  {
    method: 'POST',
    body: JSON.stringify({
      p_student_number: studentNumber,
      p_week_key: getKoreanIsoWeekKey(),
      p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      p_source_event_id: entryId,
    }),
  },
));
