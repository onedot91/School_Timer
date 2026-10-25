export const STUDENT_TOAST_MIN_MS = 4000;
export const STUDENT_TOAST_MAX_MS = 8000;
const STUDENT_TOAST_MS_PER_CHARACTER = 60;
/** A rejection tells the student what to do differently, so it stays a little longer than a success. */
const STUDENT_WARNING_TOAST_EXTRA_MS = 1500;

export type StudentToastTone = 'success' | 'warning';

export type StudentToast = {
  readonly id: number;
  readonly message: string;
  readonly tone: StudentToastTone;
};

/** Longer results (bank due dates, loan repayments) stay up longer so third graders can finish reading. */
export const getStudentToastDurationMs = (message: string, tone: StudentToastTone = 'success'): number => Math.min(
  STUDENT_TOAST_MAX_MS,
  Math.max(STUDENT_TOAST_MIN_MS, Array.from(message.trim()).length * STUDENT_TOAST_MS_PER_CHARACTER + 2000)
    + (tone === 'warning' ? STUDENT_WARNING_TOAST_EXTRA_MS : 0),
);
