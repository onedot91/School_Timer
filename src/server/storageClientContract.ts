export const requiresStudentEditRevisions = (): boolean => {
  if (process.env.STORAGE_REQUIRE_EDIT_REVISIONS === '0') return false;
  return process.env.STORAGE_REQUIRE_EDIT_REVISIONS === '1' || process.env.VERCEL_ENV === 'production';
};
