import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSaveFailureReport, type SaveFailureAlert } from './saveFailure.js';
import { collectSaveFailureDiagnostics, formatSaveFailureDiagnostic, getSaveFailureExplanation } from './saveFailureDiagnostics.js';

const alert: SaveFailureAlert = { id: 'diagnostic-test-123', studentNumber: 4, feature: 'auction', code: 'response', occurredAt: '2026-09-07T01:00:00.000Z', acknowledgedAt: null };

test('diagnostics preserve the original failure through an uncertain-write wrapper without saving raw error text', () => {
  const cause = Object.assign(new Error('SHARED_API_HTTP_502'), { status: 502, serverCode: 'SHARED_SETTINGS_WRITE_FAILED', endpoint: '/api/shared-settings' });
  const error = new Error('SHARED_SETTINGS_SAVE_UNCONFIRMED', { cause });
  const diagnostics = collectSaveFailureDiagnostics(error, { view: 'store-auction', online: true });
  assert.deepEqual(diagnostics, { errorCode: 'SHARED_SETTINGS_SAVE_UNCONFIRMED', causeCode: 'SHARED_SETTINGS_WRITE_FAILED', httpStatus: 502, errorName: 'Error', endpoint: '/api/shared-settings', view: 'store-auction', online: true });
  const raw = Object.assign(new TypeError('private student answer'), { serverCode: 'token=secret', endpoint: '/api/shared-settings?answer=private' });
  assert.deepEqual(collectSaveFailureDiagnostics(raw), { errorName: 'TypeError' });
  assert.deepEqual(collectSaveFailureDiagnostics(new DOMException('SHARED_SETTINGS_REQUEST_TIMEOUT', 'TimeoutError')), { errorCode: 'SHARED_SETTINGS_REQUEST_TIMEOUT', errorName: 'TimeoutError' });
  const parsed = parseSaveFailureReport({ ...alert, diagnostics: { ...diagnostics, message: 'private', stack: 'secret', requestBody: { answer: 'private' } } });
  assert.deepEqual(parsed?.diagnostics, diagnostics);
  assert.ok(!JSON.stringify(parsed).includes('private'));
  assert.equal(parseSaveFailureReport({ ...alert, diagnostics: { errorCode: 'private text', endpoint: '/api/unknown', httpStatus: '502', online: 'true', view: '__proto__' } })?.diagnostics, undefined);
});

test('teacher guidance distinguishes unconfirmed saves, offline devices, and missing legacy details', () => {
  assert.match(getSaveFailureExplanation(alert).problem, /저장됐을 수도/);
  assert.match(getSaveFailureExplanation(alert).action, /중복/);
  const offline = { ...alert, code: 'network' as const, diagnostics: { online: false } };
  assert.match(getSaveFailureExplanation(offline).problem, /오프라인/);
  assert.match(getSaveFailureExplanation({ ...offline, diagnostics: { online: true } }).problem, /확정할 수 없습니다/);
  assert.match(getSaveFailureExplanation({ ...alert, code: 'permission', diagnostics: { httpStatus: 401 } }).problem, /인증/);
  assert.match(getSaveFailureExplanation({ ...alert, code: 'storage' }).action, /삭제하지 마세요/);
  assert.match(getSaveFailureExplanation({ ...alert, diagnostics: { causeCode: 'SHARED_SETTINGS_NOT_CONFIGURED' } }).action, /서버 연결 설정/);
  assert.match(formatSaveFailureDiagnostic(alert), /이전 알림에는 상세 진단이 저장되지 않았습니다/);
  assert.match(formatSaveFailureDiagnostic({ ...alert, diagnostics: { errorCode: 'SHARED_SETTINGS_WRITE_FAILED', httpStatus: 502, view: 'store-auction' } }), /화면: 경매장/);
});
