import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:3031';
const command = (requestId, slotId, title) => ({
  action: 'placeLibraryBook', requestId, slotId,
  book: { kind: 'new', title, author: '합성 작가', pageCount: 120 },
});
const request = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, options);
  return { status: response.status, body: await response.json() };
};
const put = (student, body, headers = {}) => request(`/qa/request/${student}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const reset = () => request('/qa/reset', { method: 'POST' });
const state = async () => (await request('/qa/state')).body;
const barrier = () => request('/qa/barrier', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reads: 2 }),
});

await reset();
const unauthenticated = await request('/api/shared-settings', { method: 'GET' });
assert.equal(unauthenticated.status, 401);
const crossSite = await put(1, command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, '차단'), { 'x-qa-cross-site': '1' });
assert.equal(crossSite.status, 403);
const malformed = await put(1, { action: 'placeLibraryBook', requestId: 'bad', slotId: 1, book: {} });
assert.equal(malformed.status, 400);
assert.equal((await state()).value.studentLife.books.length, 0);

await barrier();
const sameSlot = await Promise.all([
  put(1, command('11111111-1111-4111-8111-111111111111', 9, '첫 책')),
  put(2, command('22222222-2222-4222-8222-222222222222', 9, '둘째 책')),
]);
assert.deepEqual(sameSlot.map((entry) => entry.status).sort(), [200, 409]);
assert.equal((await state()).value.studentLife.books.length, 1);

await reset();
await barrier();
const differentSlots = await Promise.all([
  put(1, command('33333333-3333-4333-8333-333333333333', 10, '셋째 책')),
  put(2, command('44444444-4444-4444-8444-444444444444', 11, '넷째 책')),
]);
assert.deepEqual(differentSlots.map((entry) => entry.status), [200, 200]);
assert.deepEqual((await state()).value.studentLife.books.map((book) => book.librarySlot).sort(), [10, 11]);

await reset();
await request('/qa/timeout-after-commit', { method: 'POST' });
const timeoutReplay = await put(1, command('55555555-5555-4555-8555-555555555555', 12, '재시도 책'));
assert.equal(timeoutReplay.status, 200);
const timeoutState = await state();
assert.equal(timeoutState.value.studentLife.books.length, 1);
assert.equal(timeoutState.value.currencyBalances['1'], 10);
assert.equal(timeoutState.value.currencyHistory['1'].length, 1);

console.log(JSON.stringify({
  unauthenticated: unauthenticated.status,
  crossSite: crossSite.status,
  malformed: malformed.status,
  sameSlot: sameSlot.map((entry) => entry.status),
  sameSlotBookCount: 1,
  differentSlots: differentSlots.map((entry) => entry.status),
  differentSlotIds: [10, 11],
  timeoutReplay: timeoutReplay.status,
  timeoutState: { bookCount: 1, balance: 10, rewardHistoryCount: 1 },
}, null, 2));
