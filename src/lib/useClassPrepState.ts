import { useEffect, useMemo, useState } from 'react';
import { CLASS_PREP_IDLE, getClassPrepState, type ClassPrepState } from './classPrep';

export interface ClassPrepSource {
  readonly weeklySchedule: unknown;
  readonly weeklySubjects: unknown;
  readonly clockOffsetSeconds: unknown;
  readonly release: unknown;
}

const TICK_MS = 1000;

/** Re-evaluates the class prep stage every second while a schedule is known. */
export const useClassPrepState = (source: ClassPrepSource | null): ClassPrepState => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasSchedule = source !== null && source.weeklySchedule !== null && source.weeklySchedule !== undefined;

  useEffect(() => {
    if (!hasSchedule) return undefined;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [hasSchedule]);

  return useMemo(() => (
    hasSchedule && source
      ? getClassPrepState({
        nowMs,
        clockOffsetSeconds: source.clockOffsetSeconds,
        weeklySchedule: source.weeklySchedule,
        weeklySubjects: source.weeklySubjects,
        release: source.release,
      })
      : CLASS_PREP_IDLE
  ), [hasSchedule, nowMs, source]);
};
