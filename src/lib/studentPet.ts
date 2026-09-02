import {
  AUCTION_ITEM_IDS,
  normalizeAuctionAwards,
  normalizeAuctionBidHistory,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionBids,
  type AuctionItem,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency';
import {
  normalizeStudentEconomyStates,
  type StudentEconomyStates,
} from './studentEconomy';
import {
  loadStoredStudentLifeState,
  normalizeStudentLifeState,
  type StudentLifeState,
} from './studentLife';

export const STUDENT_PET_STORAGE_KEY = 'school-timer-student-pets-v1';
export const STUDENT_PET_POSITION_OVERRIDE_STORAGE_KEY = 'school-timer-student-pet-position-overrides-v1';
export const STUDENT_PET_FEED_AMOUNT = 5;
export const STUDENT_PET_HATCH_AMOUNT = 100;
export const STUDENT_PET_NAME_MAX_LENGTH = 12;

export const STUDENT_PET_KINDS = [
  { id: 'cat', emoji: '🐱', label: '고양이' },
  { id: 'dog', emoji: '🐶', label: '강아지' },
  { id: 'rabbit', emoji: '🐰', label: '토끼' },
  { id: 'chick', emoji: '🐥', label: '병아리' },
  { id: 'fox', emoji: '🦊', label: '여우' },
] as const;

export type StudentPetKind = (typeof STUDENT_PET_KINDS)[number]['id'];

export interface StudentPet {
  id: string;
  kind: StudentPetKind;
  name: string;
  position: { x: number; y: number };
}

export interface StudentPetState {
  fedAmount: number;
  eggKind: StudentPetKind;
  ownedPets: StudentPet[];
  activePetId: string | null;
  pendingNamePetId: string | null;
  gomaPosition: { x: number; y: number };
  petKind: StudentPetKind | null;
  name: string;
  position: { x: number; y: number };
}

export type StudentPetStates = Record<string, StudentPetState>;

export interface StudentPetLocalSnapshot {
  studentPets: StudentPetStates;
  currencyBalances: CurrencyBalances;
  currencyHistory: CurrencyHistory;
  studentEconomy: StudentEconomyStates;
  studentLife: StudentLifeState;
  auctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  auctionBidHistory: AuctionBidHistory;
  auctionAwards: AuctionAwards;
}

export interface StudentPetPositionOverride {
  petId: string | null;
  position: { x: number; y: number };
  gomaPosition: { x: number; y: number };
}

export type StudentPetPositionOverrides = Record<string, StudentPetPositionOverride>;

const PET_KIND_IDS = new Set<string>(STUDENT_PET_KINDS.map((pet) => pet.id));
const DEFAULT_POSITION = { x: 0.5, y: 0.68 };
const DEFAULT_GOMA_POSITION = { x: 0.24, y: 0.67 };

const isPetKind = (value: unknown): value is StudentPetKind => (
  typeof value === 'string' && PET_KIND_IDS.has(value)
);

const clampPosition = (value: unknown, fallback: number) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0.08, Math.min(0.92, numericValue)) : fallback;
};

const normalizePosition = (value: unknown) => {
  const rawPosition = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    x: clampPosition(rawPosition.x, DEFAULT_POSITION.x),
    y: clampPosition(rawPosition.y, DEFAULT_POSITION.y),
  };
};

const normalizePet = (value: unknown, fallbackId: string): StudentPet | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rawPet = value as Record<string, unknown>;
  if (!isPetKind(rawPet.kind)) return null;
  const id = typeof rawPet.id === 'string' && rawPet.id.trim().length > 0
    ? rawPet.id.trim().slice(0, 64)
    : fallbackId;
  return {
    id,
    kind: rawPet.kind,
    name: typeof rawPet.name === 'string' ? rawPet.name.trim().slice(0, STUDENT_PET_NAME_MAX_LENGTH) : '',
    position: normalizePosition(rawPet.position),
  };
};

const getNextEggKind = (ownedPets: StudentPet[], previousKind: StudentPetKind) => {
  const firstUnowned = STUDENT_PET_KINDS.find((kind) => !ownedPets.some((pet) => pet.kind === kind.id));
  if (firstUnowned) return firstUnowned.id;
  const currentIndex = STUDENT_PET_KINDS.findIndex((kind) => kind.id === previousKind);
  return STUDENT_PET_KINDS[(currentIndex + 1) % STUDENT_PET_KINDS.length].id;
};

