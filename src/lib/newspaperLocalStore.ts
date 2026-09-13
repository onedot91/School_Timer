import { getKoreanIsoWeekKey } from './weeklyMission.js';
import { NEWSPAPER_CONFIG, NewspaperError, isQuestionRecord, isQuestionStudent, isQuestionType, isQuestionMode, normalizeQuestionText, questionValidationCode, parseNewspaperData, selectQuestionDownload, type NewspaperData } from './newspaperQuestion.js';

export const NEWSPAPER_LOCAL_KEY = 'school-timer-newspaper-mock-v1';
export const emptyNewspaperData = (): NewspaperData => ({ weekKey: getKoreanIsoWeekKey(), questions: [], history: [], topics: [] });
export const readLocalNewspaper = (): NewspaperData => {
  const raw = window.localStorage.getItem(NEWSPAPER_LOCAL_KEY);
  return raw === null ? emptyNewspaperData() : parseNewspaperData(JSON.parse(raw));
};
export const projectLocalNewspaper = (data: NewspaperData, actor: number, weekKey: string): NewspaperData => ({ weekKey,
  questions: data.questions.filter(row => row.week_key === weekKey).map(row => actor === 0 ? row : { ...row, downloaded_at: null }).sort((a, b) => a.student_number - b.student_number),
  history: data.questions.filter(row => row.student_number === actor).map(row => ({ ...row, downloaded_at: null })).sort((a, b) => b.week_key.localeCompare(a.week_key)),
  topics: data.topics.filter(row => actor === 0 || row.week_key === weekKey),
  weeks: actor === 0 ? [...new Set([...data.questions.map(row => row.week_key), ...data.topics.map(row => row.week_key)])] : [weekKey],
});
export const applyLocalNewspaperCommand = (data: NewspaperData, actor: number, command: Record<string, unknown>, now = new Date()): { data: NewspaperData; result: unknown } => {
  const next = structuredClone(data);
  const stamp = now.toISOString();
  const week = getKoreanIsoWeekKey(now);
  if (actor !== 0 && command.action !== 'submit') throw new NewspaperError('QUESTION_FORBIDDEN', 403);
  let result: unknown = { ok: true };
  if (command.action === 'submit') {
    if (!isQuestionStudent(actor) || actor !== command.studentNumber || !isQuestionType(command.questionType)) throw new NewspaperError('QUESTION_FORBIDDEN', 403);
    if (command.weekKey !== week) throw new NewspaperError('QUESTION_WEEK_CHANGED', 409);
    const text = typeof command.questionText === 'string' ? normalizeQuestionText(command.questionText) : '';
    const code = questionValidationCode(text); if (code) throw new NewspaperError(code);
    if (command.questionType === 'topic') {
      const topic = next.topics.find(row => row.week_key === week);
      if (!topic) throw new NewspaperError('QUESTION_TOPIC_REQUIRED');
      if (!next.questions.some(row => row.week_key === week && row.student_number === actor && row.question_type === 'personal')) throw new NewspaperError('QUESTION_PERSONAL_REQUIRED');
      if (topic.updated_at !== command.topicRevision) throw new NewspaperError('QUESTION_CONFLICT', 409);
    }
    const existing = next.questions.find(row => row.week_key === week && row.student_number === actor && row.question_type === command.questionType);
    if ((existing?.updated_at ?? null) !== command.expectedUpdatedAt) throw new NewspaperError('QUESTION_CONFLICT', 409);
    const question = existing ?? { id: crypto.randomUUID(), student_number: actor, question_type: command.questionType, question_text: text,
      week_key: week, created_at: stamp, updated_at: stamp, downloaded_at: null };
    if (existing && existing.question_text !== text) { question.question_text = text; question.updated_at = stamp; question.downloaded_at = null; }
    if (!existing) next.questions.push(question);
    result = { question, reward: null };
  } else if (command.action === 'topic') {
    if (typeof command.weekKey !== 'string' || typeof command.topicText !== 'string' || !command.topicText.trim() || [...command.topicText.trim()].length > NEWSPAPER_CONFIG.topicMaxLength) throw new NewspaperError('QUESTION_TOPIC_INVALID');
    const old = next.topics.find(row => row.week_key === command.weekKey);
    if ((old?.updated_at ?? null) !== command.expectedUpdatedAt) throw new NewspaperError('QUESTION_CONFLICT', 409);
    const topic = { id: old?.id ?? crypto.randomUUID(), week_key: command.weekKey, topic_text: command.topicText.trim(), created_at: old?.created_at ?? stamp, updated_at: stamp };
    next.topics = [...next.topics.filter(row => row.week_key !== command.weekKey), topic];
  } else if (command.action === 'update' || command.action === 'delete') {
    const row = next.questions.find(row => row.id === command.id);
    if (!row) throw new NewspaperError('QUESTION_NOT_FOUND');
    if (row.updated_at !== command.expectedUpdatedAt) throw new NewspaperError('QUESTION_CONFLICT', 409);
    if (command.action === 'delete') next.questions = next.questions.filter(row => row.id !== command.id);
    else {
      const text = typeof command.questionText === 'string' ? normalizeQuestionText(command.questionText) : '';
      const code = questionValidationCode(text); if (code) throw new NewspaperError(code);
      row.question_text = text; row.updated_at = stamp; row.downloaded_at = null;
    }
  } else if (command.action === 'download' && isQuestionMode(command.mode) && typeof command.cumulative === 'boolean') {
    const rows = selectQuestionDownload(next.questions.filter(row => row.week_key === command.weekKey), command.mode, command.cumulative);
    if (command.cumulative) for (const row of rows) row.downloaded_at = stamp;
    result = { questions: rows };
  } else if (command.action === 'reset' && command.confirmation === '모든 기록 초기화') { next.questions = []; next.topics = []; }
  else throw new NewspaperError('QUESTION_INVALID_ACTION');
  return { data: next, result };
};
export const isNewspaperCommandResult = (value: unknown) => isQuestionRecord(value) && (value.ok === true || Array.isArray(value.questions) || isQuestionRecord(value.question));
