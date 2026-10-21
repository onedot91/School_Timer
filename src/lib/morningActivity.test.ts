import assert from 'node:assert/strict';
import test from 'node:test';
import { hasMorningActivityEnded, isMorningSlot } from './morningActivity';

const morning = { name: '아침활동', type: 'morning' };
const legacyMorning = { name: '아침활동', type: 'class' };
const firstClass = { name: '1교시', type: 'class' };

test('아침활동은 morning 유형이나 기존 이름으로 판별한다', () => {
  assert.equal(isMorningSlot(morning), true);
  assert.equal(isMorningSlot(legacyMorning), true);
  assert.equal(isMorningSlot(firstClass), false);
});

test('아침활동에서 다른 일정이나 빈 시간으로 넘어갈 때만 종료로 본다', () => {
  assert.equal(hasMorningActivityEnded(morning, firstClass), true);
  assert.equal(hasMorningActivityEnded(morning, null), true);
  assert.equal(hasMorningActivityEnded(legacyMorning, firstClass), true);
});

test('아침활동이 이어지거나 다른 일정 사이 전환은 종료가 아니다', () => {
  assert.equal(hasMorningActivityEnded(morning, morning), false);
  assert.equal(hasMorningActivityEnded(null, firstClass), false);
  assert.equal(hasMorningActivityEnded(null, null), false);
  assert.equal(hasMorningActivityEnded(firstClass, null), false);
});
