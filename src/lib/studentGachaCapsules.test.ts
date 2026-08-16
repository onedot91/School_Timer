import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDENT_GACHA_CAPSULES, getDailyGachaCapsules } from './studentGachaCapsules.ts';

test('고마 스킨 뽑기 캡슐은 같은 날짜에 같은 다섯 개로 유지된다', () => {
  const first = getDailyGachaCapsules('2026-08-16');
  const second = getDailyGachaCapsules('2026-08-16');

  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.equal(new Set(first).size, 5);
  assert.ok(first.every((capsule) => STUDENT_GACHA_CAPSULES.includes(capsule)));
});

test('고마 스킨 뽑기 캡슐은 날짜별로 다른 배치를 만든다', () => {
  const today = getDailyGachaCapsules('2027-07-29');
  const tomorrow = getDailyGachaCapsules('2027-07-30');

  assert.notDeepEqual(today, tomorrow);
});
