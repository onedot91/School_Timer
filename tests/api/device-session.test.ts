import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import handler from '../../api/device-session.js';
import { getDeviceSession } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const REGISTRATION_KEY = 'teacher-device-key';
const CLASS_CODE = 'class-code-2026';

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
  const originalClassCode = process.env.STUDENT_REGISTRATION_KEY;
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  process.env.DEVICE_REGISTRATION_KEY = REGISTRATION_KEY;
  process.env.STUDENT_REGISTRATION_KEY = CLASS_CODE;
  try {
    run();
  } finally {
    if (originalClassCode === undefined) delete process.env.STUDENT_REGISTRATION_KEY;
    else process.env.STUDENT_REGISTRATION_KEY = originalClassCode;
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
    if (originalRegistrationKey === undefined) delete process.env.DEVICE_REGISTRATION_KEY;
    else process.env.DEVICE_REGISTRATION_KEY = originalRegistrationKey;
  }
};

const deviceCookie = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';

const postStudent = (body: Record<string, unknown>, cookie?: string) => {
  const { response, result } = createResponse();
  handler({
    method: 'POST',
    body,
    headers: { 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
  }, response);
  return result();
};

test('an unenrolled student device must present the class code', () => {
  withDeviceEnvironment(() => {
    const result = postStudent({ entryNumber: 8 });

    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.body, { error: 'CLASS_CODE_REQUIRED' });
    assert.equal(result.headers.has('Set-Cookie'), false);
  });
});

test('a wrong class code does not register a student device', () => {
  withDeviceEnvironment(() => {
    const result = postStudent({ entryNumber: 3, registrationKey: 'wrong-class-code' });

    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.body, { error: 'CLASS_CODE_DENIED' });
    assert.equal(result.headers.has('Set-Cookie'), false);
  });
});

test('the teacher key cannot stand in for the class code', () => {
  withDeviceEnvironment(() => {
    const result = postStudent({ entryNumber: 3, registrationKey: REGISTRATION_KEY });

    assert.equal(result.statusCode, 403);
    assert.equal(result.headers.has('Set-Cookie'), false);
  });
});

test('the correct class code gives a student a protected device cookie', () => {
  withDeviceEnvironment(() => {
    const result = postStudent({ entryNumber: 8, registrationKey: CLASS_CODE });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { role: 'student', studentNumber: 8 });
    assert.match(result.headers.get('Set-Cookie') ?? '', /Secure; HttpOnly; SameSite=Strict/);
  });
});

test('the test student 24 also needs the class code once', () => {
  withDeviceEnvironment(() => {
    assert.equal(postStudent({ entryNumber: 24 }).statusCode, 403);
    const result = postStudent({ entryNumber: 24, registrationKey: CLASS_CODE });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { role: 'student', studentNumber: 24 });
  });
});

test('an enrolled device changes its number without the class code again', () => {
  withDeviceEnvironment(() => {
    // Given a device that passed the class code as student 8
    const registered = postStudent({ entryNumber: 8, registrationKey: CLASS_CODE });
    const studentCookie = deviceCookie(registered.headers.get('Set-Cookie'));

    // When the number is reset and another number is chosen
    const { response, result } = createResponse();
    handler({ method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin', cookie: studentCookie } }, response);
    const enrolledCookie = deviceCookie(result().headers.get('Set-Cookie'));
    const reselected = postStudent({ entryNumber: 9 }, enrolledCookie);

    // Then the reset cookie grants no data access but skips the class code
    assert.equal(result().statusCode, 204);
    assert.equal(getDeviceSession({ cookie: enrolledCookie }, SESSION_SECRET), null);
    assert.equal(reselected.statusCode, 200);
    assert.deepEqual(reselected.body, { role: 'student', studentNumber: 9 });
  });
});

test('a student cookie issued before the class code no longer counts as enrolled', () => {
  withDeviceEnvironment(() => {
    const legacyPayload = Buffer.from(JSON.stringify({
      version: 1, role: 'student', studentNumber: 8, expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const legacyToken = `${legacyPayload}.${createHmac('sha256', SESSION_SECRET).update(legacyPayload).digest('base64url')}`;
    const cookie = `__Host-school-timer-device=${legacyToken}`;

    assert.equal(getDeviceSession({ cookie }, SESSION_SECRET), null);
    assert.equal(postStudent({ entryNumber: 8 }, cookie).statusCode, 403);
  });
});

test('student registration fails closed when the class code is missing or equals the teacher key', () => {
  withDeviceEnvironment(() => {
    delete process.env.STUDENT_REGISTRATION_KEY;
    assert.equal(postStudent({ entryNumber: 5, registrationKey: CLASS_CODE }).statusCode, 503);
    process.env.STUDENT_REGISTRATION_KEY = REGISTRATION_KEY;
    assert.equal(postStudent({ entryNumber: 5, registrationKey: REGISTRATION_KEY }).statusCode, 503);
  });
});

test('an incorrect teacher registration key cannot register the teacher entry', () => {
  withDeviceEnvironment(() => {
    // Given
    const { response, result } = createResponse();

    // When
    handler({
      method: 'POST',
      body: { entryNumber: 0, registrationKey: 'wrong-key' },
      headers: { 'sec-fetch-site': 'same-origin' },
    }, response);

    // Then
    assert.equal(result().statusCode, 403);
    assert.equal(result().headers.has('Set-Cookie'), false);
  });
});

test('the teacher entry requires the configured teacher key', () => {
  withDeviceEnvironment(() => {
    // Given
    const { response, result } = createResponse();

    // When
    handler({
      method: 'POST',
      body: { entryNumber: 0, registrationKey: REGISTRATION_KEY },
      headers: { 'sec-fetch-site': 'same-origin' },
    }, response);

    // Then
    assert.equal(result().statusCode, 200);
    assert.deepEqual(result().body, { role: 'teacher' });
    assert.match(result().headers.get('Set-Cookie') ?? '', /Secure; HttpOnly; SameSite=Strict/);
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
