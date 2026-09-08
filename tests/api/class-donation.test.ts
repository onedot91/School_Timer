import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/class-donation.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const secret = 'donation-tests-device-session-secret-over-32';
const run = async (body: unknown, upstream: (input: string, payload: unknown) => Response, student = 7) => {
  const env = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, DEVICE_SESSION_SECRET: process.env.DEVICE_SESSION_SECRET };
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only', DEVICE_SESSION_SECRET: secret });
  let status = 200;
  let responseBody: unknown;
  let calls = 0;
  const response = { setHeader: () => {}, status: (next: number) => { status = next; return response; }, json: (value: unknown) => { responseBody = value; } };
  globalThis.fetch = async (input, init) => { calls++; return upstream(String(input), JSON.parse(String(init?.body))); };
  try {
    await handler({ method: 'POST', body, headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber: student }, secret)}`, 'sec-fetch-site': 'same-origin' } }, response);
    return { status, body: responseBody, calls };
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
};

test('donation generates the thank-you letter server-side in the atomic v2 call', async () => {
  const result = await run({ protocolVersion: 2, studentNumber: 7, amount: 6, requestId: 'donate-seven' }, (url, payload) => {
    assert.ok(url.endsWith('/rpc/donate_to_class_goal_v2'));
    assert.ok(payload && typeof payload === 'object');
    assert.equal(Reflect.get(payload, 'p_protocol_version'), 2);
    const letter: unknown = Reflect.get(payload, 'p_thank_you_letter');
    assert.ok(letter && typeof letter === 'object');
    assert.equal(Reflect.get(letter, 'id'), 'donate-seven');
    assert.equal(Reflect.get(letter, 'recipient'), 7);
    const content: unknown = Reflect.get(letter, 'content');
    assert.ok(typeof content === 'string');
    assert.match(content, /6고마/);
    return Response.json({ donatedAmount: 6, balance: 94, totalAmount: 6, targetAmount: 500, completed: false });
  });
  assert.equal(result.status, 200);
  assert.equal(result.calls, 1);
});

test('donation rejects malformed JSON, old protocol, and other students before upstream writes', async () => {
  const never = () => { throw new Error('Unexpected write'); };
  assert.equal((await run('{', never)).status, 400);
  assert.deepEqual(await run({ studentNumber: 7, amount: 6, requestId: 'old' }, never), { status: 409, body: { error: 'LEGACY_CLIENT_UPDATE_REQUIRED' }, calls: 0 });
  assert.equal((await run({ protocolVersion: 2, studentNumber: 8, amount: 6, requestId: 'other' }, never)).status, 403);
});

test('donation returns only safe expected business and maintenance errors', async () => {
  const body = { protocolVersion: 2, studentNumber: 7, amount: 6, requestId: 'test-error' };
  assert.deepEqual((await run(body, () => Response.json({ message: 'INSUFFICIENT_AVAILABLE_CURRENCY' }, { status: 400 }))).body, { error: 'INSUFFICIENT_AVAILABLE_CURRENCY' });
  assert.equal((await run(body, () => Response.json({ message: 'STORAGE_MAINTENANCE' }, { status: 400 }))).status, 503);
  assert.deepEqual((await run(body, () => Response.json({ message: 'private content should never be returned' }, { status: 400 }))).body, { error: 'CLASS_DONATION_FAILED' });
});
