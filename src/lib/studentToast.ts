export const STUDENT_TOAST_MIN_MS = 4000;
export const STUDENT_TOAST_MAX_MS = 8000;
const STUDENT_TOAST_MS_PER_CHARACTER = 60;

export type StudentToast = {
  readonly id: number;
  readonly message: string;
};

/** Longer results (bank due dates, loan repayments) stay up longer so third graders can finish reading. */
export const getStudentToastDurationMs = (message: string): number => Math.min(
  STUDENT_TOAST_MAX_MS,
  Math.max(STUDENT_TOAST_MIN_MS, Array.from(message.trim()).length * STUDENT_TOAST_MS_PER_CHARACTER + 2000),
);
