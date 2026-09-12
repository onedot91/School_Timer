import {
  TODAY_FRIEND_STUDENT_NUMBERS,
  type TodayFriendSubmission,
} from './todayFriend.js';

export type TodayFriendReviewQueueStatus = 'missing' | 'submitted' | 'approved';

export const TODAY_FRIEND_REVIEW_QUEUE_STATUS_LABELS = {
  missing: '미제출',
  submitted: '승인 대기',
  approved: '완료',
} as const;

export const getTodayFriendReviewQueueStatus = (
  submission: TodayFriendSubmission | null | undefined,
): TodayFriendReviewQueueStatus => {
  if (!submission || submission.status === 'draft') return 'missing';
  if (submission.status === 'approved') return 'approved';
  return 'submitted';
};

export const getTodayFriendPendingReviewCount = (
  submissions: readonly TodayFriendSubmission[],
  dateKey: string,
) => submissions.filter((entry) => entry.dateKey === dateKey && entry.status === 'submitted').length;

export const createTodayFriendReviewQueue = (submissions: readonly TodayFriendSubmission[]) => (
  TODAY_FRIEND_STUDENT_NUMBERS.map((studentNumber) => {
    const submission = submissions.find((entry) => entry.studentNumber === studentNumber) ?? null;
    return {
      studentNumber,
      status: getTodayFriendReviewQueueStatus(submission),
      submission,
    };
  })
);
