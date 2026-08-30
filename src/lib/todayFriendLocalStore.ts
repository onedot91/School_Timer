import { parseTodayFriendState } from './todayFriendCodec';
import { TODAY_FRIEND_INITIAL_STATE, type TodayFriendState } from './todayFriendState';

export const TODAY_FRIEND_STORAGE_KEY = 'school-timer-today-friend-v1';
export const TODAY_FRIEND_CHANGE_EVENT = 'school-timer-today-friend-change';

type TodayFriendStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const loadLocalTodayFriendState = (storage: TodayFriendStorage): TodayFriendState => {
  try {
    const saved = storage.getItem(TODAY_FRIEND_STORAGE_KEY);
    if (saved === null) return TODAY_FRIEND_INITIAL_STATE;
    const parsed: unknown = JSON.parse(saved);
    return parseTodayFriendState(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) return TODAY_FRIEND_INITIAL_STATE;
    throw error;
  }
};

export const saveLocalTodayFriendState = (
  storage: Pick<Storage, 'setItem'>,
  state: TodayFriendState,
): void => {
  storage.setItem(TODAY_FRIEND_STORAGE_KEY, JSON.stringify(state));
};

export const updateLocalTodayFriendState = (
  change: (state: TodayFriendState) => TodayFriendState,
): TodayFriendState => {
  const state = change(loadLocalTodayFriendState(window.localStorage));
  saveLocalTodayFriendState(window.localStorage, state);
  window.dispatchEvent(new CustomEvent(TODAY_FRIEND_CHANGE_EVENT));
  return state;
};
