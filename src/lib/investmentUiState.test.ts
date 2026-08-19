import assert from 'node:assert/strict';
import test from 'node:test';

import { getInvestmentStatusMessage } from '../components/student/StudentInvestmentActionPanel.tsx';

const baseOptions = {
  isSaving: false,
  marketClosed: false,
  isBelowMinimum: false,
  hasInvalidAmount: false,
  hasPosition: true,
};

test('투자 거래 상태는 가장 중요한 비활성 사유를 짧게 안내한다', () => {
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, isSaving: true, marketClosed: true }), '');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, marketClosed: true }), '오늘은 휴장');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, isBelowMinimum: true }), '투자 한도 없음');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, hasInvalidAmount: true }), '입력 금액 확인');
  assert.equal(getInvestmentStatusMessage({ ...baseOptions, hasPosition: false }), '찾을 투자금 없음');
  assert.equal(getInvestmentStatusMessage(baseOptions), '');
});
