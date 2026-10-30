import assert from 'node:assert/strict';
import test from 'node:test';
import { atomicTeacherCurrencyCommand, TeacherStorageCommandError } from '../../src/server/teacherStorageCommands.js';

test('지급과 금액 설정만 DB 한 번 호출 경로를 쓰고 차감·초기화는 기존 경로를 쓴다', () => {
  assert.deepEqual(atomicTeacherCurrencyCommand('teacher.currency.adjust', { studentNumbers: [3, 3, 5], amount: 5 }), { studentNumbers: [3, 5], amount: 5 });
  assert.deepEqual(atomicTeacherCurrencyCommand('teacher.currency.set', { studentNumbers: [3], amount: 0, expectedBalance: 120 }),
    { studentNumbers: [3], amount: 0, expectedBalance: 120 });
  assert.equal(atomicTeacherCurrencyCommand('teacher.currency.adjust', { studentNumbers: [3], amount: -5 }), null);
  assert.equal(atomicTeacherCurrencyCommand('teacher.currency.adjust', { studentNumbers: [3], amount: 0 }), null);
  assert.equal(atomicTeacherCurrencyCommand('teacher.currency.reset', {}), null);
  assert.equal(atomicTeacherCurrencyCommand('teacher.currency.deduct', { studentNumbers: [3], amount: 5 }), null);
});

test('잘못된 요청은 기존 경로와 같은 오류로 거절한다', () => {
  const code = (action: string, payload: unknown) => {
    try { atomicTeacherCurrencyCommand(action, payload); return null; }
    catch (error) { assert.ok(error instanceof TeacherStorageCommandError); return [error.code, error.status]; }
  };
  assert.deepEqual(code('teacher.currency.adjust', { studentNumbers: [24], amount: 5 }), ['INVALID_TEACHER_COMMAND', 400]);
  assert.deepEqual(code('teacher.currency.adjust', { studentNumbers: [3], amount: 1.5 }), ['INVALID_TEACHER_COMMAND', 400]);
  assert.deepEqual(code('teacher.currency.set', { studentNumbers: [3], amount: 10 }), ['CURRENCY_BALANCE_CHANGED', 409]);
  assert.deepEqual(code('teacher.currency.set', { studentNumbers: [3], amount: 10, expectedBalance: '10' }), ['CURRENCY_BALANCE_CHANGED', 409]);
});
