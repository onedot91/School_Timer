/**
 * Local-only save timing for before/after speed comparisons.
 * Keeps action names and durations in memory; never payloads, students' writing or error text, and never sends them.
 */

export interface ServerSaveTiming {
  readonly appMs: number;
  readonly storageMs: number;
  readonly rpcCalls: number;
  readonly retries: number;
}

export interface SaveTimingEntry {
  readonly action: string;
  readonly outcome: 'saved' | 'failed';
  /** Click (or first click of a batch) until the confirmed result is applied. */
  readonly totalMs: number;
  /** Click until the request started: batching delay plus earlier saves in the queue. */
  readonly waitMs: number;
  /** The POST to the server as seen by the browser, when one completed. */
  readonly networkMs?: number;
  readonly server?: ServerSaveTiming;
  readonly at: string;
}

export interface SaveTimingSummary {
  readonly action: string;
  readonly count: number;
  readonly failed: number;
  readonly totalP50: number;
  readonly totalP95: number;
  readonly networkP50: number | null;
  readonly serverStorageP50: number | null;
  readonly retries: number;
}

declare global {
  interface Window {
    schoolSaveTimings?: { entries: () => SaveTimingEntry[]; summary: () => SaveTimingSummary[]; clear: () => void };
  }
}

const MAX_ENTRIES = 100;
const MAX_PENDING = 50;
const entries: SaveTimingEntry[] = [];
const network = new Map<string, { networkMs: number; server?: ServerSaveTiming }>();

const round = (value: number): number => Math.round(value * 10) / 10;

/** Parses this app's own Server-Timing header (`app;dur=…, storage;dur=…;desc="N RPC", retry;desc="N"`). */
export const parseServerTiming = (header: string | null): ServerSaveTiming | undefined => {
  if (!header) return undefined;
  const metrics = new Map<string, { dur?: number; desc?: string }>();
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';');
    const metric: { dur?: number; desc?: string } = {};
    for (const param of params) {
      const [key, raw = ''] = param.trim().split('=');
      const value = raw.replace(/^"|"$/g, '');
      if (key === 'dur' && Number.isFinite(Number(value))) metric.dur = Number(value);
      if (key === 'desc') metric.desc = value;
    }
    if (name) metrics.set(name.trim(), metric);
  }
  const app = metrics.get('app')?.dur, storage = metrics.get('storage');
  if (app === undefined || storage?.dur === undefined) return undefined;
  const calls = Number(/^(\d+) RPC$/.exec(storage.desc ?? '')?.[1] ?? NaN);
  const retries = Number(metrics.get('retry')?.desc ?? 0);
  return { appMs: app, storageMs: storage.dur, rpcCalls: Number.isFinite(calls) ? calls : 0, retries: Number.isFinite(retries) ? retries : 0 };
};

export const noteSaveNetworkTiming = (requestId: string, networkMs: number, serverTiming: string | null): void => {
  network.delete(requestId);
  network.set(requestId, { networkMs: round(networkMs), server: parseServerTiming(serverTiming) });
  while (network.size > MAX_PENDING) network.delete(network.keys().next().value ?? '');
};

export const recordSaveTiming = ({ requestId, action, clickedAt, requestStartedAt, finishedAt = performance.now(), outcome }: {
  readonly requestId: string; readonly action: string; readonly clickedAt: number; readonly requestStartedAt: number;
  readonly finishedAt?: number; readonly outcome: SaveTimingEntry['outcome'];
}): SaveTimingEntry => {
  const measured = network.get(requestId);
  network.delete(requestId);
  const entry: SaveTimingEntry = {
    action, outcome, totalMs: round(finishedAt - clickedAt), waitMs: round(Math.max(0, requestStartedAt - clickedAt)),
    ...(measured ? { networkMs: measured.networkMs, ...(measured.server ? { server: measured.server } : {}) } : {}),
    at: new Date().toISOString(),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  try { performance.measure(`save:${action}`, { start: clickedAt, end: finishedAt }); } catch { /* timing is optional */ }
  return entry;
};

const percentile = (values: readonly number[], ratio: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
};

export const summarizeSaveTimings = (list: readonly SaveTimingEntry[] = entries): SaveTimingSummary[] => (
  [...new Set(list.map(entry => entry.action))].map(action => {
    const group = list.filter(entry => entry.action === action);
    const saved = group.filter(entry => entry.outcome === 'saved');
    const totals = saved.map(entry => entry.totalMs);
    const networks = saved.flatMap(entry => entry.networkMs === undefined ? [] : [entry.networkMs]);
    const storage = saved.flatMap(entry => entry.server ? [entry.server.storageMs] : []);
    return {
      action, count: group.length, failed: group.length - saved.length,
      totalP50: percentile(totals, 0.5), totalP95: percentile(totals, 0.95),
      networkP50: networks.length ? percentile(networks, 0.5) : null,
      serverStorageP50: storage.length ? percentile(storage, 0.5) : null,
      retries: group.reduce((total, entry) => total + (entry.server?.retries ?? 0), 0),
    };
  })
);

export const getSaveTimings = (): SaveTimingEntry[] => [...entries];
export const clearSaveTimings = (): void => { entries.length = 0; network.clear(); };

if (typeof window !== 'undefined') {
  window.schoolSaveTimings = { entries: getSaveTimings, summary: () => summarizeSaveTimings(), clear: clearSaveTimings };
}
