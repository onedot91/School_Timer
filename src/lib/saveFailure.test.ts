import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySaveFailure, parseSaveFailureAlert, parseSaveFailureReport } from './saveFailure.js';

const report = { id: 'test-alert-123', studentNumber: 3, feature: 'emotion', code: 'network', occurredAt: '2026-09-07T01:00:00.000Z' };

test('save alerts retain only safe metadata and validate persisted input', () => {
  assert.deepEqual(parseSaveFailureReport({ ...report, message: 'private student answer', value: 'secret' }), report);
  for (const invalid of [null, {}, { ...report, studentNumber: 24 }, { ...report, feature: '__proto__' }, { ...report, code: 'secret' }, { ...report, occurredAt: 'bad date' }, { ...report, id: '../main' }]) {
    assert.equal(parseSaveFailureReport(invalid), null);
  }
  assert.deepEqual(parseSaveFailureAlert({ ...report, acknowledgedAt: null }), { ...report, acknowledgedAt: null });
  assert.equal(parseSaveFailureAlert(report), null);
});

test('storage failures are distinguished from ordinary business validation', () => {
  assert.equal(classifySaveFailure(new TypeError('Failed to fetch')), 'network');
  assert.equal(classifySaveFailure(new Error('SHARED_API_HTTP_403')), 'permission');
  assert.equal(classifySaveFailure(new Error('SHARED_API_HTTP_502')), 'server');
  assert.equal(classifySaveFailure(new Error('SHARED_SETTINGS_CONFLICT')), 'conflict');
  assert.equal(classifySaveFailure(new DOMException('Full', 'QuotaExceededError')), 'storage');
  assert.equal(classifySaveFailure(new SyntaxError('Invalid JSON')), 'response');
  for (const message of ['INSUFFICIENT_BALANCE', 'BID_TOO_LOW', 'READ_ONLY_DATA_MODE']) assert.equal(classifySaveFailure(new Error(message)), null);
});