const createPetId = (kind: StudentPetKind, ownedPets: StudentPet[]) => {
  let sequence = 1;
  let id = `${kind}-${sequence}`;
  while (ownedPets.some((pet) => pet.id === id)) {
    sequence += 1;
    id = `${kind}-${sequence}`;
  }
  return id;
};

const withActivePet = (state: Omit<StudentPetState, 'petKind' | 'name' | 'position'>): StudentPetState => {
  const activePet = state.ownedPets.find((pet) => pet.id === state.activePetId) ?? null;
  return {
    ...state,
    activePetId: activePet?.id ?? null,
    pendingNamePetId: state.pendingNamePetId && state.ownedPets.some((pet) => pet.id === state.pendingNamePetId)
      ? state.pendingNamePetId
      : null,
    petKind: activePet?.kind ?? null,
    name: activePet?.name ?? '',
    position: activePet?.position ?? { ...DEFAULT_POSITION },
  };
};

export const createDefaultStudentPetState = (): StudentPetState => withActivePet({
  fedAmount: 0,
  eggKind: STUDENT_PET_KINDS[0].id,
  ownedPets: [],
  activePetId: null,
  pendingNamePetId: null,
  gomaPosition: { ...DEFAULT_GOMA_POSITION },
});

export const normalizeStudentPetStates = (input: unknown): StudentPetStates => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).reduce<StudentPetStates>((states, [studentKey, rawState]) => {
    const studentNumber = Number(studentKey);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) return states;
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return states;

    const state = rawState as Record<string, unknown>;
    const fedAmount = Math.max(0, Math.min(
      STUDENT_PET_HATCH_AMOUNT,
      Math.floor((Number(state.fedAmount) || 0) / STUDENT_PET_FEED_AMOUNT) * STUDENT_PET_FEED_AMOUNT,
    ));
    const rawPets = Array.isArray(state.ownedPets) ? state.ownedPets : [];
    const ownedPets = rawPets.reduce<StudentPet[]>((pets, rawPet, index) => {
      const pet = normalizePet(rawPet, `legacy-${index + 1}`);
      if (pet && !pets.some((existingPet) => existingPet.id === pet.id)) pets.push(pet);
      return pets;
    }, []);
    const legacyKind = isPetKind(state.petKind) ? state.petKind : null;
    const legacyName = typeof state.name === 'string' ? state.name.trim().slice(0, STUDENT_PET_NAME_MAX_LENGTH) : '';
    const legacyPosition = normalizePosition(state.position);
    const gomaPosition = normalizePosition(state.gomaPosition ?? DEFAULT_GOMA_POSITION);

    if (ownedPets.length === 0 && legacyKind) {
      ownedPets.push({
        id: createPetId(legacyKind, ownedPets),
        kind: legacyKind,
        name: legacyName,
        position: legacyPosition,
      });
    }

    const eggKind = isPetKind(state.eggKind)
      ? state.eggKind
      : getNextEggKind(ownedPets, legacyKind ?? STUDENT_PET_KINDS[0].id);
    const requestedActivePetId = typeof state.activePetId === 'string' ? state.activePetId : null;
    const activePetId = ownedPets.some((pet) => pet.id === requestedActivePetId)
      ? requestedActivePetId
      : ownedPets[0]?.id ?? null;
    const requestedPendingNamePetId = typeof state.pendingNamePetId === 'string' ? state.pendingNamePetId : null;

    const shouldMigrateHatchedLegacyPet = fedAmount >= STUDENT_PET_HATCH_AMOUNT && !Array.isArray(state.ownedPets);
    states[studentKey] = withActivePet({
      fedAmount: shouldMigrateHatchedLegacyPet ? 0 : fedAmount,
      eggKind: shouldMigrateHatchedLegacyPet ? getNextEggKind(ownedPets, eggKind) : eggKind,
      ownedPets,
      activePetId,
      pendingNamePetId: shouldMigrateHatchedLegacyPet && !legacyName
        ? activePetId
        : requestedPendingNamePetId,
      gomaPosition,
    });
    return states;
  }, {});
};

export const getStudentPetState = (states: unknown, studentNumber: number): StudentPetState => (
  normalizeStudentPetStates(states)[String(studentNumber)] ?? createDefaultStudentPetState()
);

export const getStudentPetKind = (kind: StudentPetKind | null) => (
  STUDENT_PET_KINDS.find((pet) => pet.id === kind) ?? STUDENT_PET_KINDS[0]
);

export const getStudentPetEggStage = (fedAmount: number) => (
  Math.min(5, Math.floor(Math.max(0, fedAmount) / 20))
);

