import { normalizeStudentLifeState } from '../../src/lib/studentLife.js';
import { normalizeCurrencyHistory } from '../../src/lib/currency.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/student-economy.js';
import { FAILURE_PROFILE_IMAGES } from '../../src/lib/failureExhibition.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { parseStorageScope, storageResourceMatchesScope, storageStructuralAncestor, storageScopeStructuralKeys, type StorageScope } from '../../src/server/storageScope.js';
import { parseStorageSnapshot } from '../../src/server/storageV2Repository.js';
import { splitStorageState, assembleStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (code: number) => { statusCode = code; return response; },
    json: (value: unknown) => { body = value; },
  };
  return { response, result: () => ({ statusCode, body }) };
};

const withEnvironment = async (run: () => Promise<void>) => {
  const originals = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.DEVICE_SESSION_SECRET,
  };
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  try {
    await run();
  } finally {
    if (originals.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originals.url;
    if (originals.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originals.key;
    if (originals.secret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originals.secret;
  }
};

const studentHeaders = (studentNumber: number) => ({
  'x-storage-projection': '1',
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
});

const previousValue = {
  schedule: ['수학'],
  currencyBalances: { 1: 145, 2: 222 },
  currencyHistory: { 1: [], 2: [{ id: 'keep-history' }] },
  studentEconomy: { 2: { deposit: 7, legacyField: 'keep-economy' } },
  studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: {} },
  auctionBids: {},
  auctionAwards: {},
};

const fixture = (initial: Record<string, unknown> = previousValue) => {
  let state = splitStorageState(initial);
  const revisions: Record<string, number> = {};
  const receipts = new Map<string, { hash: unknown; result: unknown }>();
  const writes: Record<string, unknown>[] = [];
  const scopes: StorageScope[] = [];
  const rpcCalls: string[] = [];
  let beforeCommit: (() => void) | undefined;
  let paused = false;
  let loseCommitResponse = false;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); rpcCalls.push(url);
    const body: unknown = JSON.parse(String(init?.body));
    assert.ok(isStorageRecord(body));
    if (url.endsWith('/storage_get_receipt')) {
      const receipt = receipts.get(`${body.p_actor_key}/${body.p_request_id}`);
      if (receipt && body.p_payload_hash && body.p_payload_hash !== receipt.hash) return Response.json({ message: 'STORAGE_REQUEST_REUSED' }, { status: 409 });
      return Response.json(receipt ? { found: true, result: receipt.result, payloadHash: receipt.hash, action: 'student-economy', committedAt: '2026-09-08T00:00:01Z' } : { found: false });
    }
    if (paused) return Response.json({ message: 'STORAGE_MAINTENANCE' }, { status: 503 });
    if (url.endsWith('/storage_load_scope')) {
      const scope = parseStorageScope(body.p_scope); scopes.push(scope);
      const selected = state.resources.filter(resource => storageResourceMatchesScope(resource, scope.resources));
      const keys = [...selected.map(resource => resource.resource_key), ...scope.resources.map(selector => selector.path), ...storageScopeStructuralKeys(scope)];
      const resources = state.resources.filter(resource => selected.includes(resource) || storageStructuralAncestor(resource, keys));
      const wallets = state.wallets.filter(wallet => scope.wallets.includes(wallet.student_number));
      const history = state.history.filter(entry => scope.history.includes(entry.student_number));
      return Response.json({ kind: 'scoped', scope, resources, wallets, history, revisions, deletedKeys: [], orderingBounds: {}, updated_at: '2026-09-08T00:00:00Z' });
    }
    assert.ok(url.endsWith('/storage_commit_scoped_mutation'), `Unexpected full read or write: ${url}`);
    writes.push(body);
    const receiptKey = `${body.p_actor_key}/${body.p_request_id}`;
    const prior = receipts.get(receiptKey);
    if (prior) return prior.hash === body.p_payload_hash ? Response.json({ saved: true, result: prior.result }) : Response.json({ message: 'STORAGE_REQUEST_REUSED' }, { status: 409 });
    if (beforeCommit) { const hook = beforeCommit; beforeCommit = undefined; hook(); }
    assert.ok(isStorageRecord(body.p_expected));
    for (const [key, revision] of Object.entries(body.p_expected)) if ((revisions[key] ?? 0) !== revision) return Response.json({ saved: false });
    assert.ok(Array.isArray(body.p_resources));
    assert.ok(Array.isArray(body.p_wallets));
    assert.ok(Array.isArray(body.p_ledger));
    const resources = new Map(state.resources.map((row) => [row.resource_key, row]));
    for (const row of body.p_resources) {
      assert.ok(isStorageRecord(row) && typeof row.resource_key === 'string');
      if (row.value === null) resources.delete(row.resource_key);
      else {
        const parsed = parseStorageSnapshot({ resources: [row, { resource_key: '', category: 'root', owner_number: null, value: { kind: 'object', parentKey: null, member: '' } }], wallets: [], history: [], revisions: {}, updated_at: 'test' });
        const resource = parsed.resources?.find((entry) => entry.resource_key === row.resource_key);
        assert.ok(resource); resources.set(row.resource_key, resource);
      }
      revisions[row.resource_key] = (revisions[row.resource_key] ?? 0) + 1;
    }
    const wallets = new Map(state.wallets.map((row) => [row.student_number, row]));
    for (const row of body.p_wallets) {
      assert.ok(isStorageRecord(row) && typeof row.student_number === 'number' && typeof row.balance === 'number');
      wallets.set(row.student_number, { student_number: row.student_number, balance: row.balance });
      revisions[`wallet:${row.student_number}`] = (revisions[`wallet:${row.student_number}`] ?? 0) + 1;
    }
    const encoded = { resources: [...resources.values()], wallets: [...wallets.values()], history: [...state.history, ...body.p_ledger], revisions: {}, updated_at: 'test' };
    state = splitStorageState(parseStorageSnapshot(encoded).value);
    receipts.set(receiptKey, { hash: body.p_payload_hash, result: body.p_result });
    if (loseCommitResponse) { loseCommitResponse = false; throw new TypeError('response lost'); }
    return Response.json({ saved: true, result: body.p_result, updatedAt: '2026-09-08T00:00:01Z' });
  };
  return {
    fetcher, writes, scopes, rpcCalls, value: () => assembleStorageState(state),
    pause: () => { paused = true; },
    loseResponse: () => { loseCommitResponse = true; },
    replaceReceiptResult: (actor: string, id: string, result: unknown) => { const receipt = receipts.get(`${actor}/${id}`); assert.ok(receipt); receipts.set(`${actor}/${id}`, { ...receipt, result }); },
    conflict: (number: number, balance: number) => { beforeCommit = () => {
      state = { ...state, wallets: state.wallets.map((wallet) => wallet.student_number === number ? { ...wallet, balance } : wallet) };
      revisions[`wallet:${number}`] = (revisions[`wallet:${number}`] ?? 0) + 1;
    }; },
  };
};

