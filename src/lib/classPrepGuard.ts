// Wrap-up guard: from 70 seconds before class, students cannot start new
// state-changing work. Finishing, confirming, or closing in-progress work stays allowed.
import type { ClassPrepState } from './classPrep';
import type { StudentEconomyAction } from './studentEconomy';

export const CLASS_PREP_BLOCKED_MESSAGE = '수업 후에 하세요';

export type ClassPrepStage = ClassPrepState['stage'];

export const isClassPrepBlockingStage = (stage: ClassPrepStage) => stage === 'wrap-up' || stage === 'locked';

// true: starts new work (blocked during wrap-up). false: completes or applies
// something already owned or in progress, or runs without a student press.
const ECONOMY_ACTION_STARTS_NEW_WORK: Record<StudentEconomyAction['type'], boolean> = {
  deposit: true,
  withdraw: true,
  save: true,
  open_deposit: true,
  close_deposit: true,
  claim_deposit: true,
  borrow: true,
  repay: true,
  transfer: true,
  buy_item: true,
  draw_character: true,
  choose_draw_character: false,
  select_character: false,
  buy_house: true,
  select_house: false,
  buy_custom_house_coupon: true,
  register_custom_house: false,
  invest: true,
  withdraw_investment: true,
  settle_investments: false,
};

export const isClassPrepBlockedEconomyAction = (stage: ClassPrepStage, action: StudentEconomyAction) => (
  isClassPrepBlockingStage(stage) && ECONOMY_ACTION_STARTS_NEW_WORK[action.type]
);
