import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeRequestRateLimit } from '../../src/server/requestRateLimit.js';

test('오늘의 친구 교사는 학급 연속 검토를 허용하고 60회 초과와 학생 반복은 제한한다', () => {
  const headers = { 'x-forwarded-for': '192.0.2.28' };
  for (let attempt = 0; attempt < 60; attempt += 1) {
    assert.equal(consumeRequestRateLimit('today-friend-teacher-write', headers, 0, 1000).allowed, true);
  }
  assert.deepEqual(consumeRequestRateLimit('today-friend-teacher-write', headers, 0, 2000), { allowed: false, retryAfterSeconds: 59 });
  assert.equal(consumeRequestRateLimit('today-friend-teacher-write', headers, 0, 61000).allowed, true);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(consumeRequestRateLimit('today-friend-write', headers, 1, 61000).allowed, true);
  }
  assert.equal(consumeRequestRateLimit('today-friend-write', headers, 1, 61000).allowed, false);
});

test('25 classroom actors sharing an IP can each use their ten-request allowance', () => {
  const headers = { 'x-forwarded-for': '192.0.2.25' };
  for (let round = 0; round < 10; round += 1) {
    for (let actor = 0; actor < 25; actor += 1) {
      assert.equal(consumeRequestRateLimit('classroom-test', headers, actor, 1000).allowed, true);
    }
  }
  assert.deepEqual(consumeRequestRateLimit('classroom-test', headers, 1, 1000), { allowed: false, retryAfterSeconds: 60 });
  assert.equal(consumeRequestRateLimit('classroom-test', headers, 1, 61000).allowed, true);
});

test('rejected repeats from one actor do not block peers on the same Wi-Fi', () => {
  const headers = { 'x-forwarded-for': '192.0.2.26' };
  for (let attempt = 0; attempt < 300; attempt += 1) {
    assert.equal(consumeRequestRateLimit('classroom-flood-test', headers, 1, 1000).allowed, attempt < 10);
  }
  for (let actor = 2; actor <= 24; actor += 1) {
    assert.equal(consumeRequestRateLimit('classroom-flood-test', headers, actor, 1000).allowed, true);
  }
});

test('registration retains its aggregate IP limit', () => {
  const headers = { 'x-forwarded-for': '192.0.2.27' };
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assert.equal(consumeRequestRateLimit('device-registration', headers, attempt % 25, 1000).allowed, true);
  }
  assert.equal(consumeRequestRateLimit('device-registration', headers, 0, 1000).allowed, false);
});
