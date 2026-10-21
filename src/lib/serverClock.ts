// Device clocks drift apart (Chromebooks, teacher PC), so schedule-sensitive views
// read the server instant instead of Date.now(). The teacher's clock correction is
// applied on top of this shared reference.

export const SERVER_TIME_ENDPOINT = '/api/server-time';

const SYNC_INTERVAL_MS = 10 * 60_000;
const SAMPLE_COUNT = 3;
const MAX_ROUND_TRIP_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;

export interface ServerClockSample {
  /** Device time when the request was sent. */
  readonly sentAtMs: number;
  /** Measured round trip on a monotonic clock. */
  readonly roundTripMs: number;
  readonly serverNowMs: number;
}

export const parseServerTimeResponse = (body: unknown): number | null => {
  if (body === null || typeof body !== 'object') return null;
  const now = Reflect.get(body, 'now');
  return typeof now === 'number' && Number.isFinite(now) && now > 0 ? now : null;
};

/** NTP-style estimate from the fastest sample: server time maps to the round trip midpoint. */
export const estimateServerClockOffsetMs = (samples: readonly ServerClockSample[]): number | null => {
  let best: ServerClockSample | null = null;
  for (const sample of samples) {
    if (!Number.isFinite(sample.roundTripMs) || sample.roundTripMs < 0 || sample.roundTripMs > MAX_ROUND_TRIP_MS) continue;
    if (!best || sample.roundTripMs < best.roundTripMs) best = sample;
  }
  if (!best) return null;
  return Math.round(best.serverNowMs - (best.sentAtMs + best.roundTripMs / 2));
};

let serverClockOffsetMs = 0;

export const getServerSyncedNow = () => Date.now() + serverClockOffsetMs;

export const setServerClockOffsetMsForTest = (offsetMs: number) => {
  serverClockOffsetMs = offsetMs;
};

type FetchServerTime = (input: string, init: RequestInit) => Promise<Response>;

export const sampleServerClock = async (
  fetchImpl: FetchServerTime,
  readDeviceNow: () => number = Date.now,
  readMonotonic: () => number = () => performance.now(),
): Promise<ServerClockSample | null> => {
  const sentAtMs = readDeviceNow();
  const startedAt = readMonotonic();
  try {
    const response = await fetchImpl(SERVER_TIME_ENDPOINT, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const roundTripMs = readMonotonic() - startedAt;
    if (!response.ok) return null;
    const serverNowMs = parseServerTimeResponse(await response.json());
    return serverNowMs === null ? null : { sentAtMs, roundTripMs, serverNowMs };
  } catch {
    return null;
  }
};

export const syncServerClock = async (fetchImpl: FetchServerTime): Promise<boolean> => {
  const samples: ServerClockSample[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const sample = await sampleServerClock(fetchImpl);
    if (sample) samples.push(sample);
  }
  const offsetMs = estimateServerClockOffsetMs(samples);
  if (offsetMs === null) return false;
  serverClockOffsetMs = offsetMs;
  return true;
};

/** Browser-only: keeps the offset fresh. A failed sync keeps the last known offset. */
export const startServerClockSync = (fetchImpl: FetchServerTime = (input, init) => fetch(input, init)) => {
  let stopped = false;
  let syncing = false;
  const run = () => {
    if (stopped || syncing || document.visibilityState !== 'visible') return;
    syncing = true;
    void syncServerClock(fetchImpl).finally(() => { syncing = false; });
  };
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') run(); };
  run();
  const intervalId = window.setInterval(run, SYNC_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', run);
  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', run);
  };
};
