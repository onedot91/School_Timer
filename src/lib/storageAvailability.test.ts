import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorageAvailability, publishStorageAvailability, subscribeStorageAvailability, getStorageAvailabilityNotice, dismissStorageAvailabilityNotice } from './storageAvailability.js';
import { captureStorageResponseContext } from './storageResponseOrder.js';
import { classifySaveFailure } from './saveFailure.js';

test('운영 중단은 정확한 코드와 거절 HTTP 상태가 함께 있어야 한다', () => {
  for (const code of ['STORAGE_MAINTENANCE', 'STORAGE_NOT_ACTIVE']) {
    assert.equal(getStorageAvailability({ code, status: 503 }), 'maintenance');
    assert.equal(getStorageAvailability({ code, status: 502 }), null);
  }
  for (const code of ['STORAGE_PROTOCOL_REQUIRED', 'LEGACY_CLIENT_UPDATE_REQUIRED']) {
    for (const status of [409, 426]) assert.equal(getStorageAvailability({ serverCode: code, status }), 'update');
    assert.equal(getStorageAvailability({ code, status: 503 }), null);
  }
  assert.equal(getStorageAvailability({ code: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED', status: 426 }), 'update');
  for (const status of [200, 409, 500, 503]) assert.equal(getStorageAvailability({ code: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED', status }), null);
  assert.equal(classifySaveFailure(Object.assign(new Error('upgrade'), { code: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED', status: 426 })), null);
  for (const value of [null, new Error('STORAGE_MAINTENANCE'), { code: 'UNAVAILABLE', status: 503 },
    { code: 'STORAGE_MAINTENANCE', status: '503' }, { code: 'STORAGE_MAINTENANCE', status: 503, uncertainWrite: true }]) {
    assert.equal(getStorageAvailability(value), null);
  }
  assert.equal(classifySaveFailure(Object.assign(new Error('paused'), { code: 'STORAGE_MAINTENANCE', status: 503 })), null);
  assert.equal(classifySaveFailure(Object.assign(new Error('unavailable'), { code: 'UNAVAILABLE', status: 503 })), 'server');
});

test('이전 학생의 늦은 점검 응답을 현재 학생 안내로 게시하지 않는다', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let actor = '17';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => actor } } });
  dismissStorageAvailabilityNotice();
  let calls = 0;
  const stop = subscribeStorageAvailability(() => { calls += 1; });
  try {
    const context = captureStorageResponseContext();
    actor = '4';
    assert.equal(publishStorageAvailability({ code: 'STORAGE_MAINTENANCE', status: 503 }, context), true);
    assert.equal(getStorageAvailabilityNotice(), null);
    assert.equal(calls, 0);
    publishStorageAvailability({ code: 'STORAGE_PROTOCOL_REQUIRED', status: 409 });
    assert.deepEqual(getStorageAvailabilityNotice(), { actor: 4, kind: 'update' });
    assert.equal(calls, 1);
    dismissStorageAvailabilityNotice();
    assert.equal(calls, 2);
  } finally {
    stop(); dismissStorageAvailabilityNotice();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
