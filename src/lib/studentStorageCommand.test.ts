import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStudentStorageCommand, loadStudentStorageFormDraft, saveStudentStorageFormDraft, hasUnconfirmedStudentStorageDraft, executeStudentEconomyWithDraft, confirmStudentEconomyDraft, hasUnconfirmedStudentEconomyDraft } from './studentStorageCommand.js';
import { createStudentEconomyState } from './studentEconomy.js';
import { normalizeStudentLifeState } from './studentLife.js';

const success = () => Response.json({ value: { studentLife: { letters: [] } }, updatedAt: '2026-09-08T05:00:00Z', result: { applied: true } });

test('미확인 저장의 초안과 ID를 보존하며 직접 재시도만 같은 요청을 전송한다', async () => {
  const previousFetch = globalThis.fetch, bodies: Record<string, unknown>[] = [];
  let succeeding = false;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      bodies.push(JSON.parse(String(init.body)));
      return succeeding ? success() : Response.json({ error: 'TEMPORARY' }, { status: 502 });
    }
    return Response.json({ status: 'unknown' });
  };
  const payload = { recipient: 0, title: '보존', content: '초안 내용' };
  try {
    saveStudentStorageFormDraft(21, 'student.letter.send', payload);
    await assert.rejects(executeStudentStorageCommand(21, 'student.letter.send', payload), /CONFIRMATION_REQUIRED/);
    assert.equal(hasUnconfirmedStudentStorageDraft(21, 'student.letter.send'), true);
    assert.deepEqual(loadStudentStorageFormDraft(21, 'student.letter.send'), payload);
    await assert.rejects(executeStudentStorageCommand(21, 'student.letter.send', { ...payload, content: '바꾼 내용' }), /SAVE_DRAFT_PENDING/);
    assert.equal(bodies.length, 1);
    succeeding = true;
    await executeStudentStorageCommand(21, 'student.letter.send', payload);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].requestId, bodies[1].requestId);
    assert.equal(hasUnconfirmedStudentStorageDraft(21, 'student.letter.send'), false);
    assert.deepEqual(loadStudentStorageFormDraft(21, 'student.letter.send'), {});
  } finally { globalThis.fetch = previousFetch; }
});

test('확실히 거절된 저장은 입력을 보존하고 수정한 내용의 수동 제출을 허용한다', async () => {
  const previousFetch = globalThis.fetch, ids: unknown[] = [];
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    ids.push(JSON.parse(String(init.body)).requestId);
    return ids.length === 1 ? Response.json({ error: 'INVALID_INPUT' }, { status: 400 }) : success();
  };
  try {
    await assert.rejects(executeStudentStorageCommand(22, 'student.failure.create', { failure: '', lesson: '배움' }), /INVALID_INPUT/);
    assert.equal(hasUnconfirmedStudentStorageDraft(22, 'student.failure.create'), false);
    assert.equal(loadStudentStorageFormDraft(22, 'student.failure.create').lesson, '배움');
    saveStudentStorageFormDraft(22, 'student.failure.create', { failure: '수정', lesson: '배움' });
    assert.equal(loadStudentStorageFormDraft(22, 'student.failure.create').failure, '수정');
    await executeStudentStorageCommand(22, 'student.failure.create', { failure: '수정', lesson: '배움' });
    assert.notEqual(ids[0], ids[1]);
  } finally { globalThis.fetch = previousFetch; }
});

test('거래 입력을 바꿔도 미확인 거래를 새 ID로 재결제하지 않고 직접 확인할 수 있다', async () => {
  const previousFetch = globalThis.fetch, bodies: Record<string, unknown>[] = [];
  let succeeding = false;
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    bodies.push(JSON.parse(String(init.body)));
    return succeeding ? Response.json({ balance: 70, currencyBalanceEntries: { 23: 70 }, currencyHistoryEntries: { 23: [] }, studentEconomy: createStudentEconomyState(), studentLife: normalizeStudentLifeState({}), message: '확인 완료', applied: true, updatedAt: '2026-09-08T05:00:00Z' }) : Response.json({ error: 'TIMEOUT' }, { status: 504 });
  };
  try {
    await assert.rejects(executeStudentEconomyWithDraft(23, { type: 'deposit', amount: 30 }), /CONFIRMATION_REQUIRED/);
    assert.equal(hasUnconfirmedStudentEconomyDraft(23), true);
    await assert.rejects(executeStudentEconomyWithDraft(23, { type: 'deposit', amount: 40 }), /SAVE_DRAFT_PENDING/);
    assert.equal(bodies.length, 1);
    succeeding = true;
    const result = await confirmStudentEconomyDraft(23);
    assert.equal(result?.balance, 70);
    assert.equal(bodies[0].requestId, bodies[1].requestId);
    assert.deepEqual(bodies[0].action, bodies[1].action);
    assert.equal(hasUnconfirmedStudentEconomyDraft(23), false);
  } finally { globalThis.fetch = previousFetch; }
});

test('입찰 대상 학생 번호를 저장 요청과 미확인 영수증 조회에 유지한다', async () => {
  const previousFetch = globalThis.fetch;
  const requests: { url: string; body?: Record<string, unknown> }[] = [];
  let committed = false;
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url: String(url), body });
    if (init?.method === 'POST') return committed ? success() : Response.json({ error: 'TEMPORARY' }, { status: 502 });
    return Response.json({ status: 'unknown' });
  };
  try {
    await assert.rejects(executeStudentStorageCommand(6, 'student.auction.bid', { itemId: 'item-c', amount: 14 }, 'target-test'), /CONFIRMATION_REQUIRED/);
    committed = true;
    await executeStudentStorageCommand(6, 'student.auction.bid', { itemId: 'item-c', amount: 14 }, 'target-test');
    const posts = requests.filter(request => request.body);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].body?.studentNumber, 6);
    assert.equal(posts[0].body?.requestId, posts[1].body?.requestId);
    assert.ok(requests.filter(request => !request.body).every(request => new URL(request.url, 'https://fixture.invalid').searchParams.get('studentNumber') === '6'));
  } finally { globalThis.fetch = previousFetch; }
});
