import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auctionBidTakesLead,
  checkAuctionBid,
  getAuctionBidMinimum,
  getAuctionLeadBeforeWindow,
  getAuctionSealedWindow,
  getStudentReservedAuctionAmount,
  redactSealedAuctionForStudent,
  type AuctionBidInput,
} from './auctionBidRules.js';
import { normalizeAuctionAwards, normalizeAuctionBidHistory, normalizeAuctionBids, normalizeAuctionItems } from './currency.js';
import { applyStudentStorageCommand } from '../server/studentStorageCommands.js';

const day = (lunchStart: number) => [
  { id: 'p1', name: '1교시', type: 'class', start: 540, end: 580 },
  { id: 'p4', name: '4교시', type: 'class', start: 690, end: 730 },
  { id: 'lunch', name: '점심시간', type: 'lunch', start: lunchStart, end: lunchStart + 50 },
  { id: 'p5', name: '5교시', type: 'class', start: lunchStart + 50, end: lunchStart + 90 },
];
// Lunch starts at 12:50, and at 13:00 on Wednesday.
const schedule = { 1: day(770), 2: day(770), 3: day(780), 4: day(770), 5: day(770) };
// 2026-11-23 is a Monday; Korean time is UTC+9.
const at = (date: string, time: string) => Date.parse(`${date}T${time}+09:00`);
const iso = (date: string, time: string) => new Date(at(date, time)).toISOString();

test('lunch in the timetable is the sealed window, per weekday and clock offset', () => {
  assert.equal(getAuctionSealedWindow(at('2026-11-23', '12:49:59'), schedule, 0), null);
  assert.deepEqual(getAuctionSealedWindow(at('2026-11-23', '12:50:00'), schedule, 0),
    { startMs: at('2026-11-23', '12:50:00'), endMs: at('2026-11-23', '13:40:00') });
  assert.equal(getAuctionSealedWindow(at('2026-11-23', '13:40:00'), schedule, 0), null);
  assert.equal(getAuctionSealedWindow(at('2026-11-25', '12:55:00'), schedule, 0), null);
  assert.notEqual(getAuctionSealedWindow(at('2026-11-25', '13:00:00'), schedule, 0), null);
  // The classroom clock runs five minutes ahead, so lunch starts five real minutes earlier.
  assert.deepEqual(getAuctionSealedWindow(at('2026-11-23', '12:46:00'), schedule, 300),
    { startMs: at('2026-11-23', '12:45:00'), endMs: at('2026-11-23', '13:35:00') });
  assert.equal(getAuctionSealedWindow(at('2026-11-29', '12:55:00'), schedule, 0), null);
  assert.equal(getAuctionSealedWindow(at('2026-11-23', '12:55:00'), null, 0), null);
});

const items = normalizeAuctionItems(null);
const item = items[0];
const ids = items.map(({ id }) => id);
const lunch = getAuctionSealedWindow(at('2026-11-23', '13:00:00'), schedule, 0);
assert.ok(lunch);
const entry = (bidder: number, amount: number, time: string) => ({ itemId: item.id, bidder, amount, createdAt: iso('2026-11-23', time) });
const base = (overrides: Partial<AuctionBidInput> = {}): AuctionBidInput => ({
  item,
  bids: normalizeAuctionBids({ [item.id]: { bidder: 2, amount: 75 } }, ids),
  history: normalizeAuctionBidHistory({ [item.id]: [entry(2, 75, '11:00:00')] }, ids),
  awards: normalizeAuctionAwards(null, ids),
  activeItemIds: ids,
  studentNumber: 1,
  amount: 76,
  balance: 100,
  window: null,
  ...overrides,
});

test('open bidding raises by one coin and keeps the old rules', () => {
  assert.equal(getAuctionBidMinimum(base()), 76);
  assert.equal(checkAuctionBid(base({ amount: 75 })), 'BID_TOO_LOW');
  assert.equal(checkAuctionBid(base({ amount: 76 })), null);
  assert.equal(checkAuctionBid(base({ studentNumber: 2, amount: 90 })), 'ALREADY_HIGHEST_BIDDER');
  assert.equal(checkAuctionBid(base({ amount: 101 })), 'INSUFFICIENT_FUNDS');
  assert.equal(getAuctionBidMinimum(base({ bids: normalizeAuctionBids(null, ids) })), item.startPrice);
});

test('lunch bids must beat the pre-lunch lead and may only be raised', () => {
  const history = normalizeAuctionBidHistory({ [item.id]: [entry(2, 75, '11:00:00'), entry(3, 90, '12:55:00'), entry(1, 80, '12:56:00')] }, ids);
  const bids = normalizeAuctionBids({ [item.id]: { bidder: 3, amount: 90 } }, ids);
  const lunchBid = base({ window: lunch, bids, history });
  // Student 1 already bid 80 at lunch: the next bid must be higher, whatever the hidden lead.
  assert.equal(getAuctionBidMinimum(lunchBid), 81);
  assert.equal(checkAuctionBid({ ...lunchBid, amount: 80 }), 'BID_TOO_LOW');
  assert.equal(checkAuctionBid({ ...lunchBid, amount: 85 }), null, 'below the hidden lead is still accepted');
  // Student 4 has not bid at lunch: one coin over the pre-lunch lead is enough, and an equal amount is allowed.
  assert.equal(getAuctionBidMinimum({ ...lunchBid, studentNumber: 4 }), 76);
  assert.equal(checkAuctionBid({ ...lunchBid, studentNumber: 4, amount: 90 }), null);
  // The pre-lunch leader may raise during lunch.
  assert.equal(checkAuctionBid({ ...lunchBid, studentNumber: 2, amount: 76 }), null);
});

