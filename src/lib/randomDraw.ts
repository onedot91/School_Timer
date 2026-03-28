export type RandomDrawHistoryKind = 'normal' | 'repeat';
export type StudentNameMap = Record<string, string>;

export interface RandomDrawHistoryEntry {
  id: string;
  number: number;
  kind: RandomDrawHistoryKind;
  sourceEntryId?: string;
}

export interface RandomDrawCaseState {
  id: string;
  label: string;
  rangeStart: number;
  rangeEnd: number;
  currentResult: number | null;
  historyEntries: RandomDrawHistoryEntry[];
  studentNames: StudentNameMap;
}

export interface SavedRandomDrawState {
  activeCaseId: string;
  repeatPickEnabled: boolean;
  cases: RandomDrawCaseState[];
}

type PartialRandomDrawCaseState = Partial<RandomDrawCaseState> & {
  results?: unknown;
  history?: unknown;
  historyEntries?: unknown;
  students?: unknown;
};

type PartialRandomDrawHistoryEntry = Partial<RandomDrawHistoryEntry> & {
  numbers?: unknown;
};

export const RANDOM_DRAW_STORAGE_KEY = 'school-random-draw-v1';
export const MIN_DRAW_NUMBER = 1;
export const MAX_DRAW_NUMBER = 999;
export const MAX_HISTORY_LENGTH = 2000;
export const REPEAT_PICK_PROBABILITY = 0.1;
export const DEFAULT_PRIMARY_CASE_ID = 'case-a';
export const DEFAULT_SECONDARY_CASE_ID = 'case-b';
export const RANDOM_DRAW_DURATION_MS = 1300;
export const RANDOM_DRAW_RESULT_DISPLAY_MS = 2500;
const SOUND_START_LEAD_TIME = 0.012;
const SOUND_INITIAL_START_LEAD_TIME = 0.07;
const AUDIO_PRIME_DURATION_MS = 28;
const AUDIO_WARMUP_DELAY_MS = 64;
const RANDOM_DRAW_AUDIO_MASTER_GAIN = 3;
const RANDOM_DRAW_REPEAT_SOUND_GAIN = 1.4;

let randomDrawAudioContext: AudioContext | null = null;
let randomDrawAudioPreparePromise: Promise<AudioContext | null> | null = null;
let randomDrawAudioPrimed = false;
let randomDrawAudioMasterGain: GainNode | null = null;
let randomDrawAudioCompressor: DynamicsCompressorNode | null = null;
let randomDrawAudioPendingLaunchDelayMs = 0;

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
};

const normalizeStudentName = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeResultNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampInteger(numeric, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER);
};

const normalizeStudentNames = (value: unknown): StudentNameMap => {
  const normalized: StudentNameMap = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      const nextEntry = entry as { number?: unknown; name?: unknown };
      const normalizedNumber = normalizeResultNumber(nextEntry.number);
      const normalizedName = normalizeStudentName(nextEntry.name);
      if (normalizedNumber === null || normalizedName.length === 0) return;

      normalized[String(normalizedNumber)] = normalizedName;
    });

    return normalized;
  }

  if (!value || typeof value !== 'object') return normalized;

  Object.entries(value as Record<string, unknown>).forEach(([key, rawName]) => {
    const normalizedNumber = normalizeResultNumber(key);
    const normalizedName = normalizeStudentName(rawName);
    if (normalizedNumber === null || normalizedName.length === 0) return;

    normalized[String(normalizedNumber)] = normalizedName;
  });

  return normalized;
};

const createCaseId = () => `case-${Math.random().toString(36).slice(2, 10)}`;
const createHistoryEntryId = () => `draw-${Math.random().toString(36).slice(2, 11)}`;

export const createHistoryEntry = (
  number: number,
  kind: RandomDrawHistoryKind,
  sourceEntryId?: string,
): RandomDrawHistoryEntry => ({
  id: createHistoryEntryId(),
  number,
  kind,
  sourceEntryId,
});

