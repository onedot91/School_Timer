export const STUDENT_EMOTION_STORAGE_KEY = 'school-timer-student-emotions-v2';
export const STUDENT_EMOTION_COMMENT_MAX_LENGTH = 60;
export const STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH = 30;

export const STUDENT_EMOTION_ZONE_IDS = ['red', 'yellow', 'blue', 'green'] as const;

export type StudentEmotionZoneId = (typeof STUDENT_EMOTION_ZONE_IDS)[number];

export type StudentEmotionIconName =
  | 'angry'
  | 'annoyed'
  | 'badge-check'
  | 'battery-low'
  | 'brain'
  | 'circle-alert'
  | 'circle-check'
  | 'circle-dashed'
  | 'circle-gauge'
  | 'circle-minus'
  | 'circle-x'
  | 'cloud'
  | 'cloud-rain'
  | 'cloud-sun'
  | 'flame'
  | 'frown'
  | 'hand-heart'
  | 'heart'
  | 'heart-handshake'
  | 'laugh'
  | 'meh'
  | 'moon-star'
  | 'party-popper'
  | 'shield'
  | 'smile'
  | 'sparkles'
  | 'sun'
  | 'thumbs-up'
  | 'zap';

export interface StudentEmotionDefinition {
  id: string;
  label: string;
  zone: StudentEmotionZoneId;
  icon: StudentEmotionIconName;
}

export interface StudentEmotionZoneDefinition {
  id: StudentEmotionZoneId;
  label: string;
  description: string;
}

export const STUDENT_EMOTION_ZONES: readonly StudentEmotionZoneDefinition[] = [
  { id: 'red', label: '빨강 영역', description: '긴장되거나 가슴이 두근거려요' },
  { id: 'yellow', label: '노랑 영역', description: '힘이 나고 기분이 좋아요' },
  { id: 'blue', label: '파랑 영역', description: '기운이 빠지고 걱정이 돼요' },
  { id: 'green', label: '초록 영역', description: '편안하고 온화하게 느껴져요' },
];

export const STUDENT_EMOTIONS = [
  { id: 'furious', label: '분노하다', zone: 'red', icon: 'angry' },
  { id: 'irritable', label: '신경질을 내다', zone: 'red', icon: 'zap' },
  { id: 'stressed', label: '스트레스 받다', zone: 'red', icon: 'brain' },
  { id: 'angry', label: '화나다', zone: 'red', icon: 'flame' },
  { id: 'scared', label: '겁나다', zone: 'red', icon: 'circle-alert' },
  { id: 'anxious', label: '불안하다', zone: 'red', icon: 'circle-gauge' },
  { id: 'dislike', label: '밉다', zone: 'red', icon: 'annoyed' },
  { id: 'annoyed', label: '짜증 나다', zone: 'red', icon: 'circle-x' },
  { id: 'worried', label: '걱정하다', zone: 'red', icon: 'cloud' },
  { id: 'excited', label: '들뜨다', zone: 'yellow', icon: 'sparkles' },
  { id: 'thrilled', label: '신나다', zone: 'yellow', icon: 'party-popper' },
  { id: 'overwhelmed-with-joy', label: '벅차오르다', zone: 'yellow', icon: 'sun' },
  { id: 'brave', label: '용감하다', zone: 'yellow', icon: 'shield' },
  { id: 'amused', label: '재미있다', zone: 'yellow', icon: 'laugh' },
  { id: 'moved', label: '감격스럽다', zone: 'yellow', icon: 'heart' },
  { id: 'proud', label: '자랑스럽다', zone: 'yellow', icon: 'badge-check' },
  { id: 'glad', label: '기쁘다', zone: 'yellow', icon: 'smile' },
  { id: 'happy', label: '행복하다', zone: 'yellow', icon: 'cloud-sun' },
  { id: 'hurt', label: '서운하다', zone: 'blue', icon: 'frown' },
  { id: 'envious', label: '부럽다', zone: 'blue', icon: 'cloud' },
  { id: 'bored', label: '지루하다', zone: 'blue', icon: 'meh' },
  { id: 'lonely', label: '외롭다', zone: 'blue', icon: 'circle-dashed' },
  { id: 'sad', label: '슬프다', zone: 'blue', icon: 'cloud-rain' },
  { id: 'tired', label: '지치다', zone: 'blue', icon: 'battery-low' },
  { id: 'hopeless', label: '절망하다', zone: 'blue', icon: 'circle-minus' },
  { id: 'depressed', label: '우울하다', zone: 'blue', icon: 'moon-star' },
  { id: 'drained', label: '기운 빠지다', zone: 'blue', icon: 'battery-low' },
  { id: 'relieved', label: '안도하다', zone: 'green', icon: 'cloud-sun' },
  { id: 'grateful', label: '감사하다', zone: 'green', icon: 'hand-heart' },
  { id: 'loving', label: '사랑하다', zone: 'green', icon: 'heart' },
  { id: 'calm', label: '차분하다', zone: 'green', icon: 'cloud' },
  { id: 'satisfied', label: '만족하다', zone: 'green', icon: 'circle-check' },
  { id: 'content', label: '흐뭇하다', zone: 'green', icon: 'thumbs-up' },
  { id: 'relaxed', label: '여유롭다', zone: 'green', icon: 'smile' },
  { id: 'comfortable', label: '편안하다', zone: 'green', icon: 'smile' },
  { id: 'peaceful', label: '평화롭다', zone: 'green', icon: 'heart-handshake' },
] as const satisfies readonly StudentEmotionDefinition[];

