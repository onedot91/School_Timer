import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTeacherCurrencyDeductionsInSettings, normalizeCurrencyBalances, normalizeCurrencyHistory, settlePendingTeacherDeductionsInSettings } from './currency.js';
import { getStudentEconomyState, getStudentInvestmentBalance, normalizeStudentEconomyStates, normalizePendingTeacherDeductions } from './studentEconomy.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { applyTeacherStorageCommand } from '../server/teacherStorageCommands.js';
import { storageCommandScope } from '../server/storageCommandScope.js';
import { buildScopedStorageMutation, parseScopedStorageSnapshot } from '../server/storageV2Repository.js';
import { splitStorageState } from './storageV2Codec.js';
import { storeStudentPetSnapshot, STUDENT_PET_STORAGE_KEY } from './studentPet.js';

const createdAt = '2026-10-14T00:00:00.000Z';
const input = { studentNumbers: [14], amount: 10, teacherReason: '검수용 사유', requestId: 'fixture-pending', createdAt, deferIfInsufficient: true };
const queue = (wallet = 2, amount = 10) => applyTeacherCurrencyDeductionsInSettings({
  currencyBalances: { '14': wallet, '3': 91 }, currencyHistory: { '14': [], '3': [{ id: 'opaque-history' }] },
  studentEconomy: { '3': { future: null } }, studentLife: { letters: [] },
}, { ...input, amount }).value;
const state = (value: Record<string, unknown>) => getStudentEconomyState(normalizeStudentEconomyStates(value.studentEconomy), 14);

const investment = (currentAmount: number) => ({ investedAmount: 20, currentAmount, lastSettledDateKey: '2026-10-14', lastChangeAmount: 4, lastStage: 'rise' });

test('교사 차감은 지갑 → 예금 → 증권사 현재 투자금 순서로 사용한다', () => {
  const before = { currencyBalances: { '14': 2 }, studentEconomy: { '14': { deposit: 3,
    investments: { sunny: investment(8), sprout: investment(12) } } } };
  const after = applyTeacherCurrencyDeductionsInSettings(before, { ...input, amount: 10 }).value;
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['14'], 0);
  assert.equal(state(after).deposit, 0);
  assert.equal(getStudentInvestmentBalance(state(after)), 15);
  assert.equal(state(after).investments.sunny?.currentAmount, 3);
  assert.equal(state(after).investments.sunny?.investedAmount, 8);
  assert.equal(state(after).investments.sunny?.lastChangeAmount, 2);
  assert.equal(state(after).pendingDeductions.length, 0);
  assert.match(normalizeStudentLifeState(after.studentLife).letters[0]?.content ?? '', /5고마는 증권사 투자금/);
  assert.deepEqual(applyTeacherCurrencyDeductionsInSettings(after, { ...input, amount: 10 }).value, after);
});

test('증권사만으로 차감할 수 있고 소진한 투자 포지션은 제거한다', () => {
  const after = applyTeacherCurrencyDeductionsInSettings({ currencyBalances: { '14': 0 },
    studentEconomy: { '14': { investments: { sunny: investment(10) } } },
  }, input).value;
  assert.equal(getStudentInvestmentBalance(state(after)), 0);
  assert.equal(state(after).investments.sunny, undefined);
  assert.equal(state(after).pendingDeductions.length, 0);
});

test('증권사 자산도 부족하면 전액 대기하고 투자금이 늘면 자동 차감한다', () => {
  const before = applyTeacherCurrencyDeductionsInSettings({ currencyBalances: { '14': 0 },
    studentEconomy: { '14': { investments: { sunny: investment(8) } } },
  }, input).value;
  assert.equal(state(before).investments.sunny?.currentAmount, 8);
  assert.equal(state(before).pendingDeductions.length, 1);
  const after = settlePendingTeacherDeductionsInSettings({ ...before,
    studentEconomy: { '14': { ...state(before), investments: { sunny: investment(12) } } },
  }, createdAt);
  assert.equal(state(after).investments.sunny?.currentAmount, 2);
  assert.equal(state(after).pendingDeductions.length, 0);
  assert.deepEqual(settlePendingTeacherDeductionsInSettings(after, createdAt), after);
});

