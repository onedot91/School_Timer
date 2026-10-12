import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/student-economy.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { loadTeacherLoanReport, parseLoanReceipt } from '../../src/server/teacherLoanHistoryRepository.js';
import { parseTeacherLoanReport } from '../../src/lib/teacherLoanHistory.js';

const secret = 'loan-history-test-session-secret-at-least-32-characters';
const configuration = { url: 'https://loan-test.supabase.co', key: 'fake-service-role' };
const receipt = (overrides: Record<string, unknown> = {}) => ({
  actor_key: 'student:3:economy:3', request_id: 'borrow-fixture-3', committed_at: '2026-10-01T01:00:00Z',
  message: '40 고마를 빌렸습니다. 다음주 목요일까지 44 고마를 갚아야 합니다.',
  applied: true, loan_transaction: null, loan: 44, principal: 40, due_date: '2026-10-08', ...overrides,
});

const withEnvironment = async (fetcher: typeof fetch, run: () => Promise<void>) => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.DEVICE_SESSION_SECRET, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = configuration.url; process.env.SUPABASE_SERVICE_ROLE_KEY = configuration.key; process.env.DEVICE_SESSION_SECRET = secret;
  globalThis.fetch = fetcher;
  try { await run(); } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SERVICE_ROLE_KEY', previous.key], ['DEVICE_SESSION_SECRET', previous.secret]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
};

const query = async (role?: 'teacher' | 'student') => {
  let statusCode = 200, body: unknown;
  const headers: Record<string, string> = {};
  const response = { setHeader: (name: string, value: string) => { headers[name] = value; },
    status: (code: number) => { statusCode = code; return response; }, json: (value: unknown) => { body = value; } };
  const token = role === 'teacher' ? createDeviceSessionToken({ role: 'teacher' }, secret)
    : role === 'student' ? createDeviceSessionToken({ role: 'student', studentNumber: 3 }, secret) : '';
  await handler({ method: 'GET', query: { history: 'loans' }, headers: { cookie: `__Host-school-timer-device=${token}` } }, response);
  return { statusCode, body, headers };
};

test('대출 조회는 미등록·학생 기기를 거부하고 Supabase에 요청하지 않는다', async () => {
  await withEnvironment(async () => { assert.fail('권한 거부 후 외부 요청 금지'); }, async () => {
    assert.equal((await query()).statusCode, 401);
    const denied = await query('student');
    assert.equal(denied.statusCode, 403);
    assert.deepEqual(denied.body, { error: 'TEACHER_REQUIRED' });
  });
});

test('교사는 대출·부분 상환·완납 기록을 조회하고 원문 메시지나 학생 답변을 받지 않는다', async () => {
  const requests: URL[] = [];
  await withEnvironment(async (input, init) => {
    const url = new URL(String(input)); requests.push(url);
    assert.equal(init?.method, 'GET');
    if (url.pathname.endsWith('/storage_resources')) return Response.json([{ owner_number: 3, loan: 0, principal: 0, due_date: null }]);
    assert.ok(url.pathname.endsWith('/storage_receipts'));
    assert.equal(url.searchParams.get('action'), 'eq.student-economy');
    assert.equal(url.searchParams.get('result->>applied'), 'eq.true');
    assert.ok(url.searchParams.get('committed_at')?.startsWith('lte.'));
    assert.doesNotMatch(url.searchParams.get('select') ?? '', /studentLife|currencyHistoryEntries|\*/);
    return Response.json([receipt(), receipt({ request_id: 'partial-fixture-3', committed_at: '2026-10-02T01:00:00Z', message: '14 고마를 갚았습니다.', loan: 30, principal: 30 }),
      receipt({ request_id: 'paid-fixture-3', committed_at: '2026-10-03T01:00:00Z', message: '30 고마를 갚았습니다.', loan: 0, principal: 0, due_date: null })]);
  }, async () => {
    const result = await query('teacher');
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    const report = parseTeacherLoanReport(result.body);
    assert.equal(report.students.length, 23);
    assert.equal(report.students[2].repaymentAmount, 0);
    assert.deepEqual(report.entries.map(entry => [entry.type, entry.amount, entry.principalAfter, entry.repaymentAfter]), [['repay', 30, 0, 0], ['repay', 14, 30, 30], ['borrow', 40, 40, 44]]);
    assert.doesNotMatch(JSON.stringify(result.body), /message|studentLife|fake-service-role/);
    assert.equal(requests.length, 2);
  });
});

test('예금 이동은 대출로 추정하지 않고 명시적 대출 유형을 우선한다', () => {
  assert.throws(() => parseLoanReceipt(receipt({ message: '40 고마를 찾았습니다.' })));
  assert.throws(() => parseLoanReceipt(receipt({ message: '40 고마를 맡겼습니다.' })));
  assert.equal(parseLoanReceipt(receipt({ message: '새로운 표시 문구', loan_transaction: { type: 'borrow', amount: 40 } })).type, 'borrow');
  assert.throws(() => parseLoanReceipt(receipt({ actor_key: 'student:4:economy:3' })));
  assert.throws(() => parseLoanReceipt(receipt({ principal: 30 })));
  assert.throws(() => parseLoanReceipt(receipt({ applied: false })));
});

test('첫 500건에서 멈추지 않고 대출 처리 기록을 다음 페이지까지 조회한다', async () => {
  const offsets: string[] = [];
  await withEnvironment(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/storage_resources')) return Response.json([]);
    const offset = url.searchParams.get('offset') ?? ''; offsets.push(offset);
    if (offset === '0') return Response.json(Array.from({ length: 500 }, (_, index) => receipt({ request_id: `borrow-fixture-${index}` })));
    return Response.json([receipt({ request_id: 'borrow-final-page' })]);
  }, async () => {
    const report = await loadTeacherLoanReport(configuration);
    assert.equal(report.entries.length, 501);
    assert.deepEqual(offsets, ['0', '500']);
  });
});

test('상류 실패·잘못된 잔액은 기록 없음으로 숨기지 않고 오류로 반환한다', async () => {
  await withEnvironment(async () => new Response('private upstream message', { status: 500 }), async () => {
    const result = await query('teacher');
    assert.equal(result.statusCode, 502);
    assert.deepEqual(result.body, { error: 'LOAN_HISTORY_UNAVAILABLE' });
  });
  await withEnvironment(async input => String(input).includes('/storage_resources')
    ? Response.json([{ owner_number: 3, loan: -2, principal: 0, due_date: null }]) : Response.json([]), async () => {
    const result = await query('teacher');
    assert.equal(result.statusCode, 502);
    assert.deepEqual(result.body, { error: 'LOAN_HISTORY_INVALID_RESPONSE' });
  });
});