export const sampleOne = <T,>(pool: T[]) => pool[Math.floor(Math.random() * pool.length)]!;

const normalizeHistoryEntries = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  const normalized: RandomDrawHistoryEntry[] = [];

  value.forEach((entry) => {
    if (typeof entry === 'number') {
      normalized.push(createHistoryEntry(clampInteger(entry, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER), 'normal'));
      return;
    }

    if (!entry || typeof entry !== 'object') return;

    const nextEntry = entry as PartialRandomDrawHistoryEntry;

    if (Array.isArray(nextEntry.numbers)) {
      nextEntry.numbers.forEach((number) => {
        const normalizedNumber = normalizeResultNumber(number);
        if (normalizedNumber !== null) {
          normalized.push(createHistoryEntry(normalizedNumber, 'normal'));
        }
      });
      return;
    }

    const normalizedNumber = normalizeResultNumber(nextEntry.number);
    if (normalizedNumber === null) return;

    normalized.push({
      id:
        typeof nextEntry.id === 'string' && nextEntry.id.trim().length > 0
          ? nextEntry.id.trim()
          : createHistoryEntryId(),
      number: normalizedNumber,
      kind: nextEntry.kind === 'repeat' ? 'repeat' : 'normal',
      sourceEntryId:
        typeof nextEntry.sourceEntryId === 'string' && nextEntry.sourceEntryId.trim().length > 0
          ? nextEntry.sourceEntryId.trim()
          : undefined,
    });
  });

  const usedIds = new Set<string>();

  return normalized.slice(0, MAX_HISTORY_LENGTH).map((entry) => {
    let nextId = entry.id;

    while (!nextId || usedIds.has(nextId)) {
      nextId = createHistoryEntryId();
    }

    usedIds.add(nextId);
    return {
      ...entry,
      id: nextId,
    };
  });
};

export const getCaseLabelByIndex = (index: number) => {
  if (index < 26) {
    return `${String.fromCharCode(65 + index)}상황`;
  }

  return `상황 ${index + 1}`;
};

export const normalizeCaseLabel = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const createDefaultCaseState = (label: string, id = createCaseId()): RandomDrawCaseState => ({
  id,
  label,
  rangeStart: 1,
  rangeEnd: 20,
  currentResult: null,
  historyEntries: [],
  studentNames: {},
});

const createDefaultCasesState = (): RandomDrawCaseState[] => [
  createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID),
  createDefaultCaseState(getCaseLabelByIndex(1), DEFAULT_SECONDARY_CASE_ID),
];

export const DEFAULT_RANDOM_DRAW_STATE: SavedRandomDrawState = {
  activeCaseId: DEFAULT_PRIMARY_CASE_ID,
  repeatPickEnabled: false,
  cases: createDefaultCasesState(),
};