test('− 버튼의 서버 명령도 은행과 증권사 잔액을 차감한다', () => {
  const result = applyTeacherStorageCommand({ currencyBalances: { '14': 1 },
    studentEconomy: { '14': { deposit: 2, investments: { sunny: investment(10) } } },
  }, 'teacher.currency.adjust', { studentNumbers: [14], amount: -5 }, { requestId: 'fixture-minus', createdAt });
  assert.ok(result);
  assert.equal(normalizeCurrencyBalances(result.value.currencyBalances)['14'], 0);
  assert.equal(state(result.value).deposit, 0);
  assert.equal(state(result.value).investments.sunny?.currentAmount, 8);
});

test('부족한 자산의 차감은 전액 대기로 저장하며 재시도해도 중복 등록하지 않는다', () => {
  const before = queue();
  const after = applyTeacherCurrencyDeductionsInSettings(before, input).value;
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['14'], 2);
  assert.equal(state(after).pendingDeductions[0]?.amount, 10);
  assert.deepEqual(after, before);
  assert.equal(normalizeStudentLifeState(after.studentLife).letters.length, 1);
  assert.deepEqual(after.studentEconomy, before.studentEconomy);
});

test('자산이 부족한 동안에는 일부 차감과 차감 기록을 만들지 않는다', () => {
  const before = queue();
  const withReward: Record<string, unknown> = { ...before, currencyBalances: { '14': 7, '3': 91 } };
  const after = settlePendingTeacherDeductionsInSettings(withReward, createdAt);
  assert.deepEqual(after, withReward);
  assert.equal(normalizeCurrencyHistory(after.currencyHistory)['14'].length, 0);
});

test('실제 잔액이 없는 범위 조회에서는 기본 잔액으로 자동 차감하지 않는다', () => {
  const before: Record<string, unknown> = { ...queue(), currencyBalances: {} };
  const after = settlePendingTeacherDeductionsInSettings(before, createdAt);
  assert.deepEqual(after, before);
  assert.equal(state(after).pendingDeductions.length, 1);
});

test('충분한 보상 이후 전액 차감하고 대기를 해제하며 재시도해도 다시 차감하지 않는다', () => {
  const before = queue();
  const after = settlePendingTeacherDeductionsInSettings({ ...before, currencyBalances: { '14': 12, '3': 91 } }, createdAt);
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['14'], 2);
  assert.equal(state(after).pendingDeductions.length, 0);
  assert.equal(normalizeCurrencyHistory(after.currencyHistory)['14'][0]?.delta, -10);
  assert.equal(normalizeStudentLifeState(after.studentLife).letters.length, 2);
  assert.deepEqual(settlePendingTeacherDeductionsInSettings(after, createdAt), after);
});

test('대기 차감은 예금 부족분을 사용하고 예금 이자를 다시 계산한다', () => {
  const before = queue(0);
  const economy = state(before);
  const after = settlePendingTeacherDeductionsInSettings({ ...before, currencyBalances: { '14': 2 },
    studentEconomy: { '14': { ...economy, deposit: 20, deposits: [{ id: 'fixture-deposit', principal: 20, interest: 2, openedOn: '2026-10-14', maturityDate: '2026-10-21' }] } },
  }, createdAt);
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['14'], 0);
  assert.equal(state(after).deposit, 12);
  assert.equal(state(after).deposits[0]?.interest, 1);
  assert.equal(state(after).pendingDeductions.length, 0);
});

