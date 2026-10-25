import { useEffect, useRef, useState } from 'react';

export const STUDENT_BALANCE_COUNT_MS = 420;
export const STUDENT_BALANCE_CHANGE_VISIBLE_MS = 1800;

export type StudentBalanceChange = {
  readonly id: number;
  readonly delta: number;
};

/** Ease-out count from the previous balance to the new one; always lands exactly on `to`. */
export const interpolateStudentBalance = (from: number, to: number, progress: number): number => {
  if (progress >= 1) return to;
  const eased = 1 - (1 - Math.max(0, progress)) ** 3;
  return Math.round(from + (to - from) * eased);
};

const prefersReducedMotion = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Follows a displayed balance that the page only updates after a save or refresh is confirmed.
 * The first value after mount or loading is shown as is; later changes count to the new value and expose a short-lived delta.
 */
export const useStudentBalanceChange = (value: number, isLoading: boolean) => {
  const [displayedValue, setDisplayedValue] = useState(value);
  const [change, setChange] = useState<StudentBalanceChange | null>(null);
  const previousRef = useRef<number | null>(null);
  const displayedRef = useRef(value);
  const changeIdRef = useRef(0);

  useEffect(() => {
    if (isLoading) {
      previousRef.current = null;
      return undefined;
    }
    const previous = previousRef.current;
    previousRef.current = value;
    if (previous === null || previous === value) {
      displayedRef.current = value;
      setDisplayedValue(value);
      return undefined;
    }

    changeIdRef.current += 1;
    const id = changeIdRef.current;
    setChange({ id, delta: value - previous });
    const hideTimer = window.setTimeout(() => {
      setChange((current) => (current?.id === id ? null : current));
    }, STUDENT_BALANCE_CHANGE_VISIBLE_MS);

    const from = displayedRef.current;
    const land = () => {
      displayedRef.current = value;
      setDisplayedValue(value);
    };
    if (prefersReducedMotion()) {
      land();
      return () => window.clearTimeout(hideTimer);
    }
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = interpolateStudentBalance(from, value, (now - startedAt) / STUDENT_BALANCE_COUNT_MS);
      displayedRef.current = next;
      setDisplayedValue(next);
      if (next !== value) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    // Paused frames (background tab) must still land on the confirmed balance.
    const landTimer = window.setTimeout(land, STUDENT_BALANCE_COUNT_MS + 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(landTimer);
      window.clearTimeout(hideTimer);
      land();
    };
  }, [value, isLoading]);

  return { displayedValue: isLoading ? value : displayedValue, change: isLoading ? null : change };
};
