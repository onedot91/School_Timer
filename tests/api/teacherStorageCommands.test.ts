import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTeacherStorageCommand } from '../../src/server/teacherStorageCommands.js';
import { hasDailyWritingReward } from '../../src/lib/dailyWriting.js';
import { createTeacherSettingsChanges } from '../../src/lib/teacherStorageCommand.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from '../../src/lib/currency.js';
const context = { requestId: 'request-1', createdAt: '2026-09-08T07:00:00.000Z' };
const apply = (value: unknown, action: string, payload: unknown, id = context.requestId) => {
  const result = applyTeacherStorageCommand(value, action, payload, { ...context, requestId: id });
  assert.ok(result);
  return result;
};
test('teacher settings diff never includes student money or records and preserves concurrent earnings', () => {
  const before = { scheduleNotice: 'old', currencyBalances: { '17': 328 }, studentLife: { letters: [] },
    classDonation: { enabled: true, totalAmount: 5, history: [] }, classroomRoleMission: { enabled: true, results: {} } };
  const after = { ...before, scheduleNotice: 'new', currencyBalances: { '17': 0 }, studentLife: { letters: ['stale'] },
    classDonation: { enabled: false, totalAmount: 0, history: [] }, classroomRoleMission: { enabled: true, results: { stale: true } } };
  const changes = createTeacherSettingsChanges(before, after);
  assert.deepEqual(changes.map(change => change.field), ['scheduleNotice', 'classDonation.enabled']);
  const current = { ...before, currencyBalances: { '17': 334 }, studentLife: { letters: ['received'] } };
  const saved = apply(current, 'teacher.settings.patch', { changes }).value;
  assert.equal(saved.scheduleNotice, 'new');
  assert.deepEqual(saved.currencyBalances, current.currencyBalances);
  assert.deepEqual(saved.studentLife, current.studentLife);
});
test('same setting conflicts without overwriting it; protected fields are rejected', () => {
  assert.throws(() => apply({ scheduleNotice: 'remote' }, 'teacher.settings.patch', {
    changes: [{ field: 'scheduleNotice', before: 'old', after: 'mine' }],
  }), /TEACHER_SETTING_CONFLICT/);
  for (const field of ['currencyBalances', 'currencyHistory', 'studentLife', 'classroomRoleMission.results', 'classDonation.history']) {
    assert.throws(() => apply({}, 'teacher.settings.patch', { changes: [{ field, before: null, after: {} }] }), /INVALID_TEACHER_COMMAND/);
  }
});
test('manual delta uses latest wallet and stale absolute replacement is rejected', () => {
  const source = { currencyBalances: { '17': 334 } };
  const result = apply(source, 'teacher.currency.adjust', { studentNumbers: [17], amount: 6 });
  assert.equal(normalizeCurrencyBalances(result.value.currencyBalances)['17'], 340);
  assert.throws(() => apply(source, 'teacher.currency.set', { studentNumbers: [17], amount: 335, expectedBalance: 328 }), /CURRENCY_BALANCE_CHANGED/);
});
test('writing cancellation and reward append compensations without deleting or rebasing prior ledger', () => {
  const reward = apply({ currencyBalances: { '17': 100 } }, 'teacher.writing.reward', { studentNumber: 17, dateKey: '2026-09-08' });
  const original = normalizeCurrencyHistory(reward.value.currencyHistory)['17'][0];
  const cancelled = apply(reward.value, 'teacher.writing.cancel', { studentNumber: 17, dateKey: '2026-09-08' }, 'cancel');
  const entries = normalizeCurrencyHistory(cancelled.value.currencyHistory)['17'];
  assert.deepEqual(entries.find(entry => entry.id === original.id), original);
  assert.equal(entries.length, 2);
  assert.equal(hasDailyWritingReward(cancelled.value.currencyHistory, 17, '2026-09-08'), false);
  assert.equal(normalizeCurrencyBalances(cancelled.value.currencyBalances)['17'], 100);
  const again = apply(cancelled.value, 'teacher.writing.reward', { studentNumber: 17, dateKey: '2026-09-08' }, 'again');
  assert.equal(normalizeCurrencyBalances(again.value.currencyBalances)['17'], 125);
  assert.equal(normalizeCurrencyHistory(again.value.currencyHistory)['17'].length, 3);
});
test('weekly close is idempotent across different teacher requests for the same cycle', () => {
  const first = apply({ currencyBalances: { '17': 100 } }, 'teacher.auction.weekly-close', { cycleKey: '2026-09-07' });
  const second = apply(first.value, 'teacher.auction.weekly-close', { cycleKey: '2026-09-07' }, 'second-teacher');
  assert.deepEqual(second.value.currencyBalances, first.value.currencyBalances);
  assert.deepEqual(second.value.currencyHistory, first.value.currencyHistory);
});
test('sending a teacher letter preserves records outside presentation normalizer limits', () => {
  const letters = Array.from({ length: 700 }, (_, index) => ({ id: `old-${index}`, recipient: 1, senderLabel: '선생님',
    senderStudentNumber: null, title: '제목', content: '내용', createdAt: context.createdAt, readAt: null }));
  const saved = apply({ studentLife: { letters } }, 'teacher.mail.send', { recipients: [2], title: '새 편지', content: '내용' });
  assert.ok(saved.value.studentLife && typeof saved.value.studentLife === 'object');
  const life = Object.fromEntries(Object.entries(saved.value.studentLife));
  assert.ok(Array.isArray(life.letters));
  assert.equal(life.letters.length, 701);
});
test('removing a awarded auction item refunds it with a compensating entry and preserves the auction archive', () => {
  const source = { auctionItems: [{ id: 'item-a', dayIndex: 0, name: '공책' }, { id: 'item-b', dayIndex: 1, name: '연필' }],
    currencyBalances: { '17': 90 }, currencyHistory: { '17': [{ id: 'original-award', studentNumber: 17, before: 100, after: 90,
      delta: -10, reason: 'auction_award', createdAt: context.createdAt }] },
    auctionBids: { 'item-a': { bidder: 17, amount: 10 } }, auctionAwards: { 'item-a': { itemId: 'item-a', winner: 17, amount: 10, awardedAt: context.createdAt } } };
  const saved = apply(source, 'teacher.auction.remove', { itemId: 'item-a' }).value;
  assert.equal(normalizeCurrencyBalances(saved.currencyBalances)['17'], 100);
  const entries = normalizeCurrencyHistory(saved.currencyHistory)['17'];
  assert.equal(entries.length, 2);
  assert.ok(entries.some(entry => entry.id === 'original-award' && entry.delta === -10));
  assert.ok(entries.some(entry => entry.delta === 10));
  assert.ok(Array.isArray(saved.auctionArchives));
  assert.equal(saved.auctionArchives.length, 1);
});
