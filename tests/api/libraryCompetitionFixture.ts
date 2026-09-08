import handler from "../../api/shared-settings.js";
import { createStorageV2Fixture } from "./storageV2Fixture.js";
import { createDeviceSessionToken } from "../../src/server/deviceSession.js";

const secret = 'competition-test-secret-with-more-than-thirty-two-characters';
export const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
export const book = (id: string, librarySlot?: number) => ({ id, studentNumber: 1, title: '검증 책', author: '검증 작가', pageCount: 90, createdAt: '2026-01-01T00:00:00.000Z', colorIndex: 0, ...(librarySlot === undefined ? {} : { librarySlot }) });
type Row = { id: string; value: Record<string, unknown>; updated_at: string };

export async function fixture(run: (api: {
  call: (body: unknown, role?: 'teacher' | 'student' | 'cross-site' | number, method?: string) => Promise<{ status: number; body: Record<string, unknown> }>;
  read: () => Row;
  set: (value: Record<string, unknown>) => void;
  archives: Map<string, Record<string, unknown>>;
  fail: (status?: number) => void;
  loseResponse: () => void;
  setTimestamp: (timestamp: string) => void;
}) => Promise<void>) {
  const old = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.DEVICE_SESSION_SECRET, protocol: process.env.STORAGE_PROTOCOL_VERSION, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = 'https://competition-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.DEVICE_SESSION_SECRET = secret;
  process.env.STORAGE_PROTOCOL_VERSION = '2';
  const storage = createStorageV2Fixture({ studentLife: { books: [book('placed', 0), book('carried')] }, currencyBalances: { 1: 123 } });
  globalThis.fetch = storage.fetch;
  try {
    await run({
      call: async (body, role = 'student', method = 'PUT') => {
        let status = 200;
        let result: unknown;
        const response = { setHeader: () => undefined, status: (next: number) => { status = next; return response; }, json: (next: unknown) => { result = next; } };
        const identity = role === 'teacher' ? { role: 'teacher' as const } : { role: 'student' as const, studentNumber: typeof role === 'number' ? role : 1 };
        await handler({ method, body: body && typeof body === 'object' ? { ...record(body), protocolVersion: 2, requestId: record(body).requestId ?? crypto.randomUUID() } : body, query: method === 'GET' ? { libraryCompetition: '1' } : {}, headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken(identity, secret)}`, 'sec-fetch-site': role === 'cross-site' ? 'cross-site' : 'same-origin' } }, response);
        return { status, body: record(result) };
      },
      read: storage.read, set: storage.set, setTimestamp: storage.setTimestamp, archives: storage.archives, fail: storage.failNextCommit, loseResponse: storage.loseNextCommitResponse,
    });
  } finally {
    globalThis.fetch = old.fetch;
    for (const [key, value] of [['SUPABASE_URL', old.url], ['SUPABASE_SERVICE_ROLE_KEY', old.key], ['DEVICE_SESSION_SECRET', old.secret], ['STORAGE_PROTOCOL_VERSION', old.protocol]]) {
      if (key === undefined) continue;
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
