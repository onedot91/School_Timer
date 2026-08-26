import assert from 'node:assert/strict';
import test from 'node:test';

import { createStudentEconomyState } from './studentEconomy.js';
import { patchStudentEconomySettings } from './studentEconomySettings.js';
import { normalizeStudentLifeState } from './studentLife.js';

test('학생 경제 저장은 다른 학생의 구형 값을 바꾸지 않는다', () => {
  // Given
  const otherStudentHistory = [{ id: 'legacy-history' }];
  const otherStudentEconomy = { deposit: 25 };
  const studentEconomy = { ...createStudentEconomyState(), deposit: 30 };
  const studentLife = normalizeStudentLifeState(undefined);
  const currentValue = {
    schedule: ['수학'],
    currencyBalances: { 1: 145, 2: 100 },
    currencyHistory: { 1: [], 2: otherStudentHistory },
    studentEconomy: { 2: otherStudentEconomy },
    studentLife: {},
  };

  // When
  const result = patchStudentEconomySettings({
    currentValue,
    currencyBalanceEntries: { 1: 115 },
    currencyHistoryEntries: { 1: [] },
    studentEconomyEntries: { 1: studentEconomy },
    studentLife,
  });

  // Then
  assert.deepEqual(result, {
    schedule: ['수학'],
    currencyBalances: { 1: 115, 2: 100 },
    currencyHistory: { 1: [], 2: otherStudentHistory },
    studentEconomy: { 1: studentEconomy, 2: otherStudentEconomy },
    studentLife,
  });
});
