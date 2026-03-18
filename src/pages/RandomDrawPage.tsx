import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Settings2, X } from 'lucide-react';

interface SavedRandomDrawState {
  rangeStart: number;
  rangeEnd: number;
  currentResult: number | null;
  history: number[];
}

const RANDOM_DRAW_STORAGE_KEY = 'school-random-draw-v1';
const DEFAULT_RANDOM_DRAW_STATE: SavedRandomDrawState = {
  rangeStart: 1,
  rangeEnd: 20,
  currentResult: null,
  history: [],
};
const MIN_DRAW_NUMBER = 1;
const MAX_DRAW_NUMBER = 999;
const MAX_HISTORY_LENGTH = 50;
const ENTER_HOLD_RESET_MS = 700;

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

const getInitialRandomDrawState = (): SavedRandomDrawState => {
  if (typeof window === 'undefined') return DEFAULT_RANDOM_DRAW_STATE;

  try {
    const saved = window.localStorage.getItem(RANDOM_DRAW_STORAGE_KEY);
    if (!saved) return DEFAULT_RANDOM_DRAW_STATE;

    const parsed = JSON.parse(saved) as Partial<SavedRandomDrawState> & {
      results?: unknown;
      history?: unknown;
    };
    const currentResult =
      normalizeResultNumber(parsed.currentResult) ??
      (Array.isArray(parsed.results) ? normalizeResultNumber(parsed.results[0]) : null);

    return {
      rangeStart: clampInteger(parsed.rangeStart, 1, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
      rangeEnd: clampInteger(parsed.rangeEnd, 20, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
      currentResult,
      history: normalizeHistoryNumbers(parsed.history),
    };
  } catch {
    return DEFAULT_RANDOM_DRAW_STATE;
  }
};

const sampleOneNumber = (pool: number[]) => pool[Math.floor(Math.random() * pool.length)];

export default function RandomDrawPage() {
  const initialState = getInitialRandomDrawState();
  const [rangeStart, setRangeStart] = useState(initialState.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(initialState.rangeEnd);
  const [currentResult, setCurrentResult] = useState<number | null>(initialState.currentResult);
  const [history, setHistory] = useState<number[]>(initialState.history);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const hasMountedRef = useRef(false);
  const animationIntervalRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const enterHoldTimeoutRef = useRef<number | null>(null);
  const enterHoldTriggeredRef = useRef(false);
  const enterPressedRef = useRef(false);

  const minNumber = Math.min(rangeStart, rangeEnd);
  const maxNumber = Math.max(rangeStart, rangeEnd);
  const totalCount = maxNumber - minNumber + 1;
  const validHistory = history
    .filter((number) => number >= minNumber && number <= maxNumber)
    .slice(0, MAX_HISTORY_LENGTH);
  const historySet = new Set(validHistory);
  const availableNumbers = Array.from({ length: totalCount }, (_, index) => minNumber + index).filter(
    (number) => !historySet.has(number),
  );
  const stageValue = isDrawing ? String(rollingValue ?? '?') : currentResult !== null ? String(currentResult) : '?';
  const hasVisibleNumber = isDrawing || currentResult !== null;
  const rangeSignature = `${minNumber}:${maxNumber}`;

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
    window.localStorage.setItem(
      RANDOM_DRAW_STORAGE_KEY,
      JSON.stringify({
        rangeStart,
        rangeEnd,
        currentResult,
        history: validHistory,
      }),
    );
  }, [currentResult, rangeEnd, rangeStart, validHistory]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    clearAnimationTimers();
    setCurrentResult(null);
    setRollingValue(null);
    setHistory([]);
  }, [rangeSignature]);

  useEffect(() => {
    return () => {
      clearAnimationTimers();
      clearEnterHoldTimer();
    };
  }, []);

  const startDraw = () => {
    if (availableNumbers.length === 0) return;

    clearAnimationTimers();
    setIsDrawing(true);

    const updateRollingValue = () => {
      setRollingValue(sampleOneNumber(availableNumbers));
    };

    updateRollingValue();
    animationIntervalRef.current = window.setInterval(updateRollingValue, 92);

    animationTimeoutRef.current = window.setTimeout(() => {
      clearAnimationTimers();

      const finalNumber = sampleOneNumber(availableNumbers);
      setRollingValue(finalNumber);
      setCurrentResult(finalNumber);
      setHistory((previous) =>
        [finalNumber, ...previous.filter((number) => number !== finalNumber)].slice(0, MAX_HISTORY_LENGTH),
      );
      setIsDrawing(false);
    }, 2200);
  };

  const resetDrawBag = () => {
    clearAnimationTimers();
    setIsDrawing(false);
    setRollingValue(null);
    setCurrentResult(null);
    setHistory([]);
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
  }, [isSettingsOpen]);

  return (
    <div className="draw-simple-page h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <div className="draw-simple-shell relative mx-auto flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]">
        <div className="random-shell-grid grid h-full min-h-0 flex-1 gap-4 p-4 pt-18 sm:p-5 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-4 lg:p-6 lg:pt-20">
          <section className="random-stage-panel flex min-h-0 flex-col">
            <div className="random-stage-toolbar flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="random-tool-button"
                aria-label="설정 열기"
                title="설정 열기"
              >
                <Settings2 size={22} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-4 lg:px-6 lg:py-5">
              <div className={`random-stage-circle ${isDrawing ? 'random-stage-circle-drawing' : ''}`}>
                <div
                  className={`random-stage-circle-value${hasVisibleNumber ? ' random-stage-circle-value-active' : ''}`}
                >
                  {stageValue}
                </div>
              </div>
            </div>

            <div className="random-stage-actions flex items-center justify-center gap-3 pb-1">
              <button
                type="button"
                onClick={startDraw}
                disabled={isDrawing || availableNumbers.length === 0}
                className="random-primary-action"
              >
                <Play size={24} className="ml-1" fill="currentColor" />
                <span>{isDrawing ? '추첨 중' : '뽑기!'}</span>
              </button>
              <button type="button" onClick={resetDrawBag} className="random-secondary-action">
                <RotateCcw size={22} />
                <span>초기화</span>
              </button>
            </div>
          </section>

          <aside className="random-side-panel flex min-h-0 flex-col">
            <div className="random-side-header">
              <h1 className="random-side-title">뽑힌 번호</h1>
              <p className="random-side-summary">
                남은 {availableNumbers.length} / {totalCount}
              </p>
            </div>

            <div className="random-side-divider" />

            <div className="random-side-content random-scroll flex-1 overflow-auto">
              {validHistory.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {validHistory.map((number) => (
                    <span key={`drawn-${number}`} className="random-picked-chip">
                      {number}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="random-empty-state">없음</div>
              )}
            </div>
          </aside>
        </div>

        {isSettingsOpen && (
          <div className="random-settings-overlay">
            <div className="random-settings-dialog">
              <div className="random-settings-dialog-header">
                <div>
                  <h2 className="text-xl font-bold text-[#6F5138]">범위 설정</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="random-settings-close"
                  aria-label="설정 닫기"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="random-settings-grid">
                <label className="random-field">
                  <span>시작</span>
                  <input
                    type="number"
                    min={MIN_DRAW_NUMBER}
                    max={MAX_DRAW_NUMBER}
                    value={rangeStart}
                    onChange={(event) =>
                      setRangeStart(
                        clampInteger(event.target.value, rangeStart, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
                      )
                    }
                  />
                </label>

                <label className="random-field">
                  <span>끝</span>
                  <input
                    type="number"
                    min={MIN_DRAW_NUMBER}
                    max={MAX_DRAW_NUMBER}
                    value={rangeEnd}
                    onChange={(event) =>
                      setRangeEnd(
                        clampInteger(event.target.value, rangeEnd, MIN_DRAW_NUMBER, MAX_DRAW_NUMBER),
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
