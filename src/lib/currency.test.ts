import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUCTION_ITEM_TEMPLATES,
  AUCTION_MISSION_MAX_COUNT,
  AUCTION_MAX_ITEM_COUNT,
  AUCTION_MAX_ITEMS_PER_DAY,
  adjustCurrencyBalancesForStudents,
  applyTeacherCurrencyDeductionInSettings,
  applyAuctionAwardToCurrencyState,
  createDefaultCurrencyBalances,
  createDefaultCurrencyHistory,
  claimDailyEmotionRewardInSettings,
  claimWeeklyEmotionRewardInSettings,
  collectCurrencyTax,
  finalizeAuctionAwardInSettings,
  getAuctionAwardsForDay,
  hasDailyEmotionReward,
  hasWeeklyEmotionReward,
  pickAvailableAuctionMissionIllustrationIndex,
  normalizeAuctionMissions,
} from './currency.ts';
import { normalizeStudentEconomyState } from './studentEconomy.ts';
import { createStudentEmotionEntry, getSchoolWeekDateKeys } from './studentEmotion.ts';

test('선택한 번호에만 화폐를 일괄 조정하고 중복 번호는 한 번만 반영한다', () => {
  // Given
  const balances = {
    ...createDefaultCurrencyBalances(),
    2: 20,
    5: 999_995,
  };

  // When
  const adjustedBalances = adjustCurrencyBalancesForStudents(balances, [2, 5, 5, 24], 10);

  // Then
  assert.equal(adjustedBalances['2'], 30);
  assert.equal(adjustedBalances['5'], 999_999);
  assert.equal(adjustedBalances['1'], 100);
  assert.equal(adjustedBalances['24'], undefined);
});

test('세금은 예금 원금을 포함하고 대출 원금은 제외한다', () => {
  // Given
  const economy = {
    '1': normalizeStudentEconomyState({
      deposits: [{ id: 'deposit-1', principal: 30, openedOn: '2026-08-17', maturityDate: '2026-08-19', interest: 3 }],
      loan: 55,
      loanPrincipal: 50,
    }),
  };

  // When
  const result = collectCurrencyTax({ '1': 165 }, economy);

  // Then
  assert.equal(result.balances['1'], 93);
  assert.equal(result.economy['1']?.deposits[0]?.principal, 30);
  assert.equal(result.economy['1']?.loanPrincipal, 50);
});

test('사용 가능 고마가 부족하면 세금은 예금 원금에서만 추가로 차감한다', () => {
  // Given
  const economy = {
    '1': normalizeStudentEconomyState({
      deposits: [{ id: 'deposit-1', principal: 100, openedOn: '2026-08-17', maturityDate: '2026-08-19', interest: 10 }],
    }),
  };

  // When
  const result = collectCurrencyTax({ '1': 20 }, economy);

  // Then
  assert.equal(result.balances['1'], 0);
  assert.equal(result.economy['1']?.deposits[0]?.principal, 60);
  assert.equal(result.economy['1']?.deposits[0]?.interest, 6);
});

test('교사 차감은 지갑이 부족한 만큼 예금에서 사용하고 사유 편지를 만든다', () => {
  const result = applyTeacherCurrencyDeductionInSettings({
    currencyBalances: { '12': 5 },
    currencyHistory: { '12': [] },
    studentEconomy: {
      '12': {
        deposits: [
          { id: 'deposit-1', principal: 20, openedOn: '2026-09-01', maturityDate: '2026-09-03', interest: 2 },
          { id: 'deposit-2', principal: 10, openedOn: '2026-09-02', maturityDate: '2026-09-04', interest: 1 },
        ],
      },
    },
    studentLife: { letters: [] },
  }, {
    studentNumber: 12,
    amount: 15,
    teacherReason: '준비물 미지참',
    requestId: 'teacher-deduction-1',
    createdAt: '2026-09-05T01:00:00.000Z',
  });

  const value = result.value;
  const economy = normalizeStudentEconomyState((value.studentEconomy as Record<string, unknown>)['12']);
  const letters = (value.studentLife as { letters: Array<{ content: string }> }).letters;
  assert.equal(result.applied, true);
  assert.equal(result.walletDeduction, 5);
  assert.equal(result.depositDeduction, 10);
  assert.equal((value.currencyBalances as Record<string, number>)['12'], 0);
  assert.equal(economy.deposit, 20);
  assert.equal(economy.deposits[0]?.principal, 10);
  assert.equal(economy.deposits[0]?.interest, 1);
  assert.equal(letters[0]?.content, [
    '선생님이 15고마를 차감했어요.',
    '',
    '차감 사유',
    '준비물 미지참',
    '',
    '보유 고마가 부족해 10고마는 예금에서 사용했어요.',
  ].join('\n'));
});

