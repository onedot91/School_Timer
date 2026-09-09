import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStudentStorageCommand, loadStudentStorageFormDraft, saveStudentStorageFormDraft, hasUnconfirmedStudentStorageDraft, executeStudentEconomyWithDraft, confirmStudentEconomyDraft, hasUnconfirmedStudentEconomyDraft, discardRejectedStudentStorageDraft, isRejectedStudentStorageDraft, saveStudentStorageFormDraftDurably } from './studentStorageCommand.js';
import { createStudentEconomyState } from './studentEconomy.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { canonicalStorageJson, isStorageRecord } from './storageV2Codec.js';
import { getKoreanLocalDateKey } from './studentEmotion.js';
import { runSaveRecoveryPass, serializeStudentSave } from './saveRecovery.js';

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

class CommandTestStorage implements Storage {
  private values = new Map<string, string>();
  failRemove = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) {
    if (this.failRemove) throw new Error('synthetic local delete failure');
    this.values.delete(key);
  }
}

const withCommandBrowser = async (actor: number, work: (storage: CommandTestStorage) => Promise<void>) => {
  const originals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const previousFetch = globalThis.fetch;
  const storage = new CommandTestStorage();
  storage.setItem('school-timer-entry-number-v1', String(actor));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: storage, location: { hash: '#student-mailbox' },
  }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try { await work(storage); }
  finally {
    globalThis.fetch = previousFetch;
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key);
    }
  }
};

const commandBody = (init?: RequestInit): Record<string, unknown> => {
  const value: unknown = JSON.parse(String(init?.body));
  assert.ok(isStorageRecord(value));
  return value;
};

const letter = (content: string) => ({ recipient: 0, title: '합성 테스트', content });

test('A 저장 응답을 기다리는 동안 편집한 B는 A 성공 후에도 남는다', async () => {
  await withCommandBrowser(11, async () => {
    const A = letter('입력 A'), B = letter('입력 B');
    const sent: Record<string, unknown>[] = [];
    let release: (() => void) | undefined, started: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.method, 'POST');
      sent.push(commandBody(init));
      if (sent.length === 1) { started?.(); await gate; }
      return success();
    };
    saveStudentStorageFormDraft(11, 'student.letter.send', A, 'edit-during-response');
    const savingA = executeStudentStorageCommand(11, 'student.letter.send', A, 'edit-during-response');
    await ready;
    saveStudentStorageFormDraft(11, 'student.letter.send', B, 'edit-during-response');
    release?.();
    await savingA;
    assert.deepEqual(loadStudentStorageFormDraft(11, 'student.letter.send', 'edit-during-response'), B);
    await executeStudentStorageCommand(11, 'student.letter.send', B, 'edit-during-response');
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map(body => body.payload), [A, B]);
    assert.notEqual(sent[0].requestId, sent[1].requestId);
  });
});

test('A 전송이 큐에 대기할 때 생긴 B 초안도 A의 정리 대상으로 삼지 않는다', async () => {
  await withCommandBrowser(12, async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const blocking = serializeStudentSave(12, () => gate);
    const A = letter('대기 중 A'), B = letter('먼저 편집된 B');
    globalThis.fetch = async (_url, init) => { assert.deepEqual(commandBody(init).payload, A); return success(); };
    saveStudentStorageFormDraft(12, 'student.letter.send', A, 'before-queue-start');
    const saving = executeStudentStorageCommand(12, 'student.letter.send', A, 'before-queue-start');
    saveStudentStorageFormDraft(12, 'student.letter.send', B, 'before-queue-start');
    release?.();
    await Promise.all([blocking, saving]);
    assert.deepEqual(loadStudentStorageFormDraft(12, 'student.letter.send', 'before-queue-start'), B);
  });
});

test('대기열에서 학생이 바뀌면 이전 학생의 저장 요청은 POST하지 않는다', async () => {
  await withCommandBrowser(13, async storage => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const blocking = serializeStudentSave(13, () => gate);
    let posts = 0;
    globalThis.fetch = async () => { posts++; return success(); };
    const saving = executeStudentStorageCommand(13, 'student.letter.send', letter('13번 초안'), 'actor-switch-in-queue');
    const rejected = assert.rejects(saving, /SESSION_CHANGED/);
    storage.setItem('school-timer-entry-number-v1', '14');
    release?.();
    await Promise.all([blocking, rejected]);
    assert.equal(posts, 0);
  });
});

