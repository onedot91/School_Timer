import handler from "../../api/shared-settings.js";
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
}) => Promise<void>) {
  const old = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.DEVICE_SESSION_SECRET, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = 'https://competition-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.DEVICE_SESSION_SECRET = secret;
  let row: Row = { id: 'school-timer-main', value: { studentLife: { books: [book('placed', 0), book('carried')] }, currencyBalances: { 1: 123 } }, updated_at: '2026-01-01T00:00:00.000Z' };
  const archives = new Map<string, Record<string, unknown>>();
  let fail = 0;
  let loseResponse = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/rpc/library_competition_commit')) {
      if (fail) return Response.json({ code: 'P0001' }, { status: fail });
      const body = record(JSON.parse(String(init?.body)));
      if (body.p_expected_updated_at !== row.updated_at) return Response.json({ saved: false });
      const archive = record(body.p_archive);
      if (typeof archive.seasonId === 'string') archives.set(archive.seasonId, archive);
      row = { ...row, value: record(body.p_value), updated_at: String(body.p_updated_at) };
      if (loseResponse) { loseResponse = false; throw new TypeError('Fixture connection lost after commit'); }
      return Response.json({ saved: true });
    }
    if (url.pathname.endsWith('/library_competition_archives')) {
      return Response.json([...archives.values()].map((archive) => ({ season_id: archive.seasonId, archived_at: archive.archivedAt, standings: archive.standings, books: archive.books })));
    }
    if (init?.method === 'PATCH') {
      const body = record(JSON.parse(String(init.body)));
      if (url.searchParams.get('updated_at') !== `eq.${row.updated_at}`) return Response.json([]);
      row = { ...row, value: record(body.value), updated_at: String(body.updated_at) };
      return Response.json([{ id: row.id }]);
    }
    return Response.json([row]);
  };
  try {
    await run({
      call: async (body, role = 'student', method = 'PUT') => {
        let status = 200;
        let result: unknown;
        const response = { setHeader: () => undefined, status: (next: number) => { status = next; return response; }, json: (next: unknown) => { result = next; } };
        const identity = role === 'teacher' ? { role: 'teacher' as const } : { role: 'student' as const, studentNumber: typeof role === 'number' ? role : 1 };
        await handler({ method, body, query: method === 'GET' ? { libraryCompetition: '1' } : {}, headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken(identity, secret)}`, 'sec-fetch-site': role === 'cross-site' ? 'cross-site' : 'same-origin' } }, response);
        return { status, body: record(result) };
      },
      read: () => row, set: (value) => { row = { ...row, value }; }, archives, fail: (status = 500) => { fail = status; }, loseResponse: () => { loseResponse = true; },
    });
  } finally {
    globalThis.fetch = old.fetch;
    for (const [key, value] of [['SUPABASE_URL', old.url], ['SUPABASE_SERVICE_ROLE_KEY', old.key], ['DEVICE_SESSION_SECRET', old.secret]]) {
      if (key === undefined) continue;
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
