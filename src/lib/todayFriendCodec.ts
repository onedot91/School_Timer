import {
  TODAY_FRIEND_GENRES,
  type TodayFriendGenre,
  type TodayFriendPartnerAssignment,
  type TodayFriendPayload,
  type TodayFriendSubmission,
  type TodayFriendSubmissionStatus,
  type TodayFriendWeek,
  type TodayFriendWeekDay,
} from './todayFriend';
import {
  TODAY_FRIEND_INITIAL_STATE,
  type TodayFriendPartnerDay,
  type TodayFriendQuestion,
  type TodayFriendState,
} from './todayFriendState';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isGenre = (value: unknown): value is TodayFriendGenre => (
  typeof value === 'string' && TODAY_FRIEND_GENRES.some((genre) => genre === value)
);

const isStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23
);

const isSubmissionStatus = (value: unknown): value is TodayFriendSubmissionStatus => (
  value === 'draft' || value === 'submitted' || value === 'revision_requested' || value === 'approved'
);

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

const isRecommendationCategory = (value: unknown): value is 'movie' | 'book' | 'music' | 'food' => (
  value === 'movie' || value === 'book' || value === 'music' || value === 'food'
);

export const parseTodayFriendPayload = (value: unknown): TodayFriendPayload | null => {
  if (!isRecord(value)) return null;
  const kind = Reflect.get(value, 'kind');
  switch (kind) {
    case 'interview': {
      const answer = Reflect.get(value, 'answer');
      return typeof answer === 'string' ? { kind, answer } : null;
    }
    case 'commonality': {
      const commonality = Reflect.get(value, 'commonality');
      return typeof commonality === 'string' ? { kind, commonality } : null;
    }
    case 'recommendation': {
      const category = Reflect.get(value, 'category');
      const title = Reflect.get(value, 'title');
      const reason = Reflect.get(value, 'reason');
      const letterId = Reflect.get(value, 'letterId');
      return isRecommendationCategory(category) && typeof title === 'string' && typeof reason === 'string' && isNullableString(letterId)
        ? { kind, category, title, reason, letterId }
        : null;
    }
    case 'compliment': {
      const compliment = Reflect.get(value, 'compliment');
      return typeof compliment === 'string' ? { kind, compliment } : null;
    }
    case 'emotion': {
      const emotion = Reflect.get(value, 'emotion');
      const reason = Reflect.get(value, 'reason');
      const declinedToExplain = Reflect.get(value, 'declinedToExplain');
      return typeof emotion === 'string' && typeof reason === 'string' && typeof declinedToExplain === 'boolean'
        ? { kind, emotion, reason, declinedToExplain }
        : null;
    }
    default:
      return null;
  }
};

export const parseTodayFriendSubmission = (value: unknown): TodayFriendSubmission | null => {
  if (!isRecord(value)) return null;
  const id = Reflect.get(value, 'id');
  const dateKey = Reflect.get(value, 'dateKey');
  const studentNumber = Reflect.get(value, 'studentNumber');
  const partnerNumber = Reflect.get(value, 'partnerNumber');
  const genre = Reflect.get(value, 'genre');
  const payload = parseTodayFriendPayload(Reflect.get(value, 'payload'));
  const status = Reflect.get(value, 'status');
  const revision = Reflect.get(value, 'revision');
  const teacherFeedback = Reflect.get(value, 'teacherFeedback');
  const submittedAt = Reflect.get(value, 'submittedAt');
  const reviewedAt = Reflect.get(value, 'reviewedAt');
  const rewardStatus = Reflect.get(value, 'rewardStatus');
  if (
    typeof id !== 'string'
    || typeof dateKey !== 'string'
    || !isStudentNumber(studentNumber)
    || !isStudentNumber(partnerNumber)
    || !isGenre(genre)
    || payload === null
    || payload.kind !== genre
    || !isSubmissionStatus(status)
    || typeof revision !== 'number'
    || !Number.isInteger(revision)
    || !isNullableString(teacherFeedback)
    || !isNullableString(submittedAt)
    || !isNullableString(reviewedAt)
    || (rewardStatus !== 'pending' && rewardStatus !== 'paid')
  ) return null;
  return {
    id,
    dateKey,
    studentNumber,
    partnerNumber,
    genre,
    payload,
    status,
    revision,
    teacherFeedback,
    submittedAt,
    reviewedAt,
    rewardStatus,
  };
};