test('교사 차감 요청은 중복 처리되지 않고 총 보유액을 넘으면 거부된다', () => {
  const first = applyTeacherCurrencyDeductionInSettings({
    currencyBalances: { '3': 20 },
    currencyHistory: { '3': [] },
  }, {
    studentNumber: 3,
    amount: 5,
    teacherReason: '교구 파손',
    requestId: 'teacher-deduction-2',
  });
  const duplicate = applyTeacherCurrencyDeductionInSettings(first.value, {
    studentNumber: 3,
    amount: 5,
    teacherReason: '교구 파손',
    requestId: 'teacher-deduction-2',
  });

  assert.equal(duplicate.applied, false);
  assert.equal((duplicate.value.currencyBalances as Record<string, number>)['3'], 15);
  assert.equal((duplicate.value.studentLife as { letters: unknown[] }).letters.length, 1);
  assert.throws(() => applyTeacherCurrencyDeductionInSettings(first.value, {
    studentNumber: 3,
    amount: 16,
    teacherReason: '교구 파손',
    requestId: 'teacher-deduction-3',
  }), /INSUFFICIENT_STUDENT_ASSETS/);
});

test('요일별 경매 물품을 최대 6개까지 구성한다', () => {
  assert.equal(AUCTION_MAX_ITEMS_PER_DAY, 6);
  assert.equal(AUCTION_MAX_ITEM_COUNT, 30);
  assert.equal(AUCTION_ITEM_TEMPLATES.length, 30);
  assert.equal(AUCTION_ITEM_TEMPLATES.filter((item) => item.dayIndex === 0).length, 6);
});

test('교사 미션 보상 범위는 최소값과 최대값 순서로 저장된다', () => {
  // Given
  const missions = [{ id: 'mission-1', content: '인사하기', rewardAmount: [20, 5] }];

  // When
  const normalized = normalizeAuctionMissions(missions);

  // Then
  assert.deepEqual(normalized[0]?.rewardAmount, [5, 20]);
});

test('교사 미션은 최대 4개이며 서로 다른 일러스트 번호를 가진다', () => {
  // Given
  const missions = Array.from({ length: 6 }, (_, index) => ({
    id: `mission-${index + 1}`,
    content: `미션 ${index + 1}`,
    rewardAmount: 5,
    illustrationIndex: index === 1 ? 0 : index,
  }));

  // When
  const normalized = normalizeAuctionMissions(missions);

  // Then
  assert.equal(normalized.length, AUCTION_MISSION_MAX_COUNT);
  assert.equal(new Set(normalized.map((mission) => mission.illustrationIndex)).size, AUCTION_MISSION_MAX_COUNT);
  assert.deepEqual(normalized.map((mission) => mission.illustrationIndex).sort(), [0, 1, 2, 3]);
});

test('교사 미션명은 권장 길이보다 길어도 그대로 저장한다', () => {
  // Given
  const content = '아주 긴 미션 이름 '.repeat(12).trim();

  // When
  const normalized = normalizeAuctionMissions([
    { id: 'mission-long', content, rewardAmount: 5, illustrationIndex: 0 },
  ]);

  // Then
  assert.equal(normalized[0]?.content, content);
});

test('새 교사 미션은 사용하지 않은 일러스트 중 하나를 선택한다', () => {
  // Given
  const missions = normalizeAuctionMissions([
    { id: 'mission-1', content: '첫 미션', rewardAmount: 5, illustrationIndex: 0 },
    { id: 'mission-2', content: '둘째 미션', rewardAmount: 5, illustrationIndex: 2 },
  ]);

  // When
  const firstAvailable = pickAvailableAuctionMissionIllustrationIndex(missions, 0);
  const lastAvailable = pickAvailableAuctionMissionIllustrationIndex(missions, 0.999);

  // Then
  assert.equal(firstAvailable, 1);
  assert.equal(lastAvailable, 3);
});

test('당일 낙찰 품목을 완료 시각 순서로 누적한다', () => {
  const awardedItems = getAuctionAwardsForDay([
    { id: 'item-4-1', name: '첫 번째 물품', startPrice: 10, dayIndex: 3 },
    { id: 'item-4-2', name: '두 번째 물품', startPrice: 10, dayIndex: 3 },
    { id: 'item-3-1', name: '수요일 물품', startPrice: 10, dayIndex: 2 },
  ], {
    'item-4-1': { itemId: 'item-4-1', winner: 8, amount: 120, awardedAt: '2026-07-23T01:10:00.000Z' },
    'item-4-2': { itemId: 'item-4-2', winner: 15, amount: 95, awardedAt: '2026-07-23T01:05:00.000Z' },
    'item-3-1': { itemId: 'item-3-1', winner: 3, amount: 80, awardedAt: '2026-07-22T01:00:00.000Z' },
  }, 3);

  assert.deepEqual(awardedItems.map(({ item, award }) => ({
    itemId: item.id,
    winner: award.winner,
  })), [
    { itemId: 'item-4-2', winner: 15 },
    { itemId: 'item-4-1', winner: 8 },
  ]);
});

