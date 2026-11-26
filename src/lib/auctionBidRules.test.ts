import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auctionBidTakesLead,
  checkAuctionBid,
  getAuctionBidMinimum,
  getAuctionBidStep,
  getStudentReservedAuctionAmount,
  redactSealedAuctionForStudent,
  type AuctionBidInput,
} from './auctionBidRules.js';
import { normalizeAuctionAwards, normalizeAuctionBidHistory, normalizeAuctionBids, normalizeAuctionItems } from './currency.js';
import { applyStudentStorageCommand } from '../server/studentStorageCommands.js';

const day = (lunchStart: number) => [
  { id: 'p1', name: '1교시', type: 'class', start: 540, end: 580 },
  { id: 'p2', name: '2교시', type: 'class', start: 590, end: 630 },
  { id: 'p3', name: '3교시', type: 'class', start: 640, end: 680 },
  { id: 'p4', name: '4교시', type: 'class', start: 690, end: 730 },
  { id: 'p5', name: '5교시', type: 'class', start: 740, end: lunchStart },
  { id: 'lunch', name: '점심시간', type: 'lunch', start: lunchStart, end: lunchStart + 50 },
  { id: 'p6', name: '6교시', type: 'class', start: lunchStart + 50, end: lunchStart + 90 },
];
// Lunch starts at 12:50, and at 13:00 on Wednesday.
const schedule = { 1: day(770), 2: day(770), 3: day(780), 4: day(770), 5: day(770) };
// 2026-11-23 is a Monday; Korean time is UTC+9.
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+09:00`);

test('the raise step follows the timetable: 5 for periods 1-3, 10 from period 4, 20 at lunch', () => {
  assert.equal(getAuctionBidStep(at('2026-11-23', '09:10'), schedule, 0), 5);
  assert.equal(getAuctionBidStep(at('2026-11-23', '11:29'), schedule, 0), 5);
  assert.equal(getAuctionBidStep(at('2026-11-23', '11:30'), schedule, 0), 10);
  assert.equal(getAuctionBidStep(at('2026-11-23', '12:49'), schedule, 0), 10);
  assert.equal(getAuctionBidStep(at('2026-11-23', '12:50'), schedule, 0), 20);
  assert.equal(getAuctionBidStep(at('2026-11-23', '13:39'), schedule, 0), 20);
  assert.equal(getAuctionBidStep(at('2026-11-23', '13:40'), schedule, 0), 10);
});

test('the raise step uses each weekday lunch and the teacher clock offset', () => {
  assert.equal(getAuctionBidStep(at('2026-11-25', '12:55'), schedule, 0), 10);
  assert.equal(getAuctionBidStep(at('2026-11-25', '13:00'), schedule, 0), 20);
  assert.equal(getAuctionBidStep(at('2026-11-23', '12:45'), schedule, 300), 20);
  assert.equal(getAuctionBidStep(at('2026-11-29', '12:55'), schedule, 0), 5);
  assert.equal(getAuctionBidStep(at('2026-11-23', '12:55'), null, 0), 5);
});

const items = normalizeAuctionItems(null);
const item = items[0];
const ids = items.map(({ id }) => id);
const base = (overrides: Partial<AuctionBidInput> = {}): AuctionBidInput => ({
  item,
  bids: normalizeAuctionBids({ [item.id]: { bidder: 2, amount: 75 } }, ids),
  history: normalizeAuctionBidHistory({ [item.id]: [{ itemId: item.id, bidder: 2, amount: 75, createdAt: '2026-11-23T01:00:00Z' }] }, ids),
  awards: normalizeAuctionAwards(null, ids),
  activeItemIds: ids,
  sealedItemIds: new Set(),
  studentNumber: 1,
  amount: 80,
  balance: 100,
  step: 5,
  ...overrides,
});
const sealedFirst = new Set([item.id]);

test('open bids must clear the current lead by the step', () => {
  assert.equal(getAuctionBidMinimum(base()), 80);
  assert.equal(checkAuctionBid(base({ amount: 76 })), 'BID_TOO_LOW');
  assert.equal(checkAuctionBid(base({ amount: 80 })), null);
  assert.equal(checkAuctionBid(base({ amount: 94, step: 20 })), 'BID_TOO_LOW');
  assert.equal(checkAuctionBid(base({ amount: 95, step: 20 })), null);
  assert.equal(checkAuctionBid(base({ studentNumber: 2, amount: 90 })), 'ALREADY_HIGHEST_BIDDER');
  assert.equal(checkAuctionBid(base({ amount: 101 })), 'INSUFFICIENT_FUNDS');
  // The first bid only needs the start price, whatever the step.
  assert.equal(getAuctionBidMinimum(base({ bids: normalizeAuctionBids(null, ids), step: 20 })), item.startPrice);
});

test('sealed bids allow one bid per item and may sit below the hidden lead', () => {
  const sealed = base({ sealedItemIds: sealedFirst, amount: 30 });
  assert.equal(checkAuctionBid(sealed), null);
  assert.equal(checkAuctionBid({ ...sealed, sealedItemIds: new Set([items[1].id]) }), 'BID_TOO_LOW', 'other items stay open');
  assert.equal(auctionBidTakesLead(sealed.bids, item.id, 30, true), false);
  assert.equal(auctionBidTakesLead(sealed.bids, item.id, 75, true), false, 'a tie keeps the earlier bid');
  assert.equal(auctionBidTakesLead(sealed.bids, item.id, 76, true), true);
  assert.equal(checkAuctionBid({ ...sealed, amount: item.startPrice - 1 }), 'BID_TOO_LOW');
  assert.equal(checkAuctionBid({ ...sealed, studentNumber: 2 }), 'ALREADY_BID');
});

test('sealed bids hold the student coins whether or not they lead', () => {
  const history = normalizeAuctionBidHistory({
    [items[0].id]: [{ itemId: items[0].id, bidder: 1, amount: 30, createdAt: '2026-11-23T01:00:00Z' }],
    [items[1].id]: [{ itemId: items[1].id, bidder: 1, amount: 40, createdAt: '2026-11-23T01:00:00Z' }],
  }, ids);
  const input = { bids: base().bids, history, awards: normalizeAuctionAwards(null, ids), activeItemIds: ids, studentNumber: 1 };
  assert.equal(getStudentReservedAuctionAmount({ ...input, sealedItemIds: new Set() }), 0);
  assert.equal(getStudentReservedAuctionAmount({ ...input, sealedItemIds: sealedFirst }), 30);
  const bothSealed = new Set([items[0].id, items[1].id]);
  assert.equal(getStudentReservedAuctionAmount({ ...input, sealedItemIds: bothSealed }), 70);
  assert.equal(checkAuctionBid(base({ sealedItemIds: bothSealed, history, item: items[2], amount: 31 })), 'INSUFFICIENT_FUNDS');
});

test('students receive no leading bid and only their own history on sealed items', () => {
  const open = items[1].id;
  const value = {
    auctionSealedItemIds: [item.id],
    auctionBids: { [item.id]: { bidder: 2, amount: 75 }, [open]: { bidder: 2, amount: 44 } },
    auctionBidHistory: { [item.id]: [{ bidder: 2, amount: 75 }, { bidder: 1, amount: 30 }], [open]: [{ bidder: 2, amount: 44 }] },
    auctionAwards: {},
  };
  const redacted = redactSealedAuctionForStudent(value, 1);
  assert.deepEqual(redacted.auctionBids, { [item.id]: { amount: 0, bidder: null }, [open]: { bidder: 2, amount: 44 } });
  assert.deepEqual(redacted.auctionBidHistory, { [item.id]: [{ bidder: 1, amount: 30 }], [open]: [{ bidder: 2, amount: 44 }] });
  assert.doesNotMatch(JSON.stringify(redacted), /75/);
  assert.equal(redactSealedAuctionForStudent({ ...value, auctionSealedItemIds: [] }, 1).auctionBids, value.auctionBids);
  assert.equal(redactSealedAuctionForStudent({ ...value, auctionSealedItemIds: ['not-an-item'] }, 1).auctionBids, value.auctionBids);
});

test('the server records a sealed bid below the lead without taking the lead', () => {
  const current = {
    auctionSealedItemIds: [item.id],
    auctionItems: items,
    auctionBids: { [item.id]: { bidder: 2, amount: 75 } },
    auctionBidHistory: { [item.id]: [{ itemId: item.id, bidder: 2, amount: 75, createdAt: '2026-11-23T01:00:00.000Z' }] },
    currencyBalances: { '1': 100, '2': 100 },
  };
  const context = { requestId: 'sealed-bid-0001', createdAt: '2026-11-27T01:00:00.000Z' };
  const result = applyStudentStorageCommand(current, 1, 'student.auction.bid', { itemId: item.id, amount: 30 }, context);
  assert.ok(result);
  assert.deepEqual(Reflect.get(Object(result.value.auctionBids), item.id), { bidder: 2, amount: 75 });
  assert.equal(normalizeAuctionBidHistory(result.value.auctionBidHistory, ids)[item.id].length, 2);
  assert.throws(() => applyStudentStorageCommand(result.value, 1, 'student.auction.bid', { itemId: item.id, amount: 90 }, context), /ALREADY_BID/);
});

test('the server rejects an open raise smaller than the step', () => {
  const current = {
    auctionItems: items,
    auctionBids: { [item.id]: { bidder: 2, amount: 75 } },
    auctionBidHistory: {},
    currencyBalances: { '1': 100 },
  };
  const context = { requestId: 'open-bid-0001', createdAt: '2026-11-27T01:00:00.000Z' };
  assert.throws(() => applyStudentStorageCommand(current, 1, 'student.auction.bid', { itemId: item.id, amount: 76 }, context), /BID_TOO_LOW/);
  assert.ok(applyStudentStorageCommand(current, 1, 'student.auction.bid', { itemId: item.id, amount: 80 }, context));
});