const parseWeekDay = (value: unknown): TodayFriendWeekDay | null => {
  if (!isRecord(value)) return null;
  const dateKey = Reflect.get(value, 'dateKey');
  const weekday = Reflect.get(value, 'weekday');
  const genre = Reflect.get(value, 'genre');
  if (typeof dateKey !== 'string' || (weekday !== 1 && weekday !== 2 && weekday !== 3 && weekday !== 4 && weekday !== 5) || !isGenre(genre)) return null;
  return { dateKey, weekday, genre };
};

const parseWeek = (value: unknown): TodayFriendWeek | null => {
  if (!isRecord(value)) return null;
  const weekKey = Reflect.get(value, 'weekKey');
  const rawDays = Reflect.get(value, 'days');
  if (typeof weekKey !== 'string' || !Array.isArray(rawDays)) return null;
  const days = rawDays.map(parseWeekDay).filter((day): day is TodayFriendWeekDay => day !== null);
  return days.length === 5 ? { weekKey, days } : null;
};

const parsePartner = (value: unknown): TodayFriendPartnerAssignment | null => {
  if (!isRecord(value)) return null;
  const studentNumber = Reflect.get(value, 'studentNumber');
  const partnerNumber = Reflect.get(value, 'partnerNumber');
  const groupId = Reflect.get(value, 'groupId');
  const relationKind = Reflect.get(value, 'relationKind');
  return isStudentNumber(studentNumber)
    && isStudentNumber(partnerNumber)
    && typeof groupId === 'string'
    && (relationKind === 'pair' || relationKind === 'cycle')
    ? { studentNumber, partnerNumber, groupId, relationKind }
    : null;
};

const parsePartnerDay = (value: unknown): TodayFriendPartnerDay | null => {
  if (!isRecord(value)) return null;
  const dateKey = Reflect.get(value, 'dateKey');
  const revision = Reflect.get(value, 'revision');
  const rawAssignments = Reflect.get(value, 'assignments');
  if (typeof dateKey !== 'string' || typeof revision !== 'number' || !Number.isInteger(revision) || !Array.isArray(rawAssignments)) return null;
  const assignments = rawAssignments.map(parsePartner).filter((entry): entry is TodayFriendPartnerAssignment => entry !== null);
  return assignments.length >= 2 ? { dateKey, revision, assignments } : null;
};

const parseQuestion = (value: unknown): TodayFriendQuestion | null => {
  if (!isRecord(value)) return null;
  const id = Reflect.get(value, 'id');
  const text = Reflect.get(value, 'text');
  const active = Reflect.get(value, 'active');
  const rawUsedDateKeys = Reflect.get(value, 'usedDateKeys');
  if (typeof id !== 'string' || typeof text !== 'string' || typeof active !== 'boolean' || !Array.isArray(rawUsedDateKeys)) return null;
  const usedDateKeys = rawUsedDateKeys.filter((dateKey): dateKey is string => typeof dateKey === 'string');
  return { id, text, active, usedDateKeys };
};

export const parseTodayFriendState = (value: unknown): TodayFriendState => {
  if (!isRecord(value) || Reflect.get(value, 'version') !== 1) return TODAY_FRIEND_INITIAL_STATE;
  const rawWeeks = Reflect.get(value, 'weeks');
  const rawPartnerDays = Reflect.get(value, 'partnerDays');
  const rawSubmissions = Reflect.get(value, 'submissions');
  const rawQuestions = Reflect.get(value, 'questions');
  const rawSelectedQuestionIdByDate = Reflect.get(value, 'selectedQuestionIdByDate');
  if (!Array.isArray(rawWeeks) || !Array.isArray(rawPartnerDays) || !Array.isArray(rawSubmissions) || !Array.isArray(rawQuestions) || !isRecord(rawSelectedQuestionIdByDate)) {
    return TODAY_FRIEND_INITIAL_STATE;
  }
  const weeks = rawWeeks.map(parseWeek).filter((week): week is TodayFriendWeek => week !== null);
  const partnerDays = rawPartnerDays.map(parsePartnerDay).filter((day): day is TodayFriendPartnerDay => day !== null);
  const submissions = rawSubmissions.map(parseTodayFriendSubmission).filter((submission): submission is TodayFriendSubmission => submission !== null);
  const questions = rawQuestions.map(parseQuestion).filter((question): question is TodayFriendQuestion => question !== null);
  const selectedQuestionIdByDate = Object.fromEntries(Object.entries(rawSelectedQuestionIdByDate).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  return { version: 1, weeks, partnerDays, submissions, questions, selectedQuestionIdByDate };
};
