import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Play, Plus, RotateCcw, Settings2, Trash2, X } from 'lucide-react';

type RandomDrawHistoryKind = 'normal' | 'repeat';

interface RandomDrawHistoryEntry {
  id: string;
  number: number;
  kind: RandomDrawHistoryKind;
  sourceEntryId?: string;
}

interface RandomDrawCaseState {
  id: string;
  label: string;
  rangeStart: number;
  rangeEnd: number;
  currentResult: number | null;
  historyEntries: RandomDrawHistoryEntry[];
}

interface SavedRandomDrawState {
  activeCaseId: string;
  repeatPickEnabled: boolean;
  cases: RandomDrawCaseState[];
}

type PartialRandomDrawCaseState = Partial<RandomDrawCaseState> & {
  results?: unknown;
  history?: unknown;
  historyEntries?: unknown;
};

type PartialRandomDrawHistoryEntry = Partial<RandomDrawHistoryEntry> & {
  numbers?: unknown;
};

interface RepeatFlightState {
  key: string;
  number: number;
  sourceEntryId: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  distance: number;
  angle: number;
  startScale: number;
  pushX: number;
  pushY: number;
}

interface RepeatStageNumbers {
  outgoingNumber: number;
  incomingNumber: number;
}

const RANDOM_DRAW_STORAGE_KEY = 'school-random-draw-v1';
const MIN_DRAW_NUMBER = 1;
const MAX_DRAW_NUMBER = 999;
const MAX_HISTORY_LENGTH = 2000;
const ENTER_HOLD_RESET_MS = 700;
const DRAW_DURATION_MS = 2200;
const DRAW_START_BREAK_MS = 180;
const ROLL_TICK_START_MS = 104;
const ROLL_TICK_END_MS = 34;
const REPEAT_PICK_PROBABILITY = 0.1;
const REPEAT_RESOLVE_DELAY_MS = 920;
const SOUND_START_LEAD_TIME = 0.012;
const SOUND_INITIAL_START_LEAD_TIME = 0.07;
const AUDIO_PRIME_DURATION_MS = 28;
const AUDIO_WARMUP_DELAY_MS = 64;
const RANDOM_DRAW_AUDIO_MASTER_GAIN = 1.45;
const DEFAULT_PRIMARY_CASE_ID = 'case-a';
const DEFAULT_SECONDARY_CASE_ID = 'case-b';

const SETTINGS_LABEL = '\uC124\uC815';
const SETTINGS_CLOSE_LABEL = '\uC124\uC815 \uB2EB\uAE30';
const DRAWN_NUMBERS_LABEL = '\uBF51\uD78C \uBC88\uD638';
const REMAINING_LABEL = '\uB0A8\uC740';
const EMPTY_HISTORY_LABEL = '\uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.';
const ADD_CASE_LABEL = '\uC0C1\uD669 \uCD94\uAC00';
const DELETE_CASE_LABEL = '\uC0C1\uD669 \uC0AD\uC81C';
const SETTINGS_SUBTITLE = '\uC0C1\uD669 \uC774\uB984, \uBC94\uC704, \uD2B9\uC218 \uCD94\uCCA8 \uC635\uC158\uC744 \uAD00\uB9AC\uD569\uB2C8\uB2E4.';
const CASE_LIST_LABEL = '\uC0C1\uD669 \uBAA9\uB85D';
const CASE_NAME_LABEL = '\uC0C1\uD669 \uC774\uB984';
const RANGE_START_NUMBER_LABEL = '\uC2DC\uC791 \uBC88\uD638';
const RANGE_END_NUMBER_LABEL = '\uB05D \uBC88\uD638';
const DRAW_COUNT_LABEL = '\uCD94\uCCA8';
const DRAW_COUNT_SUFFIX = '\uD68C';
const REPEAT_PICK_LABEL = '\uC7AC\uB4F1\uC7A5 \uC5F0\uCD9C';
const REPEAT_PICK_DESCRIPTION =
  '\uCD94\uCCA8 \uC2DC 10% \uD655\uB960\uB85C \uC774\uBBF8 \uBF51\uD78C \uBC88\uD638\uAC00 \uD55C \uBC88 \uB354 \uB4F1\uC7A5\uD558\uACE0, \uAC01 \uBC88\uD638\uB294 \uCD08\uAE30\uD654 \uC804\uAE4C\uC9C0 \uCD5C\uB300 2\uBC88';

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

const normalizeResultNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampInteger(numeric, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER);
};

const createCaseId = () => `case-${Math.random().toString(36).slice(2, 10)}`;
const createHistoryEntryId = () => `draw-${Math.random().toString(36).slice(2, 11)}`;

const createHistoryEntry = (
  number: number,
  kind: RandomDrawHistoryKind,
  sourceEntryId?: string,
): RandomDrawHistoryEntry => ({
  id: createHistoryEntryId(),
  number,
  kind,
  sourceEntryId,
});

const sampleOne = <T,>(pool: T[]) => pool[Math.floor(Math.random() * pool.length)]!;

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

