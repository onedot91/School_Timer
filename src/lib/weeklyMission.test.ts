import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  claimWeeklyMissionRewardInSettings,
  findPersonalQuestionForWeek,
  getKoreanIsoWeekKey,
  hasWeeklyMissionReward,
  getWeeklyMissionRewardIds,
  getAuctionAwardKeys,
  mergeConcurrentCurrencyUpdatesIntoSettings,
  parseQuestionStudentResponse,
  parseWeeklyMissionResult,
} from './weeklyMission';
import { hasPersonalQuestionSubmission } from './questionSubmissionStatus';
import { finalizeAuctionAwardInSettings } from './currency';

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

test('fallback weekly mission claim awards once per student, week, and mission type', () => {
  const first = claimWeeklyMissionRewardInSettings({
    currencyBalances: { 6: 200 },
    currencyHistory: { 6: [] },
  }, 6, '2026-29', 'personal_question', '2026-07-13T14:00:00.000Z');

  assert.equal(first.awarded, true);
  assert.equal(first.balance, 205);

  const second = claimWeeklyMissionRewardInSettings(
    first.value,
    6,
    '2026-29',
    'personal_question',
    '2026-07-13T14:01:00.000Z',
  );

  assert.equal(second.awarded, false);
  assert.equal(second.balance, 205);
  assert.deepEqual(second.value, first.value);
  const third = claimWeeklyMissionRewardInSettings(
    first.value,
    6,
    '2026-29',
    CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
    '2026-07-13T14:02:00.000Z',
  );
  const fourth = claimWeeklyMissionRewardInSettings(
    third.value,
    6,
    '2026-29',
    CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
    '2026-07-13T14:03:00.000Z',
  );

  assert.equal(third.balance, 210);
  assert.equal(fourth.balance, 215);
  assert.equal(hasWeeklyMissionReward(first.value.currencyHistory, 6, '2026-29', 'personal_question'), true);
  assert.equal(hasWeeklyMissionReward(first.value.currencyHistory, 6, '2026-30', 'personal_question'), false);
  assert.equal(hasWeeklyMissionReward(fourth.value.currencyHistory, 6, '2026-29', CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE), true);
  assert.equal(hasWeeklyMissionReward(fourth.value.currencyHistory, 6, '2026-29', CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE), true);
});

test('weekly mission claim never records a partial reward at the balance limit', () => {
  const result = claimWeeklyMissionRewardInSettings({
    currencyBalances: { 6: 999_997 },
    currencyHistory: { 6: [] },
  }, 6, '2026-29', 'personal_question');

  assert.equal(result.awarded, false);
  assert.equal(result.balance, 999_997);
  assert.deepEqual(result.value, {
    currencyBalances: { 6: 999_997 },
    currencyHistory: { 6: [] },
  });
});

test('stale settings saves preserve a concurrent weekly mission reward', () => {
  const remote = claimWeeklyMissionRewardInSettings({
    currencyBalances: { 6: 200 },
    currencyHistory: { 6: [] },
  }, 6, '2026-29', 'personal_question', '2026-07-13T14:00:00.000Z').value;

  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, {
    scheduleNotice: '수정된 공지',
    currencyBalances: { 6: 200 },
    currencyHistory: { 6: [] },
  }, new Set());

  assert.equal((merged.currencyBalances as Record<string, number>)['6'], 205);
  assert.equal(hasWeeklyMissionReward(merged.currencyHistory, 6, '2026-29', 'personal_question'), true);
  assert.equal(merged.scheduleNotice, '수정된 공지');

  const mergedAgain = mergeConcurrentCurrencyUpdatesIntoSettings(remote, merged);
  assert.deepEqual(mergedAgain, merged);
});

test('an intentional reset does not restore rewards from before the last sync', () => {
  const remote = claimWeeklyMissionRewardInSettings({
    currencyBalances: { 6: 200 },
    currencyHistory: { 6: [] },
  }, 6, '2026-29', 'personal_question', '2026-07-13T14:00:00.000Z').value;

  const reset = mergeConcurrentCurrencyUpdatesIntoSettings(remote, {
    currencyBalances: { 6: 100 },
    currencyHistory: { 6: [] },
  }, getWeeklyMissionRewardIds(remote.currencyHistory));

  assert.equal((reset.currencyBalances as Record<string, number>)['6'], 100);
  assert.equal(hasWeeklyMissionReward(reset.currencyHistory, 6, '2026-29', 'personal_question'), false);
});

