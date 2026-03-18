import { useEffect, useRef, useState } from 'react';
import { Play, Plus, RotateCcw, Settings2, Trash2, X } from 'lucide-react';

interface RandomDrawCaseState {
  id: string;
  label: string;
  rangeStart: number;
  rangeEnd: number;
  currentResult: number | null;
  history: number[];
}

interface SavedRandomDrawState {
  activeCaseId: string;
  cases: RandomDrawCaseState[];
}

type PartialRandomDrawCaseState = Partial<RandomDrawCaseState> & {
  results?: unknown;
  history?: unknown;
};

const RANDOM_DRAW_STORAGE_KEY = 'school-random-draw-v1';
const MIN_DRAW_NUMBER = 1;
const MAX_DRAW_NUMBER = 999;
const MAX_HISTORY_LENGTH = 50;
const ENTER_HOLD_RESET_MS = 700;
const DEFAULT_PRIMARY_CASE_ID = 'case-a';
const DEFAULT_SECONDARY_CASE_ID = 'case-b';

const SETTINGS_LABEL = '\uC124\uC815';
const SETTINGS_CLOSE_LABEL = '\uC124\uC815 \uB2EB\uAE30';
const CASE_MANAGEMENT_LABEL = '\uC0C1\uD669 \uAD00\uB9AC';
const DRAWN_NUMBERS_LABEL = '\uBF51\uD78C \uBC88\uD638';
const REMAINING_LABEL = '\uB0A8\uC740';
const EMPTY_HISTORY_LABEL = '\uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.';
const RANGE_START_LABEL = '\uC2DC\uC791';
const RANGE_END_LABEL = '\uB05D';
const ADD_CASE_LABEL = '\uC0C1\uD669 \uCD94\uAC00';
const DELETE_CASE_LABEL = '\uC0C1\uD669 \uC0AD\uC81C';
const ACTIVE_CASE_LABEL = '\uC0AC\uC6A9 \uC911';

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

const normalizeHistoryNumbers = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  const normalized: number[] = [];

  value.forEach((entry) => {
    if (typeof entry === 'number') {
      normalized.push(clampInteger(entry, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER));
      return;
    }

    if (!entry || typeof entry !== 'object') return;

    const nextEntry = entry as { numbers?: unknown };
    if (!Array.isArray(nextEntry.numbers)) return;

    nextEntry.numbers.forEach((number) => {
      const normalizedNumber = normalizeResultNumber(number);
      if (normalizedNumber !== null) {
        normalized.push(normalizedNumber);
      }
    });
  });

  return Array.from(new Set(normalized)).slice(0, MAX_HISTORY_LENGTH);
};

const createCaseId = () => `case-${Math.random().toString(36).slice(2, 10)}`;

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
  history: [],
});

const createDefaultCasesState = (): RandomDrawCaseState[] => [
  createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID),
  createDefaultCaseState(getCaseLabelByIndex(1), DEFAULT_SECONDARY_CASE_ID),
];

const DEFAULT_RANDOM_DRAW_STATE: SavedRandomDrawState = {
  activeCaseId: DEFAULT_PRIMARY_CASE_ID,
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
    history: normalizeHistoryNumbers(parsed.history),
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
      };

    if (parsed.cases) {
      const normalizedCases = normalizeSavedCases(parsed.cases);
      const nextActiveCaseId =
        typeof parsed.activeCaseId === 'string' && normalizedCases.some((caseState) => caseState.id === parsed.activeCaseId)
          ? parsed.activeCaseId
          : normalizedCases[0].id;

      return {
        activeCaseId: nextActiveCaseId,
        cases: normalizedCases,
      };
    }

    const migratedPrimaryCase = normalizeCaseState(parsed, getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID);
    const normalizedCases = normalizeSavedCases(undefined, migratedPrimaryCase);

    return {
      activeCaseId: normalizedCases[0].id,
      cases: normalizedCases,
    };
  } catch {
    return DEFAULT_RANDOM_DRAW_STATE;
  }
};

const sampleOneNumber = (pool: number[]) => pool[Math.floor(Math.random() * pool.length)];

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