const getCaseLabelByIndex = (index: number) => {
  if (index < 26) {
    return `${String.fromCharCode(65 + index)}\uC0C1\uD669`;
  }

  return `\uC0C1\uD669 ${index + 1}`;
};

const createDefaultCaseState = (label: string, id = createCaseId()): RandomDrawCaseState => ({
  id,
  label,
  rangeStart: 1,
  rangeEnd: 20,
  currentResult: null,
  historyEntries: [],
});

const createDefaultCasesState = (): RandomDrawCaseState[] => [
  createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID),
  createDefaultCaseState(getCaseLabelByIndex(1), DEFAULT_SECONDARY_CASE_ID),
];

const DEFAULT_RANDOM_DRAW_STATE: SavedRandomDrawState = {
  activeCaseId: DEFAULT_PRIMARY_CASE_ID,
  repeatPickEnabled: false,
  cases: createDefaultCasesState(),
};

const normalizeCaseLabel = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
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

const getInitialRandomDrawState = (): SavedRandomDrawState => {
  if (typeof window === 'undefined') return DEFAULT_RANDOM_DRAW_STATE;

  try {
    const saved = window.localStorage.getItem(RANDOM_DRAW_STORAGE_KEY);
    if (!saved) return DEFAULT_RANDOM_DRAW_STATE;

    const parsed = JSON.parse(saved) as Partial<SavedRandomDrawState> &
      PartialRandomDrawCaseState & {
        cases?: unknown;
        activeCaseId?: unknown;
        repeatPickEnabled?: unknown;
      };

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

    const migratedPrimaryCase = normalizeCaseState(parsed, getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID);
    const normalizedCases = normalizeSavedCases(undefined, migratedPrimaryCase);

    return {
      activeCaseId: normalizedCases[0].id,
      repeatPickEnabled: parsed.repeatPickEnabled === true,
      cases: normalizedCases,
    };
  } catch {
    return DEFAULT_RANDOM_DRAW_STATE;
  }
};

const createUniqueCaseLabel = (cases: RandomDrawCaseState[]) => {
  let index = 0;

  while (true) {
    const candidate = getCaseLabelByIndex(index);
    if (!cases.some((caseState) => caseState.label === candidate)) {
      return candidate;
    }
    index += 1;
  }
};

const getCaseBounds = (caseState: RandomDrawCaseState) => {
  const minNumber = Math.min(caseState.rangeStart, caseState.rangeEnd);
  const maxNumber = Math.max(caseState.rangeStart, caseState.rangeEnd);
  const totalCount = maxNumber - minNumber + 1;

  return {
    minNumber,
    maxNumber,
    totalCount,
  };
};

const getCaseSummaryLabel = (caseState: RandomDrawCaseState) => {
  const { minNumber, maxNumber } = getCaseBounds(caseState);
  const drawCount = getCaseDrawData(caseState, false).historyEntries.length;

  return `${minNumber} ~ ${maxNumber} / ${DRAW_COUNT_LABEL} ${drawCount}${DRAW_COUNT_SUFFIX}`;
};

const buildRepeatSourceMap = (historyEntries: RandomDrawHistoryEntry[]) => {
  const repeatSourceMap = new Map<string, string>();
  const normalSourceByNumber = new Map<number, string>();

  [...historyEntries].reverse().forEach((entry) => {
    if (entry.kind === 'normal' && !normalSourceByNumber.has(entry.number)) {
      normalSourceByNumber.set(entry.number, entry.id);
      return;
    }

    if (entry.kind !== 'repeat') return;

    const sourceEntryId = entry.sourceEntryId ?? normalSourceByNumber.get(entry.number);
    if (!sourceEntryId) return;
    repeatSourceMap.set(entry.id, sourceEntryId);
  });

  return repeatSourceMap;
};

