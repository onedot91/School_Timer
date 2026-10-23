import { CURRENCY_BALANCE_MAX } from './currency.js';

export type TeacherCurrencyTarget = 'student' | 'group' | 'all';

export interface TeacherCurrencyClickBatch {
  readonly target: TeacherCurrencyTarget;
  /** Identifies the selected students so a changed selection never joins an earlier batch. */
  readonly key: string;
  readonly studentNumbers: readonly number[];
  readonly delta: number;
  /** performance.now() of the batch's first click, for save timing. */
  readonly clickedAt?: number;
}

export interface PendingTeacherCurrencyAdjustment {
  readonly requestId: string;
  readonly target: TeacherCurrencyTarget;
  readonly key: string;
  readonly delta: number;
}

/** Clicks within this quiet period are saved as one request. */
export const TEACHER_CURRENCY_BATCH_DELAY_MS = 700;

const clampDelta = (delta: number): number => Math.max(-CURRENCY_BALANCE_MAX, Math.min(CURRENCY_BALANCE_MAX, delta));

export const addTeacherCurrencyClick = (
  batch: TeacherCurrencyClickBatch | null,
  click: TeacherCurrencyClickBatch,
): { readonly batch: TeacherCurrencyClickBatch; readonly flush: TeacherCurrencyClickBatch | null } => (
  batch && batch.target === click.target && batch.key === click.key
    ? { batch: { ...batch, delta: clampDelta(batch.delta + click.delta), clickedAt: batch.clickedAt ?? click.clickedAt }, flush: null }
    : { batch: { ...click, delta: clampDelta(click.delta) }, flush: batch && batch.delta !== 0 ? batch : null }
);

/** Unsaved clicks plus requests still waiting for the server; never part of a confirmed balance. */
export const pendingTeacherCurrencyDelta = (
  batch: TeacherCurrencyClickBatch | null,
  pending: readonly PendingTeacherCurrencyAdjustment[],
  target: TeacherCurrencyTarget,
  key: string,
): number => pending.reduce((total, entry) => (entry.target === target && entry.key === key ? total + entry.delta : total), 0)
  + (batch?.target === target && batch.key === key ? batch.delta : 0);
