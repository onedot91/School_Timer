import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../netlify/functions/api.mts';

test('Netlify adapter preserves registration, secure cookies, auth and cross-site rejection', async () => {
  const previous = process.env.DEVICE_SESSION_SECRET;
  process.env.DEVICE_SESSION_SECRET = 'netlify-local-test-secret-at-least-32-characters';
  try {
    const endpoint = 'https://local-test.invalid/api/device-session';
    const missing = await handler(new Request(endpoint));
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    const newspaper = await handler(new Request('https://local-test.invalid/api/newspaper'));
    assert.equal(newspaper.status, 401);
    assert.equal((await newspaper.json()).error, 'DEVICE_REGISTRATION_REQUIRED');
    const rejected = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{"entryNumber":7}',
    }));
    assert.equal(rejected.status, 403);
    const registered = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: '{"entryNumber":7}',
    }));
    assert.equal(registered.status, 200);
    const cookie = registered.headers.get('set-cookie');
    assert.ok(cookie);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const session = await handler(new Request(endpoint, { headers: { cookie: cookie.split(';')[0] } }));
    assert.equal(session.status, 200);
    assert.equal((await session.json()).studentNumber, 7);
    const cleared = await handler(new Request(endpoint, { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } }));
    assert.equal(cleared.status, 204);
    assert.equal(await cleared.text(), '');
    const unknown = await handler(new Request('https://local-test.invalid/api/unknown'));
    assert.equal(unknown.status, 404);
  } finally {
    if (previous === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = previous;
  }
});
