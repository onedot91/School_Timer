import { getKoreanLocalDateKey } from './studentEmotion';

export const TODAY_FRIEND_REWARD = 10;
export const TODAY_FRIEND_STUDENT_COUNT = 23;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const getTodayFriendDateKey = getKoreanLocalDateKey;

export const getTodayFriendNumber = (
  studentNumber: number,
  dateKey: string = getTodayFriendDateKey(),
): number => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MILLISECONDS);
  const offset = ((dayNumber % (TODAY_FRIEND_STUDENT_COUNT - 1)) + TODAY_FRIEND_STUDENT_COUNT - 1)
    % (TODAY_FRIEND_STUDENT_COUNT - 1) + 1;

  return ((studentNumber - 1 + offset) % TODAY_FRIEND_STUDENT_COUNT) + 1;
};