export type StudentEmotionId = (typeof STUDENT_EMOTIONS)[number]['id'];

export interface StudentEmotionEntry {
  id: string;
  studentNumber: number;
  dateKey: string;
  emotionId: StudentEmotionId;
  comment: string;
  selfMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type StudentEmotionHistory = Record<string, StudentEmotionEntry[]>;

const LEGACY_STUDENT_EMOTION_IDS = new Set(['sorry']);
const STUDENT_EMOTION_IDS = new Set<string>([
  ...STUDENT_EMOTIONS.map((emotion) => emotion.id),
  ...LEGACY_STUDENT_EMOTION_IDS,
]);
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getStudentEmotion = (emotionId: string | null | undefined): StudentEmotionDefinition | null => (
  STUDENT_EMOTIONS.find((emotion) => emotion.id === emotionId)
  ?? (emotionId === 'sorry'
    ? { id: 'sorry', label: '미안하다', zone: 'green', icon: 'frown' }
    : null)
);

export const getStudentEmotionsByZone = (zoneId: StudentEmotionZoneId) => (
  STUDENT_EMOTIONS.filter((emotion) => emotion.zone === zoneId)
);

export const getKoreanLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const compareEmotionEntries = (left: StudentEmotionEntry, right: StudentEmotionEntry) => (
  right.dateKey.localeCompare(left.dateKey) || right.updatedAt.localeCompare(left.updatedAt)
);

export const normalizeStudentEmotionHistory = (input: unknown): StudentEmotionHistory => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).reduce<StudentEmotionHistory>((history, [studentKey, value]) => {
    const studentNumber = Number(studentKey);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23 || !Array.isArray(value)) {
      return history;
    }

    const entriesByDate = new Map<string, StudentEmotionEntry>();
    value.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const candidate = item as Partial<Omit<StudentEmotionEntry, 'emotionId'>> & { emotionId?: string };
      const comment = typeof candidate.comment === 'string' ? candidate.comment.trim() : '';
      const selfMessage = typeof candidate.selfMessage === 'string' ? candidate.selfMessage.trim() : '';
      if (
        typeof candidate.id !== 'string'
        || candidate.id.length === 0
        || candidate.studentNumber !== studentNumber
        || typeof candidate.dateKey !== 'string'
        || !DATE_KEY_PATTERN.test(candidate.dateKey)
        || typeof candidate.emotionId !== 'string'
        || !STUDENT_EMOTION_IDS.has(candidate.emotionId)
        || comment.length === 0
        || comment.length > STUDENT_EMOTION_COMMENT_MAX_LENGTH
        || selfMessage.length > STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH
        || typeof candidate.createdAt !== 'string'
        || !Number.isFinite(Date.parse(candidate.createdAt))
        || typeof candidate.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(candidate.updatedAt))
      ) return;

      const normalizedEmotionId = candidate.emotionId === 'sorry' ? 'relaxed' : candidate.emotionId;
      const entry: StudentEmotionEntry = {
        id: candidate.id,
        studentNumber,
        dateKey: candidate.dateKey,
        emotionId: normalizedEmotionId as StudentEmotionId,
        comment,
        ...(selfMessage ? { selfMessage } : {}),
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      };
      const existing = entriesByDate.get(entry.dateKey);
      if (!existing || Date.parse(entry.updatedAt) >= Date.parse(existing.updatedAt)) {
        entriesByDate.set(entry.dateKey, entry);
      }
    });

    const entries = [...entriesByDate.values()].sort(compareEmotionEntries);
    if (entries.length > 0) history[studentKey] = entries;
    return history;
  }, {});
};

