import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStudentEconomyRejectionMessage,
  isStudentProfileRejection,
  shouldToastStudentEconomyResult,
} from './studentEconomyRejection.js';

test('은행·상점의 정상적인 거절 코드는 학생에게 보여 줄 이유로 바꾼다', () => {
  assert.equal(getStudentEconomyRejectionMessage('STOCK_MARKET_CLOSED', 'invest'), '오늘은 휴장입니다.');
  assert.equal(getStudentEconomyRejectionMessage('DEPOSIT_NOT_AVAILABLE_TODAY', 'deposit'), '예금은 월요일부터 금요일까지만 들 수 있습니다.');
  assert.equal(getStudentEconomyRejectionMessage('INSUFFICIENT_AVAILABLE_CURRENCY', 'buy_item'), '사용 가능한 고마가 부족합니다.');
  assert.equal(getStudentEconomyRejectionMessage('INVALID_CHARACTER_CHOICE', 'claim_halloween_character'), '다른 스킨을 골라 주세요.');
});

test('미확인·저장 문제·알 수 없는 오류는 거절로 보지 않아 알림창에 남는다', () => {
  for (const code of ['SAVE_DRAFT_PENDING', 'STUDENT_ECONOMY_INVALID_RESPONSE', 'Failed to fetch', '', 'toString', 'constructor']) {
    assert.equal(getStudentEconomyRejectionMessage(code, 'deposit'), null, code);
  }
});

test('자기 창을 계속 띄우는 뽑기·할로윈·집 구매 결과는 토스트로 보내지 않는다', () => {
  for (const type of ['draw_character', 'choose_draw_character', 'claim_halloween_character', 'buy_house'] as const) {
    assert.equal(shouldToastStudentEconomyResult(type), false, type);
  }
  for (const type of ['deposit', 'borrow', 'transfer', 'buy_item'] as const) {
    assert.equal(shouldToastStudentEconomyResult(type), true, type);
  }
});

test('프로필은 이유가 확인된 정상 거절만 토스트로 보낸다', () => {
  assert.equal(isStudentProfileRejection('profile_in_use'), true);
  assert.equal(isStudentProfileRejection('insufficient_currency'), true);
  assert.equal(isStudentProfileRejection('invalid_profile'), false);
  assert.equal(isStudentProfileRejection(undefined), false);
});
