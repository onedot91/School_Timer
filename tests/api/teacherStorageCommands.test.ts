import { normalizeSavedRandomDrawState } from '../../src/lib/randomDraw.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTeacherStorageCommand } from '../../src/server/teacherStorageCommands.js';
import { hasDailyWritingReward } from '../../src/lib/dailyWriting.js';
import { createTeacherSettingsChanges } from '../../src/lib/teacherStorageCommand.js';
import { normalizeAuctionItems, normalizeCurrencyBalances, normalizeCurrencyHistory } from '../../src/lib/currency.js';
import { assembleStorageState, splitStorageState } from '../../src/lib/storageV2Codec.js';
const context = { requestId: 'request-1', createdAt: '2026-09-08T07:00:00.000Z' };
const apply = (value: unknown, action: string, payload: unknown, id = context.requestId) => {
  const result = applyTeacherStorageCommand(value, action, payload, { ...context, requestId: id });
  assert.ok(result);
  return result;
};
test('added auction item survives settings patch, storage projection and reload without a name edit', () => {
  const before = { auctionItems: normalizeAuctionItems(null), currencyBalances: { '17': 328 } };
  const items = before.auctionItems.map((item, index) => index === 3 ? { ...item, isConfigured: true } : item);
  const changes = createTeacherSettingsChanges(before, { ...before, auctionItems: items });
  assert.equal(changes.length, 1);
  const saved = apply(before, 'teacher.settings.patch', { changes }).value;
  const reloaded = assembleStorageState(splitStorageState(saved));
  assert.equal(normalizeAuctionItems(reloaded.auctionItems)[3].isConfigured, true);
  assert.deepEqual(reloaded.currencyBalances, before.currencyBalances);
  assert.deepEqual(normalizeAuctionItems(reloaded.auctionItems).filter(item => !item.isConfigured),
    before.auctionItems.filter(item => item.dayIndex !== 3));
});
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

test('auction settings survive JSON object key reordering and legacy omitted defaults', () => {
  const raw = [{ name: '공책', dayIndex: 0, id: 'item-a' }];
  const base = { auctionItems: normalizeAuctionItems(raw) };
  const after = { auctionItems: base.auctionItems.map(item => item.id === 'item-a' ? { ...item, name: '새 공책' } : item) };
  const changes = createTeacherSettingsChanges(base, after);
  const stored = assembleStorageState(splitStorageState({ auctionItems: raw }));
  const saved = apply(stored, 'teacher.settings.patch', { changes }).value;
  assert.equal(normalizeAuctionItems(saved.auctionItems)[0].name, '새 공책');
  const reordered = JSON.parse(JSON.stringify(after, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).reverse()) : value));
  assert.deepEqual(createTeacherSettingsChanges(after, reordered), []);
  assert.deepEqual(apply(reordered, 'teacher.settings.patch', { changes }).value.auctionItems, after.auctionItems);
  const concurrent = { auctionItems: base.auctionItems.map(item => item.id === 'item-a' ? { ...item, name: '다른 기기 물품' } : item) };
  assert.throws(() => apply(concurrent, 'teacher.settings.patch', { changes }), /TEACHER_SETTING_CONFLICT/);
});

test('initial auction configuration can be created from an absent storage field', () => {
  const after = { auctionItems: normalizeAuctionItems([{ id: 'item-a', dayIndex: 0, name: '공책' }]) };
  const saved = apply({}, 'teacher.settings.patch', { changes: createTeacherSettingsChanges({}, after) });
  assert.deepEqual(saved.value.auctionItems, after.auctionItems);
});

test('teacher hydration with ordinary random draw history does not crash or invent changes', () => {
  const randomDraw = normalizeSavedRandomDrawState({ activeCaseId: 'fixture', cases: [{
    id: 'fixture', historyEntries: [{ id: 'draw-1', number: 3, kind: 'normal' }],
  }] });
  assert.equal(Object.hasOwn(randomDraw.cases[0].historyEntries[0], 'sourceEntryId'), true);
  assert.equal(randomDraw.cases[0].historyEntries[0].sourceEntryId, undefined);
  const hydrated = { randomDraw, scheduleNotice: 'before' };
  const persisted = JSON.parse(JSON.stringify(hydrated));
  assert.deepEqual(createTeacherSettingsChanges(persisted, hydrated), []);
  const changes = createTeacherSettingsChanges(persisted, { ...hydrated, scheduleNotice: 'after' });
  assert.deepEqual(changes, [{ field: 'scheduleNotice', before: 'before', after: 'after' }]);
  const saved = apply(persisted, 'teacher.settings.patch', { changes });
  assert.deepEqual(saved.value.randomDraw, persisted.randomDraw);
  assert.equal(saved.value.scheduleNotice, 'after');
});

test('removing an unawarded item releases its reservation without crediting money twice', async () => {
  const { AUCTION_ITEM_IDS, normalizeAuctionBids, getReservedAuctionBidAmount } = await import('../../src/lib/currency.js');
  const source = {
    auctionItems: [{ id: 'item-a', dayIndex: 0, name: '공책' }, { id: 'item-b', dayIndex: 1, name: '연필' }],
    currencyBalances: { '17': 100, '2': 75 },
    auctionBids: { 'item-a': { bidder: 17, amount: 30 }, 'item-b': { bidder: 17, amount: 20 } },
  };
  assert.equal(getReservedAuctionBidAmount(normalizeAuctionBids(source.auctionBids, AUCTION_ITEM_IDS), 17), 50);
  const saved = apply(source, 'teacher.auction.remove', { itemId: 'item-a' }).value;
  assert.equal(getReservedAuctionBidAmount(normalizeAuctionBids(saved.auctionBids, AUCTION_ITEM_IDS), 17), 20);
  assert.equal(normalizeCurrencyBalances(saved.currencyBalances)['17'], 100);
  assert.equal(normalizeCurrencyBalances(saved.currencyBalances)['2'], 75);
  assert.equal(normalizeCurrencyHistory(saved.currencyHistory)['17'].length, 0);
  assert.throws(() => apply(saved, 'teacher.auction.remove', { itemId: 'item-a' }), /AUCTION_ITEM_NOT_REMOVABLE/);
});