export default function RandomDrawPage() {
  const initialState = getInitialRandomDrawState();
  const [activeCaseId, setActiveCaseId] = useState(initialState.activeCaseId);
  const [cases, setCases] = useState<RandomDrawCaseState[]>(initialState.cases);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const hasMountedRef = useRef(false);
  const animationIntervalRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const enterHoldTimeoutRef = useRef<number | null>(null);
  const enterHoldTriggeredRef = useRef(false);
  const enterPressedRef = useRef(false);

  const activeCase =
    cases.find((caseState) => caseState.id === activeCaseId) ??
    cases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0), DEFAULT_PRIMARY_CASE_ID);
  const resolvedActiveCaseId = activeCase.id;
  const minNumber = Math.min(activeCase.rangeStart, activeCase.rangeEnd);
  const maxNumber = Math.max(activeCase.rangeStart, activeCase.rangeEnd);
  const totalCount = maxNumber - minNumber + 1;
  const displayHistory = activeCase.history.slice(0, MAX_HISTORY_LENGTH);
  const inRangeHistory = displayHistory.filter((number) => number >= minNumber && number <= maxNumber);
  const historySet = new Set(inRangeHistory);
  const availableNumbers = Array.from({ length: totalCount }, (_, index) => minNumber + index).filter(
    (number) => !historySet.has(number),
  );
  const stageValue =
    isDrawing ? String(rollingValue ?? '?') : activeCase.currentResult !== null ? String(activeCase.currentResult) : '?';
  const hasVisibleNumber = isDrawing || activeCase.currentResult !== null;
  const caseSignature = `${resolvedActiveCaseId}:${minNumber}:${maxNumber}`;

  const updateCaseState = (
    caseId: string,
    updater: (previousCase: RandomDrawCaseState) => RandomDrawCaseState,
  ) => {
    setCases((previousCases) =>
      previousCases.map((caseState) => (caseState.id === caseId ? updater(caseState) : caseState)),
    );
  };

  const clearAnimationTimers = () => {
    if (animationIntervalRef.current !== null) {
      window.clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  const stopDrawing = () => {
    clearAnimationTimers();
    setIsDrawing(false);
    setRollingValue(null);
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

  useEffect(() => {
    if (activeCaseId === resolvedActiveCaseId) return;
    setActiveCaseId(resolvedActiveCaseId);
  }, [activeCaseId, resolvedActiveCaseId]);

  useEffect(() => {
    const persistedCases = cases.map((caseState) => ({
      ...caseState,
      history: caseState.history.slice(0, MAX_HISTORY_LENGTH),
    }));

    window.localStorage.setItem(
      RANDOM_DRAW_STORAGE_KEY,
      JSON.stringify({
        activeCaseId: resolvedActiveCaseId,
        cases: persistedCases,
      }),
    );
  }, [cases, resolvedActiveCaseId]);

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
    if (availableNumbers.length === 0) return;

    const targetCaseId = resolvedActiveCaseId;
    const drawPool = [...availableNumbers];

    clearAnimationTimers();
    setIsDrawing(true);

    const updateRollingValue = () => {
      setRollingValue(sampleOneNumber(drawPool));
    };

    updateRollingValue();
    animationIntervalRef.current = window.setInterval(updateRollingValue, 92);

    animationTimeoutRef.current = window.setTimeout(() => {
      clearAnimationTimers();

      const finalNumber = sampleOneNumber(drawPool);
      setRollingValue(finalNumber);
      updateCaseState(targetCaseId, (previousCase) => ({
        ...previousCase,
        currentResult: finalNumber,
        history: [finalNumber, ...previousCase.history.filter((number) => number !== finalNumber)].slice(
          0,
          MAX_HISTORY_LENGTH,
        ),
      }));
      setIsDrawing(false);
    }, 2200);
  };

  const resetDrawBag = () => {
    const targetCaseId = resolvedActiveCaseId;

    stopDrawing();
    updateCaseState(targetCaseId, (previousCase) => ({
      ...previousCase,
      currentResult: null,
      history: [],
    }));
  };

  const addCase = () => {
    const nextCase = createDefaultCaseState(createUniqueCaseLabel(cases));

    stopDrawing();
    setCases((previousCases) => [...previousCases, nextCase]);
    setActiveCaseId(nextCase.id);
  };

  const removeCase = (caseId: string) => {
    if (cases.length <= 1) return;

    const caseIndex = cases.findIndex((caseState) => caseState.id === caseId);
    const nextCases = cases.filter((caseState) => caseState.id !== caseId);
    const fallbackCase = nextCases[Math.min(caseIndex, nextCases.length - 1)] ?? nextCases[0];

    stopDrawing();
    setCases(nextCases);

    if (resolvedActiveCaseId === caseId && fallbackCase) {
      setActiveCaseId(fallbackCase.id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isSettingsOpen || isEditableTarget(event.target)) return;
      if (enterPressedRef.current || event.repeat) return;

      event.preventDefault();
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
  }, [availableNumbers, isSettingsOpen, resolvedActiveCaseId]);

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <div className="mascot-shell app-tone-calm relative flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] shadow-2xl md:rounded-[3rem]">
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_29rem] xl:grid-cols-[minmax(0,1fr)_32rem] 2xl:grid-cols-[minmax(0,1fr)_34rem]">
          <section className="timer-pane relative flex h-full min-h-0 flex-col items-center p-5 md:p-8 lg:px-8 lg:py-10 xl:px-10 xl:py-12">
            <div className="random-stage-toolbar mb-2 w-full shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="random-settings-button icon-button rounded-full p-3 text-[#8A6347]/70 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347]"
                title={SETTINGS_LABEL}
                aria-label={SETTINGS_LABEL}
              >
                <Settings2 size={22} />
              </button>

              <div className="mode-switch random-case-switch flex shrink-0 rounded-2xl p-1.5">
                {cases.map((caseState) => (
                  <button
                    key={caseState.id}
                    type="button"
                    onClick={() => setActiveCaseId(caseState.id)}
                    className={`mode-toggle random-case-button flex items-center justify-center rounded-[1.1rem] px-5 py-3 text-sm font-bold transition-all lg:text-base ${
                      resolvedActiveCaseId === caseState.id ? 'mode-toggle-active' : 'mode-toggle-inactive'
                    }`}
                    aria-pressed={resolvedActiveCaseId === caseState.id}
                  >
                    {caseState.label}
                  </button>
                ))}
              </div>

              <div aria-hidden="true" className="random-stage-toolbar-spacer" />
            </div>

            <div className="random-stage-shell flex min-h-0 w-full flex-1 flex-col items-center justify-center">
              <div className="random-board-stage relative flex min-h-0 w-full flex-1 items-center justify-center">
                <div className={`random-board ${isDrawing ? 'random-board-drawing' : ''}`}>
                  <span
                    className={`random-board-number${hasVisibleNumber ? ' random-board-number-active' : ''}`}
                  >
                    {stageValue}
                  </span>
                </div>
              </div>

              <div className="random-stage-actions flex shrink-0 items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={startDraw}
                  disabled={isDrawing || availableNumbers.length === 0}
                  className="round-action round-action-play random-action-button flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:h-32 lg:w-32"
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

          <aside className="control-pane random-control-pane relative flex min-h-0 w-full flex-col gap-6 overflow-hidden border-t border-[#E6D5C9]/50 p-5 sm:p-6 lg:w-auto lg:border-l lg:border-t-0 lg:px-8 lg:py-9 xl:px-10 xl:py-10">
            <div className="paper-card random-summary-card shrink-0 rounded-3xl border-2 border-[#E6D5C9] p-5 shadow-sm">
              <div className="random-case-label random-case-pill">{activeCase.label}</div>
              <h2 className="section-title mt-4 text-xl font-bold text-[#8A6347] md:text-2xl">{DRAWN_NUMBERS_LABEL}</h2>
              <div className="mt-4">
                <div className="status-medallion inline-flex items-center justify-center rounded-full border-2 px-5 py-3 text-[clamp(1.2rem,2.2vw,1.6rem)] font-extrabold text-[#5C8D5D]">
                  {REMAINING_LABEL} {availableNumbers.length} / {totalCount}
                </div>
              </div>
            </div>

            <div className="paper-card random-history-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 border-[#E6D5C9] p-4 shadow-sm md:p-5">
              <div className="custom-scrollbar random-history-scroll flex-1 overflow-y-auto pr-1">
                {displayHistory.length > 0 ? (
                  <div className="random-history-grid">
                    {displayHistory.map((number) => (
                      <span key={`${resolvedActiveCaseId}-drawn-${number}`} className="random-history-chip">
                        {number}
                      </span>
                    ))}
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
          <div className="settings-dialog flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border-4 border-[#E6D5C9] bg-[#FDFBF7] shadow-2xl">
            <div className="settings-header flex shrink-0 items-center justify-between border-b border-[#E6D5C9] bg-white p-5 md:p-6">
              <h2 className="section-title flex items-center gap-2 text-xl font-bold text-[#8A6347] md:text-2xl">
                <Settings2 size={24} className="md:h-7 md:w-7" />
                {SETTINGS_LABEL}
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="icon-button rounded-full p-2 text-[#8A6347]/60 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347]"
                aria-label={SETTINGS_CLOSE_LABEL}
              >
                <X size={24} className="md:h-7 md:w-7" />
              </button>
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
              <div className="paper-card rounded-3xl border-2 border-[#E6D5C9] p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="section-title text-lg font-bold text-[#8A6347]">{CASE_MANAGEMENT_LABEL}</h3>
                  <button
                    type="button"
                    onClick={addCase}
                    className="toolbar-button toolbar-button-green inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-[#466146]"
                  >
                    <Plus size={18} />
                    {ADD_CASE_LABEL}
                  </button>
                </div>

                <div className="random-settings-case-list mt-4">
                  {cases.map((caseState) => {
                    const isActive = caseState.id === resolvedActiveCaseId;

                    return (
                      <article
                        key={caseState.id}
                        className={`random-settings-case-card rounded-3xl border-2 p-4 ${
                          isActive ? 'random-settings-case-card-active' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setActiveCaseId(caseState.id)}
                            className={`random-settings-case-select inline-flex items-center gap-2 rounded-full px-4 py-2 text-left text-base font-bold transition-colors ${
                              isActive ? 'random-settings-case-select-active' : 'random-settings-case-select-inactive'
                            }`}
                          >
                            <span>{caseState.label}</span>
                            {isActive && <span className="random-settings-case-badge">{ACTIVE_CASE_LABEL}</span>}
                          </button>

                          {cases.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeCase(caseState.id)}
                              className="toolbar-button inline-flex h-11 w-11 items-center justify-center rounded-full text-[#B55E4C]"
                              aria-label={`${caseState.label} ${DELETE_CASE_LABEL}`}
                              title={`${caseState.label} ${DELETE_CASE_LABEL}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          ) : (
                            <div className="h-11 w-11" />
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="section-title text-base font-bold text-[#8A6347]">{RANGE_START_LABEL}</span>
                            <input
                              type="number"
                              min={MIN_DRAW_NUMBER}
                              max={MAX_DRAW_NUMBER}
                              value={caseState.rangeStart}
                              onChange={(event) =>
                                updateCaseState(caseState.id, (previousCase) => ({
                                  ...previousCase,
                                  rangeStart: clampInteger(
                                    event.target.value,
                                    previousCase.rangeStart,
                                    MIN_DRAW_NUMBER,
                                    MAX_DRAW_NUMBER,
                                  ),
                                }))
                              }
                              className="slot-time-input rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-4 py-3 text-center font-mono text-xl font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363]"
                            />
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="section-title text-base font-bold text-[#8A6347]">{RANGE_END_LABEL}</span>
                            <input
                              type="number"
                              min={MIN_DRAW_NUMBER}
                              max={MAX_DRAW_NUMBER}
                              value={caseState.rangeEnd}
                              onChange={(event) =>
                                updateCaseState(caseState.id, (previousCase) => ({
                                  ...previousCase,
                                  rangeEnd: clampInteger(
                                    event.target.value,
                                    previousCase.rangeEnd,
                                    MIN_DRAW_NUMBER,
                                    MAX_DRAW_NUMBER,
                                  ),
                                }))
                              }
                              className="slot-time-input rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-4 py-3 text-center font-mono text-xl font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363]"
                            />
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
