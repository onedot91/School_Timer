import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalStorageJson } from './storageV2Codec.js';
import { loadStorageCommandReceipt } from './storageCommandClient.js';

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
