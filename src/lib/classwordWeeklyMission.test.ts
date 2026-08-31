import assert from 'node:assert/strict';
import test from 'node:test';
import { getKoreanWeekDateRange, getPreviousKoreanDateKey } from './classwordWeeklyMission';

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

test('한국 날짜가 바뀌면 직전 마감일을 월·연 경계에서도 정확히 계산한다', () => {
  assert.equal(getPreviousKoreanDateKey(new Date('2026-09-01T00:01:00+09:00')), '2026-08-31');
  assert.equal(getPreviousKoreanDateKey(new Date('2027-01-01T00:01:00+09:00')), '2026-12-31');
});
