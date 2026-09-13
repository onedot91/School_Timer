import { NewspaperError, QUESTION_ERRORS, parseNewspaperData } from '../lib/newspaperQuestion.js';
import { parseQuestionStudentResponse, findPersonalQuestionForWeek } from '../lib/weeklyMission.js';
import type { StorageConfiguration } from './storageV2Repository.js';

export const newspaperRpc = async (configuration: StorageConfiguration, name: 'newspaper_read' | 'newspaper_command', payload: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(`${configuration.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: configuration.key, Authorization: `Bearer ${configuration.key}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const message = value && typeof value === 'object' && 'message' in value ? value.message : null;
    const code = typeof message === 'string' && Object.hasOwn(QUESTION_ERRORS, message) ? message : 'QUESTION_DATABASE_FAILED';
    throw new NewspaperError(code, ['QUESTION_CONFLICT', 'QUESTION_WEEK_CHANGED', 'QUESTION_REQUEST_REUSED'].includes(code) ? 409 : code === 'QUESTION_DATABASE_FAILED' ? 502 : 400);
  }
  return value;
};
export const loadNewspaperData = async (configuration: StorageConfiguration, actor: number, week: string) => parseNewspaperData(await newspaperRpc(configuration, 'newspaper_read', { p_actor: actor, p_week: week }));
export const loadPersonalQuestionEvidence = async (configuration: StorageConfiguration, student: number, week: string) => {
  const url = new URL(`${configuration.url.replace(/\/$/, '')}/rest/v1/newspaper_questions`);
  url.searchParams.set('select', 'id,student_number,question_type,week_key'); url.searchParams.set('student_number', `eq.${student}`);
  url.searchParams.set('week_key', `eq.${week}`); url.searchParams.set('question_type', 'eq.personal');
  const response = await fetch(url, { headers: { apikey: configuration.key, Authorization: `Bearer ${configuration.key}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new NewspaperError('QUESTION_DATABASE_FAILED', 502);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
  return findPersonalQuestionForWeek(parseQuestionStudentResponse({ history: value }), student, week);
};