test('stale settings saves preserve a concurrent auction award once', () => {
  const award = {
    itemId: 'item-a', winner: 8, amount: 124, awardedAt: '2026-07-14T00:00:00.000Z',
  };
  const remote = finalizeAuctionAwardInSettings({
    currencyBalances: { 8: 300 },
    currencyHistory: { 8: [] },
    auctionBids: { 'item-a': { bidder: 8, amount: 124 } },
    auctionAwards: {},
  }, award).value;
  const stale = {
    currencyBalances: { 8: 300 },
    currencyHistory: { 8: [] },
    auctionBids: { 'item-a': { bidder: 8, amount: 124 } },
    auctionAwards: {},
  };

  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, stale, new Set(), new Set());
  assert.equal((merged.currencyBalances as Record<string, number>)['8'], 176);
  assert.equal(getAuctionAwardKeys(merged.auctionAwards).has(`${award.itemId}:${award.awardedAt}`), true);

  const mergedAgain = mergeConcurrentCurrencyUpdatesIntoSettings(remote, merged, new Set(), new Set());
  assert.equal((mergedAgain.currencyBalances as Record<string, number>)['8'], 176);
});

test('stale settings saves preserve a concurrent class donation once', () => {
  const donationEntry = {
    id: 'class-donation-request-1',
    studentNumber: 8,
    delta: -20,
    before: 100,
    after: 80,
    reason: 'class_donation',
    createdAt: '2026-07-14T02:00:00.000Z',
  } as const;
  const remote = {
    currencyBalances: { 8: 80 },
    currencyHistory: { 8: [donationEntry] },
    classDonation: {
      enabled: true,
      targetAmount: 500,
      totalAmount: 20,
      history: [{ id: 'request-1', studentNumber: 8, amount: 20, createdAt: donationEntry.createdAt }],
    },
  };
  const stale = {
    currencyBalances: { 8: 100 },
    currencyHistory: { 8: [] },
    classDonation: { enabled: true, targetAmount: 500, totalAmount: 0, history: [] },
  };

  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, stale);
  assert.equal((merged.currencyBalances as Record<string, number>)['8'], 80);
  assert.equal((merged.classDonation as { totalAmount: number }).totalAmount, 20);

  const mergedAgain = mergeConcurrentCurrencyUpdatesIntoSettings(remote, merged);
  assert.equal((mergedAgain.currencyBalances as Record<string, number>)['8'], 80);
});

test('ordinary settings saves preserve the latest remote bid activity', () => {
  const merged = mergeConcurrentCurrencyUpdatesIntoSettings({
    auctionBids: { 'item-a': { bidder: 8, amount: 40 } },
    auctionBidHistory: { 'item-a': [{ itemId: 'item-a', bidder: 8, amount: 40, createdAt: '2026-07-14T01:00:00.000Z' }] },
  }, {
    auctionBids: { 'item-a': { bidder: 7, amount: 30 } },
    auctionBidHistory: { 'item-a': [{ itemId: 'item-a', bidder: 7, amount: 30, createdAt: '2026-07-14T00:59:00.000Z' }] },
  }, new Set(), new Set());

  assert.deepEqual((merged.auctionBids as Record<string, unknown>)['item-a'], { bidder: 8, amount: 40 });
  assert.deepEqual((merged.auctionBidHistory as Record<string, unknown[]>)['item-a']?.[0], {
    itemId: 'item-a', bidder: 8, amount: 40, createdAt: '2026-07-14T01:00:00.000Z',
  });
});

test('weekly reward ledger remains durable beyond thirty later entries', () => {
  let value: Record<string, unknown> = {
    currencyBalances: { 6: 100 },
    currencyHistory: { 6: [] },
  };
  for (let week = 1; week <= 31; week += 1) {
    value = claimWeeklyMissionRewardInSettings(
      value,
      6,
      `2026-${String(week).padStart(2, '0')}`,
      'personal_question',
      `2026-07-${String(Math.min(week, 31)).padStart(2, '0')}T00:00:00.000Z`,
    ).value;
  }

  assert.equal(hasWeeklyMissionReward(value.currencyHistory, 6, '2026-01', 'personal_question'), true);
  assert.equal((value.currencyHistory as Record<string, unknown[]>)['6'].length, 31);
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
