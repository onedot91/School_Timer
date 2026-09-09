import { readStorageRevisions } from './storageResponseOrder.js';

export const studentEditRevisionKey = (studentNumber: number, action: string): string | null => {
  if (action === 'student.sudoku.save' || action === 'student.sudoku.complete') return `scope:studentSudoku:${studentNumber}`;
  if (action === 'student.emotion.save') return `scope:studentEmotionHistory:${studentNumber}`;
  if (['student.pet.name', 'student.pet.select', 'student.pet.move'].includes(action)) return `scope:studentPets:${studentNumber}`;
  return null;
};

export const captureStudentEditRevisions = (studentNumber: number, action: string): Record<string, number> | undefined => {
  const key = studentEditRevisionKey(studentNumber, action);
  if (!key) return undefined;
  const value = readStorageRevisions()[key];
  return value === undefined ? undefined : { [key]: value };
};
