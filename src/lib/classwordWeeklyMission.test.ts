import assert from 'node:assert/strict';
import test from 'node:test';
import { getKoreanWeekDateRange } from './classwordWeeklyMission';

test('Korean week range starts on Monday and ends on Sunday', () => {
  assert.deepEqual(getKoreanWeekDateRange(new Date('2026-07-13T14:59:00.000Z')), {
    startDate: '2026-07-13',
    endDate: '2026-07-19',
    today: '2026-07-13',
  });
  assert.deepEqual(getKoreanWeekDateRange(new Date('2026-07-19T15:01:00.000Z')), {
    startDate: '2026-07-20',
    endDate: '2026-07-26',
    today: '2026-07-20',
  });
});
