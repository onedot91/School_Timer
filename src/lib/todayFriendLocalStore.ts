import { createFeatureInputDraftStore, type FeatureDraftStorage } from './featureInputDraft.js';
import { parseTodayFriendState } from './todayFriendCodec';
import {
  TODAY_FRIEND_INITIAL_STATE,
  type TodayFriendState,
  type TodayFriendStudentMission,
} from './todayFriendState';

export const TODAY_FRIEND_STORAGE_KEY = 'school-timer-today-friend-v1';
export const TODAY_FRIEND_CHANGE_EVENT = 'school-timer-today-friend-change';
const TODAY_FRIEND_DEVICE_DRAFT_PREFIX = 'school-timer-today-friend-device-draft-v1';

type TodayFriendStorage = Pick<Storage, 'getItem' | 'setItem'>;
type TodayFriendDraftIdentity = Pick<
  TodayFriendStudentMission,
  'dateKey' | 'studentNumber' | 'partnerNumber' | 'genre' | 'question'
>;

export type TodayFriendDeviceDraft = {
  readonly primaryText: string;
  readonly secondaryText: string;
  readonly tertiaryText: string;
  readonly category: 'movie' | 'book' | 'music' | 'food';
  readonly declinedToExplain: boolean;
};

const getDeviceDraftKey = (mission: TodayFriendDraftIdentity): string => (
  `${TODAY_FRIEND_DEVICE_DRAFT_PREFIX}:${encodeURIComponent(JSON.stringify([
    mission.dateKey,
    mission.studentNumber,
    mission.partnerNumber,
    mission.genre,
    mission.question,
  ]))}`
);

const parseDeviceDraft = (value: unknown): TodayFriendDeviceDraft | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.primaryText !== 'string'
    || draft.primaryText.length > 800
    || typeof draft.secondaryText !== 'string'
    || draft.secondaryText.length > 800
    || (draft.tertiaryText !== undefined && (typeof draft.tertiaryText !== 'string' || draft.tertiaryText.length > 800))
    || (draft.category !== 'movie' && draft.category !== 'book' && draft.category !== 'music' && draft.category !== 'food')
    || typeof draft.declinedToExplain !== 'boolean'
  ) return null;
  return {
    primaryText: draft.primaryText,
    secondaryText: draft.secondaryText,
    tertiaryText: typeof draft.tertiaryText === 'string' ? draft.tertiaryText : '',
    category: draft.category,
    declinedToExplain: draft.declinedToExplain,
  };
};

const inputStore = createFeatureInputDraftStore<TodayFriendDeviceDraft>(parseDeviceDraft);
const inputScope = (mission: TodayFriendDraftIdentity) => ({
  studentNumber: mission.studentNumber, feature: 'today-friend-input',
  entityId: JSON.stringify([mission.dateKey, mission.partnerNumber, mission.genre, mission.question]),
});
const legacyDraft = (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity) => () => (
  JSON.parse(storage?.getItem(getDeviceDraftKey(mission)) ?? 'null')
);
export const loadTodayFriendDeviceDraft = (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity): TodayFriendDeviceDraft | null => (
  inputStore.load(storage, inputScope(mission), legacyDraft(storage, mission))?.value ?? null
);
export const readyTodayFriendDeviceDraft = async (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity): Promise<TodayFriendDeviceDraft | null> => (
  (await inputStore.ready(storage, inputScope(mission), legacyDraft(storage, mission)))?.value ?? null
);
export const todayFriendDeviceDraftVersion = (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity): string | null => (
  inputStore.load(storage, inputScope(mission), legacyDraft(storage, mission))?.version ?? null
);
export const saveTodayFriendDeviceDraft = (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity, draft: TodayFriendDeviceDraft): boolean => (
  inputStore.save(storage, inputScope(mission), draft)
);
export const clearTodayFriendDeviceDraft = async (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity, version: string): Promise<boolean> => (
  inputStore.confirm(storage, inputScope(mission), version)
);

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

export const settleTodayFriendDeviceDraft = (storage: FeatureDraftStorage | null, mission: TodayFriendDraftIdentity) => inputStore.settled(storage, inputScope(mission));
