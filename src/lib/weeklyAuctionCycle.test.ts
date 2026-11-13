import assert from 'node:assert/strict';
import test from 'node:test';
import { getWeeklyAuctionCloseCycle } from './weeklyAuctionCycle.js';

const at = (dateKey: string) => getWeeklyAuctionCloseCycle(new Date(`${dateKey}T12:00:00+09:00`));

test('월~수에 마감하면 지난주(월~일)를 마감한다', () => {
  for (const day of ['2026-11-09', '2026-11-10', '2026-11-11']) {
    const cycle = at(day);
    assert.equal(cycle.weekStart, '2026-11-02');
    assert.equal(cycle.cycleKey, '2026-11-08');
    assert.equal(cycle.label, '11/2~11/8');
  }
});

test('목~일에 마감하면 이번 주(월~일)를 미리 마감한다', () => {
  for (const day of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']) {
    const cycle = at(day);
    assert.equal(cycle.weekStart, '2026-11-09');
    assert.equal(cycle.cycleKey, '2026-11-15');
  }
});

test('금요일 선마감 뒤 월요일은 같은 주이고, 그다음 주는 다른 키다', () => {
  assert.equal(at('2026-11-13').cycleKey, at('2026-11-16').cycleKey);
  assert.notEqual(at('2026-11-16').cycleKey, at('2026-11-20').cycleKey);
});

test('월 경계와 연말에도 주 범위가 맞다', () => {
  assert.equal(at('2026-12-28').label, '12/21~12/27');
  assert.equal(at('2027-01-01').cycleKey, '2027-01-03');
});