const act = async (studentNumber: number, action: Record<string, unknown>, requestId: string) => {
  const { response, result } = createResponse();
  await handler({ method: 'POST', headers: studentHeaders(studentNumber), body: { protocolVersion: 2, studentNumber, action, requestId } }, response);
  return result();
};
const withFixture = async (run: (db: ReturnType<typeof fixture>) => Promise<void>, initial?: Record<string, unknown>) => withEnvironment(async () => {
  const originalFetch = globalThis.fetch;
  const db = fixture(initial);
  globalThis.fetch = db.fetcher;
  try { await run(db); } finally { globalThis.fetch = originalFetch; }
});

test('학생 예금은 학생 지갑·경제 상태·새 원장만 트랜잭션으로 저장한다', async () => {
  await withFixture(async (db) => {
    const result = await act(1, { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' }, 'deposit-request-1');
    assert.equal(result.statusCode, 200);
    assert.equal(Reflect.get(result.body as object, 'balance'), 115);
    assert.equal(Reflect.get(Reflect.get(result.body as object, 'studentEconomy'), 'deposit'), 30);
    const current = db.value();
    assert.deepEqual(Reflect.get(current.studentEconomy as object, '2'), previousValue.studentEconomy[2]);
    assert.deepEqual(current.schedule, previousValue.schedule);
    assert.deepEqual(Reflect.get(current.currencyHistory as object, '2'), previousValue.currencyHistory[2]);
    assert.equal(normalizeCurrencyHistory(current.currencyHistory)['1'][0].id, 'currency-economy-deposit-request-1-1');
    assert.ok(!JSON.stringify(db.writes).includes('legacyField'));
    assert.ok(isStorageRecord(db.writes[0].p_expected));
    assert.ok('wallet:1' in db.writes[0].p_expected);
    assert.ok('scope:auctionBids:shared' in db.writes[0].p_expected);
  });
});

test('잘못된 예금은 업무 거절이며 저장이나 재시도가 없다', async () => {
  await withFixture(async (db) => {
    const result = await act(1, { type: 'open_deposit', amount: 9, dateKey: '2026-08-26' }, 'small-deposit-id');
    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.body, { error: 'INVALID_BANK_AMOUNT', businessRejected: true });
    assert.equal(db.writes.length, 0);
  });
});

test('동시 송금으로 수신 잔액이 바뀌면 최신 수신 잔액에서 다시 계산한다', async () => {
  await withFixture(async (db) => {
    db.conflict(2, 230);
    const result = await act(1, { type: 'transfer', amount: 20, recipientNumber: 2, dateKey: '2026-09-03' }, 'transfer-request-1');
    assert.equal(result.statusCode, 200);
    assert.equal(db.writes.length, 2);
    assert.deepEqual(db.value().currencyBalances, { 1: 125, 2: 250 });
    const history = normalizeCurrencyHistory(db.value().currencyHistory);
    assert.equal(history['1'][0].id, 'currency-economy-transfer-request-1-1');
    assert.equal(history['2'].at(-1)?.id, 'currency-economy-transfer-request-1-2');
  });
});

test('동시 차감 뒤 잔액이 부족해지면 새 원장을 추가하지 않는다', async () => {
  await withFixture(async (db) => {
    db.conflict(1, 20);
    const result = await act(1, { type: 'deposit', amount: 30 }, 'concurrent-spend-id');
    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.body, { error: 'INSUFFICIENT_AVAILABLE_CURRENCY', businessRejected: true });
    assert.equal(db.writes.length, 1);
    assert.equal(Reflect.get(db.value().currencyBalances as object, '1'), 20);
    assert.deepEqual(Reflect.get(db.value().currencyHistory as object, '1'), []);
  });
});