export const loadStoredStudentEmotionHistory = (): StudentEmotionHistory => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(STUDENT_EMOTION_STORAGE_KEY);
    return saved ? normalizeStudentEmotionHistory(JSON.parse(saved)) : {};
  } catch (error) {
    if (error instanceof Error) return {};
    throw error;
  }
};

export const storeStudentEmotionHistory = (history: StudentEmotionHistory) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      STUDENT_EMOTION_STORAGE_KEY,
      JSON.stringify(normalizeStudentEmotionHistory(history)),
    );
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};

export const createStudentEmotionEntry = (
  studentNumber: number,
  emotionId: StudentEmotionId,
  comment: string,
  selectedAt = new Date(),
  existingEntry?: StudentEmotionEntry | null,
  selfMessage = '',
): StudentEmotionEntry => {
  const timestamp = selectedAt.toISOString();
  return {
    id: existingEntry?.id ?? `student-emotion-${studentNumber}-${getKoreanLocalDateKey(selectedAt)}`,
    studentNumber,
    dateKey: getKoreanLocalDateKey(selectedAt),
    emotionId,
    comment: comment.trim().slice(0, STUDENT_EMOTION_COMMENT_MAX_LENGTH),
    ...(selfMessage.trim() ? {
      selfMessage: selfMessage.trim().slice(0, STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH),
    } : {}),
    createdAt: existingEntry?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

export const upsertStudentEmotionEntry = (
  history: StudentEmotionHistory,
  entry: StudentEmotionEntry,
): StudentEmotionHistory => {
  const normalized = normalizeStudentEmotionHistory(history);
  const studentKey = String(entry.studentNumber);
  return normalizeStudentEmotionHistory({
    ...normalized,
    [studentKey]: [
      entry,
      ...(normalized[studentKey] ?? []).filter((item) => item.dateKey !== entry.dateKey),
    ],
  });
};

export const mergeStudentEmotionHistories = (
  remoteHistory: unknown,
  localHistory: unknown,
): StudentEmotionHistory => {
  const remote = normalizeStudentEmotionHistory(remoteHistory);
  const local = normalizeStudentEmotionHistory(localHistory);
  const merged: StudentEmotionHistory = {};

  for (let studentNumber = 1; studentNumber <= 23; studentNumber += 1) {
    const studentKey = String(studentNumber);
    const entries = [...(remote[studentKey] ?? []), ...(local[studentKey] ?? [])];
    if (entries.length > 0) merged[studentKey] = entries;
  }
  return normalizeStudentEmotionHistory(merged);
};

export const getStudentEmotionEntries = (
  history: StudentEmotionHistory,
  studentNumber: number,
) => normalizeStudentEmotionHistory(history)[String(studentNumber)] ?? [];

export const getTodayStudentEmotionEntry = (
  history: StudentEmotionHistory,
  studentNumber: number,
  today = new Date(),
) => {
  const todayKey = getKoreanLocalDateKey(today);
  return getStudentEmotionEntries(history, studentNumber).find((entry) => entry.dateKey === todayKey) ?? null;
};
