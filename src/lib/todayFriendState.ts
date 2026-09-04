import {
  approveTodayFriendSubmission,
  createDailyTodayFriendPartnerAssignments,
  createTodayFriendPartnerAssignments,
  createTodayFriendSubmission,
  createTodayFriendWeek,
  requestTodayFriendRevision,
  submitTodayFriendSubmission,
  TodayFriendDomainError,
  type TodayFriendGenre,
  type TodayFriendPartnerAssignment,
  type TodayFriendPayload,
  type TodayFriendSubmission,
  type TodayFriendWeek,
} from './todayFriend.js';

export interface TodayFriendQuestion {
  readonly id: string;
  readonly text: string;
  readonly active: boolean;
  readonly usedDateKeys: readonly string[];
}

export interface TodayFriendPartnerDay {
  readonly dateKey: string;
  readonly revision: number;
  readonly assignments: readonly TodayFriendPartnerAssignment[];
}

export interface TodayFriendState {
  readonly version: 1;
  readonly weeks: readonly TodayFriendWeek[];
  readonly partnerDays: readonly TodayFriendPartnerDay[];
  readonly submissions: readonly TodayFriendSubmission[];
  readonly questions: readonly TodayFriendQuestion[];
  readonly selectedQuestionIdByDate: Readonly<Record<string, string>>;
}

export interface TodayFriendStudentMission {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly genre: TodayFriendGenre;
  readonly question: string | null;
  readonly submission: TodayFriendSubmission | null;
}

const INITIAL_QUESTIONS: readonly TodayFriendQuestion[] = [
  '요즘 가장 재미있게 한 일은 무엇인가요?',
  '쉬는 시간에 가장 하고 싶은 것은 무엇인가요?',
  '새로 배우고 싶은 것이 있나요?',
  '기억에 남는 책이나 영화는 무엇인가요?',
  '우리 반에서 좋아하는 순간은 언제인가요?',
  '주말에 가족과 무엇을 하고 싶나요?',
  '친구에게 고마웠던 일은 무엇인가요?',
  '잘하고 싶어서 연습 중인 것은 무엇인가요?',
].map((text, index) => ({ id: `question-${index + 1}`, text, active: true, usedDateKeys: [] }));

export const TODAY_FRIEND_INITIAL_STATE: TodayFriendState = {
  version: 1,
  weeks: [],
  partnerDays: [],
  submissions: [],
  questions: INITIAL_QUESTIONS,
  selectedQuestionIdByDate: {},
};

const STUDENT_NUMBERS = Array.from({ length: 23 }, (_, index) => index + 1);

export const ensureTodayFriendDay = (
  state: TodayFriendState,
  weekKey: string,
  dateKey: string,
): TodayFriendState => {
  const weeks = state.weeks.some((week) => week.weekKey === weekKey)
    ? state.weeks
    : [...state.weeks, createTodayFriendWeek(weekKey)];
  const partnerDays = state.partnerDays.some((day) => day.dateKey === dateKey)
    ? state.partnerDays
    : [...state.partnerDays, {
        dateKey,
        revision: 1,
        assignments: createDailyTodayFriendPartnerAssignments(STUDENT_NUMBERS, dateKey),
      }];
  return { ...state, weeks, partnerDays };
};

const getQuestionForDate = (state: TodayFriendState, dateKey: string): string | null => {
  const activeQuestions = state.questions.filter((question) => question.active);
  if (activeQuestions.length === 0) return null;
  const selectedQuestionId = state.selectedQuestionIdByDate[dateKey];
  const selectedQuestion = activeQuestions.find((question) => question.id === selectedQuestionId);
  if (selectedQuestion) return selectedQuestion.text;
  const dayNumber = Number(dateKey.replaceAll('-', ''));
  return activeQuestions[dayNumber % activeQuestions.length]?.text ?? activeQuestions[0]?.text ?? null;
};

export const selectTodayFriendQuestion = (
  state: TodayFriendState,
  dateKey: string,
  questionId: string,
): TodayFriendState => {
  if (!state.questions.some((question) => question.id === questionId && question.active)) {
    throw new TodayFriendDomainError('QUESTION_NOT_AVAILABLE');
  }
  return {
    ...state,
    selectedQuestionIdByDate: { ...state.selectedQuestionIdByDate, [dateKey]: questionId },
  };
};

export const getTodayFriendStudentMission = (
  state: TodayFriendState,
  dateKey: string,
  studentNumber: number,
): TodayFriendStudentMission => {
  const day = state.weeks.flatMap((week) => week.days).find((entry) => entry.dateKey === dateKey);
  const partner = state.partnerDays.find((entry) => entry.dateKey === dateKey)?.assignments
    .find((assignment) => assignment.studentNumber === studentNumber);
  if (!day || !partner) throw new TodayFriendDomainError('TODAY_FRIEND_DAY_NOT_READY');
  return {
    dateKey,
    studentNumber,
    partnerNumber: partner.partnerNumber,
    genre: day.genre,
    question: day.genre === 'interview' ? getQuestionForDate(state, dateKey) : null,
    submission: state.submissions.find((submission) => (
      submission.dateKey === dateKey && submission.studentNumber === studentNumber
    )) ?? null,
  };
};