const getCaseDrawData = (caseState: RandomDrawCaseState, repeatPickEnabled: boolean) => {
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

const consumeRandomDrawAudioLaunchDelay = () => {
  const nextDelay = randomDrawAudioPendingLaunchDelayMs;
  randomDrawAudioPendingLaunchDelayMs = 0;
  return nextDelay;
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

const prepareRandomDrawAudio = () => {
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

const playRandomDrawSound = async (kind: 'tick' | 'pop' | 'repeat') => {
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

    playTone(176, 720, 0, 0.24, 'sawtooth', 0.062);
    playTone(392, 415, 0.15, 0.11, 'triangle', 0.046);
    playTone(494, 523, 0.21, 0.11, 'triangle', 0.054);
    playTone(659, 698, 0.27, 0.12, 'triangle', 0.061);
    playTone(988, 1046, 0.33, 0.16, 'sine', 0.05);
    playTone(1318, 1396, 0.36, 0.14, 'sine', 0.037);
    playTone(784, 830, 0.43, 0.16, 'triangle', 0.032);
  } catch {
    // Ignore browsers that block or do not support Web Audio.
  }
};

export default function RandomDrawPage() {
  const [initialState] = useState(() => getInitialRandomDrawState());
  const [activeCaseId, setActiveCaseId] = useState(initialState.activeCaseId);
  const [repeatPickEnabled, setRepeatPickEnabled] = useState(initialState.repeatPickEnabled);
  const [cases, setCases] = useState<RandomDrawCaseState[]>(initialState.cases);
  const [settingsSelectedCaseId, setSettingsSelectedCaseId] = useState(initialState.activeCaseId);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [isDrawPending, setIsDrawPending] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repeatStageNumbers, setRepeatStageNumbers] = useState<RepeatStageNumbers | null>(null);
  const [repeatFlight, setRepeatFlight] = useState<RepeatFlightState | null>(null);
  const [isRepeatImpacting, setIsRepeatImpacting] = useState(false);

  const hasMountedRef = useRef(false);
  const casesRef = useRef(cases);
  const repeatPickEnabledRef = useRef(repeatPickEnabled);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pickedBallRefs = useRef(new Map<string, HTMLSpanElement>());
  const drawStartTimeoutRef = useRef<number | null>(null);
  const rollingStepTimeoutRef = useRef<number | null>(null);
  const drawResolveTimeoutRef = useRef<number | null>(null);
  const repeatResolveTimeoutRef = useRef<number | null>(null);
  const enterHoldTimeoutRef = useRef<number | null>(null);
  const enterHoldTriggeredRef = useRef(false);
  const enterPressedRef = useRef(false);
  const latestRollingValueRef = useRef<number | null>(null);
  const drawLaunchTokenRef = useRef(0);

  const activeCase =
    cases.find((caseState) => caseState.id === activeCaseId) ??
    cases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID);
  const resolvedActiveCaseId = activeCase.id;
  const selectedSettingsCaseIndex = cases.findIndex((caseState) => caseState.id === settingsSelectedCaseId);
  const selectedSettingsCase =
    cases[selectedSettingsCaseIndex] ??
    cases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID);
  const drawData = getCaseDrawData(activeCase, repeatPickEnabled);
  const { minNumber, maxNumber, totalCount, historyEntries, availableNumbers, repeatableEntries } = drawData;
  const stageDisplayValue = repeatStageNumbers === null ? (isDrawing ? rollingValue : activeCase.currentResult) : null;
  const stageValue = stageDisplayValue !== null ? String(stageDisplayValue) : '?';
  const hasVisibleNumber = stageDisplayValue !== null || repeatStageNumbers !== null;
  const canDraw = !isDrawPending && !isDrawing && (availableNumbers.length > 0 || repeatableEntries.length > 0);
  const caseSignature = `${resolvedActiveCaseId}:${minNumber}:${maxNumber}`;
  const visibleHistoryEntries = (() => {
    const seenNumbers = new Set<number>();

    return historyEntries.filter((entry) => {
      if (seenNumbers.has(entry.number)) {
        return false;
      }

      seenNumbers.add(entry.number);
      return true;
    });
  })();
  const orderedVisibleHistoryEntries = [...visibleHistoryEntries].reverse();

  useEffect(() => {
    casesRef.current = cases;
  }, [cases]);

  useEffect(() => {
    repeatPickEnabledRef.current = repeatPickEnabled;
  }, [repeatPickEnabled]);

  const updateCaseState = (
    caseId: string,
    updater: (previousCase: RandomDrawCaseState) => RandomDrawCaseState,
  ) => {
    setCases((previousCases) =>
      previousCases.map((caseState) => (caseState.id === caseId ? updater(caseState) : caseState)),
    );
  };

  const openSettingsModal = () => {
    setSettingsSelectedCaseId(resolvedActiveCaseId);
    setIsSettingsOpen(true);
  };

  const closeSettingsModal = () => {
    setIsSettingsOpen(false);
  };

  const updateSettingsCaseLabel = (caseId: string, rawValue: string) => {
    updateCaseState(caseId, (previousCase) => ({
      ...previousCase,
      label: rawValue,
    }));
  };

  const updateSettingsCaseRange = (
    caseId: string,
    field: 'rangeStart' | 'rangeEnd',
    rawValue: string,
    fallback: number,
  ) => {
    const nextValue = clampInteger(rawValue, fallback, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER);

    updateCaseState(caseId, (previousCase) => {
      if (previousCase[field] === nextValue) {
        return previousCase;
      }

      return {
        ...previousCase,
        [field]: nextValue,
        currentResult: null,
        historyEntries: [],
      };
    });
  };

  const addSettingsCase = () => {
    const nextCase = createDefaultCaseState(createUniqueCaseLabel(cases));

    setCases((previousCases) => [...previousCases, nextCase]);
    setSettingsSelectedCaseId(nextCase.id);
  };

  const removeSettingsCase = (caseId: string) => {
    if (cases.length <= 1) return;

    const caseIndex = cases.findIndex((caseState) => caseState.id === caseId);
    const nextCases = cases.filter((caseState) => caseState.id !== caseId);
    const fallbackCase = nextCases[Math.min(caseIndex, nextCases.length - 1)] ?? nextCases[0];

    setCases(nextCases);
    if (resolvedActiveCaseId === caseId && fallbackCase) {
      setActiveCaseId(fallbackCase.id);
    }
    if (settingsSelectedCaseId === caseId && fallbackCase) {
      setSettingsSelectedCaseId(fallbackCase.id);
    }
  };

  const setPickedBallRef = (entryId: string, node: HTMLSpanElement | null) => {
    if (node) {
      pickedBallRefs.current.set(entryId, node);
      return;
    }

    pickedBallRefs.current.delete(entryId);
  };

  const clearAnimationTimers = () => {
    if (drawStartTimeoutRef.current !== null) {
      window.clearTimeout(drawStartTimeoutRef.current);
      drawStartTimeoutRef.current = null;
    }

    if (rollingStepTimeoutRef.current !== null) {
      window.clearTimeout(rollingStepTimeoutRef.current);
      rollingStepTimeoutRef.current = null;
    }

    if (drawResolveTimeoutRef.current !== null) {
      window.clearTimeout(drawResolveTimeoutRef.current);
      drawResolveTimeoutRef.current = null;
    }

    if (repeatResolveTimeoutRef.current !== null) {
      window.clearTimeout(repeatResolveTimeoutRef.current);
      repeatResolveTimeoutRef.current = null;
    }
  };

  const clearRepeatVisualState = () => {
    setRepeatStageNumbers(null);
    setRepeatFlight(null);
    setIsRepeatImpacting(false);
  };

  const stopDrawing = () => {
    drawLaunchTokenRef.current += 1;
    clearAnimationTimers();
    clearRepeatVisualState();
    setIsDrawPending(false);
    setIsDrawing(false);
    setRollingValue(null);
    latestRollingValueRef.current = null;
  };

  const clearEnterHoldTimer = () => {
    if (enterHoldTimeoutRef.current !== null) {
      window.clearTimeout(enterHoldTimeoutRef.current);
      enterHoldTimeoutRef.current = null;
    }
  };

  const isEditableTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;

    const tagName = element.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      tagName === 'BUTTON' ||
      tagName === 'A'
    );
  };

  const getCaseSnapshot = (caseId: string) =>
    casesRef.current.find((caseState) => caseState.id === caseId) ??
    createDefaultCaseState(getCaseLabelByIndex(0), caseId);

  const finalizeNormalDraw = (caseId: string, finalNumber: number) => {
    setRollingValue(finalNumber);
    latestRollingValueRef.current = finalNumber;
    updateCaseState(caseId, (previousCase) => ({
      ...previousCase,
      currentResult: finalNumber,
      historyEntries: [createHistoryEntry(finalNumber, 'normal'), ...previousCase.historyEntries].slice(
        0,
        MAX_HISTORY_LENGTH,
      ),
    }));
    setIsDrawing(false);
    void playRandomDrawSound('pop');
  };

  const createRepeatFlightState = (sourceEntryId: string, number: number) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    const sourceRect = pickedBallRefs.current.get(sourceEntryId)?.getBoundingClientRect();

    if (!boardRect) return null;

    const endX = boardRect.left + boardRect.width / 2;
    const endY = boardRect.top + boardRect.height / 2;
    const startX = sourceRect ? sourceRect.left + sourceRect.width / 2 : Math.min(window.innerWidth - 80, endX + 260);
    const startY = sourceRect ? sourceRect.top + sourceRect.height / 2 : Math.max(88, endY - 120);
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
    const travelUnitX = deltaX / distance;
    const travelUnitY = deltaY / distance;
    const digitCount = String(number).length;
    const estimatedBoardNumberWidth =
      boardRect.width * (digitCount >= 3 ? 0.62 : digitCount === 2 ? 0.45 : 0.28);
    const startScale = Math.max(
      0.16,
      Math.min((sourceRect?.width ?? 68) / Math.max(estimatedBoardNumberWidth, 1), 0.34),
    );
    const pushDistance = Math.min(Math.max(boardRect.width * 0.1, 28), 52);

    return {
      key: `${sourceEntryId}-${Date.now()}`,
      number,
      sourceEntryId,
      startX,
      startY,
      deltaX,
      deltaY,
      distance,
      angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
      startScale,
      pushX: travelUnitX * pushDistance,
      pushY: travelUnitY * pushDistance,
    };
  };

  const beginRepeatDraw = (caseId: string, repeatedEntry: RandomDrawHistoryEntry) => {
    const previewNumber = latestRollingValueRef.current ?? activeCase.currentResult ?? repeatedEntry.number;
    const nextFlight =
      createRepeatFlightState(repeatedEntry.id, repeatedEntry.number) ?? {
        key: `${repeatedEntry.id}-${Date.now()}`,
        number: repeatedEntry.number,
        sourceEntryId: repeatedEntry.id,
        startX: window.innerWidth - 96,
        startY: Math.max(88, window.innerHeight * 0.35),
        deltaX: -220,
        deltaY: 80,
        distance: 240,
        angle: 160,
        startScale: 0.24,
        pushX: -42,
        pushY: 12,
      };

    setRepeatStageNumbers({
      outgoingNumber: previewNumber,
      incomingNumber: repeatedEntry.number,
    });
    setIsRepeatImpacting(true);
    setRepeatFlight(nextFlight);
    void playRandomDrawSound('repeat');

    repeatResolveTimeoutRef.current = window.setTimeout(() => {
      updateCaseState(caseId, (previousCase) => ({
        ...previousCase,
        currentResult: repeatedEntry.number,
        historyEntries: [
          createHistoryEntry(repeatedEntry.number, 'repeat', repeatedEntry.id),
          ...previousCase.historyEntries,
        ].slice(0, MAX_HISTORY_LENGTH),
      }));

      setRollingValue(null);
      latestRollingValueRef.current = repeatedEntry.number;
      setIsDrawing(false);
      clearRepeatVisualState();
    }, REPEAT_RESOLVE_DELAY_MS);
  };

  useEffect(() => {
    if (activeCaseId === resolvedActiveCaseId) return;
    setActiveCaseId(resolvedActiveCaseId);
  }, [activeCaseId, resolvedActiveCaseId]);

  useEffect(() => {
    const persistedCases = cases.map((caseState) => ({
      ...caseState,
      historyEntries: caseState.historyEntries.slice(0, MAX_HISTORY_LENGTH),
    }));

    window.localStorage.setItem(
      RANDOM_DRAW_STORAGE_KEY,
      JSON.stringify({
        activeCaseId: resolvedActiveCaseId,
        repeatPickEnabled,
        cases: persistedCases,
      }),
    );
  }, [cases, repeatPickEnabled, resolvedActiveCaseId]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    stopDrawing();
  }, [caseSignature]);

  useEffect(() => {
    return () => {
      clearAnimationTimers();
      clearEnterHoldTimer();
    };
  }, []);

  const startDraw = () => {
    if (!canDraw) return;

    const targetCaseId = resolvedActiveCaseId;
    const initialCase = getCaseSnapshot(targetCaseId);
    const initialDrawData = getCaseDrawData(initialCase, repeatPickEnabledRef.current);
    const drawPool =
      initialDrawData.availableNumbers.length > 0
        ? initialDrawData.availableNumbers
        : initialDrawData.repeatableEntries.map((entry) => entry.number);

    if (drawPool.length === 0) return;

    const drawLaunchToken = drawLaunchTokenRef.current + 1;
    drawLaunchTokenRef.current = drawLaunchToken;
    clearAnimationTimers();
    clearRepeatVisualState();
    setIsDrawPending(true);
    const launchDraw = () => {
      if (drawLaunchTokenRef.current !== drawLaunchToken) {
        setIsDrawPending(false);
        return;
      }

      drawStartTimeoutRef.current = null;
      setIsDrawPending(false);
      setIsDrawing(true);
      const startedAt = performance.now();

      const rollStep = () => {
        const nextValue = sampleOne(drawPool);
        const elapsed = performance.now() - startedAt;
        const progress = Math.min(elapsed / DRAW_DURATION_MS, 1);
        const nextDelay = Math.round(ROLL_TICK_START_MS - (ROLL_TICK_START_MS - ROLL_TICK_END_MS) * progress);

        latestRollingValueRef.current = nextValue;
        setRollingValue(nextValue);
        void playRandomDrawSound('tick');

        if (elapsed < DRAW_DURATION_MS - nextDelay) {
          rollingStepTimeoutRef.current = window.setTimeout(rollStep, nextDelay);
        }
      };

      rollStep();

      drawResolveTimeoutRef.current = window.setTimeout(() => {
        clearAnimationTimers();

        const nextCase = getCaseSnapshot(targetCaseId);
        const nextDrawData = getCaseDrawData(nextCase, repeatPickEnabledRef.current);
        const shouldRepeat =
          repeatPickEnabledRef.current &&
          nextDrawData.repeatableEntries.length > 0 &&
          Math.random() < REPEAT_PICK_PROBABILITY;

        if (shouldRepeat) {
          beginRepeatDraw(targetCaseId, sampleOne(nextDrawData.repeatableEntries));
          return;
        }

        if (nextDrawData.availableNumbers.length === 0) {
          setIsDrawing(false);
          setRollingValue(null);
          latestRollingValueRef.current = null;
          return;
        }

        finalizeNormalDraw(targetCaseId, sampleOne(nextDrawData.availableNumbers));
      }, DRAW_DURATION_MS);
    };

    const queueLaunch = () => {
      if (drawLaunchTokenRef.current !== drawLaunchToken) {
        setIsDrawPending(false);
        return;
      }

      if (activeCase.currentResult !== null) {
        drawStartTimeoutRef.current = window.setTimeout(launchDraw, DRAW_START_BREAK_MS);
        return;
      }

      launchDraw();
    };

    void prepareRandomDrawAudio().finally(() => {
      const audioLaunchDelay = consumeRandomDrawAudioLaunchDelay();

      if (audioLaunchDelay > 0) {
        drawStartTimeoutRef.current = window.setTimeout(queueLaunch, audioLaunchDelay);
        return;
      }

      queueLaunch();
    });
  };

  const resetDrawBag = () => {
    const targetCaseId = resolvedActiveCaseId;

    stopDrawing();
    updateCaseState(targetCaseId, (previousCase) => ({
      ...previousCase,
      currentResult: null,
      historyEntries: [],
    }));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isSettingsOpen || isEditableTarget(event.target)) return;
      if (enterPressedRef.current || event.repeat) return;

      event.preventDefault();
      if (canDraw) {
        void prepareRandomDrawAudio();
      }
      enterPressedRef.current = true;
      enterHoldTriggeredRef.current = false;
      clearEnterHoldTimer();

      enterHoldTimeoutRef.current = window.setTimeout(() => {
        enterHoldTriggeredRef.current = true;
        resetDrawBag();
      }, ENTER_HOLD_RESET_MS);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (!enterPressedRef.current) return;

      event.preventDefault();
      enterPressedRef.current = false;
      clearEnterHoldTimer();

      if (enterHoldTriggeredRef.current) {
        enterHoldTriggeredRef.current = false;
        return;
      }

      if (!isSettingsOpen && !isEditableTarget(event.target)) {
        startDraw();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cases, canDraw, isSettingsOpen, repeatPickEnabled, resolvedActiveCaseId]);

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <div className="mascot-shell app-tone-calm relative flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] shadow-2xl md:rounded-[3rem]">
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_29rem] xl:grid-cols-[minmax(0,1fr)_32rem] 2xl:grid-cols-[minmax(0,1fr)_34rem]">
          <section className="timer-pane relative flex h-full min-h-0 flex-col items-center p-5 md:p-8 lg:px-8 lg:py-10 xl:px-10 xl:py-12">
            <div className="random-stage-toolbar random-stage-toolbar-single mb-2 w-full shrink-0">
              <button
                type="button"
                onClick={openSettingsModal}
                disabled={isDrawing}
                className="random-settings-button icon-button rounded-full p-3 text-[#8A6347]/70 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347] disabled:cursor-not-allowed disabled:opacity-50"
                title={SETTINGS_LABEL}
                aria-label={SETTINGS_LABEL}
              >
                <Settings2 size={22} />
              </button>
            </div>

            <div className="random-stage-shell flex min-h-0 w-full flex-1 flex-col items-center justify-center">
              <div className="random-board-stage relative flex min-h-0 w-full flex-1 items-center justify-center">
                {repeatFlight && (
                  <div
                    key={repeatFlight.key}
                    className="random-repeat-flight"
                    style={
                      {
                        '--repeat-start-x': `${repeatFlight.startX}px`,
                        '--repeat-start-y': `${repeatFlight.startY}px`,
                        '--repeat-dx': `${repeatFlight.deltaX}px`,
                        '--repeat-dy': `${repeatFlight.deltaY}px`,
                        '--repeat-distance': `${repeatFlight.distance}px`,
                        '--repeat-angle': `${repeatFlight.angle}deg`,
                        '--repeat-start-scale': `${repeatFlight.startScale}`,
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  >
                    <div className="random-repeat-flight-trail" />
                    <span className="random-board-number random-board-number-active random-repeat-flight-number">
                      {repeatFlight.number}
                    </span>
                  </div>
                )}

                <div
                  ref={boardRef}
                  className={`random-board ${isDrawing ? 'random-board-drawing' : ''}${
                    isRepeatImpacting ? ' random-board-repeat-impact' : ''
                  }`}
                >
                  {isRepeatImpacting && <div aria-hidden="true" className="random-board-repeat-glow" />}
                  {isRepeatImpacting && <div aria-hidden="true" className="random-board-shockwave" />}
                  {isRepeatImpacting && (
                    <div aria-hidden="true" className="random-board-sparks">
                      {Array.from({ length: 8 }, (_, index) => (
                        <span
                          key={`spark-${index}`}
                          className="random-board-spark"
                          style={{ '--spark-angle': `${index * 45}deg` } as CSSProperties}
                        />
                      ))}
                    </div>
                  )}
                  {repeatStageNumbers ? (
                    <div
                      className="random-board-number-stack"
                      style={
                        repeatFlight
                          ? ({
                              '--repeat-push-x': `${repeatFlight.pushX}px`,
                              '--repeat-push-y': `${repeatFlight.pushY}px`,
                              '--repeat-incoming-x': `${-repeatFlight.pushX * 0.84}px`,
                              '--repeat-incoming-y': `${-repeatFlight.pushY * 0.84}px`,
                            } as CSSProperties)
                          : undefined
                      }
                      aria-hidden="true"
                    >
                      <span className="random-board-number random-board-number-active random-board-number-outgoing">
                        {repeatStageNumbers.outgoingNumber}
                      </span>
                      <span className="random-board-number random-board-number-active random-board-number-repeat-incoming">
                        {repeatStageNumbers.incomingNumber}
                      </span>
                    </div>
                  ) : (
                    <span className={`random-board-number${hasVisibleNumber ? ' random-board-number-active' : ''}`}>
                      {stageValue}
                    </span>
                  )}
                </div>
              </div>

              <div className="random-stage-actions flex shrink-0 items-center justify-center gap-6">
                <button
                  type="button"
                  onPointerDown={() => {
                    if (canDraw) {
                      void prepareRandomDrawAudio();
                    }
                  }}
                  onClick={startDraw}
                  disabled={!canDraw}
                  className="round-action round-action-play random-action-button flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:h-32 lg:w-32"
                  aria-label={isDrawing ? '\uCD94\uCCA8 \uC911' : '\uBC88\uD638 \uBF51\uAE30'}
                  title={isDrawing ? '\uCD94\uCCA8 \uC911' : '\uBC88\uD638 \uBF51\uAE30'}
                >
                  <Play size={46} className="ml-1 lg:h-14 lg:w-14" fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={resetDrawBag}
                  className="round-action round-action-reset flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[#8A6347] shadow-lg transition-transform hover:scale-105 active:scale-95 lg:h-20 lg:w-20"
                >
                  <RotateCcw size={32} className="lg:h-10 lg:w-10" />
                </button>
              </div>
            </div>
          </section>

          <aside className="control-pane random-control-pane relative flex min-h-0 w-full flex-col gap-4 overflow-hidden border-t border-[#E6D5C9]/50 p-4 sm:p-5 lg:w-auto lg:border-l lg:border-t-0 lg:px-6 lg:py-6 xl:px-7 xl:py-7">
            <div className="mode-switch random-case-switch random-case-switch-side flex shrink-0 rounded-[1.25rem] p-0.5">
              {cases.map((caseState, index) => {
                const displayLabel = normalizeCaseLabel(caseState.label, getCaseLabelByIndex(index));

                return (
                  <button
                    key={caseState.id}
                    type="button"
                    onClick={() => setActiveCaseId(caseState.id)}
                    disabled={isDrawing}
                    className={`mode-toggle random-case-button flex items-center justify-center rounded-[0.95rem] px-4 py-1.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 lg:text-[0.92rem] ${
                      resolvedActiveCaseId === caseState.id ? 'mode-toggle-active' : 'mode-toggle-inactive'
                    }`}
                    aria-pressed={resolvedActiveCaseId === caseState.id}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>

            <div className="paper-card random-summary-card shrink-0 rounded-[1.9rem] border-2 border-[#E6D5C9] p-4 shadow-sm">
              <div className="random-summary-row flex flex-wrap items-center justify-between gap-3">
                <h2 className="random-summary-title section-title text-lg font-bold text-[#8A6347] md:text-[1.35rem]">
                  {DRAWN_NUMBERS_LABEL}
                </h2>
                <div className="status-medallion random-summary-medallion inline-flex items-center justify-center rounded-full border-2 px-4 py-2 text-[clamp(1rem,1.55vw,1.28rem)] font-extrabold text-[#5C8D5D]">
                  {REMAINING_LABEL} {availableNumbers.length} / {totalCount}
                </div>
              </div>
            </div>

            <div className="paper-card random-history-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 border-[#E6D5C9] p-4 shadow-sm md:p-5">
              <div className="custom-scrollbar random-history-scroll flex-1 overflow-y-auto pr-1">
                {orderedVisibleHistoryEntries.length > 0 ? (
                  <div className="random-history-grid">
                    {orderedVisibleHistoryEntries.map((entry) => {
                      const isRepeatEntry = entry.kind === 'repeat';

                      return (
                        <span
                          key={entry.id}
                          ref={entry.kind === 'normal' ? (node) => setPickedBallRef(entry.id, node) : undefined}
                          className={`random-history-chip${
                            isRepeatEntry ? ' random-history-chip-repeat' : ''
                          }${
                            repeatFlight?.sourceEntryId === entry.id ? ' random-history-chip-launching' : ''
                          }`}
                        >
                          <span className="random-history-chip-number">{entry.number}</span>
                          {isRepeatEntry && <span className="random-history-chip-badge">x2</span>}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-slot-state flex h-full min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-[#E6D5C9] text-center font-medium text-[#8A6347]/60">
                    {EMPTY_HISTORY_LABEL}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-8">
          <div className="settings-dialog random-settings-shell flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.25rem] border-[5px] border-[#B58363] bg-[#FDFBF7] shadow-2xl">
            <div className="settings-header random-settings-header-panel flex shrink-0 items-start justify-between border-b border-[#E6D5C9] p-6 md:p-8">
              <div>
                <h2 className="section-title text-2xl font-extrabold text-[#3F2B20] md:text-[2.1rem]">{SETTINGS_LABEL}</h2>
                <p className="mt-2 text-base font-bold text-[#B58363] md:text-[1.08rem]">{SETTINGS_SUBTITLE}</p>
              </div>
              <button
                type="button"
                onClick={closeSettingsModal}
                className="random-settings-close-button icon-button rounded-full p-2 text-[#B58363] transition-colors hover:bg-[#F7F0E7] hover:text-[#8A6347]"
                aria-label={SETTINGS_CLOSE_LABEL}
              >
                <X size={32} className="md:h-9 md:w-9" />
              </button>
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6 lg:p-8">
              <div className="random-settings-layout grid gap-6 lg:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1fr)]">
                <section className="random-settings-sidebar rounded-[2rem] border border-[#EEE4D6] bg-[linear-gradient(180deg,rgba(255,253,248,0.96)_0%,rgba(248,241,232,0.9)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="section-title text-[1.65rem] font-extrabold text-[#3F2B20]">{CASE_LIST_LABEL}</h3>
                    <button
                      type="button"
                      onClick={addSettingsCase}
                      className="toolbar-button random-settings-add-button inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-bold text-white"
                    >
                      <Plus size={20} />
                      {ADD_CASE_LABEL}
                    </button>
                  </div>

                  <div className="random-settings-case-list mt-5">
                    {cases.map((caseState, index) => {
                      const isSelected = caseState.id === selectedSettingsCase.id;
                      const displayLabel = normalizeCaseLabel(caseState.label, getCaseLabelByIndex(index));

                      return (
                        <article
                          key={caseState.id}
                          className={`random-settings-case-card random-settings-case-card-v2 rounded-[1.9rem] border-2 p-4 ${
                            isSelected ? 'random-settings-case-card-active' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSettingsSelectedCaseId(caseState.id)}
                            className="random-settings-case-content block w-full pr-12 text-left"
                          >
                            <div className="text-[1.15rem] font-extrabold text-[#3F2B20] md:text-[1.25rem]">
                              {displayLabel}
                            </div>
                            <div className="mt-2 text-[1rem] font-bold text-[#B58363]">
                              {getCaseSummaryLabel(caseState)}
                            </div>
                          </button>

                          {cases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSettingsCase(caseState.id)}
                              className="random-settings-case-delete toolbar-button inline-flex h-11 w-11 items-center justify-center rounded-full text-[#B58363]"
                              aria-label={`${displayLabel} ${DELETE_CASE_LABEL}`}
                              title={`${displayLabel} ${DELETE_CASE_LABEL}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="random-settings-detail flex flex-col gap-5">
                  <div className="random-settings-detail-card rounded-[2rem] border border-[#EEE4D6] bg-[linear-gradient(180deg,rgba(255,254,251,0.98)_0%,rgba(249,243,234,0.94)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-6">
                    <div className="grid gap-5">
                      <label className="flex flex-col gap-2.5">
                        <span className="section-title text-lg font-bold text-[#B58363]">{CASE_NAME_LABEL}</span>
                        <input
                          type="text"
                          value={selectedSettingsCase.label}
                          onChange={(event) => updateSettingsCaseLabel(selectedSettingsCase.id, event.target.value)}
                          className="random-settings-text-input rounded-[1.35rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-6 py-5 text-[1.15rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                          placeholder={getCaseLabelByIndex(Math.max(selectedSettingsCaseIndex, 0))}
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-2.5">
                          <span className="section-title text-lg font-bold text-[#B58363]">{RANGE_START_NUMBER_LABEL}</span>
                          <input
                            type="number"
                            min={MIN_DRAW_NUMBER}
                            max={MAX_DRAW_NUMBER}
                            value={selectedSettingsCase.rangeStart}
                            onChange={(event) =>
                              updateSettingsCaseRange(
                                selectedSettingsCase.id,
                                'rangeStart',
                                event.target.value,
                                selectedSettingsCase.rangeStart,
                              )
                            }
                            className="random-settings-number-input rounded-[1.35rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-6 py-5 text-left font-mono text-[1.15rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                          />
                        </label>

                        <label className="flex flex-col gap-2.5">
                          <span className="section-title text-lg font-bold text-[#B58363]">{RANGE_END_NUMBER_LABEL}</span>
                          <input
                            type="number"
                            min={MIN_DRAW_NUMBER}
                            max={MAX_DRAW_NUMBER}
                            value={selectedSettingsCase.rangeEnd}
                            onChange={(event) =>
                              updateSettingsCaseRange(
                                selectedSettingsCase.id,
                                'rangeEnd',
                                event.target.value,
                                selectedSettingsCase.rangeEnd,
                              )
                            }
                            className="random-settings-number-input rounded-[1.35rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-6 py-5 text-left font-mono text-[1.15rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="random-settings-repeat-card rounded-[2rem] border border-[#EEE4D6] bg-[linear-gradient(180deg,rgba(255,253,248,0.98)_0%,rgba(247,241,232,0.94)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="max-w-xl">
                        <h3 className="section-title text-[1.45rem] font-extrabold text-[#3F2B20]">{REPEAT_PICK_LABEL}</h3>
                        <p className="mt-3 text-[1.02rem] font-bold leading-9 text-[#B58363]">{REPEAT_PICK_DESCRIPTION}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRepeatPickEnabled((previous) => !previous)}
                        className={`random-settings-toggle random-settings-toggle-large${
                          repeatPickEnabled ? ' random-settings-toggle-active' : ''
                        }`}
                        aria-pressed={repeatPickEnabled}
                        aria-label={REPEAT_PICK_LABEL}
                      >
                        <span className="random-settings-toggle-thumb" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
