import { isSupabaseSettingsEnabled } from './supabaseConfig.js';
import { createLocalTeacherLoanReport, parseTeacherLoanReport, TeacherLoanHistoryError, type TeacherLoanReport } from './teacherLoanHistory.js';
import type { StudentEconomyStates } from './studentEconomy.js';

export const loadTeacherLoanHistory = async (states: StudentEconomyStates, signal: AbortSignal): Promise<TeacherLoanReport> => {
  if (!isSupabaseSettingsEnabled) return createLocalTeacherLoanReport(states);
  const response = await fetch('/api/student-economy?history=loans', {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  });
  if (!response.ok) throw new TeacherLoanHistoryError();
  return parseTeacherLoanReport(await response.json());
};