export const saveTodayFriendSubmission = (
  state: TodayFriendState,
  input: { readonly mission: TodayFriendStudentMission; readonly payload: TodayFriendPayload },
): TodayFriendState => {
  const existing = input.mission.submission;
  if (existing && existing.status !== 'draft' && existing.status !== 'revision_requested') {
    throw new TodayFriendDomainError('SUBMISSION_NOT_EDITABLE');
  }
  const submission = existing
    ? { ...existing, payload: input.payload }
    : createTodayFriendSubmission({
        dateKey: input.mission.dateKey,
        studentNumber: input.mission.studentNumber,
        partnerNumber: input.mission.partnerNumber,
        genre: input.mission.genre,
        payload: input.payload,
      });
  return {
    ...state,
    submissions: [...state.submissions.filter((entry) => entry.id !== submission.id), submission],
  };
};

export const submitSavedTodayFriendSubmission = (
  state: TodayFriendState,
  dateKey: string,
  studentNumber: number,
  submittedAt: string,
): TodayFriendState => {
  const submission = state.submissions.find((entry) => (
    entry.dateKey === dateKey && entry.studentNumber === studentNumber
  ));
  if (!submission) throw new TodayFriendDomainError('SUBMISSION_NOT_FOUND');
  const submitted = submitTodayFriendSubmission(submission, submittedAt);
  return { ...state, submissions: state.submissions.map((entry) => entry.id === submitted.id ? submitted : entry) };
};

export const reviewTodayFriendSubmission = (
  state: TodayFriendState,
  input: {
    readonly submissionId: string;
    readonly decision: 'revision_requested' | 'approved';
    readonly feedback: string;
    readonly reviewedAt: string;
  },
): TodayFriendState => {
  const submission = state.submissions.find((entry) => entry.id === input.submissionId);
  if (!submission) throw new TodayFriendDomainError('SUBMISSION_NOT_FOUND');
  const reviewed = input.decision === 'revision_requested'
    ? requestTodayFriendRevision(submission, input.feedback, input.reviewedAt)
    : approveTodayFriendSubmission(submission, 0, input.reviewedAt).submission;
  return { ...state, submissions: state.submissions.map((entry) => entry.id === reviewed.id ? reviewed : entry) };
};

export const reassignTodayFriendWeek = (state: TodayFriendState, weekKey: string): TodayFriendState => {
  const currentIndex = state.weeks.findIndex((week) => week.weekKey === weekKey);
  const revision = currentIndex < 0 ? 1 : currentIndex + 2;
  const week = createTodayFriendWeek(weekKey, `${weekKey}-revision-${revision}`);
  return { ...state, weeks: [...state.weeks.filter((entry) => entry.weekKey !== weekKey), week] };
};

export const reassignTodayFriendPartners = (state: TodayFriendState, dateKey: string): TodayFriendState => {
  const current = state.partnerDays.find((day) => day.dateKey === dateKey);
  const revision = (current?.revision ?? 0) + 1;
  const day = {
    dateKey,
    revision,
    assignments: createTodayFriendPartnerAssignments(STUDENT_NUMBERS, `${dateKey}-revision-${revision}`),
  };
  return { ...state, partnerDays: [...state.partnerDays.filter((entry) => entry.dateKey !== dateKey), day] };
};

export const assignTodayFriendPair = (
  state: TodayFriendState,
  input: { readonly dateKey: string; readonly firstStudentNumber: number; readonly secondStudentNumber: number },
): TodayFriendState => {
  if (input.firstStudentNumber === input.secondStudentNumber) throw new TodayFriendDomainError('INVALID_PARTNER_PAIR');
  const current = state.partnerDays.find((day) => day.dateKey === input.dateKey);
  const revision = (current?.revision ?? 0) + 1;
  const remainingStudents = STUDENT_NUMBERS.filter((studentNumber) => (
    studentNumber !== input.firstStudentNumber && studentNumber !== input.secondStudentNumber
  ));
  const assignments = [
    ...createTodayFriendPartnerAssignments(remainingStudents, `${input.dateKey}-manual-${revision}`),
    {
      studentNumber: input.firstStudentNumber,
      partnerNumber: input.secondStudentNumber,
      groupId: `${input.dateKey}-manual-pair-${revision}`,
      relationKind: 'pair' as const,
    },
    {
      studentNumber: input.secondStudentNumber,
      partnerNumber: input.firstStudentNumber,
      groupId: `${input.dateKey}-manual-pair-${revision}`,
      relationKind: 'pair' as const,
    },
  ].sort((first, second) => first.studentNumber - second.studentNumber);
  const day = { dateKey: input.dateKey, revision, assignments };
  return { ...state, partnerDays: [...state.partnerDays.filter((entry) => entry.dateKey !== input.dateKey), day] };
};
