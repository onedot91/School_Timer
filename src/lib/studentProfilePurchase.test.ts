import assert from 'node:assert/strict';
import test from 'node:test';

import { FAILURE_PROFILE_IMAGES } from './failureExhibition.ts';
import {
  loadStoredStudentPetSnapshot,
  storeStudentPetSnapshot,
  STUDENT_PET_STORAGE_KEY,
} from './studentPet.ts';
import {
  purchaseStudentProfile,
  RANDOM_PROFILE_CHANGE_PRICE,
  SELECTED_PROFILE_CHANGE_PRICE,
} from './studentProfilePurchase.ts';

const createSettings = (balance = 100, assignments: Record<string, string> = {}) => ({
  currencyBalances: { 1: balance },
  currencyHistory: { 1: [] },
  studentLife: {
    letters: [],
    books: [],
    failureStories: [],
    failureProfileAssignments: assignments,
  },
});

test('첫 프로필은 랜덤만 무료로 받을 수 있다', () => {
  const selected = purchaseStudentProfile(
    createSettings(),
    1,
    { type: 'selected', profileImage: FAILURE_PROFILE_IMAGES[2] },
    100,
  );
  const random = purchaseStudentProfile(createSettings(), 1, { type: 'random' }, 100, () => 0);

  assert.equal(selected.applied, false);
  assert.equal(selected.reason, 'first_profile_must_be_random');
  assert.equal(random.applied, true);
  assert.equal(random.price, 0);
  assert.equal(random.balances['1'], 100);
  assert.equal(random.studentLife.failureProfileAssignments['1'], FAILURE_PROFILE_IMAGES[0]);
});

test('프로필을 받은 뒤 랜덤 교체는 30고마를 차감한다', () => {
  const result = purchaseStudentProfile(
    createSettings(100, { 1: FAILURE_PROFILE_IMAGES[0] }),
    1,
    { type: 'random' },
    100,
    () => 0,
    '2026-08-30T01:00:00.000Z',
  );

  assert.equal(result.applied, true);
  assert.equal(result.price, RANDOM_PROFILE_CHANGE_PRICE);
  assert.equal(result.balances['1'], 70);
  assert.equal(result.history['1'][0]?.reason, 'shop_purchase');
  assert.notEqual(result.studentLife.failureProfileAssignments['1'], FAILURE_PROFILE_IMAGES[0]);
});

test('특정 프로필 교체는 50고마이고 예약액을 제외한 잔액이 부족하면 거절한다', () => {
  const settings = createSettings(100, { 1: FAILURE_PROFILE_IMAGES[0] });
  const insufficient = purchaseStudentProfile(
    settings,
    1,
    { type: 'selected', profileImage: FAILURE_PROFILE_IMAGES[1] },
    49,
  );
  const purchased = purchaseStudentProfile(
    settings,
    1,
    { type: 'selected', profileImage: FAILURE_PROFILE_IMAGES[1] },
    50,
  );

  assert.equal(insufficient.applied, false);
  assert.equal(insufficient.reason, 'insufficient_currency');
  assert.equal(purchased.applied, true);
  assert.equal(purchased.price, SELECTED_PROFILE_CHANGE_PRICE);
  assert.equal(purchased.balances['1'], 50);
});

test('다른 학생이 사용하는 특정 프로필은 결제하지 않는다', () => {
  const result = purchaseStudentProfile(
    createSettings(100, {
      1: FAILURE_PROFILE_IMAGES[0],
      2: FAILURE_PROFILE_IMAGES[1],
    }),
    1,
    { type: 'selected', profileImage: FAILURE_PROFILE_IMAGES[1] },
    100,
  );

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'profile_in_use');
  assert.equal(result.balances['1'], 100);
});

test('로컬 프로필 구매는 프로필과 잔액을 하나의 스냅샷으로 저장한다', () => {
  const result = purchaseStudentProfile(createSettings(), 1, { type: 'random' }, 100, () => 0);
  const writes: Array<{ key: string; value: string }> = [];
  const stored = storeStudentPetSnapshot({
    ...loadStoredStudentPetSnapshot(),
    studentPets: {},
    currencyBalances: result.balances,
    currencyHistory: result.history,
    studentEconomy: {},
    studentLife: result.studentLife,
  }, {
    setItem: (key, value) => writes.push({ key, value }),
  });

  assert.equal(stored, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, STUDENT_PET_STORAGE_KEY);
  const saved = JSON.parse(writes[0]?.value ?? '{}') as Record<string, Record<string, unknown>>;
  assert.equal(saved.currencyBalances?.['1'], 100);
  assert.equal(saved.studentLife?.failureProfileAssignments?.['1'], FAILURE_PROFILE_IMAGES[0]);
});

test('결합 스냅샷 저장 실패는 부분 저장 없이 실패로 반환한다', () => {
  const result = purchaseStudentProfile(
    createSettings(100, { 1: FAILURE_PROFILE_IMAGES[0] }),
    1,
    { type: 'random' },
    100,
    () => 0,
  );
  let writeCount = 0;
  const stored = storeStudentPetSnapshot({
    ...loadStoredStudentPetSnapshot(),
    studentPets: {},
    currencyBalances: result.balances,
    currencyHistory: result.history,
    studentEconomy: {},
    studentLife: result.studentLife,
  }, {
    setItem: () => {
      writeCount += 1;
      throw new Error('quota exceeded');
    },
  });

  assert.equal(stored, false);
  assert.equal(writeCount, 1);
});
