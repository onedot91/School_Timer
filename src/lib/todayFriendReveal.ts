import { TODAY_FRIEND_STUDENT_COUNT } from './todayFriend';

export type TodayFriendRevealIdentity = {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
};

const TODAY_FRIEND_REVEAL_PREFIX = 'school-timer-today-friend-partner-reveal-v1';
const TODAY_FRIEND_REVEAL_CANDIDATE_COUNT = 7;

const getTodayFriendRevealKey = (identity: TodayFriendRevealIdentity): string => (
  `${TODAY_FRIEND_REVEAL_PREFIX}:${identity.dateKey}:${identity.studentNumber}:${identity.partnerNumber}`
);

export const shouldAnimateTodayFriendReveal = (
  hasSeenReveal: boolean,
  prefersReducedMotion: boolean,
): boolean => !hasSeenReveal && !prefersReducedMotion;

export const createTodayFriendRevealSequence = (
  identity: TodayFriendRevealIdentity,
  random: () => number = Math.random,
): readonly number[] => {
  const candidates = Array.from({ length: TODAY_FRIEND_STUDENT_COUNT }, (_, index) => index + 1)
    .filter((number) => number !== identity.studentNumber && number !== identity.partnerNumber);
  const sequence: number[] = [];
  while (sequence.length < TODAY_FRIEND_REVEAL_CANDIDATE_COUNT) {
    const selected = candidates.splice(Math.floor(random() * candidates.length), 1)[0];
    if (selected !== undefined) sequence.push(selected);
  }
  return [...sequence, identity.partnerNumber];
};

export const hasSeenTodayFriendReveal = (
  storage: Pick<Storage, 'getItem'>,
  identity: TodayFriendRevealIdentity,
): boolean => {
  try {
    return storage.getItem(getTodayFriendRevealKey(identity)) === 'seen';
  } catch (error) {
    if (error instanceof DOMException) return true;
    throw error;
  }
};

export const markTodayFriendRevealSeen = (
  storage: Pick<Storage, 'setItem'>,
  identity: TodayFriendRevealIdentity,
): boolean => {
  try {
    storage.setItem(getTodayFriendRevealKey(identity), 'seen');
    return true;
  } catch (error) {
    if (error instanceof DOMException) return false;
    throw error;
  }
};
