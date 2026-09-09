import { getStudentEmotionEntries, normalizeStudentEmotionHistory, type StudentEmotionEntry } from './studentEmotion.js';
import { studentEditRevisionKey } from './studentEditRevision.js';

export interface StudentEmotionConflictSnapshot {
  readonly studentNumber: number;
  readonly dateKey: string;
  readonly latestEntry: Readonly<StudentEmotionEntry> | null;
  readonly expectedRevisions: Readonly<Record<string, number>>;
}

export type StudentEmotionSaveConflict =
  | { readonly status: 'checking' | 'unavailable' | 'expired' }
  | { readonly status: 'ready'; readonly snapshot: StudentEmotionConflictSnapshot };

export const createStudentEmotionConflictSnapshot = (
  studentNumber: number,
  dateKey: string,
  history: unknown,
  revisions: Readonly<Record<string, number>>,
): StudentEmotionConflictSnapshot | null => {
  const key = studentEditRevisionKey(studentNumber, 'student.emotion.save');
  const revision = key ? revisions[key] : undefined;
  if (!key || !Number.isSafeInteger(revision) || revision === undefined || revision < 0) return null;
  const entry = getStudentEmotionEntries(normalizeStudentEmotionHistory(history), studentNumber)
    .find(item => item.dateKey === dateKey);
  return Object.freeze({ studentNumber, dateKey,
    latestEntry: entry ? Object.freeze({ ...entry }) : null,
    expectedRevisions: Object.freeze({ [key]: revision }),
  });
};
