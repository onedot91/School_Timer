import assert from 'node:assert/strict';
import test from 'node:test';

import { getInvestmentStatusMessage, shouldResetInvestmentAmount } from '../components/student/StudentInvestmentActionPanel.tsx';
import { needsInvestmentSettlement } from '../components/student/StudentStockMarketPage.tsx';
import { createStudentEconomyState } from './studentEconomy.ts';

const baseOptions = {
  isSaving: false,
  marketClosed: false,
  isBelowMinimum: false,
  hasInvalidAmount: false,
  hasPosition: true,
};

test('투자 거래 상태는 가장 중요한 비활성 사유를 짧게 안내한다', () => {
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, isSaving: true, marketClosed: true }), '처리 중');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, marketClosed: true }), '오늘은 휴장');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, isBelowMinimum: true }), '투자 한도 없음');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, hasInvalidAmount: true }), '입력 금액 확인');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, hasPosition: false }), '찾을 투자금 없음');
  assert.equal(getInvestmentStatusMessage(baseOptions), '');
});

test('기존 투자는 늦게 불러와도 오늘 정산 여부를 투자 날짜로 판단한다', () => {
  const emptyState = createStudentEconomyState();
  assert.equal(needsInvestmentSettlement(emptyState, '2026-08-26'), false);

  const existingState = {
    ...emptyState,
    investments: {
      sunny: {
        investedAmount: 30,
        currentAmount: 30,
        lastSettledDateKey: '2026-08-25',
        lastChangeAmount: 0,
        lastStage: 'flat' as const,
      },
    },
  };
  assert.equal(needsInvestmentSettlement(existingState, '2026-08-26'), true);
  assert.equal(needsInvestmentSettlement({
    ...existingState,
    investments: {
      sunny: { ...existingState.investments.sunny, lastSettledDateKey: '2026-08-26' },
    },
  }, '2026-08-26'), false);
});

test('투자 금액은 첫 화면 진입이 아니라 실제 종목 변경 때만 초기화한다', () => {
  assert.equal(shouldResetInvestmentAmount('sunny', 'sunny'), false);
  assert.equal(shouldResetInvestmentAmount('sunny', 'sprout'), true);
});