export const feedStudentPetEgg = (state: StudentPetState): StudentPetState => {
  const normalizedState = getStudentPetState({ 1: state }, 1);
  const nextFedAmount = Math.min(STUDENT_PET_HATCH_AMOUNT, normalizedState.fedAmount + STUDENT_PET_FEED_AMOUNT);
  if (nextFedAmount < STUDENT_PET_HATCH_AMOUNT) {
    return withActivePet({ ...normalizedState, fedAmount: nextFedAmount });
  }

  const hatchedPet: StudentPet = {
    id: createPetId(normalizedState.eggKind, normalizedState.ownedPets),
    kind: normalizedState.eggKind,
    name: '',
    position: { ...DEFAULT_POSITION },
  };
  const ownedPets = [...normalizedState.ownedPets, hatchedPet];
  return withActivePet({
    ...normalizedState,
    fedAmount: 0,
    eggKind: getNextEggKind(ownedPets, normalizedState.eggKind),
    ownedPets,
    activePetId: hatchedPet.id,
    pendingNamePetId: hatchedPet.id,
  });
};

export const selectStudentPet = (state: StudentPetState, petId: string) => {
  const normalizedState = getStudentPetState({ 1: state }, 1);
  if (!normalizedState.ownedPets.some((pet) => pet.id === petId)) return null;
  return withActivePet({ ...normalizedState, activePetId: petId });
};

export const nameStudentPet = (state: StudentPetState, name: string) => {
  const normalizedState = getStudentPetState({ 1: state }, 1);
  const targetPetId = normalizedState.pendingNamePetId;
  if (!targetPetId) return null;
  const nextName = name.trim().slice(0, STUDENT_PET_NAME_MAX_LENGTH);
  if (!nextName) return null;
  return withActivePet({
    ...normalizedState,
    ownedPets: normalizedState.ownedPets.map((pet) => (
      pet.id === targetPetId ? { ...pet, name: nextName } : pet
    )),
    pendingNamePetId: null,
  });
};

export const moveStudentPet = (state: StudentPetState, position: StudentPetState['position']) => {
  const normalizedState = getStudentPetState({ 1: state }, 1);
  if (!normalizedState.activePetId) return null;
  const nextPosition = normalizePosition(position);
  return withActivePet({
    ...normalizedState,
    ownedPets: normalizedState.ownedPets.map((pet) => (
      pet.id === normalizedState.activePetId ? { ...pet, position: nextPosition } : pet
    )),
  });
};

export const moveGomaCharacter = (state: StudentPetState, position: StudentPetState['gomaPosition']) => {
  const normalizedState = getStudentPetState({ 1: state }, 1);
  return withActivePet({
    ...normalizedState,
    gomaPosition: normalizePosition(position),
  });
};

const normalizeStudentPetPositionOverrides = (input: unknown): StudentPetPositionOverrides => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).reduce<StudentPetPositionOverrides>((overrides, [studentKey, rawOverride]) => {
    const studentNumber = Number(studentKey);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) return overrides;
    if (!rawOverride || typeof rawOverride !== 'object' || Array.isArray(rawOverride)) return overrides;
    const override = rawOverride as Record<string, unknown>;
    overrides[studentKey] = {
      petId: typeof override.petId === 'string' && override.petId.trim().length > 0
        ? override.petId.trim().slice(0, 64)
        : null,
      position: normalizePosition(override.position),
      gomaPosition: normalizePosition(override.gomaPosition),
    };
    return overrides;
  }, {});
};

export const loadStudentPetPositionOverrides = (): StudentPetPositionOverrides => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(STUDENT_PET_POSITION_OVERRIDE_STORAGE_KEY);
    return saved ? normalizeStudentPetPositionOverrides(JSON.parse(saved)) : {};
  } catch {
    return {};
  }
};

