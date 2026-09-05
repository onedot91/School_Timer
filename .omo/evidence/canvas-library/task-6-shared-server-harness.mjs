import http from 'node:http';

import handler from '../../../api/shared-settings.ts';
import { createDeviceSessionToken } from '../../../src/server/deviceSession.ts';

const PORT = 3036;
const SETTINGS_ID = 'school-timer-main';
const SESSION_SECRET = 'synthetic-qa-session-secret-with-at-least-32-characters';
const SUPABASE_URL = `http://127.0.0.1:${PORT}/fake`;
const initialRow = () => ({
  id: SETTINGS_ID,
  value: {
    currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), 0])),
    currencyHistory: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [String(index + 1), []])),
    studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: {} },
  },
  updated_at: '2026-09-05T00:00:00.000Z',
});

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-qa-service-role';
process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

let row = initialRow();
let timeoutAfterCommit = false;
let barrier = null;

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
};

const waitAtReadBarrier = async () => {
  if (!barrier) return;
  const active = barrier;
  active.arrived += 1;
  if (active.arrived >= active.target) active.release();
  await active.promise;
  if (barrier === active) barrier = null;
};

const projectStudentRow = (select) => {
  const match = select.match(/currencyBalances:value->currencyBalances->"(\d+)"/);
  const studentKey = match?.[1] ?? '1';
  const result = { id: SETTINGS_ID, updated_at: row.updated_at };
  for (const part of select.split(',')) {
    const alias = part.split(':')[0];
    if (!alias || alias === 'id' || alias === 'updated_at') continue;
    if (part.includes(`->"${studentKey}"`)) result[alias] = row.value[alias]?.[studentKey] ?? null;
    else result[alias] = row.value[alias] ?? null;
  }
  return result;
};

const handleFakePostgrest = async (request, response, url) => {
  if (request.method === 'GET') {
    const snapshot = row ? structuredClone(row) : null;
    await waitAtReadBarrier();
    const select = url.searchParams.get('select') ?? '';
    if (!snapshot) return sendJson(response, 200, []);
    if (select === 'updated_at') return sendJson(response, 200, [{ updated_at: snapshot.updated_at }]);
    if (select === 'id,value,updated_at') return sendJson(response, 200, [snapshot]);
    return sendJson(response, 200, [projectStudentRow(select)]);
  }
  const body = await readJson(request);
  if (request.method === 'PATCH') {
    const expected = url.searchParams.get('updated_at')?.replace(/^eq\./, '') ?? '';
    if (!row || row.updated_at !== expected) return sendJson(response, 200, []);
    row = { id: SETTINGS_ID, value: structuredClone(body.value), updated_at: body.updated_at };
    if (timeoutAfterCommit) {
      timeoutAfterCommit = false;
      response.destroy();
      return;
    }
    return sendJson(response, 200, [{ id: SETTINGS_ID }]);
  }
  if (request.method === 'POST') {
    if (row) return sendJson(response, 409, { code: '23505' });
    row = structuredClone(body);
    return sendJson(response, 201, [{ id: SETTINGS_ID }]);
  }
  return sendJson(response, 405, { error: 'FAKE_METHOD_NOT_ALLOWED' });
};

const invokeHandler = async (request, response, url, syntheticStudent) => {
  const body = await readJson(request);
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, value]));
  if (syntheticStudent !== null) {
    headers.cookie = `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber: syntheticStudent }, SESSION_SECRET)}`;
    headers['sec-fetch-site'] = headers['x-qa-cross-site'] === '1' ? 'cross-site' : 'same-origin';
    delete headers['x-qa-cross-site'];
  }
  let statusCode = 200;
  const outgoingHeaders = {};
  const apiResponse = {
    setHeader: (name, value) => { outgoingHeaders[name] = value; },
    status: (code) => { statusCode = code; return apiResponse; },
    json: (value) => sendJson(response, statusCode, value, outgoingHeaders),
  };
  await handler({
    method: request.method,
    body,
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
  }, apiResponse);
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
    if (url.pathname === '/qa/reset' && request.method === 'POST') {
      row = initialRow();
      timeoutAfterCommit = false;
      barrier = null;
      return sendJson(response, 200, { ok: true, updatedAt: row.updated_at });
    }
    if (url.pathname === '/qa/state' && request.method === 'GET') return sendJson(response, 200, row);
    if (url.pathname === '/qa/barrier' && request.method === 'POST') {
      const body = await readJson(request);
      const target = Number(body?.reads);
      if (!Number.isInteger(target) || target < 2 || target > 5) return sendJson(response, 400, { error: 'INVALID_BARRIER' });
      let release;
      const promise = new Promise((resolve) => { release = resolve; });
      barrier = { target, arrived: 0, promise, release };
      return sendJson(response, 200, { ok: true, reads: target });
    }
    if (url.pathname === '/qa/timeout-after-commit' && request.method === 'POST') {
      timeoutAfterCommit = true;
      return sendJson(response, 200, { ok: true });
    }
    const qaMatch = url.pathname.match(/^\/qa\/request\/(\d+)$/);
    if (qaMatch) {
      const studentNumber = Number(qaMatch[1]);
      if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) {
        return sendJson(response, 400, { error: 'INVALID_QA_STUDENT' });
      }
      return await invokeHandler(request, response, url, studentNumber);
    }
    if (url.pathname === '/api/shared-settings') return await invokeHandler(request, response, url, null);
    if (url.pathname === '/fake/rest/v1/app_settings') return await handleFakePostgrest(request, response, url);
    return sendJson(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    return sendJson(response, 500, { error: error instanceof SyntaxError ? 'INVALID_JSON' : 'HARNESS_FAILURE' });
  }
});

const close = () => server.close(() => process.exit(0));
process.once('SIGINT', close);
process.once('SIGTERM', close);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`canvas-library task6 QA harness listening on http://127.0.0.1:${PORT}`);
});