const normalizeCaseState = (
  value: unknown,
  fallbackLabel: string,
  fallbackId: string,
): RandomDrawCaseState => {
  const parsed = value && typeof value === 'object' ? (value as PartialRandomDrawCaseState) : {};
  const currentResult =
    normalizeResultNumber(parsed.currentResult) ??
    (Array.isArray(parsed.results) ? normalizeResultNumber(parsed.results[0]) : null);
  const nextId = typeof parsed.id === 'string' && parsed.id.trim().length > 0 ? parsed.id.trim() : fallbackId;

  return {
    id: nextId,
    label: normalizeCaseLabel(parsed.label, fallbackLabel),
    rangeStart: clampInteger(parsed.rangeStart, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
    rangeEnd: clampInteger(parsed.rangeEnd, 20, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
    currentResult,
    historyEntries: normalizeHistoryEntries(parsed.historyEntries ?? parsed.history),
    studentNames: normalizeStudentNames(parsed.studentNames ?? parsed.students),
  };
};

const ensureUniqueCaseIds = (cases: RandomDrawCaseState[]) => {
  const usedIds = new Set<string>();

  return cases.map((caseState) => {
    let nextId = caseState.id;

    while (!nextId || usedIds.has(nextId)) {
      nextId = createCaseId();
    }

    usedIds.add(nextId);
    return {
      ...caseState,
      id: nextId,
    };
  });
};

const sortLegacyCaseEntries = (entries: [string, unknown][]) =>
  [...entries].sort(([leftId], [rightId]) => {
    const getOrder = (value: string) => {
      if (value === DEFAULT_PRIMARY_CASE_ID) return 0;
      if (value === DEFAULT_SECONDARY_CASE_ID) return 1;
      return Number.MAX_SAFE_INTEGER;
    };

    const orderDifference = getOrder(leftId) - getOrder(rightId);
    if (orderDifference !== 0) return orderDifference;
    return leftId.localeCompare(rightId);
  });

const normalizeSavedCases = (value?: unknown, migratedPrimaryCase?: RandomDrawCaseState) => {
  const defaults = createDefaultCasesState();
  if (migratedPrimaryCase) {
    defaults[0] = {
      ...migratedPrimaryCase,
      id: defaults[0].id,
      label: defaults[0].label,
    };
  }

  if (Array.isArray(value)) {
    const normalizedCases = ensureUniqueCaseIds(
      value.map((entry, index) => normalizeCaseState(entry, getCaseLabelByIndex(index), createCaseId())),
    );
    return normalizedCases.length > 0 ? normalizedCases : defaults;
  }

  if (value && typeof value === 'object') {
    const legacyEntries = sortLegacyCaseEntries(Object.entries(value as Record<string, unknown>));
    const normalizedCases = ensureUniqueCaseIds(
      legacyEntries.map(([caseId, entry], index) =>
        normalizeCaseState(entry, getCaseLabelByIndex(index), caseId || createCaseId()),
      ),
    );
    return normalizedCases.length > 0 ? normalizedCases : defaults;
  }

  return defaults;
};

export const normalizeSavedRandomDrawState = (value: unknown): SavedRandomDrawState => {
  const parsed =
    value && typeof value === 'object'
      ? (value as Partial<SavedRandomDrawState> &
          PartialRandomDrawCaseState & {
            cases?: unknown;
            activeCaseId?: unknown;
            repeatPickEnabled?: unknown;
          })
      : {};

  if (parsed.cases) {
    const normalizedCases = normalizeSavedCases(parsed.cases);
    const nextActiveCaseId =
      typeof parsed.activeCaseId === 'string' && normalizedCases.some((caseState) => caseState.id === parsed.activeCaseId)
        ? parsed.activeCaseId
        : normalizedCases[0].id;

    return {
      activeCaseId: nextActiveCaseId,
      repeatPickEnabled: parsed.repeatPickEnabled === true,
      cases: normalizedCases,
    };
  }

  const migratedPrimaryCase =
    Object.keys(parsed).length > 0
      ? normalizeCaseState(parsed, getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID)
      : undefined;
  const normalizedCases = normalizeSavedCases(undefined, migratedPrimaryCase);

  return {
    activeCaseId: normalizedCases[0].id,
    repeatPickEnabled: parsed.repeatPickEnabled === true,
    cases: normalizedCases,
  };
};

export const getInitialRandomDrawState = (): SavedRandomDrawState => {
  if (typeof window === 'undefined') return DEFAULT_RANDOM_DRAW_STATE;

  try {
    const saved = window.localStorage.getItem(RANDOM_DRAW_STORAGE_KEY);
    if (!saved) return DEFAULT_RANDOM_DRAW_STATE;
    return normalizeSavedRandomDrawState(JSON.parse(saved));
  } catch {
    return DEFAULT_RANDOM_DRAW_STATE;
  }
};

export const persistRandomDrawState = (state: SavedRandomDrawState) => {
  if (typeof window === 'undefined') return;

  const persistedCases = state.cases.map((caseState) => ({
    ...caseState,
    historyEntries: caseState.historyEntries.slice(0, MAX_HISTORY_LENGTH),
  }));

  window.localStorage.setItem(
    RANDOM_DRAW_STORAGE_KEY,
    JSON.stringify({
      activeCaseId: state.activeCaseId,
      repeatPickEnabled: state.repeatPickEnabled,
      cases: persistedCases,
    }),
  );
};

export const createUniqueCaseLabel = (cases: RandomDrawCaseState[]) => {
  let index = 0;

  while (true) {
    const candidate = getCaseLabelByIndex(index);
    if (!cases.some((caseState) => caseState.label === candidate)) {
      return candidate;
    }
    index += 1;
  }
};

export const getCaseBounds = (caseState: RandomDrawCaseState) => {
  const minNumber = Math.min(caseState.rangeStart, caseState.rangeEnd);
  const maxNumber = Math.max(caseState.rangeStart, caseState.rangeEnd);
  const totalCount = maxNumber - minNumber + 1;

  return {
    minNumber,
    maxNumber,
    totalCount,
  };
};

export const getStudentName = (caseState: RandomDrawCaseState, number: number) => {
  const storedName = caseState.studentNames[String(number)];
  return typeof storedName === 'string' ? storedName.trim() : '';
};

export const getStudentDisplayText = (caseState: RandomDrawCaseState, number: number) => {
  const studentName = getStudentName(caseState, number);
  return studentName.length > 0 ? studentName : String(number);
};

export const buildStudentRosterBulkInput = (caseState: RandomDrawCaseState, studentNumbers: number[]) => {
  const lines = studentNumbers.map((studentNumber) => getStudentName(caseState, studentNumber));

  while (lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }

  return lines.join('\n');
};

export const parseStudentRosterBulkInput = (rawValue: string, studentNumbers: number[]) => {
  const nextStudentNames: StudentNameMap = {};
  const studentNumberSet = new Set(studentNumbers);

  rawValue
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .forEach((line, index) => {
      if (!line) return;

      const numberedMatch = line.match(/^(\d{1,3})\s+(.+)$/u);
      if (numberedMatch) {
        const explicitNumber = Number(numberedMatch[1]);
        const explicitName = normalizeStudentName(numberedMatch[2]);
        if (studentNumberSet.has(explicitNumber) && explicitName.length > 0) {
          nextStudentNames[String(explicitNumber)] = explicitName;
        }
        return;
      }

      const studentNumber = studentNumbers[index];
      if (studentNumber === undefined) return;

      nextStudentNames[String(studentNumber)] = line;
    });

  return nextStudentNames;
};

const buildRepeatSourceMap = (historyEntries: RandomDrawHistoryEntry[]) => {
  const normalSourceByNumber = new Map<number, string>();
  const repeatSourceMap = new Map<string, string>();

  [...historyEntries].reverse().forEach((entry) => {
    if (entry.kind === 'normal') {
      normalSourceByNumber.set(entry.number, entry.id);
      return;
    }

    const sourceEntryId = entry.sourceEntryId ?? normalSourceByNumber.get(entry.number);
    if (!sourceEntryId) return;
    repeatSourceMap.set(entry.id, sourceEntryId);
  });

  return repeatSourceMap;
};

export const getCaseDrawData = (caseState: RandomDrawCaseState, repeatPickEnabled: boolean) => {
  const { minNumber, maxNumber, totalCount } = getCaseBounds(caseState);
  const historyEntries = caseState.historyEntries
    .filter((entry) => entry.number >= minNumber && entry.number <= maxNumber)
    .slice(0, MAX_HISTORY_LENGTH);
  const repeatedSourceEntryIds = new Set(buildRepeatSourceMap(historyEntries).values());
  const repeatedNumberSet = new Set<number>();
  const pickedEntryByNumber = new Map<number, RandomDrawHistoryEntry>();

  historyEntries.forEach((entry) => {
    if (entry.kind === 'repeat') {
      repeatedNumberSet.add(entry.number);
      return;
    }

    if (!pickedEntryByNumber.has(entry.number)) {
      pickedEntryByNumber.set(entry.number, entry);
    }
  });

  const availableNumbers = Array.from({ length: totalCount }, (_, index) => minNumber + index).filter(
    (number) => !pickedEntryByNumber.has(number),
  );

  return {
    minNumber,
    maxNumber,
    totalCount,
    historyEntries,
    availableNumbers,
    repeatableEntries: repeatPickEnabled
      ? Array.from(pickedEntryByNumber.values()).filter((entry) => !repeatedNumberSet.has(entry.number))
      : [],
    repeatedSourceEntryIds,
  };
};

export const getCaseSummaryLabel = (caseState: RandomDrawCaseState) => {
  const { minNumber, maxNumber } = getCaseBounds(caseState);
  const drawCount = getCaseDrawData(caseState, false).historyEntries.length;

  return `${minNumber} ~ ${maxNumber} / 추첨 ${drawCount}회`;
};

const getRandomDrawAudioContext = () => {
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!randomDrawAudioContext) {
      randomDrawAudioContext = new AudioContextConstructor();
    }

    return randomDrawAudioContext;
  } catch {
    return null;
  }
};

