import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalStorageJson } from './storageV2Codec.js';
import { loadStorageCommandReceipt } from './storageCommandClient.js';
import { readConfirmedAuctionAward } from './auctionAwardConfirmation.js';

test('잘못된 낙찰 영수증은 성공 결과로 사용하지 않는다', () => {
  const award = { itemId: 'item-b', winner: 12, amount: 50, awardedAt: '2026-10-13T01:00:00Z' };
  for (const patch of [{ itemId: '' }, { winner: 24 }, { amount: 0 }, { amount: 1.5 }, { amount: 1000000 }, { awardedAt: '' }]) {
    assert.equal(readConfirmedAuctionAward({ awarded: true, award: { ...award, ...patch } }), null);
  }
  assert.equal(readConfirmedAuctionAward({ award }), null);
  assert.equal(readConfirmedAuctionAward(null), null);
});

test('낙찰 영수증에 확정 결과가 있으면 느린 전체 조회를 기다리지 않는다', async () => {
  const original = globalThis.fetch;
  const command = { requestId: 'auction-receipt-0001', action: 'teacher.auction.finalize', payload: { itemId: 'item-b', useLatestBid: true } };
  const payloadHash = createHash('sha256').update(canonicalStorageJson({ action: command.action, payload: command.payload })).digest('hex');
  const award = { itemId: 'item-b', winner: 12, amount: 50, awardedAt: '2026-10-13T01:00:00Z' };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ status: 'committed', action: command.action, payloadHash, committedAt: award.awardedAt, result: { awarded: true, award } });
    return Response.json({ error: 'SNAPSHOT_UNAVAILABLE' }, { status: 502 });
  };
  try {
    const saved = await loadStorageCommandReceipt(command.requestId, command);
    assert.deepEqual(saved?.result, { awarded: true, award });
    assert.equal(saved?.refreshPending, true);
    assert.equal(saved?.value, null);
    assert.equal(calls, 1, '확정된 낙찰 결과 표시에 추가 조회를 기다리게 하면 안 됩니다.');
  } finally { globalThis.fetch = original; }
});

test('저장 영수증은 화면 조회가 실패해도 저장을 확정하며 빈 화면 값을 만들지 않는다', async () => {
  const original = globalThis.fetch;
  const command = { requestId: 'receipt-fixture', action: 'student.letter.send', payload: { title: '합성', content: '검증' } };
  const payloadHash = createHash('sha256').update(canonicalStorageJson({ action: command.action, payload: command.payload })).digest('hex');
  const urls: string[] = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (String(url).includes('receiptOnly=1')) return Response.json({ status: 'committed', action: command.action, payloadHash, committedAt: '2026-09-09T01:00:00Z', result: { applied: true } });
    return Response.json({ error: 'SNAPSHOT_UNAVAILABLE' }, { status: 502 });
  };
  try {
    const saved = await loadStorageCommandReceipt(command.requestId, command);
    assert.equal(saved?.refreshPending, true);
    assert.equal(saved?.value, null);
    assert.deepEqual(saved?.result, { applied: true });
    assert.ok(urls.every(url => url.includes('requestId=receipt-fixture')));
  } finally { globalThis.fetch = original; }
});

test('다른 요청 내용의 영수증으로 저장 성공을 확정하지 않는다', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ status: 'committed', action: 'student.letter.send', payloadHash: '0'.repeat(64), committedAt: '2026-09-09T01:00:00Z', result: {} });
  try {
    await assert.rejects(loadStorageCommandReceipt('receipt-mismatch', { requestId: 'receipt-mismatch', action: 'student.letter.send', payload: {} }), /STORAGE_REQUEST_REUSED/);
  } finally { globalThis.fetch = original; }
});
