import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimWeeklyMissionRewardInSettings,
  findPersonalQuestionForWeek,
  getKoreanIsoWeekKey,
  parseQuestionStudentResponse,
  parseWeeklyMissionResult,
} from './weeklyMission';
import { hasPersonalQuestionSubmission } from './questionSubmissionStatus';

test('Korean ISO week key matches the question site contract', () => {
  assert.equal(getKoreanIsoWeekKey(new Date('2026-07-13T03:25:42.181Z')), '2026-29');
  assert.equal(getKoreanIsoWeekKey(new Date('2027-01-03T14:59:59.000Z')), '2026-53');
  assert.equal(getKoreanIsoWeekKey(new Date('2027-01-03T15:00:00.000Z')), '2027-01');
});

test('only a personal question from the requested student and week completes the mission', () => {
  const response = parseQuestionStudentResponse({
    history: [
      { id: 'topic', student_number: 6, question_type: 'topic', week_key: '2026-29' },
      { id: 'old', student_number: 6, question_type: 'personal', week_key: '2026-28' },
      { id: 'other', student_number: 7, question_type: 'personal', week_key: '2026-29' },
      { id: 'personal', student_number: 6, question_type: 'personal', week_key: '2026-29' },
    ],
  });

  assert.equal(findPersonalQuestionForWeek(response, 6, '2026-29')?.id, 'personal');
  assert.equal(findPersonalQuestionForWeek(response, 6, '2026-30'), null);
});

test('weekly mission response parser rejects incomplete server payloads', () => {
  assert.throws(() => parseWeeklyMissionResult({ completed: true }), /WEEKLY_MISSION_INVALID_RESPONSE/);
  assert.deepEqual(parseWeeklyMissionResult({
    missionType: 'personal_question',
    weekKey: '2026-29',
    completed: true,
    awarded: false,
    rewardAmount: 5,
    balance: 105,
  }), {
    missionType: 'personal_question',
    weekKey: '2026-29',
    completed: true,
    awarded: false,
    rewardAmount: 5,
    balance: 105,
  });
});

test('fallback weekly mission claim awards once per student and week', () => {
  const first = claimWeeklyMissionRewardInSettings({
    currencyBalances: { 6: 200 },
    currencyHistory: { 6: [] },
  }, 6, '2026-29', '2026-07-13T14:00:00.000Z');

  assert.equal(first.awarded, true);
  assert.equal(first.balance, 205);

  const second = claimWeeklyMissionRewardInSettings(
    first.value,
    6,
    '2026-29',
    '2026-07-13T14:01:00.000Z',
  );

  assert.equal(second.awarded, false);
  assert.equal(second.balance, 205);
  assert.deepEqual(second.value, first.value);
});

test('question status fallback clears only students with a personal submission', () => {
  const statuses = [
    { number: 6, personalSubmitted: true, topicSubmitted: true },
    { number: 7, personalSubmitted: false, topicSubmitted: true },
  ];

  assert.equal(hasPersonalQuestionSubmission(statuses, 6), true);
  assert.equal(hasPersonalQuestionSubmission(statuses, 7), false);
  assert.equal(hasPersonalQuestionSubmission(statuses, 9), false);
});