test('투자 및 랜덤 프로필의 비용과 상태가 함께 저장된다', async () => {
  await withFixture(async (db) => {
    const result = await act(1, { type: 'invest', stockId: 'sunny', amount: 30, dateKey: '2026-08-26' }, 'invest-request-1');
    assert.equal(result.statusCode, 200);
    assert.equal(Reflect.get(result.body as object, 'balance'), 115);
    const profile = await act(1, { type: 'draw_profile' }, 'profile-request-1');
    assert.equal(profile.statusCode, 200);
    assert.equal(Reflect.get(profile.body as object, 'balance'), 115);
    assert.ok(FAILURE_PROFILE_IMAGES.includes(Reflect.get(profile.body as object, 'profileImage')));
    const expected = db.writes.at(-1)?.p_expected;
    assert.ok(isStorageRecord(expected));
    for (let number = 1; number <= 23; number += 1) assert.ok(`/studentLife/failureProfileAssignments/${number}` in expected);
  });
});

test('저장 충돌 때 스킨 추첨 결과와 비용은 동일하다', async () => {
  await withFixture(async (db) => {
    db.conflict(1, 150);
    const result = await act(1, { type: 'draw_character' }, 'draw-conflict-id');
    assert.equal(result.statusCode, 200);
    assert.equal(db.writes.length, 2);
    const economies = db.writes.map((write) => {
      assert.ok(Array.isArray(write.p_resources));
      return write.p_resources.find((row) => isStorageRecord(row) && row.resource_key === '/studentEconomy/1');
    });
    assert.deepEqual(economies[0], economies[1]);
    assert.equal(Reflect.get(db.value().currencyBalances as object, '1'), 50);
  });
});

test('집 구매는 제작자 보상·편지까지 한 번만 저장하며 같은 ID의 변경 요청은 거절한다', async () => {
  await withFixture(async (db) => {
    db.conflict(7, 80);
    const action = { type: 'buy_house', houseId: 'student-house-7' };
    const first = await act(1, action, 'house-purchase-one');
    assert.equal(first.statusCode, 200);
    assert.equal(db.writes.length, 2);
    assert.deepEqual(db.value().currencyBalances, { 1: 400, 2: 222, 7: 90 });
    assert.equal(normalizeStudentLifeState(db.value().studentLife).letters.length, 1);
    assert.equal((await act(1, action, 'house-purchase-one')).statusCode, 200);
    assert.equal((await act(1, { type: 'select_house', houseId: 'student-house-7' }, 'house-purchase-one')).statusCode, 409);
    assert.equal((await act(1, action, 'house-purchase-two')).statusCode, 400);
    assert.equal(Reflect.get(db.value().currencyBalances as object, '7'), 90);
    assert.equal(normalizeStudentLifeState(db.value().studentLife).letters.length, 1);
  }, { ...previousValue, currencyBalances: { 1: 500, 2: 222, 7: 75 }, currencyHistory: { 1: [], 2: previousValue.currencyHistory[2], 7: [] }, studentEconomy: { ...previousValue.studentEconomy, 1: { inventory: { house_repair: 1 } } } });
});