const waitForRandomDrawAudioWarmup = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const markRandomDrawAudioFresh = () => {
  randomDrawAudioPendingLaunchDelayMs = Math.max(
    randomDrawAudioPendingLaunchDelayMs,
    Math.round(SOUND_INITIAL_START_LEAD_TIME * 1000),
  );
};

const getRandomDrawAudioStartLeadTime = (ctx: AudioContext) => {
  const outputLatency = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  return Math.max(SOUND_START_LEAD_TIME, ctx.baseLatency + outputLatency + 0.018);
};

const primeRandomDrawAudioOutput = (ctx: AudioContext, outputNode: AudioNode) => {
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const durationSeconds = AUDIO_PRIME_DURATION_MS / 1000;
    const startTime = ctx.currentTime + SOUND_INITIAL_START_LEAD_TIME;
    const endTime = startTime + durationSeconds;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.0002, startTime + durationSeconds * 0.2);
    gain.gain.linearRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(outputNode);

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  } catch {
    // Ignore browsers that block or do not support Web Audio.
  }
};

const getRandomDrawAudioOutput = (ctx: AudioContext) => {
  if (!randomDrawAudioMasterGain || !randomDrawAudioCompressor) {
    randomDrawAudioCompressor = ctx.createDynamicsCompressor();
    randomDrawAudioCompressor.threshold.setValueAtTime(-26, ctx.currentTime);
    randomDrawAudioCompressor.knee.setValueAtTime(18, ctx.currentTime);
    randomDrawAudioCompressor.ratio.setValueAtTime(3.4, ctx.currentTime);
    randomDrawAudioCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    randomDrawAudioCompressor.release.setValueAtTime(0.16, ctx.currentTime);

    randomDrawAudioMasterGain = ctx.createGain();
    randomDrawAudioMasterGain.gain.setValueAtTime(RANDOM_DRAW_AUDIO_MASTER_GAIN, ctx.currentTime);

    randomDrawAudioCompressor.connect(randomDrawAudioMasterGain);
    randomDrawAudioMasterGain.connect(ctx.destination);
  }

  return randomDrawAudioCompressor;
};