export const storeStudentPetPositionOverride = (studentNumber: number, state: StudentPetState) => {
  if (typeof window === 'undefined') return false;
  try {
    const overrides = loadStudentPetPositionOverrides();
    const normalizedState = getStudentPetState({ [studentNumber]: state }, studentNumber);
    overrides[String(studentNumber)] = {
      petId: normalizedState.activePetId,
      position: normalizedState.position,
      gomaPosition: normalizedState.gomaPosition,
    };
    window.localStorage.setItem(STUDENT_PET_POSITION_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
};

const arePositionsEqual = (
  first: StudentPetPositionOverride,
  second: StudentPetPositionOverride,
) => (
  first.petId === second.petId
  && first.position.x === second.position.x
  && first.position.y === second.position.y
  && first.gomaPosition.x === second.gomaPosition.x
  && first.gomaPosition.y === second.gomaPosition.y
);

export const clearStudentPetPositionOverride = (
  studentNumber: number,
  expectedState?: StudentPetState,
) => {
  if (typeof window === 'undefined') return false;
  try {
    const overrides = loadStudentPetPositionOverrides();
    const studentKey = String(studentNumber);
    const existing = overrides[studentKey];
    if (!existing) return true;
    if (expectedState) {
      const expected = getStudentPetState({ [studentKey]: expectedState }, studentNumber);
      if (!arePositionsEqual(existing, {
        petId: expected.activePetId,
        position: expected.position,
        gomaPosition: expected.gomaPosition,
      })) return true;
    }
    delete overrides[studentKey];
    window.localStorage.setItem(STUDENT_PET_POSITION_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
};

export const applyStudentPetPositionOverrides = (states: unknown): StudentPetStates => {
  const normalizedStates = normalizeStudentPetStates(states);
  const overrides = loadStudentPetPositionOverrides();

  return Object.entries(overrides).reduce<StudentPetStates>((nextStates, [studentKey, override]) => {
    const studentNumber = Number(studentKey);
    const currentState = getStudentPetState(nextStates, studentNumber);
    const ownedPets = currentState.ownedPets.map((pet) => (
      pet.id === override.petId ? { ...pet, position: override.position } : pet
    ));
    nextStates[studentKey] = withActivePet({
      ...currentState,
      ownedPets,
      gomaPosition: override.gomaPosition,
    });
    return nextStates;
  }, normalizedStates);
};

export const loadStoredStudentPetSnapshot = (): StudentPetLocalSnapshot => {
  const fallback = {
    studentPets: {},
    currencyBalances: normalizeCurrencyBalances(null),
    currencyHistory: normalizeCurrencyHistory(null),
    studentEconomy: {},
    studentLife: normalizeStudentLifeState(null),
    auctionItems: normalizeAuctionItems(null),
    auctionBids: normalizeAuctionBids(null, AUCTION_ITEM_IDS),
    auctionBidHistory: normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS),
    auctionAwards: normalizeAuctionAwards(null, AUCTION_ITEM_IDS),
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(STUDENT_PET_STORAGE_KEY);
    if (!saved) return { ...fallback, studentLife: loadStoredStudentLifeState() };
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      studentPets: normalizeStudentPetStates(parsed.studentPets),
      currencyBalances: normalizeCurrencyBalances(parsed.currencyBalances),
      currencyHistory: normalizeCurrencyHistory(parsed.currencyHistory),
      studentEconomy: normalizeStudentEconomyStates(parsed.studentEconomy),
      studentLife: 'studentLife' in parsed
        ? normalizeStudentLifeState(parsed.studentLife)
        : loadStoredStudentLifeState(),
      auctionItems: normalizeAuctionItems(parsed.auctionItems),
      auctionBids: normalizeAuctionBids(parsed.auctionBids, AUCTION_ITEM_IDS),
      auctionBidHistory: normalizeAuctionBidHistory(parsed.auctionBidHistory, AUCTION_ITEM_IDS),
      auctionAwards: normalizeAuctionAwards(parsed.auctionAwards, AUCTION_ITEM_IDS),
    };
  } catch (error) {
    if (error instanceof Error) return fallback;
    throw error;
  }
};

export const storeStudentPetSnapshot = (
  snapshot: StudentPetLocalSnapshot,
  storage?: Pick<Storage, 'setItem'>,
) => {
  const targetStorage = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  if (targetStorage === null) return false;
  try {
    targetStorage.setItem(STUDENT_PET_STORAGE_KEY, JSON.stringify({
      studentPets: normalizeStudentPetStates(snapshot.studentPets),
      currencyBalances: normalizeCurrencyBalances(snapshot.currencyBalances),
      currencyHistory: normalizeCurrencyHistory(snapshot.currencyHistory),
      studentEconomy: normalizeStudentEconomyStates(snapshot.studentEconomy),
      studentLife: normalizeStudentLifeState(snapshot.studentLife),
      auctionItems: normalizeAuctionItems(snapshot.auctionItems),
      auctionBids: normalizeAuctionBids(snapshot.auctionBids, AUCTION_ITEM_IDS),
      auctionBidHistory: normalizeAuctionBidHistory(snapshot.auctionBidHistory, AUCTION_ITEM_IDS),
      auctionAwards: normalizeAuctionAwards(snapshot.auctionAwards, AUCTION_ITEM_IDS),
    }));
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
