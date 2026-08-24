import assert from 'node:assert/strict';
import test from 'node:test';

import handler from './device-session.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const REGISTRATION_KEY = 'teacher-device-key';

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); },
    status: (nextStatusCode: number) => {
      statusCode = nextStatusCode;
      return response;
    },
    json: (nextBody: unknown) => { body = nextBody; },
  };
  return { response, result: () => ({ statusCode, body, headers }) };
};

const withDeviceEnvironment = (run: () => void) => {
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const originalRegistrationKey = process.env.DEVICE_REGISTRATION_KEY;
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  process.env.DEVICE_REGISTRATION_KEY = REGISTRATION_KEY;
  try {
    run();
  } finally {
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
    if (originalRegistrationKey === undefined) delete process.env.DEVICE_REGISTRATION_KEY;
    else process.env.DEVICE_REGISTRATION_KEY = originalRegistrationKey;
  }
};

test('a teacher-approved student number receives a protected device cookie', () => {
  withDeviceEnvironment(() => {
    // Given
    const { response, result } = createResponse();

    // When
    handler({
      method: 'POST',
      body: { entryNumber: 8, registrationKey: REGISTRATION_KEY },
      headers: { 'sec-fetch-site': 'same-origin' },
    }, response);

    // Then
    assert.equal(result().statusCode, 200);
    assert.deepEqual(result().body, { role: 'student', studentNumber: 8 });
    assert.match(result().headers.get('Set-Cookie') ?? '', /Secure; HttpOnly; SameSite=Strict/);
  });
});

test('an incorrect teacher registration key cannot register a device', () => {
  withDeviceEnvironment(() => {
    // Given
    const { response, result } = createResponse();

    // When
    handler({
      method: 'POST',
      body: { entryNumber: 8, registrationKey: 'wrong-key' },
      headers: { 'sec-fetch-site': 'same-origin' },
    }, response);

    // Then
    assert.equal(result().statusCode, 403);
    assert.equal(result().headers.has('Set-Cookie'), false);
  });
});

test('resetting a student device expires its server session cookie', () => {
  withDeviceEnvironment(() => {
    // Given
    const { response, result } = createResponse();

    // When
    handler({ method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } }, response);

    // Then
    assert.equal(result().statusCode, 204);
    assert.match(result().headers.get('Set-Cookie') ?? '', /Max-Age=0/);
  });
});