test('원본 편지와 알 수 없는 필드는 정규화 한도와 관계없이 유지한다', async () => {
  const letters = Array.from({ length: 605 }, (_, index) => ({ id: `old-letter-${index}`, extra: true }));
  await withFixture(async (db) => {
    assert.equal((await act(1, { type: 'deposit', amount: 30 }, 'preserve-raw-id')).statusCode, 200);
    const life = db.value().studentLife;
    assert.ok(isStorageRecord(life));
    assert.deepEqual(life.letters, letters);
    assert.equal(life.unknownField, 'preserved');
  }, { ...previousValue, studentLife: { ...previousValue.studentLife, letters, unknownField: 'preserved' } });
});

test('구형 프로토콜·다른 학생 접근은 DB 호출 전에 막고 점검 중에는 거래하지 않는다', async () => {
  await withFixture(async (db) => {
    const { response, result } = createResponse();
    await handler({ method: 'POST', headers: studentHeaders(1), body: { studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'old-client-id' } }, response);
    assert.equal(result().statusCode, 426);
    const denied = createResponse();
    await handler({ method: 'POST', headers: studentHeaders(1), body: { protocolVersion: 2, studentNumber: 2, action: { type: 'deposit', amount: 30 }, requestId: 'wrong-student-id' } }, denied.response);
    assert.equal(denied.result().statusCode, 403);
    db.pause();
    assert.equal((await act(1, { type: 'deposit', amount: 30 }, 'maintenance-id')).statusCode, 503);
    assert.equal(db.writes.length, 0);
  });
});

test('응답 유실 뒤 영수증 조회는 본인 거래만 반환한다', async () => {
  await withFixture(async (db) => {
    db.loseResponse();
    assert.equal((await act(1, { type: 'deposit', amount: 30 }, 'lost-response-id')).statusCode, 502);
    const confirmed = createResponse();
    await handler({ method: 'GET', headers: studentHeaders(1), query: { protocolVersion: '2', studentNumber: '1', requestId: 'lost-response-id' } }, confirmed.response);
    assert.equal(confirmed.result().statusCode, 200);
    assert.equal(Reflect.get(confirmed.result().body as object, 'status'), 'committed');
    const denied = createResponse();
    await handler({ method: 'GET', headers: studentHeaders(2), query: { protocolVersion: '2', studentNumber: '1', requestId: 'lost-response-id' } }, denied.response);
    assert.equal(denied.result().statusCode, 403);
  });
});

test('학생 거래 POST와 영수증 GET은 타인 편지와 송금 수신자의 잔액·이력을 노출하지 않는다', async () => {
  const life = normalizeStudentLifeState({ letters: [
    { id: 'private-2', recipient: 2, senderLabel: '선생님', title: '비공개', content: '다른 학생 비밀 편지', createdAt: '2026-09-08T00:00:00Z' },
    { id: 'own-1', recipient: 1, senderLabel: '선생님', title: '본인', content: '내 편지', createdAt: '2026-09-08T00:00:00Z' },
  ] });
  await withFixture(async (db) => {
    const result = await act(1, { type: 'transfer', amount: 20, recipientNumber: 2, dateKey: '2026-09-08' }, 'private-transfer-id');
    assert.equal(result.statusCode, 200);
    assert.ok(isStorageRecord(result.body));
    assert.deepEqual(result.body.currencyBalanceEntries, { 1: 125 });
    assert.ok(isStorageRecord(result.body.currencyHistoryEntries));
    assert.deepEqual(Object.keys(result.body.currencyHistoryEntries), ['1']);
    assert.ok(!JSON.stringify(result.body).includes('다른 학생 비밀 편지'));
    assert.ok(JSON.stringify(result.body).includes('내 편지'));
    assert.equal(Reflect.get(db.value().currencyBalances as object, '2'), 242);
    assert.ok(JSON.stringify(db.value().studentLife).includes('다른 학생 비밀 편지'));
    db.replaceReceiptResult('student:1:economy:1', 'private-transfer-id', { ...result.body, currencyBalanceEntries: { 1: 125, 2: 242 }, currencyHistoryEntries: { ...result.body.currencyHistoryEntries, 2: previousValue.currencyHistory[2] }, studentLife: life });
    const confirmed = createResponse();
    await handler({ method: 'GET', headers: studentHeaders(1), query: { protocolVersion: '2', studentNumber: '1', requestId: 'private-transfer-id' } }, confirmed.response);
    assert.equal(confirmed.result().statusCode, 200);
    assert.ok(isStorageRecord(confirmed.result().body));
    const body = confirmed.result().body;
    assert.ok(isStorageRecord(body) && isStorageRecord(body.result));
    assert.deepEqual(body.result.currencyBalanceEntries, { 1: 125 });
    assert.ok(!JSON.stringify(body).includes('다른 학생 비밀 편지'));
  }, { ...previousValue, studentLife: life });
});

