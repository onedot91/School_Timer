import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSaveTimings, getSaveTimings, noteSaveNetworkTiming, parseServerTiming, recordSaveTiming, summarizeSaveTimings } from './saveTiming.js';

test('저장 응답의 Server-Timing에서 서버·DB 시간, RPC 수, 재시도 수를 읽는다', () => {
  assert.deepEqual(parseServerTiming('app;dur=84.2, storage;dur=61.5;desc="2 RPC", retry;desc="1"'),
    { appMs: 84.2, storageMs: 61.5, rpcCalls: 2, retries: 1 });
  assert.deepEqual(parseServerTiming('app;dur=10.0, storage;dur=4.0;desc="2 RPC"'),
    { appMs: 10, storageMs: 4, rpcCalls: 2, retries: 0 });
  assert.equal(parseServerTiming(null), undefined);
  assert.equal(parseServerTiming('cdn-cache;desc=HIT'), undefined);
});

test('클릭부터 반영까지 시간을 대기·네트워크·서버 시간과 함께 남긴다', () => {
  clearSaveTimings();
  noteSaveNetworkTiming('request-1', 120.04, 'app;dur=90.0, storage;dur=70.0;desc="2 RPC"');
  const entry = recordSaveTiming({ requestId: 'request-1', action: 'teacher.currency.adjust', clickedAt: 1000, requestStartedAt: 1700, finishedAt: 1850, outcome: 'saved' });
  assert.equal(entry.totalMs, 850);
  assert.equal(entry.waitMs, 700);
  assert.equal(entry.networkMs, 120);
  assert.deepEqual(entry.server, { appMs: 90, storageMs: 70, rpcCalls: 2, retries: 0 });
  assert.deepEqual(Object.keys(entry).sort(), ['action', 'at', 'networkMs', 'outcome', 'server', 'totalMs', 'waitMs']);
  const failed = recordSaveTiming({ requestId: 'request-2', action: 'teacher.currency.adjust', clickedAt: 0, requestStartedAt: 0, finishedAt: 5000, outcome: 'failed' });
  assert.equal(failed.networkMs, undefined);
  assert.equal(getSaveTimings().length, 2);
});

test('기능별 요약은 저장된 요청만으로 중앙값을 내고 실패 수를 따로 센다', () => {
  clearSaveTimings();
  [300, 100, 200].forEach((total, index) => {
    noteSaveNetworkTiming(`ok-${index}`, total / 2, `app;dur=1.0, storage;dur=${total / 4};desc="2 RPC", retry;desc="${index}"`);
    recordSaveTiming({ requestId: `ok-${index}`, action: 'teacher.settings.patch', clickedAt: 0, requestStartedAt: 0, finishedAt: total, outcome: 'saved' });
  });
  recordSaveTiming({ requestId: 'bad', action: 'teacher.settings.patch', clickedAt: 0, requestStartedAt: 0, finishedAt: 9000, outcome: 'failed' });
  assert.deepEqual(summarizeSaveTimings(), [{ action: 'teacher.settings.patch', count: 4, failed: 1,
    totalP50: 200, totalP95: 300, networkP50: 100, serverStorageP50: 50, retries: 3 }]);
});

test('응답을 기다리기만 하고 끝나지 않은 측정은 오래된 것부터 버린다', () => {
  clearSaveTimings();
  for (let index = 0; index < 60; index += 1) noteSaveNetworkTiming(`pending-${index}`, 1, null);
  assert.equal(recordSaveTiming({ requestId: 'pending-0', action: 'student.x', clickedAt: 0, requestStartedAt: 0, finishedAt: 1, outcome: 'saved' }).networkMs, undefined);
  assert.equal(recordSaveTiming({ requestId: 'pending-59', action: 'student.x', clickedAt: 0, requestStartedAt: 0, finishedAt: 1, outcome: 'saved' }).networkMs, 1);
});