test('an equal lunch bid never takes the lead from the earlier one', () => {
  const bids = normalizeAuctionBids({ [item.id]: { bidder: 3, amount: 90 } }, ids);
  assert.equal(auctionBidTakesLead(bids, item.id, 90, lunch), false);
  assert.equal(auctionBidTakesLead(bids, item.id, 89, lunch), false);
  assert.equal(auctionBidTakesLead(bids, item.id, 91, lunch), true);
  assert.equal(auctionBidTakesLead(bids, item.id, 50, null), true, 'open bids were already checked against the lead');
});

test('lunch reservations hold own lunch bids and the pre-lunch lead, never revealing the hidden lead', () => {
  const history = normalizeAuctionBidHistory({
    [items[0].id]: [{ ...entry(1, 40, '11:00:00') }, { ...entry(2, 60, '12:55:00') }],
    [items[1].id]: [{ ...entry(1, 30, '12:58:00'), itemId: items[1].id }],
  }, ids);
  // Student 2 now leads item 0 on the server, but student 1 cannot know that.
  const bids = normalizeAuctionBids({ [items[0].id]: { bidder: 2, amount: 60 }, [items[1].id]: { bidder: 1, amount: 30 } }, ids);
  const input = { bids, history, awards: normalizeAuctionAwards(null, ids), activeItemIds: ids, studentNumber: 1 };
  assert.equal(getStudentReservedAuctionAmount({ ...input, window: lunch }), 70);
  assert.equal(getStudentReservedAuctionAmount({ ...input, window: null }), 30);
});

test('during lunch students see the pre-lunch lead and only their own lunch bids', () => {
  const open = items[1].id;
  const value = {
    auctionBids: { [item.id]: { bidder: 3, amount: 90 }, [open]: { bidder: 2, amount: 44 } },
    auctionBidHistory: {
      [item.id]: [entry(2, 75, '11:00:00'), entry(3, 90, '12:55:00'), entry(1, 80, '12:56:00')],
    },
  };
  const redacted = redactSealedAuctionForStudent(value, 1, lunch);
  // The other item has no history in this value, so its lead is left out rather than guessed.
  assert.deepEqual(redacted.auctionBids, { [item.id]: { amount: 75, bidder: 2 } });
  assert.deepEqual(redacted.auctionBidHistory, { [item.id]: [entry(2, 75, '11:00:00'), entry(1, 80, '12:56:00')] });
  assert.doesNotMatch(JSON.stringify(redacted), /"amount":90/);
  assert.equal(redactSealedAuctionForStudent(value, 1, null), value);
  const historyOnly = normalizeAuctionBidHistory(value.auctionBidHistory, ids);
  assert.deepEqual(getAuctionLeadBeforeWindow(historyOnly, item.id, lunch), { amount: 75, bidder: 2 });
});

const lunchContext = (requestId: string, time: string) => ({ requestId, createdAt: iso('2026-11-27', time) });
const friday = (time: string) => ({ itemId: item.id, createdAt: iso('2026-11-27', time) });

test('the server records lunch bids below the hidden lead and keeps the earlier bid on a tie', () => {
  const current = {
    weeklySchedule: schedule,
    auctionItems: items,
    auctionBids: { [item.id]: { bidder: 2, amount: 75 } },
    auctionBidHistory: { [item.id]: [{ ...friday('11:00:00'), bidder: 2, amount: 75 }] },
    currencyBalances: { '1': 100, '2': 100, '3': 100 },
  };
  const first = applyStudentStorageCommand(current, 3, 'student.auction.bid', { itemId: item.id, amount: 90 }, lunchContext('lunch-bid-0001', '12:55:00'));
  assert.ok(first);
  const tie = applyStudentStorageCommand(first.value, 1, 'student.auction.bid', { itemId: item.id, amount: 90 }, lunchContext('lunch-bid-0002', '12:56:00'));
  assert.ok(tie);
  assert.deepEqual(Reflect.get(Object(tie.value.auctionBids), item.id), { bidder: 3, amount: 90 });
  assert.throws(() => applyStudentStorageCommand(tie.value, 1, 'student.auction.bid', { itemId: item.id, amount: 89 }, lunchContext('lunch-bid-0003', '12:57:00')), /BID_TOO_LOW/);
  const raised = applyStudentStorageCommand(tie.value, 1, 'student.auction.bid', { itemId: item.id, amount: 91 }, lunchContext('lunch-bid-0004', '12:58:00'));
  assert.ok(raised);
  assert.deepEqual(Reflect.get(Object(raised.value.auctionBids), item.id), { bidder: 1, amount: 91 });
  assert.equal(normalizeAuctionBidHistory(raised.value.auctionBidHistory, ids)[item.id].length, 4);
});

test('outside lunch the server keeps the one-coin open rules', () => {
  const current = {
    weeklySchedule: schedule,
    auctionItems: items,
    auctionBids: { [item.id]: { bidder: 2, amount: 75 } },
    auctionBidHistory: { [item.id]: [{ ...friday('11:00:00'), bidder: 2, amount: 75 }] },
    currencyBalances: { '1': 100 },
  };
  assert.throws(() => applyStudentStorageCommand(current, 1, 'student.auction.bid', { itemId: item.id, amount: 75 }, lunchContext('open-bid-0001', '11:30:00')), /BID_TOO_LOW/);
  const raised = applyStudentStorageCommand(current, 1, 'student.auction.bid', { itemId: item.id, amount: 76 }, lunchContext('open-bid-0002', '11:30:00'));
  assert.ok(raised);
  assert.deepEqual(Reflect.get(Object(raised.value.auctionBids), item.id), { bidder: 1, amount: 76 });
});