test('낙찰 완료 시 낙찰자의 보유 고마를 낙찰가만큼 차감한다', () => {
  // Given
  const balances = createDefaultCurrencyBalances();
  const history = createDefaultCurrencyHistory();

  // When
  const result = applyAuctionAwardToCurrencyState(balances, history, {
    itemId: 'item-a',
    winner: 7,
    amount: 30,
    awardedAt: '2026-07-14T00:00:00.000Z',
  });

  // Then
  assert.equal(result.balances['7'], 70);
  assert.deepEqual(
    result.history['7']?.map(({ studentNumber, delta, before, after, reason, createdAt }) => ({
      studentNumber,
      delta,
      before,
      after,
      reason,
      createdAt,
    })),
    [{
      studentNumber: 7,
      delta: -30,
      before: 100,
      after: 70,
      reason: 'auction_award',
      createdAt: '2026-07-14T00:00:00.000Z',
    }],
  );
});

test('같은 낙찰은 공유 설정에서 한 번만 차감한다', () => {
  const award = {
    itemId: 'item-a',
    winner: 7,
    amount: 30,
    awardedAt: '2026-07-14T00:00:00.000Z',
  };
  const initial = {
    currencyBalances: { 7: 100 },
    currencyHistory: { 7: [] },
    auctionBids: { 'item-a': { bidder: 7, amount: 30 } },
    auctionAwards: {},
  };

  const first = finalizeAuctionAwardInSettings(initial, award);
  const second = finalizeAuctionAwardInSettings(first.value, award);

  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balances['7'], 70);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'auction_award').length, 1);
});

test('감정 구슬 일일 미션은 같은 날짜에 한 번만 5고마를 지급한다', () => {
  // Given
  const initial = {
    currencyBalances: { 7: 100 },
    currencyHistory: { 7: [] },
  };

  // When
  const first = claimDailyEmotionRewardInSettings(initial, 7, '2026-08-11', '2026-08-11T01:00:00.000Z');
  const second = claimDailyEmotionRewardInSettings(first.value, 7, '2026-08-11', '2026-08-11T02:00:00.000Z');

  // Then
  assert.equal(first.awarded, true);
  assert.equal(first.balance, 105);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 105);
  assert.equal(hasDailyEmotionReward(second.value.currencyHistory, 7, '2026-08-11'), true);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'daily_emotion').length, 1);
});

test('월요일부터 금요일 감정 구슬을 모두 채우면 주간 25고마를 한 번만 지급한다', () => {
  const weekdayDateKeys = getSchoolWeekDateKeys(new Date(2026, 7, 14, 9));
  const studentEmotionHistory = {
    7: weekdayDateKeys.map((dateKey, index) => createStudentEmotionEntry(
      7,
      index % 2 === 0 ? 'happy' : 'calm',
      `${index + 1}일차 감정`,
      new Date(`${dateKey}T09:00:00+09:00`),
    )),
  };
  const initial = {
    currencyBalances: { 7: 125 },
    currencyHistory: { 7: [] },
    studentEmotionHistory,
  };

  const first = claimWeeklyEmotionRewardInSettings(
    initial,
    7,
    weekdayDateKeys,
    '2026-08-14T01:00:00.000Z',
  );
  const second = claimWeeklyEmotionRewardInSettings(
    first.value,
    7,
    weekdayDateKeys,
    '2026-08-14T02:00:00.000Z',
  );

  assert.equal(first.awarded, true);
  assert.equal(first.balance, 150);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 150);
  assert.equal(hasWeeklyEmotionReward(second.history, 7, weekdayDateKeys[0]), true);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'weekly_emotion').length, 1);
});

test('평일 감정 구슬이 네 칸이면 주간 보상을 지급하지 않는다', () => {
  const weekdayDateKeys = getSchoolWeekDateKeys(new Date(2026, 7, 14, 9));
  const result = claimWeeklyEmotionRewardInSettings({
    currencyBalances: { 7: 120 },
    currencyHistory: { 7: [] },
    studentEmotionHistory: {
      7: weekdayDateKeys.slice(0, 4).map((dateKey) => createStudentEmotionEntry(
        7,
        'happy',
        '감정 기록',
        new Date(`${dateKey}T09:00:00+09:00`),
      )),
    },
  }, 7, weekdayDateKeys);

  assert.equal(result.awarded, false);
  assert.equal(result.balance, 120);
});

test('잔액보다 큰 낙찰과 확정 중 변경된 입찰은 거부한다', () => {
  const base = {
    currencyBalances: { 7: 20 },
    currencyHistory: { 7: [] },
    auctionBids: { 'item-a': { bidder: 7, amount: 40 } },
    auctionAwards: {},
  };

  assert.throws(() => finalizeAuctionAwardInSettings(base, {
    itemId: 'item-a', winner: 7, amount: 40, awardedAt: '2026-07-14T00:00:00.000Z',
  }), /INSUFFICIENT_CURRENCY_FOR_AUCTION_AWARD/);
  assert.throws(() => finalizeAuctionAwardInSettings({
    ...base,
    currencyBalances: { 7: 100 },
    auctionBids: { 'item-a': { bidder: 8, amount: 45 } },
  }, {
    itemId: 'item-a', winner: 7, amount: 40, awardedAt: '2026-07-14T00:00:00.000Z',
  }), /AUCTION_BID_CHANGED/);
});
