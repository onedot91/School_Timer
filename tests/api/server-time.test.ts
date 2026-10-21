import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/server-time.js';

const invoke = (method: string) => {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); },
    status: (nextStatusCode: number) => { statusCode = nextStatusCode; return response; },
    json: (nextBody: unknown) => { body = nextBody; },
  };
  handler({ method }, response);
  return { statusCode, body, headers };
};

test('server time GET returns the current server instant without caching', () => {
  const before = Date.now();
  const result = invoke('GET');
  const after = Date.now();
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const now = (result.body as { now: number }).now;
  assert.ok(now >= before && now <= after);
});

test('server time rejects state-changing methods', () => {
  const result = invoke('POST');
  assert.equal(result.statusCode, 405);
  assert.deepEqual(result.body, { error: 'METHOD_NOT_ALLOWED' });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});