test('부분 응답을 지원하지 않는 기존 v2 화면은 POST와 영수증 조회 모두 RPC 전에 차단된다', async () => {
  await withFixture(async (db) => {
    const headers = { ...studentHeaders(1), 'x-storage-projection': undefined };
    const before = db.value();
    for (const method of ['POST','GET']) {
      const response = createResponse();
      await handler({ method, headers, body: { protocolVersion: 2, studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'old-partial-client' }, query: { protocolVersion: '2', studentNumber: '1', requestId: 'old-partial-client' } }, response.response);
      assert.equal(response.result().statusCode,426);
      assert.deepEqual(response.result().body,{error:'STORAGE_PROTOCOL_UPGRADE_REQUIRED'});
    }
    assert.equal(db.rpcCalls.length,0);assert.equal(db.scopes.length,0);assert.equal(db.writes.length,0);assert.deepEqual(db.value(),before);
  });
});

test('receiptOnly confirms an economy transaction while all current-state queries fail', () => withFixture(async (db) => {
  assert.equal((await act(1, { type: 'deposit', amount: 30 }, 'economy-receipt-only')).statusCode, 200);
  const writes = db.writes.length;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.ok(String(input).endsWith('/storage_get_receipt'), 'Receipt confirmation must not need another state read');
    return originalFetch(input, init);
  };
  const result = createResponse();
  await handler({ method: 'GET', headers: studentHeaders(1), query: { protocolVersion: '2', studentNumber: '1', requestId: 'economy-receipt-only', receiptOnly: '1' } }, result.response);
  assert.equal(result.result().statusCode, 200);
  const body = result.result().body; assert.ok(isStorageRecord(body) && isStorageRecord(body.result));
  assert.equal(body.status, 'committed'); assert.equal(body.action, 'student-economy');
  assert.equal(typeof body.payloadHash, 'string'); assert.equal(typeof body.committedAt, 'string');
  assert.deepEqual(body.result.currencyBalanceEntries, { 1: 115 });
  assert.equal(db.writes.length, writes);
}));

test('final economy business validation rechecks the same request before rejecting', () => withFixture(async (db) => {
  const action = { type: 'deposit', amount: 140 };
  assert.equal((await act(1, action, 'economy-race-receipt')).statusCode, 200);
  const originalFetch = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/storage_get_receipt') && ++reads <= 2) return Response.json({ found: false });
    if (String(input).endsWith('/storage_load_scope')) {
      const response = await originalFetch(input, init);
      const snapshot: unknown = await response.json();
      assert.ok(isStorageRecord(snapshot) && Array.isArray(snapshot.resources));
      // The bounded domain request list may have expired while the durable receipt still exists.
      return Response.json({ ...snapshot, resources: snapshot.resources.map(row => {
        if (!isStorageRecord(row) || row.resource_key !== '/studentEconomy/1' || !isStorageRecord(row.value) || !isStorageRecord(row.value.data)) return row;
        return { ...row, value: { ...row.value, data: { ...row.value.data, processedRequestIds: [] } } };
      }) });
    }
    return originalFetch(input, init);
  };
  const saved = await act(1, action, 'economy-race-receipt');
  assert.equal(saved.statusCode, 200);
  assert.equal(reads, 3);
  assert.equal(db.writes.length, 1);
}));
