import { createServer } from 'node:http';
import handler from '../../../api/shared-settings.ts';
import { createDeviceSessionToken } from '../../../src/server/deviceSession.ts';

const secret = 'isolated-http-fixture-secret-longer-than-thirty-two-characters';
process.env.SUPABASE_URL = 'https://isolated-fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-fixture';
process.env.DEVICE_SESSION_SECRET = secret;
let row = { id: 'school-timer-main', value: { studentLife: { books: [] } }, updated_at: '2026-01-01T00:00:00.000Z' };
globalThis.fetch = async (input, init) => {
  if (String(input).includes('/rpc/library_competition_commit')) {
    const body = JSON.parse(String(init.body));
    if (body.p_expected_updated_at !== row.updated_at) return Response.json({ saved: false });
    row = { ...row, value: body.p_value, updated_at: body.p_updated_at };
    return Response.json({ saved: true });
  }
  if (String(input).includes('/library_competition_archives')) return Response.json([]);
  return Response.json([row]);
};
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const role = request.headers['x-test-role'] === 'teacher' ? { role: 'teacher' } : { role: 'student', studentNumber: 1 };
  const adapted = { setHeader: (key, value) => response.setHeader(key, value), status: (code) => { response.statusCode = code; return adapted; }, json: (value) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); } };
  await handler({ method: request.method, body: raw ? JSON.parse(raw) : undefined, query: Object.fromEntries(url.searchParams), headers: { 'sec-fetch-site': request.headers['sec-fetch-site'] ?? 'same-origin', cookie: `__Host-school-timer-device=${createDeviceSessionToken(role, secret)}` } }, adapted);
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port, fixture: 'HTTP adapter with in-memory PostgREST seam; not a real SQL engine' })));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
