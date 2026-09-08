import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const secret = 'library-projection-capability-test-secret-more-than-thirty-two';
const command = { protocolVersion: 2, requestId: '123e4567-e89b-42d3-a456-426614174000', action: 'placeLibraryBook', slotId: 0, book: { kind: 'new', title: '검증', author: '검증', pageCount: 30 } };
test('old protocol 2 library clients are rejected before any scoped read or mutation', async () => {
  const previous = { fetch: globalThis.fetch, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.DEVICE_SESSION_SECRET, protocol: process.env.STORAGE_PROTOCOL_VERSION };
  process.env.SUPABASE_URL = 'https://library-capability-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.DEVICE_SESSION_SECRET = secret;
  process.env.STORAGE_PROTOCOL_VERSION = '2';
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('Rejected client must not reach storage'); };
  const call = async (method: string, body: unknown, role: 'teacher' | 'student' | 'none' = 'student', crossSite = false) => {
    let status = 200;
    let result: unknown;
    const response = { setHeader: () => undefined, status: (next: number) => { status = next; return response; }, json: (next: unknown) => { result = next; } };
    const identity = role === 'teacher' ? { role: 'teacher' as const } : { role: 'student' as const, studentNumber: 1 };
    await handler({ method, body, query: method === 'GET' ? { libraryCompetition: '1' } : {}, headers: { ...(role === 'none' ? {} : { cookie: `__Host-school-timer-device=${createDeviceSessionToken(identity, secret)}` }), 'sec-fetch-site': crossSite ? 'cross-site' : 'same-origin' } }, response);
    return { status, body: result };
  };
  try {
    for (const response of [
      await call('GET', undefined),
      await call('PUT', { protocolVersion: 2, action: 'libraryCompetition', intent: 'enter' }),
      await call('PUT', { protocolVersion: 2, action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts: [] }, 'teacher'),
      await call('PUT', command),
    ]) assert.deepEqual(response, { status: 426, body: { error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' } });
    assert.equal((await call('GET', undefined, 'none')).status, 401);
    assert.equal((await call('PUT', command, 'teacher')).status, 403);
    assert.equal((await call('PUT', command, 'student', true)).status, 403);
    assert.equal((await call('PUT', { protocolVersion: 2, action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts: [] })).status, 403);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SERVICE_ROLE_KEY', previous.key], ['DEVICE_SESSION_SECRET', previous.secret], ['STORAGE_PROTOCOL_VERSION', previous.protocol]]) {
      if (name === undefined) continue;
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
