import { appDataMode, canWriteSharedBackend } from './dataMode.js';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { getKoreanDateKey } from './classword.js';
import { getKoreanIsoWeekKey, parseWeeklyMissionResult, parseWeeklyMissionsResult } from './weeklyMission.js';

interface PendingMissionCheck { promise: Promise<unknown>; expiresAt: number }
const missionChecks = new Map<string, PendingMissionCheck>();
const FOREGROUND_COOLDOWN_MS = 5_000;
const getRetryAfterMs = (response: Response) => {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return FOREGROUND_COOLDOWN_MS;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(retryAfter) - Date.now();
  return Number.isFinite(delay) ? Math.max(FOREGROUND_COOLDOWN_MS, delay) : FOREGROUND_COOLDOWN_MS;
};

const settleWeeklyMission = async <T>(studentNumber: number, endpoint: '/api/weekly-mission' | '/api/weekly-missions', parse: (value: unknown) => T): Promise<T> => {
  if (!canWriteSharedBackend(appDataMode)) throw new Error('BACKEND_WRITE_DISABLED');
  const key = `${endpoint}:${studentNumber}:${getKoreanDateKey()}:${getKoreanIsoWeekKey()}`;
  const previous = missionChecks.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous.promise.then(parse);
  for (const [oldKey, check] of missionChecks) if (check.expiresAt <= Date.now()) missionChecks.delete(oldKey);
  const prefix = endpoint === '/api/weekly-mission' ? 'WEEKLY_MISSION' : 'WEEKLY_MISSIONS';
  const promise = withSaveFailureReporting('economy', async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ protocolVersion: 2, studentNumber }),
      });
      if (!response.ok) throw Object.assign(new Error(`${prefix}_HTTP_${response.status}`), { retryAfterMs: getRetryAfterMs(response) });
      return parse(await response.json());
    } catch (error) {
      if (error instanceof Error) Object.assign(error, { endpoint,
        retryAfterMs: Reflect.get(error, 'retryAfterMs') ?? FOREGROUND_COOLDOWN_MS,
        ...(error instanceof TypeError ? { code: `${prefix}_NETWORK` } : {}),
      });
      throw error;
    }
  }, studentNumber);
  const check: PendingMissionCheck = { promise, expiresAt: Infinity };
  missionChecks.set(key, check);
  void promise.then(() => { check.expiresAt = Date.now() + FOREGROUND_COOLDOWN_MS; }, error => {
    const delay: unknown = error instanceof Error ? Reflect.get(error, 'retryAfterMs') : undefined;
    check.expiresAt = Date.now() + (typeof delay === 'number' && Number.isFinite(delay) ? delay : FOREGROUND_COOLDOWN_MS);
  });
  return promise;
};

export const syncPersonalQuestionWeeklyMission = (studentNumber: number) => settleWeeklyMission(studentNumber, '/api/weekly-mission', parseWeeklyMissionResult);
export const syncWeeklyMissions = (studentNumber: number) => settleWeeklyMission(studentNumber, '/api/weekly-missions', parseWeeklyMissionsResult);
