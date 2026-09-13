import { getKoreanIsoWeekKey } from './weeklyMission.js';

export const NEWSPAPER_CONFIG = {
  studentCount: 23, teacherNumber: 0, questionMaxLength: 60, topicMaxLength: 40,
  timeZone: 'Asia/Seoul', weekStartsOn: 1, exportHeader: '신문 질문 모음',
  adminAccess: 'device-session', blockedWords: [] as readonly string[], privateWords: [] as readonly string[],
} as const;
export const QUESTION_TYPES = ['personal', 'topic'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];
export type QuestionMode = QuestionType | 'all';
export const QUESTION_LABELS = { personal: '개인 질문', topic: '주제 질문', all: '전체 질문' };
export const QUESTION_GLASSES = { 왜: '이유를 묻는 질문', 만약: '상상해 보는 질문', 거꾸로: '반대로 생각하는 질문' };
export type QuestionGlasses = keyof typeof QUESTION_GLASSES;
export const QUESTION_ERRORS: Record<string, string> = {
  QUESTION_EMPTY: '질문을 써 주세요.', QUESTION_TOO_LONG: '60자 안으로 줄여 주세요.',
  QUESTION_PRIVATE_WORD: '친구 이름은 쓸 수 없어요.', QUESTION_BLOCKED_WORD: '쓸 수 없는 말이 들어 있어요.',
  QUESTION_SPACE_REQUIRED: '띄어쓰기를 한 번 이상 해 주세요.', QUESTION_CHARACTER: '특수문자는 물음표만 쓸 수 있어요.',
  QUESTION_MARK_REQUIRED: '물음표 하나로 끝내 주세요.', QUESTION_PERSONAL_REQUIRED: '개인 질문 먼저!',
  QUESTION_TOPIC_REQUIRED: '주제가 아직 없어요.', QUESTION_WEEK_CHANGED: '주가 바뀌었어요. 새로고침해 주세요.',
  QUESTION_CONFLICT: '다른 곳에서 수정됐어요. 새로고침 후 다시 확인해 주세요.',
  QUESTION_NOT_FOUND: '질문이 삭제됐어요. 새로고침해 주세요.', QUESTION_READ_ONLY: '읽기 전용에서는 저장할 수 없어요.',
  QUESTION_CONFIRMATION_REQUIRED: '저장 결과를 확인하지 못했어요. 입력을 유지하고 다시 눌러 확인해 주세요.',
  QUESTION_TOPIC_INVALID: '주제는 1~40자로 써 주세요.', QUESTION_REQUEST_REUSED: '이전 요청과 내용이 달라요. 새로고침해 주세요.',
};
export class NewspaperError extends Error {
  readonly endpoint = '/api/newspaper';
  constructor(readonly code: string, readonly status = 400) { super(code); this.name = 'NewspaperError'; }
}
export interface NewspaperQuestion {
  id: string; student_number: number; question_type: QuestionType; question_text: string; week_key: string;
  created_at: string; updated_at: string; downloaded_at: string | null;
}
export interface NewspaperTopic { id: string; week_key: string; topic_text: string; created_at: string; updated_at: string }
export interface NewspaperData { weekKey: string; questions: NewspaperQuestion[]; history: NewspaperQuestion[]; topics: NewspaperTopic[]; weeks?: string[] }
export const isQuestionRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isQuestionStudent = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= NEWSPAPER_CONFIG.studentCount;
export const isQuestionType = (value: unknown): value is QuestionType => value === 'personal' || value === 'topic';
export const isQuestionMode = (value: unknown): value is QuestionMode => isQuestionType(value) || value === 'all';
export const isQuestionUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const weekMonday = (key: string) => {
  if (!/^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/.test(key)) throw new NewspaperError('QUESTION_INVALID_WEEK');
  const [year, week] = key.split('-').map(Number);
  const day = new Date(Date.UTC(year, 0, 4));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) + (week - 1) * 7);
  if (getKoreanIsoWeekKey(day) !== key) throw new NewspaperError('QUESTION_INVALID_WEEK');
  return day;
};
export const isQuestionWeek = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { weekMonday(value); return true; } catch { return false; }
};
export const questionWeekLabel = (key: string) => {
  const day = weekMonday(key);
  const ordinals = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
  const firstWeekday = (new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)).getUTCDay() + 6) % 7;
  return `${day.getUTCMonth() + 1}월 ${ordinals[Math.floor((day.getUTCDate() + firstWeekday - 1) / 7)]}주`;
};
export const questionWeekOptions = (now = new Date()) => Array.from({ length: 8 }, (_, index) => getKoreanIsoWeekKey(new Date(now.getTime() + index * 7 * 86400000)));
export const normalizeQuestionText = (text: string) => text.replace(/\s+/gu, ' ').trim();
export const questionValidationCode = (raw: string, rules: { privateWords: readonly string[]; blockedWords: readonly string[] } = NEWSPAPER_CONFIG): string | null => {
  const text = normalizeQuestionText(raw);
  if (!text) return 'QUESTION_EMPTY';
  if ([...text].length > NEWSPAPER_CONFIG.questionMaxLength) return 'QUESTION_TOO_LONG';
  if (rules.privateWords.some(word => word.trim() && text.includes(word))) return 'QUESTION_PRIVATE_WORD';
  if (rules.blockedWords.some(word => word.trim() && text.toLocaleLowerCase().includes(word.toLocaleLowerCase()))) return 'QUESTION_BLOCKED_WORD';
  if (!text.includes(' ')) return 'QUESTION_SPACE_REQUIRED';
  if (!/^[\p{L}\p{M}\p{N}\s?？]+$/u.test(text)) return 'QUESTION_CHARACTER';
  if (!/^[^?？]+[?？]$/u.test(text)) return 'QUESTION_MARK_REQUIRED';
  return null;
};
export const detectQuestionGlasses = (text: string): QuestionGlasses | null => {
  const word = /^(왜|만약|거꾸로)(?:\s|$)/u.exec(text)?.[1];
  return word === '왜' || word === '만약' || word === '거꾸로' ? word : null;
};
export const segmentQuestionGlasses = (text: string): Array<{ text: string; glasses: QuestionGlasses | null }> => {
  const segments: Array<{ text: string; glasses: QuestionGlasses | null }> = [];
  let cursor = 0;
  for (const match of text.matchAll(/왜|만약|거꾸로/gu)) {
    const word = match[0] as QuestionGlasses;
    const index = match.index;
    const before = text[index - 1];
    const after = text[index + word.length];
    if (before !== undefined && !/[\s?？]/u.test(before) || after !== undefined && !/[\s?？]/u.test(after)) continue;
    if (index > cursor) segments.push({ text: text.slice(cursor, index), glasses: null });
    segments.push({ text: word, glasses: word });
    cursor = index + word.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), glasses: null });
  return segments;
};
export const applyQuestionGlasses = (text: string, word: QuestionGlasses) => `${word} ${text.replace(/^(왜|만약|거꾸로)(?:\s+|$)/u, '')}`;
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const parseNewspaperQuestion = (value: unknown): NewspaperQuestion => {
  if (!isQuestionRecord(value) || !isQuestionUuid(value.id) || !isQuestionStudent(value.student_number) || !isQuestionType(value.question_type)
    || typeof value.question_text !== 'string' || !value.question_text.trim() || [...value.question_text].length > NEWSPAPER_CONFIG.questionMaxLength
    || typeof value.week_key !== 'string' || !timestamp(value.created_at) || !timestamp(value.updated_at)
    || (value.downloaded_at !== null && !timestamp(value.downloaded_at))) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
  weekMonday(value.week_key);
  return { id: value.id, student_number: value.student_number, question_type: value.question_type, question_text: value.question_text,
    week_key: value.week_key, created_at: value.created_at, updated_at: value.updated_at, downloaded_at: typeof value.downloaded_at === 'string' ? value.downloaded_at : null };
};
export const parseNewspaperData = (value: unknown): NewspaperData => {
  if (!isQuestionRecord(value) || typeof value.weekKey !== 'string' || !Array.isArray(value.questions) || !Array.isArray(value.history) || !Array.isArray(value.topics)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
  weekMonday(value.weekKey);
  const weeks = value.weeks === undefined ? [] : value.weeks;
  if (!Array.isArray(weeks) || !weeks.every((key): key is string => typeof key === 'string')) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
  weeks.forEach(weekMonday);
  return { weekKey: value.weekKey, weeks, questions: value.questions.map(parseNewspaperQuestion), history: value.history.map(parseNewspaperQuestion),
    topics: value.topics.map((row: unknown) => {
      if (!isQuestionRecord(row) || !isQuestionUuid(row.id) || typeof row.week_key !== 'string' || typeof row.topic_text !== 'string'
        || !row.topic_text.trim() || [...row.topic_text].length > NEWSPAPER_CONFIG.topicMaxLength || !timestamp(row.created_at) || !timestamp(row.updated_at)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
      weekMonday(row.week_key);
      return { id: row.id, week_key: row.week_key, topic_text: row.topic_text, created_at: row.created_at, updated_at: row.updated_at };
    }) };
};
export const selectQuestionDownload = (questions: readonly NewspaperQuestion[], mode: QuestionMode, cumulative: boolean) => questions
  .filter(row => (mode === 'all' || row.question_type === mode) && (!cumulative || row.downloaded_at === null))
  .sort((a, b) => a.student_number - b.student_number || a.question_type.localeCompare(b.question_type));
export const buildQuestionTxt = (questions: readonly NewspaperQuestion[], mode: QuestionMode, header: string = NEWSPAPER_CONFIG.exportHeader) => {
  const lines = (type: QuestionType) => selectQuestionDownload(questions, type, false).map((row, index) => `${type === 'personal' ? row.student_number : index + 1}. ${row.question_text}`).join('\n');
  return `${header}\n\n${mode === 'all' ? `[개인 질문]\n${lines('personal')}\n[주제 질문]\n${lines('topic')}` : lines(mode)}\n`;
};
export const questionTxtFilename = (weekKey: string, mode: QuestionMode, cumulative: boolean) => `${QUESTION_LABELS[mode].replaceAll(' ', '')}-${cumulative ? '누적-' : ''}${weekKey}.txt`;