test('A 저장 확인 후 기기에서 요청 삭제가 실패하면 B를 재귀 전송하지 않는다', async () => {
  await withCommandBrowser(14, async storage => {
    const A = letter('확정된 A'), B = letter('아직 미전송 B');
    let original: Record<string, unknown> | undefined;
    let posts = 0, receipts = 0;
    globalThis.fetch = async (_url, init) => {
      if (init?.method === 'POST') {
        posts++;
        original = commandBody(init);
        storage.failRemove = true;
        return success();
      }
      receipts++;
      assert.ok(receipts <= 2, 'confirmation must terminate instead of recursively checking the same undeletable request');
      assert.ok(original);
      const bytes = new TextEncoder().encode(canonicalStorageJson({ action: original.action, payload: original.payload }));
      const payloadHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      return Response.json({ status: 'committed', action: original.action, payloadHash,
        value: { studentLife: { letters: [] } }, updatedAt: '2026-09-08T05:00:00Z', result: { applied: true } });
    };
    saveStudentStorageFormDraft(14, 'student.letter.send', A, 'undeletable-request');
    await executeStudentStorageCommand(14, 'student.letter.send', A, 'undeletable-request');
    saveStudentStorageFormDraft(14, 'student.letter.send', B, 'undeletable-request');
    await assert.rejects(executeStudentStorageCommand(14, 'student.letter.send', B, 'undeletable-request'), /SAVE_DRAFT_PENDING/);
    assert.equal(posts, 1);
    assert.equal(receipts, 1);
    assert.deepEqual(loadStudentStorageFormDraft(14, 'student.letter.send', 'undeletable-request'), B);
  });
});

const seedRecoveryDraft = (storage: CommandTestStorage, actor: number, action: string, id: string, date: Date) => {
  let nextId = 0;
  const store = createStudentSaveDraftStore({ storage, now: () => date, createRequestId: () => nextId++ === 0 ? id : `${id}-context` });
  const scope = { studentNumber: actor, feature: action, entityId: id };
  store.save(scope, action === 'student.auction.bid' ? { itemId: 'synthetic-item', amount: 3 } : letter('보관한 원래 입력'));
  store.save({ ...scope, feature: `${action}.context` }, { requestId: id, actor: String(actor), dateKey: getKoreanLocalDateKey(date) });
  store.dispose();
};

test('일반 기록 복구는 영수증 조회 후 원래 ID와 내용으로만 재전송한다', async () => {
  await withCommandBrowser(17, async storage => {
    const id = 'recovery-original-request-17';
    seedRecoveryDraft(storage, 17, 'student.letter.send', id, new Date());
    const calls: string[] = [], sent: Record<string, unknown>[] = [];
    globalThis.fetch = async (_url, init) => {
      if (init?.method === 'POST') { calls.push('POST'); sent.push(commandBody(init)); return success(); }
      calls.push('GET'); return Response.json({ status: 'unknown' });
    };
    const result = await runSaveRecoveryPass(17);
    assert.equal(calls[0], 'GET');
    assert.equal(result.pending, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].requestId, id);
    assert.deepEqual(sent[0].payload, letter('보관한 원래 입력'));
  });
});

test('어제 제출한 답은 조회만 하고 오늘 과제로 자동 재전송하지 않는다', async () => {
  await withCommandBrowser(18, async storage => {
    seedRecoveryDraft(storage, 18, 'student.letter.send', 'expired-context-request-18', new Date(Date.now() - 86_400_000));
    const calls: string[] = [];
    globalThis.fetch = async (_url, init) => { calls.push(init?.method ?? 'GET'); return Response.json({ status: 'unknown' }); };
    const result = await runSaveRecoveryPass(18);
    assert.equal(result.pending, 1);
    assert.deepEqual(calls, ['GET']);
  });
});

