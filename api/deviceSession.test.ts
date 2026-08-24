import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeviceSessionToken,
  getDeviceSession,
  parseDeviceSessionToken,
} from './deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';

test('a signed student device session preserves its assigned number', () => {
  // Given
  const token = createDeviceSessionToken({ role: 'student', studentNumber: 7 }, SESSION_SECRET, 1_000);

  // When
  const session = getDeviceSession({ cookie: `other=1; __Host-school-timer-device=${token}` }, SESSION_SECRET, 1_001);

  // Then
  assert.deepEqual(session, { role: 'student', studentNumber: 7, expiresAt: 15_553_000 });
});

test('a modified device session signature is rejected', () => {
  // Given
  const token = createDeviceSessionToken({ role: 'teacher' }, SESSION_SECRET, 1_000);
  const modifiedToken = `${token.slice(0, -1)}x`;

  // When
  const session = parseDeviceSessionToken(modifiedToken, SESSION_SECRET, 1_001);

  // Then
  assert.equal(session, null);
});

test('an expired device session is rejected', () => {
  // Given
  const token = createDeviceSessionToken({ role: 'student', studentNumber: 12 }, SESSION_SECRET, 1_000);

  // When
  const session = parseDeviceSessionToken(token, SESSION_SECRET, 15_553_000);

  // Then
  assert.equal(session, null);
});
