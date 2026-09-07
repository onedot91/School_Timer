import { isReadOnlyDataMode } from './dataMode.js';
import { isSupabaseSettingsEnabled } from './supabaseConfig.js';
import { createBrowserRequestId } from './requestId.js';
import { classifySaveFailure, parseSaveFailureAlert, parseSaveFailureDiagnostics, SAVE_FAILURE_POLL_MS, type SaveFailureAlert, type SaveFailureCode, type SaveFailureFeature, type SaveFailureDiagnostics } from './saveFailure.js';
import { collectSaveFailureDiagnostics } from './saveFailureDiagnostics.js';

export const SAVE_FAILURE_STORAGE_KEY = 'school-timer-save-failures-v1';
export const SAVE_FAILURE_CHANGE_EVENT = 'school-timer-save-failure-change';
let memory: SaveFailureAlert[] = [];
let flushing = false;
let memoryDirty = false;
const currentActor = () => {
  try {
    const raw = window.localStorage.getItem('school-timer-entry-number-v1');
    const number = raw === null ? NaN : Number(raw);
    return Number.isInteger(number) && number >= 0 && number <= 23 ? number : null;
  } catch { return null; }
};
const readLocal = (): SaveFailureAlert[] => {
  if (typeof window === 'undefined') return memory;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    const stored = Array.isArray(value) ? value.flatMap((item) => { const parsed = parseSaveFailureAlert(item); return parsed ? [parsed] : []; }) : [];
    return memoryDirty ? [...new Map([...stored, ...memory].map((item) => [item.id, item])).values()] : stored;
  } catch { return memory; }
};
const writeLocal = (alerts: SaveFailureAlert[]) => {
  memory = alerts;
  try { window.localStorage.setItem(SAVE_FAILURE_STORAGE_KEY, JSON.stringify(alerts)); memoryDirty = false; } catch { memoryDirty = true; }
  window.dispatchEvent(new Event(SAVE_FAILURE_CHANGE_EVENT));
};

export const flushSaveFailureReports = async () => {
  if (typeof window === 'undefined' || !isSupabaseSettingsEnabled || isReadOnlyDataMode || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const alert of readLocal().filter((item) => item.acknowledgedAt === null && item.studentNumber === currentActor())) {
      try {
        const result = await fetch('/api/save-alerts', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert), signal: AbortSignal.timeout(8000),
        });
        if (!result.ok) break;
        writeLocal(readLocal().filter((item) => item.id !== alert.id));
      } catch { break; }
    }
  } finally { flushing = false; }
};

export const reportSaveFailure = (feature: SaveFailureFeature, code: SaveFailureCode, studentNumber?: number, details?: SaveFailureDiagnostics) => {
  if (typeof window === 'undefined' || isReadOnlyDataMode) return;
  try {
    const actor = studentNumber ?? currentActor();
    if (actor === null) return;
    const alerts = readLocal();
    const diagnostics = parseSaveFailureDiagnostics({ ...captureSaveFailureContext(), ...details });
    if (alerts.some((item) => item.studentNumber === actor && item.feature === feature && item.code === code && item.acknowledgedAt === null
      && item.diagnostics?.errorCode === diagnostics?.errorCode && item.diagnostics?.causeCode === diagnostics?.causeCode
      && item.diagnostics?.httpStatus === diagnostics?.httpStatus && item.diagnostics?.view === diagnostics?.view
      && item.diagnostics?.endpoint === diagnostics?.endpoint && item.diagnostics?.online === diagnostics?.online)) return;
    writeLocal([...alerts, { id: createBrowserRequestId(), studentNumber: actor, feature, code, occurredAt: new Date().toISOString(), acknowledgedAt: null, ...(diagnostics ? { diagnostics } : {}) }]);
    void flushSaveFailureReports();
  } catch { /* Error reporting must never interrupt the original save result. */ }
};

export const getSaveFailureFeature = (): SaveFailureFeature => {
  if (typeof window === 'undefined') return 'settings';
  const hash = window.location.hash;
  if (hash.includes('number-baseball')) return 'numberBaseball';
  if (hash.includes('sudoku')) return 'sudoku';
  if (hash.includes('emotion')) return 'emotion';
  if (hash.includes('auction')) return 'auction';
  if (hash.includes('library')) return 'library';
  if (hash.includes('donation')) return 'donation';
  if (hash.includes('store-bank') || hash.includes('store-shop')) return 'economy';
  if (hash.includes('classword')) return 'classword';
  if (hash.includes('today-friend')) return 'todayFriend';
  if (hash.includes('overview')) return 'pet';
  return hash.startsWith('#student') ? 'studentLife' : 'settings';
};

const captureSaveFailureContext = (): SaveFailureDiagnostics => {
  if (typeof window === 'undefined') return {};
  try {
    const hash = window.location?.hash ?? '';
    return parseSaveFailureDiagnostics({
      view: hash.startsWith('#student-') ? hash.slice('#student-'.length) : 'teacher',
      online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
    }) ?? {};
  } catch { return {}; }
};

export const withSaveFailureReporting = async <T>(feature: SaveFailureFeature, save: () => Promise<T>, studentNumber?: number): Promise<T> => {
  const context = captureSaveFailureContext();
  const actor = studentNumber ?? (typeof window === 'undefined' ? undefined : currentActor() ?? undefined);
  try { return await save(); }
  catch (error) {
    const code = classifySaveFailure(error);
    if (code) {
      try { reportSaveFailure(feature, code, actor, collectSaveFailureDiagnostics(error, {
        ...context, online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
      })); } catch { return Promise.reject(error); }
    }
    throw error;
  }
};

export const startSaveFailureReporting = () => {
  const flush = () => void flushSaveFailureReports();
  flush();
  window.addEventListener('online', flush);
  const interval = window.setInterval(flush, 15000);
  return () => { window.removeEventListener('online', flush); window.clearInterval(interval); };
};

export const loadSaveFailureAlerts = async (): Promise<{ alerts: SaveFailureAlert[]; hasMore: boolean }> => {
  if (!isSupabaseSettingsEnabled) return { alerts: readLocal().filter((item) => item.acknowledgedAt === null), hasMore: false };
  const response = await fetch('/api/save-alerts', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(SAVE_FAILURE_POLL_MS) });
  if (!response.ok) throw new Error('SAVE_ALERTS_UNAVAILABLE');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !Array.isArray(Reflect.get(value, 'alerts')) || typeof Reflect.get(value, 'hasMore') !== 'boolean') throw new Error('SAVE_ALERTS_INVALID_RESPONSE');
  const raw: unknown[] = Reflect.get(value, 'alerts');
  const alerts = raw.map(parseSaveFailureAlert);
  if (alerts.some((alert) => !alert)) throw new Error('SAVE_ALERTS_INVALID_RESPONSE');
  return { alerts: alerts.filter((alert): alert is SaveFailureAlert => alert !== null), hasMore: Reflect.get(value, 'hasMore') };
};

export const acknowledgeSaveFailure = async (alert: SaveFailureAlert) => {
  if (isReadOnlyDataMode) throw new Error('READ_ONLY_DATA_MODE');
  if (!isSupabaseSettingsEnabled) {
    writeLocal(readLocal().map((item) => item.id === alert.id ? { ...item, acknowledgedAt: new Date().toISOString() } : item));
    return;
  }
  const response = await fetch('/api/save-alerts', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'acknowledge', alert }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('SAVE_ALERT_ACKNOWLEDGE_FAILED');
};
