import assert from 'node:assert/strict';
import test from 'node:test';
import { createFailureExhibitionMissionEntry } from './failureExhibitionMission.js';

test('실패 이야기를 저장하면 같은 주에 10고마를 한 번만 지급한다', () => {
  const initial = {
    currencyBalances: { 6: 100 },
    currencyHistory: { 6: [] },
    studentLife: {},
  };
  const first = createFailureExhibitionMissionEntry(initial, {
    id: 'failure-1',
    studentNumber: 6,
    failure: '발표할 말을 잊었어요.',
    lesson: '다음에는 쪽지에 적어 둘 거예요.',
    createdAt: '2026-07-13T03:00:00.000Z',
  });
  const second = createFailureExhibitionMissionEntry(first.value, {
    id: 'failure-2',
    studentNumber: 6,
    failure: '준비물을 놓고 왔어요.',
    lesson: '전날 가방을 확인할 거예요.',
    createdAt: '2026-07-14T03:00:00.000Z',
  });

  assert.equal(first.applied, true);
  assert.equal(first.awarded, true);
  assert.equal(first.balance, 110);
  assert.equal(first.studentLife.failureStories.length, 1);
  assert.equal(second.applied, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 110);
  assert.equal(second.studentLife.failureStories.length, 2);
});

test('저장되지 않은 실패 이야기에는 고마를 지급하지 않는다', () => {
  const result = createFailureExhibitionMissionEntry({
    currencyBalances: { 6: 100 },
    currencyHistory: { 6: [] },
    studentLife: {},
  }, {
    id: 'failure-empty',
    studentNumber: 6,
    failure: '   ',
    lesson: '다시 해 볼게요.',
    createdAt: '2026-07-13T03:00:00.000Z',
  });

  assert.equal(result.applied, false);
  assert.equal(result.awarded, false);
  assert.equal(result.balance, 100);
  assert.equal(result.studentLife.failureStories.length, 0);
});