test('큰 대기 금액을 건너뛰어 뒤의 작은 금액부터 차감하지 않는다', () => {
  const before = queue(2, 20);
  const second = applyTeacherCurrencyDeductionsInSettings(before, { ...input, requestId: 'second-fixture', amount: 10 }).value;
  const after = settlePendingTeacherDeductionsInSettings({ ...second, currencyBalances: { '14': 12 } }, createdAt);
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['14'], 12);
  assert.deepEqual(state(after).pendingDeductions.map(item => item.amount), [20, 10]);
});

test('잘못된 대기 기록은 정규화 경계에서 거절한다', () => {
  const pending = state(queue()).pendingDeductions[0];
  assert.deepEqual(normalizePendingTeacherDeductions([pending, pending, { ...pending, amount: -1 }, { ...pending, id: 'bad', createdAt: 'unknown' }]), [pending]);
});

test('자동 차감은 다른 학생의 비정규화 원본과 미지의 필드를 보존한다', () => {
  const before = queue();
  const after = settlePendingTeacherDeductionsInSettings({ ...before, currencyBalances: { '14': 12, '3': 91 } }, createdAt);
  assert.ok(after.studentEconomy && typeof after.studentEconomy === 'object');
  assert.ok(after.currencyHistory && typeof after.currencyHistory === 'object');
  assert.deepEqual(Reflect.get(after.studentEconomy, '3'), { future: null });
  assert.deepEqual(Reflect.get(after.currencyHistory, '3'), [{ id: 'opaque-history' }]);
});

test('로컬 mock 저장에도 차감 기록·경제 상태·편지가 함께 반영된다', () => {
  const before = queue();
  const values = new Map<string, string>();
  const snapshot = { studentPets: {}, currencyBalances: normalizeCurrencyBalances({ '14': 12 }), currencyHistory: normalizeCurrencyHistory(before.currencyHistory),
    studentEconomy: normalizeStudentEconomyStates(before.studentEconomy), studentLife: normalizeStudentLifeState(before.studentLife),
    auctionItems: [], auctionBids: {}, auctionBidHistory: {}, auctionAwards: {},
  };
  const saved = storeStudentPetSnapshot(snapshot, { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
  assert.equal(saved, true);
  const persisted: unknown = JSON.parse(values.get(STUDENT_PET_STORAGE_KEY) ?? '{}');
  assert.ok(persisted && typeof persisted === 'object');
  assert.equal(normalizeCurrencyBalances(Reflect.get(persisted, 'currencyBalances'))['14'], 2);
  assert.equal(normalizeStudentLifeState(Reflect.get(persisted, 'studentLife')).letters.length, 2);
  assert.equal(getStudentEconomyState(normalizeStudentEconomyStates(Reflect.get(persisted, 'studentEconomy')), 14).pendingDeductions.length, 0);
});

test('학생 범위의 교사 차감 명령은 다른 학생의 원본 기록을 쓰지 않는다', () => {
  const action = 'teacher.currency.deduct';
  const payload = { studentNumbers: [14], amount: 10, teacherReason: 'fixture', deferIfInsufficient: true };
  const scope = storageCommandScope(action, payload, { role: 'teacher', expiresAt: 0 });
  const encoded = splitStorageState({ currencyBalances: { '14': 2 }, currencyHistory: { '14': [] }, studentEconomy: {}, studentLife: { letters: [] } });
  const snapshot = parseScopedStorageSnapshot({ ...encoded, kind: 'scoped', scope, deletedKeys: [], orderingBounds: {}, revisions: {}, updated_at: createdAt });
  const result = applyTeacherStorageCommand(snapshot.value, action, payload, { requestId: 'scoped-fixture', createdAt });
  assert.ok(result);
  const args = buildScopedStorageMutation({ snapshot, value: result.value, actorKey: 'teacher:0', requestId: 'scoped-fixture', action, payload, result: result.result });
  assert.deepEqual(args.p_wallets, []);
  assert.deepEqual(args.p_ledger, []);
  assert.ok(Array.isArray(args.p_resources));
  assert.ok(args.p_resources.every(row => row.owner_number === 14 || row.owner_number === null));
});