export const prepareRandomDrawAudio = () => {
  if (!randomDrawAudioPreparePromise) {
    randomDrawAudioPreparePromise = (async () => {
      try {
        const ctx = getRandomDrawAudioContext();
        if (!ctx) return null;
        const outputNode = getRandomDrawAudioOutput(ctx);
        let didResume = false;
        let didPrime = false;

        if (ctx.state === 'suspended') {
          await ctx.resume();
          didResume = true;
        }

        if (!randomDrawAudioPrimed) {
          randomDrawAudioPrimed = true;
          didPrime = true;
          primeRandomDrawAudioOutput(ctx, outputNode);
          await waitForRandomDrawAudioWarmup(AUDIO_WARMUP_DELAY_MS);
        }

        if (didResume || didPrime) {
          markRandomDrawAudioFresh();
        }

        return ctx;
      } catch {
        return null;
      } finally {
        randomDrawAudioPreparePromise = null;
      }
    })();
  }

  return randomDrawAudioPreparePromise;
};

export const playRandomDrawSound = async (kind: 'tick' | 'pop' | 'repeat' | 'empty' | 'reset') => {
  try {
    const ctx = await prepareRandomDrawAudio();
    if (!ctx) return;
    const outputNode = getRandomDrawAudioOutput(ctx);

    const playTone = (
      startFrequency: number,
      endFrequency: number,
      startOffset: number,
      duration: number,
      type: OscillatorType,
      volume: number,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + getRandomDrawAudioStartLeadTime(ctx) + startOffset;
      const endTime = startTime + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFrequency, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(120, endFrequency), endTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + duration * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.connect(gain);
      gain.connect(outputNode);

      oscillator.start(startTime);
      oscillator.stop(endTime + 0.03);
    };

    if (kind === 'tick') {
      playTone(680, 200, 0, 0.055, 'sine', 0.048);
      return;
    }

    if (kind === 'pop') {
      playTone(340, 920, 0, 0.15, 'triangle', 0.068);
      playTone(523, 560, 0.07, 0.17, 'triangle', 0.078);
      playTone(659, 700, 0.1, 0.17, 'triangle', 0.069);
      playTone(784, 830, 0.13, 0.19, 'sine', 0.066);
      playTone(1046, 1100, 0.17, 0.19, 'sine', 0.054);
      return;
    }

    if (kind === 'empty') {
      playTone(312, 228, 0, 0.11, 'triangle', 0.04);
      playTone(196, 154, 0.018, 0.34, 'sine', 0.056);
      playTone(262, 208, 0.032, 0.44, 'sine', 0.034);
      playTone(156, 132, 0.11, 0.56, 'triangle', 0.022);
      return;
    }

    if (kind === 'reset') {
      playTone(1040, 240, 0, 0.24, 'sawtooth', 0.025);
      playTone(760, 180, 0.028, 0.28, 'triangle', 0.022);
      playTone(280, 190, 0.042, 0.2, 'sine', 0.018);
      playTone(392, 523, 0.19, 0.12, 'triangle', 0.02);
      playTone(523, 784, 0.23, 0.12, 'triangle', 0.019);
      playTone(784, 1046, 0.28, 0.16, 'sine', 0.016);
      return;
    }

    const repeatVolumeMultiplier = RANDOM_DRAW_REPEAT_SOUND_GAIN;
    playTone(176, 720, 0, 0.24, 'sawtooth', 0.062 * repeatVolumeMultiplier);
    playTone(392, 415, 0.15, 0.11, 'triangle', 0.046 * repeatVolumeMultiplier);
    playTone(494, 523, 0.21, 0.11, 'triangle', 0.054 * repeatVolumeMultiplier);
    playTone(659, 698, 0.27, 0.12, 'triangle', 0.061 * repeatVolumeMultiplier);
    playTone(988, 1046, 0.33, 0.16, 'sine', 0.05 * repeatVolumeMultiplier);
    playTone(1318, 1396, 0.36, 0.14, 'sine', 0.037 * repeatVolumeMultiplier);
    playTone(784, 830, 0.43, 0.16, 'triangle', 0.032 * repeatVolumeMultiplier);
  } catch {
    // Ignore browsers that block or do not support Web Audio.
  }
};
