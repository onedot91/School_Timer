import assert from 'node:assert/strict';
import test from 'node:test';
import economyHandler from '../../api/student-economy.js';
import settingsHandler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { getStorageReceipt, StorageRepositoryError } from '../../src/server/storageV2Repository.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';

const configuration = { url: 'https://upstream-fixture.invalid', key: 'fixture-only' };
const secret = 'fixture-only-storage-upstream-secret-32-characters';

for (const scenario of [
  { name: 'HTML 503', fetcher: async () => new Response('<html>private gateway body</html>', { status: 503 }), code: 'STORAGE_DATABASE_HTTP_503' },
  { name: 'empty 502', fetcher: async () => new Response(null, { status: 502 }), code: 'STORAGE_DATABASE_HTTP_502' },
  { name: 'invalid JSON 200', fetcher: async () => new Response('private invalid JSON'), code: 'STORAGE_INVALID_RESPONSE' },
  { name: 'network rejection', fetcher: async () => { throw new TypeError('private network details'); }, code: 'STORAGE_DATABASE_NETWORK' },
  { name: 'timeout', fetcher: async () => { throw new DOMException('private timeout details', 'TimeoutError'); }, code: 'STORAGE_DATABASE_TIMEOUT' },
]) {
  test(`storage preserves upstream failure instead of client SyntaxError when ${scenario.name}`, async (t) => {
    // Given an upstream failure and a valid receipt lookup.
    const fetchMock = t.mock.method(globalThis, 'fetch', scenario.fetcher);
    // When / Then: preserve a stable server failure, without replay or raw data.
    await assert.rejects(getStorageReceipt(configuration, 'student:1', 'fixture-request'), (error: unknown) => {
      assert.ok(error instanceof StorageRepositoryError);
      assert.equal(error.status, 502);
      assert.equal(error.code, scenario.code);
      assert.equal(error.message.includes('private'), false);
      return true;
    });
    assert.equal(fetchMock.mock.callCount(), 1);
  });
}

const environment = async (run: () => Promise<void>) => {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET', 'STORAGE_PROTOCOL_VERSION'] as const;
  const previous = names.map(name => process.env[name]);
  process.env.SUPABASE_URL = configuration.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = configuration.key;
  process.env.DEVICE_SESSION_SECRET = secret;
  process.env.STORAGE_PROTOCOL_VERSION = '2';
  try { await run(); }
  finally { names.forEach((name, index) => { const value = previous[index]; if (value === undefined) delete process.env[name]; else process.env[name] = value; }); }
};

for (const route of ['economy', 'settings'] as const) {
  test(`${route} returns server error and safe diagnostics when commit response is invalid JSON`, async (t) => {
    await environment(async () => {
      // Given a valid command whose database commit succeeds but response is corrupt.
      const fixture = createStorageV2Fixture({ currencyBalances: { 1: 100 }, currencyHistory: { 1: [] }, scheduleNotice: 'before' });
      let writes = 0;
      t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
        const result = await fixture.fetch(url, init);
        if (String(url).endsWith('/storage_commit_scoped_mutation')) {
          writes += 1;
          assert.equal(result.status, 200);
          return new Response('<html>private response</html>');
        }
        return result;
      });
      const logs: unknown[][] = [];
      t.mock.method(console, 'error', (...args: unknown[]) => { logs.push(args); });
      let status = 200;
      let body: unknown;
      const response = { setHeader: () => undefined, status: (value: number) => { status = value; return response; }, json: (value: unknown) => { body = value; } };
      const headers = { 'x-storage-projection': '1', 'sec-fetch-site': 'same-origin', cookie: `__Host-school-timer-device=${createDeviceSessionToken(route === 'economy' ? { role: 'student', studentNumber: 1 } : { role: 'teacher' }, secret)}` };
      // When the real API handler processes the command.
      if (route === 'economy') await economyHandler({ method: 'POST', headers,
        body: { protocolVersion: 2, studentNumber: 1, requestId: 'fixture-economy-upstream', action: { type: 'deposit', amount: 10 } },
      }, response);
      else await settingsHandler({ method: 'POST', headers,
        body: { protocolVersion: 2, requestId: 'fixture-settings-upstream', action: 'teacher.settings.patch', payload: { changes: [{ field: 'scheduleNotice', before: 'before', after: 'after' }] } },
      }, response);
      // Then it must not label the possibly committed command INVALID_BODY or retry it.
      assert.equal(writes, 1);
      assert.equal(status, 502);
      assert.deepEqual(body, { error: 'STORAGE_INVALID_RESPONSE' });
      assert.equal(logs.length, 1);
      const encoded = JSON.stringify(logs);
      assert.ok(encoded.includes('STORAGE_INVALID_RESPONSE'));
      for (const forbidden of ['private', configuration.key, secret, headers.cookie, 'scheduleNotice']) assert.equal(encoded.includes(forbidden), false);
      if (route === 'economy') await economyHandler({ method: 'GET', headers,
        query: { protocolVersion: '2', studentNumber: '1', requestId: 'fixture-economy-upstream', receiptOnly: '1' },
      }, response);
      else await settingsHandler({ method: 'GET', headers,
        query: { requestId: 'fixture-settings-upstream', receiptOnly: '1' },
      }, response);
      assert.equal(status, 200);
      assert.ok(body && typeof body === 'object' && Reflect.get(body, 'status') === 'committed');
      assert.equal(writes, 1);
    });
  });
}

test('storage diagnostics omit untrusted error details and normal conflicts', async (t) => {
  const { logStorageFailure } = await import('../../src/server/storageFailureDiagnostics.js');
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { logs.push(args); });
  const context = { route: '/api/student-economy', stage: 'command', startedAt: Date.now() } as const;
  logStorageFailure(new StorageRepositoryError(409, 'STORAGE_REQUEST_REUSED'), context);
  assert.equal(logs.length, 0);
  logStorageFailure(new StorageRepositoryError(502, 'STORAGE_PRIVATE_STUDENT_CONTENT'), context);
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes('PRIVATE_STUDENT_CONTENT'), false);
  assert.ok(JSON.stringify(logs).includes('STORAGE_REQUEST_FAILED'));
});
