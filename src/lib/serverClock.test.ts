import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateServerClockOffsetMs,
  getServerSyncedNow,
  parseServerTimeResponse,
  sampleServerClock,
  SERVER_TIME_ENDPOINT,
  setServerClockOffsetMsForTest,
  syncServerClock,
} from './serverClock';

test('server time payload accepts only a positive finite number', () => {
  assert.equal(parseServerTimeResponse({ now: 1_700_000_000_000 }), 1_700_000_000_000);
  for (const value of [null, {}, { now: '1' }, { now: Number.NaN }, { now: -1 }, 5]) {
    assert.equal(parseServerTimeResponse(value), null);
  }
});

test('offset uses the fastest sample and its round-trip midpoint', () => {
  assert.equal(estimateServerClockOffsetMs([
    { sentAtMs: 1000, roundTripMs: 400, serverNowMs: 31_500 },
    { sentAtMs: 2000, roundTripMs: 100, serverNowMs: 32_050 },
  ]), 30_000);
});

test('offset ignores slow or invalid samples', () => {
  assert.equal(estimateServerClockOffsetMs([]), null);
  assert.equal(estimateServerClockOffsetMs([
    { sentAtMs: 0, roundTripMs: 5000, serverNowMs: 1 },
    { sentAtMs: 0, roundTripMs: -1, serverNowMs: 1 },
  ]), null);
});

test('sample reports failed or malformed responses as missing', async () => {
  const failing = async () => new Response('{}', { status: 503 });
  assert.equal(await sampleServerClock(failing), null);
  const malformed = async () => new Response('{"now":"x"}', { status: 200 });
  assert.equal(await sampleServerClock(malformed), null);
  const rejected = async () => { throw new TypeError('offline'); };
  assert.equal(await sampleServerClock(rejected), null);
});

test('sync moves every reader to the server instant and keeps it on failure', async (t) => {
  t.after(() => setServerClockOffsetMsForTest(0));
  setServerClockOffsetMsForTest(0);
  const requested: string[] = [];
  const ahead = async (input: string) => {
    requested.push(input);
    return Response.json({ now: Date.now() + 90_000 });
  };
  assert.equal(await syncServerClock(ahead), true);
  assert.deepEqual(requested, [SERVER_TIME_ENDPOINT, SERVER_TIME_ENDPOINT, SERVER_TIME_ENDPOINT]);
  const drift = getServerSyncedNow() - Date.now();
  assert.ok(Math.abs(drift - 90_000) < 1000, `drift ${drift}`);

  assert.equal(await syncServerClock(async () => new Response('', { status: 502 })), false);
  assert.ok(Math.abs(getServerSyncedNow() - Date.now() - drift) < 50);
});
