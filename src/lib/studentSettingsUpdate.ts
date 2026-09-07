export const STUDENT_MUTABLE_MAP_FIELDS = [
  'currencyBalances',
  'currencyHistory',
  'studentEmotionHistory',
  'studentPets',
] as const;

export const STUDENT_MUTABLE_PROGRESS_FIELDS = ['studentSudoku', 'studentNumberBaseball'] as const;
export const STUDENT_MUTABLE_SHARED_FIELDS = ['auctionBids', 'auctionBidHistory', 'studentLife'] as const;

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
);

export const createStudentSettingsUpdate = (
  currentValue: unknown,
  nextValue: unknown,
  studentNumber: number,
): { value: Record<string, unknown>; patch: Record<string, unknown> } => {
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) {
    throw new Error('INVALID_STUDENT_NUMBER');
  }
  if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
    throw new Error('INVALID_STUDENT_SETTINGS_UPDATE');
  }
  const current = asRecord(currentValue);
  const next = asRecord(nextValue);
  const studentKey = String(studentNumber);
  const patch: Record<string, unknown> = {};
  const value = { ...current };

  for (const field of STUDENT_MUTABLE_SHARED_FIELDS) {
    if (next[field] === undefined) continue;
    patch[field] = next[field];
    value[field] = next[field];
  }
  for (const field of STUDENT_MUTABLE_MAP_FIELDS) {
    const ownValue = asRecord(next[field])[studentKey];
    if (ownValue === undefined) continue;
    patch[field] = { [studentKey]: ownValue };
    value[field] = { ...asRecord(current[field]), [studentKey]: ownValue };
  }
  for (const field of STUDENT_MUTABLE_PROGRESS_FIELDS) {
    if (next[field] === undefined) continue;
    const ownEntries = Object.fromEntries(Object.entries(asRecord(next[field]))
      .filter(([key]) => key.startsWith(`${studentKey}:`)));
    // Progress maps are shared in GET and replaced in PUT; retain untouched entries verbatim.
    patch[field] = { ...asRecord(current[field]), ...ownEntries };
    value[field] = patch[field];
  }
  return { value, patch };
};
