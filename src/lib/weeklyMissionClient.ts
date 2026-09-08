import { appDataMode, canWriteSharedBackend } from './dataMode.js';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { parseWeeklyMissionResult, parseWeeklyMissionsResult } from './weeklyMission.js';

const settleWeeklyMission = async <T>(studentNumber: number, endpoint: '/api/weekly-mission' | '/api/weekly-missions', parse: (value: unknown) => T): Promise<T> => {
  if (!canWriteSharedBackend(appDataMode)) throw new Error('BACKEND_WRITE_DISABLED');
  const prefix = endpoint === '/api/weekly-mission' ? 'WEEKLY_MISSION' : 'WEEKLY_MISSIONS';
  return withSaveFailureReporting('economy', async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ protocolVersion: 2, studentNumber }),
      });
      if (!response.ok) throw new Error(`${prefix}_HTTP_${response.status}`);
      return parse(await response.json());
    } catch (error) {
      if (error instanceof Error) Object.assign(error, { endpoint,
        ...(error instanceof TypeError ? { code: `${prefix}_NETWORK` } : {}),
      });
      throw error;
    }
  }, studentNumber);
};

export const syncPersonalQuestionWeeklyMission = (studentNumber: number) => settleWeeklyMission(studentNumber, '/api/weekly-mission', parseWeeklyMissionResult);
export const syncWeeklyMissions = (studentNumber: number) => settleWeeklyMission(studentNumber, '/api/weekly-missions', parseWeeklyMissionsResult);
