import assert from 'node:assert/strict';
import test from 'node:test';
import { CLASS_PREP_BLOCKED_MESSAGE, isClassPrepBlockedEconomyAction, isClassPrepBlockingStage } from './classPrepGuard';
import { STUDENT_CHARACTER_PRIZES, STUDENT_HOUSE_DESIGNS, STUDENT_STOCKS, type StudentEconomyAction } from './studentEconomy';

const stockId = STUDENT_STOCKS[0].id;
const houseId = STUDENT_HOUSE_DESIGNS[0].id;
const characterId = STUDENT_CHARACTER_PRIZES[0].id;

test('마무리와 잠금 단계에서만 새 작업을 막는다', () => {
  assert.equal(isClassPrepBlockingStage('idle'), false);
  assert.equal(isClassPrepBlockingStage('notice'), false);
  assert.equal(isClassPrepBlockingStage('wrap-up'), true);
  assert.equal(isClassPrepBlockingStage('locked'), true);
  assert.equal(CLASS_PREP_BLOCKED_MESSAGE, '수업 후에 하세요');
});

test('마무리 단계에서 고마가 움직이는 거래와 구매를 막는다', () => {
  const blocked: StudentEconomyAction[] = [
    { type: 'open_deposit', amount: 10, dateKey: '2026-10-19' },
    { type: 'close_deposit', depositId: 'd1' },
    { type: 'claim_deposit', depositId: 'd1', dateKey: '2026-10-19' },
    { type: 'borrow', amount: 10 },
    { type: 'repay', amount: 10 },
    { type: 'transfer', amount: 10, recipientNumber: 2, dateKey: '2026-10-19' },
    { type: 'buy_item', itemId: 'snack' },
    { type: 'draw_character' },
    { type: 'buy_house', houseId },
    { type: 'buy_custom_house_coupon' },
    { type: 'invest', stockId, amount: 10, dateKey: '2026-10-19' },
    { type: 'withdraw_investment', stockId, dateKey: '2026-10-19' },
  ];
  for (const action of blocked) {
    assert.equal(isClassPrepBlockedEconomyAction('wrap-up', action), true, action.type);
    assert.equal(isClassPrepBlockedEconomyAction('notice', action), false, action.type);
    assert.equal(isClassPrepBlockedEconomyAction('idle', action), false, action.type);
  }
});

test('진행 중인 선택 마무리, 쓰던 디자인 적용, 자동 정산은 막지 않는다', () => {
  const allowed: StudentEconomyAction[] = [
    { type: 'choose_draw_character', drawRequestId: 'r1', characterId },
    { type: 'select_character', characterId: null },
    { type: 'select_house', houseId: null },
    { type: 'register_custom_house', name: '우리 집', theme: 'green' },
    { type: 'settle_investments', dateKey: '2026-10-19' },
  ];
  for (const action of allowed) {
    assert.equal(isClassPrepBlockedEconomyAction('wrap-up', action), false, action.type);
    assert.equal(isClassPrepBlockedEconomyAction('locked', action), false, action.type);
  }
});
