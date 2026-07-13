import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getClasswordMissionEvidence,
  getKoreanWeekDateRange,
  parseClasswordMissionStatus,
} from './classwordWeeklyMission';

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

test('Classword response parser accepts only the requested student and week', () => {
  const parsed = parseClasswordMissionStatus({
    data: {
      studentNumber: 21,
      startDate: '2026-07-13',
      endDate: '2026-07-19',
      wordEntryDates: ['2026-07-13'],
      quizCorrectDates: ['2026-07-14'],
    },
  }, 21, '2026-07-13', '2026-07-19');

  assert.deepEqual(parsed.data.wordEntryDates, ['2026-07-13']);
  assert.throws(() => parseClasswordMissionStatus({
    data: { ...parsed.data, studentNumber: 22 },
  }, 21, '2026-07-13', '2026-07-19'), /CLASSWORD_MISSION_INVALID_RESPONSE/);
});

test('word entry completes after its day ends while a correct quiz completes immediately', () => {
  const status = parseClasswordMissionStatus({
    data: {
      studentNumber: 21,
      startDate: '2026-07-13',
      endDate: '2026-07-19',
      wordEntryDates: ['2026-07-13', '2026-07-12'],
      quizCorrectDates: ['2026-07-13'],
    },
  }, 21, '2026-07-13', '2026-07-19');

  assert.deepEqual(getClasswordMissionEvidence(status, '2026-07-13'), {
    wordEntryEventDate: null,
    quizCorrectEventDate: '2026-07-13',
  });
  assert.deepEqual(getClasswordMissionEvidence(status, '2026-07-14'), {
    wordEntryEventDate: '2026-07-13',
    quizCorrectEventDate: '2026-07-13',
  });
});