test('입찰 미확인 요청은 자동 복구에서 조회만 하고 입찰을 재실행하지 않는다', async () => {
  await withCommandBrowser(19, async storage => {
    seedRecoveryDraft(storage, 19, 'student.auction.bid', 'financial-confirm-only-19', new Date());
    const calls: string[] = [];
    globalThis.fetch = async (_url, init) => { calls.push(init?.method ?? 'GET'); return Response.json({ status: 'unknown' }); };
    const result = await runSaveRecoveryPass(19);
    assert.equal(result.pending, 1);
    assert.deepEqual(calls, ['GET']);
  });
});

test('실제 충돌을 최신 기록으로 전환할 때 이전 입력을 보관하고 거절된 요청만 정리한다', async () => {
  await withCommandBrowser(5, async () => {
    const action = 'student.sudoku.save', key = 'explicit-conflict-adoption';
    const payload = { key, cells: [1, 0, 3], expectedRevisions: { 'scope:studentSudoku:5': 1 } };
    let posts = 0;
    globalThis.fetch = async (_url, init) => {
      if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
      posts++;
      return Response.json({ error: 'STUDENT_EDIT_CONFLICT' }, { status: 409 });
    };
    saveStudentStorageFormDraft(5, action, payload, key);
    await assert.rejects(executeStudentStorageCommand(5, action, payload, key), /STUDENT_EDIT_CONFLICT/);
    assert.equal(isRejectedStudentStorageDraft(5, action, key, 'STUDENT_EDIT_CONFLICT'), true);
    assert.equal(await saveStudentStorageFormDraftDurably(5, 'student.sudoku.conflict-copy', payload, key), true);
    assert.equal(await discardRejectedStudentStorageDraft(5, action, key, payload), true);
    assert.deepEqual(loadStudentStorageFormDraft(5, action, key), {});
    assert.deepEqual(loadStudentStorageFormDraft(5, 'student.sudoku.conflict-copy', key), payload);
    assert.equal(posts, 1);
  });
});

test('충돌 내용을 확인하는 동안 다른 탭에서 바뀐 입력은 이전 확인으로 삭제하지 않는다', async () => {
  await withCommandBrowser(5, async () => {
    const action = 'student.sudoku.save', key = 'changed-while-reviewing';
    const A = { key, cells: [1, 0, 3], expectedRevisions: { 'scope:studentSudoku:5': 1 } };
    const B = { ...A, cells: [1, 2, 3] };
    globalThis.fetch = async (_url, init) => init?.method === 'POST'
      ? Response.json({ error: 'STUDENT_EDIT_CONFLICT' }, { status: 409 }) : Response.json({ status: 'unknown' });
    saveStudentStorageFormDraft(5, action, A, key);
    await assert.rejects(executeStudentStorageCommand(5, action, A, key), /STUDENT_EDIT_CONFLICT/);
    saveStudentStorageFormDraft(5, action, B, key);
    assert.equal(await discardRejectedStudentStorageDraft(5, action, key, A), false);
    assert.deepEqual(loadStudentStorageFormDraft(5, action, key), B);
    assert.equal(isRejectedStudentStorageDraft(5, action, key), true);
  });
});

test('결과가 미확인인 요청은 최신 기록 선택용 정리 함수로 삭제할 수 없다', async () => {
  await withCommandBrowser(5, async () => {
    const action = 'student.baseball.save', key = 'uncertain-cannot-discard';
    const payload = { key, attempts: [{ guess: [1, 2, 3] }] };
    globalThis.fetch = async (_url, init) => init?.method === 'POST'
      ? Response.json({ error: 'TEMPORARY' }, { status: 503 }) : Response.json({ status: 'unknown' });
    saveStudentStorageFormDraft(5, action, payload, key);
    await assert.rejects(executeStudentStorageCommand(5, action, payload, key), /CONFIRMATION_REQUIRED/);
    assert.equal(await discardRejectedStudentStorageDraft(5, action, key, payload), false);
    assert.equal(hasUnconfirmedStudentStorageDraft(5, action, key), true);
    assert.deepEqual(loadStudentStorageFormDraft(5, action, key), payload);
  });
});
