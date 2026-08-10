import {
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency';

export const STUDENT_PET_STORAGE_KEY = 'school-timer-student-pets-v1';
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

export interface StudentPetState {
  fedAmount: number;
  petKind: StudentPetKind | null;
  name: string;
  position: { x: number; y: number };
}

export type StudentPetStates = Record<string, StudentPetState>;

export interface StudentPetLocalSnapshot {
  studentPets: StudentPetStates;
  currencyBalances: CurrencyBalances;
  currencyHistory: CurrencyHistory;
}

const PET_KIND_IDS = new Set<string>(STUDENT_PET_KINDS.map((pet) => pet.id));
const DEFAULT_POSITION = { x: 0.5, y: 0.68 };

const clampPosition = (value: unknown, fallback: number) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0.08, Math.min(0.92, numericValue)) : fallback;
};

export const createDefaultStudentPetState = (): StudentPetState => ({
  fedAmount: 0,
  petKind: null,
  name: '',
  position: { ...DEFAULT_POSITION },
});

export const normalizeStudentPetStates = (input: unknown): StudentPetStates => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).reduce<StudentPetStates>((states, [studentKey, rawState]) => {
    const studentNumber = Number(studentKey);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) return states;
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return states;

    const state = rawState as Record<string, unknown>;
    const rawPosition = state.position && typeof state.position === 'object' && !Array.isArray(state.position)
      ? state.position as Record<string, unknown>
      : {};
    const fedAmount = Math.max(0, Math.min(
      STUDENT_PET_HATCH_AMOUNT,
      Math.floor((Number(state.fedAmount) || 0) / STUDENT_PET_FEED_AMOUNT) * STUDENT_PET_FEED_AMOUNT,
    ));
    const petKind = typeof state.petKind === 'string' && PET_KIND_IDS.has(state.petKind)
      ? state.petKind as StudentPetKind
      : fedAmount >= STUDENT_PET_HATCH_AMOUNT
        ? STUDENT_PET_KINDS[0].id
        : null;

    states[studentKey] = {
      fedAmount,
      petKind,
      name: typeof state.name === 'string'
        ? state.name.trim().slice(0, STUDENT_PET_NAME_MAX_LENGTH)
        : '',
      position: {
        x: clampPosition(rawPosition.x, DEFAULT_POSITION.x),
        y: clampPosition(rawPosition.y, DEFAULT_POSITION.y),
      },
    };
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

export const loadStoredStudentPetSnapshot = (): StudentPetLocalSnapshot => {
  const fallback = {
    studentPets: {},
    currencyBalances: normalizeCurrencyBalances(null),
    currencyHistory: normalizeCurrencyHistory(null),
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(STUDENT_PET_STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      studentPets: normalizeStudentPetStates(parsed.studentPets),
      currencyBalances: normalizeCurrencyBalances(parsed.currencyBalances),
      currencyHistory: normalizeCurrencyHistory(parsed.currencyHistory),
    };
  } catch (error) {
    if (error instanceof Error) return fallback;
    throw error;
  }
};

export const storeStudentPetSnapshot = (snapshot: StudentPetLocalSnapshot) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STUDENT_PET_STORAGE_KEY, JSON.stringify({
      studentPets: normalizeStudentPetStates(snapshot.studentPets),
      currencyBalances: normalizeCurrencyBalances(snapshot.currencyBalances),
      currencyHistory: normalizeCurrencyHistory(snapshot.currencyHistory),
    }));
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
