import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySaveFailure, parseSaveFailureReport, type SaveFailureAlert } from './saveFailure.js';
import { collectSaveFailureDiagnostics, formatSaveFailureDiagnostic, getSaveFailureExplanation, getSaveFailureLabel } from './saveFailureDiagnostics.js';

const alert: SaveFailureAlert = { id: 'diagnostic-test-123', studentNumber: 4, feature: 'auction', code: 'response', occurredAt: '2026-09-07T01:00:00.000Z', acknowledgedAt: null };

test('기존 물품 삭제 거절 알림도 다른 기기의 저장 충돌로 설명하지 않는다', () => {
  const explanation = getSaveFailureExplanation({ ...alert, code: 'conflict', diagnostics: { causeCode: 'AUCTION_ITEM_NOT_REMOVABLE', httpStatus: 409 } });
  assert.match(explanation.problem, /물품.*삭제/);
  assert.doesNotMatch(explanation.problem, /다른 기기/);
  assert.match(explanation.action, /물품 목록/);
  const previousAlert: SaveFailureAlert = { ...alert, code: 'conflict', diagnostics: { errorCode: 'AUCTION_ITEM_NOT_REMOVABLE' } };
  assert.equal(getSaveFailureLabel(previousAlert), '경매 물품 삭제 불가');
  assert.match(formatSaveFailureDiagnostic(previousAlert), /분류: 경매 물품 삭제 불가/);
  assert.equal(getSaveFailureLabel({ ...alert, code: 'conflict' }), '동시 저장 충돌');
});

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

test('클라이언트가 만든 거래 확인 필요 상태는 서버 HTTP 오류로 기록하지 않는다', () => {
  const error = Object.assign(new Error('STUDENT_ECONOMY_CONFIRMATION_REQUIRED'), {
    name: 'StudentEconomyRequestError',
    code: 'STUDENT_ECONOMY_CONFIRMATION_REQUIRED',
    status: 504,
  });

  assert.equal(classifySaveFailure(error), 'response');
  assert.deepEqual(collectSaveFailureDiagnostics(error), { errorCode: 'STUDENT_ECONOMY_CONFIRMATION_REQUIRED' });
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

test('복구 진단은 제한된 요청 식별자·배포 시각·단계·횟수만 통과한다', () => {
  const diagnostics = { requestId: 'submitted-request-123', buildVersion: '2026-09-09T01:02:03.000Z', stage: 'recovery', retryCount: 5 };
  const parsed = parseSaveFailureReport({ ...alert, diagnostics: { ...diagnostics, answer: '학생 내용', error: '원문 오류', requestBody: { content: '비공개' } } });
  assert.deepEqual(parsed?.diagnostics, diagnostics);
  assert.doesNotMatch(JSON.stringify(parsed), /학생 내용|원문 오류|비공개/);
  assert.equal(parseSaveFailureReport({ ...alert, diagnostics: { requestId: '비공개 내용', buildVersion: 'private token', stage: '/api?answer=private', retryCount: 10000 } })?.diagnostics, undefined);
  assert.match(formatSaveFailureDiagnostic({ ...alert, diagnostics: parsed?.diagnostics }), /저장 요청 ID: submitted-request-123/);
  assert.match(formatSaveFailureDiagnostic({ ...alert, diagnostics: parsed?.diagnostics }), /재시도 횟수: 5/);
});
