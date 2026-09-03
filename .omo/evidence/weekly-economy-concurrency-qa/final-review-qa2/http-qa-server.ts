import http from 'node:http';
import handlerStudentEconomy from '../../../../api/student-economy.ts';
import handlerSharedSettings from '../../../../api/shared-settings.ts';
import { createDeviceSessionToken } from '../../../../src/server/deviceSession.ts';
import { createStudentEconomyState } from '../../../../src/lib/studentEconomy.ts';
import { FAILURE_PROFILE_IMAGES } from '../../../../src/lib/failureExhibition.ts';

const secret = 'qa2-device-session-secret-with-at-least-32-characters';
const economy = (overrides: Record<string, unknown> = {}) => ({
  ...createStudentEconomyState(),
  ...overrides,
});

let version = 'qa2-v1';
let value: Record<string, unknown> = {
  schedule: ['qa2-teacher-value'],
  currencyBalances: { '1': 300, '2': 100, '3': 210, '4': 100, '5': 100 },
  currencyHistory: { '1': [], '2': [], '3': [], '4': [], '5': [] },
  studentEconomy: {
    '1': economy({ inventory: { house_repair: 1 } }),
    '2': economy(),
    '3': economy(),
    '4': economy(),
    '5': economy({ inventory: { house_repair: 1 }, ownedHouseIds: ['pink-cottage'], activeHouseId: 'pink-cottage' }),
  },
  studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: { '4': FAILURE_PROFILE_IMAGES[0] } },
  auctionBids: {},
  auctionAwards: {},
};

const supabaseHeaders = () => ({ 'content-type': 'application/json' });
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: supabaseHeaders() });

const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === 'PATCH') {
    const expected = (new URL(url).searchParams.get('updated_at') ?? '').replace(/^eq\./, '');
    if (expected !== version) return jsonResponse([], 200);
    const body = JSON.parse(String(init.body ?? '{}')) as { value?: Record<string, unknown>; updated_at?: string };
    value = body.value ?? value;
    version = body.updated_at ?? `qa2-v${Date.now()}`;
    return jsonResponse([{ id: 'school-timer-main' }]);
  }
  if (init?.method === 'POST') {
    const body = JSON.parse(String(init.body ?? '{}')) as { value?: Record<string, unknown>; updated_at?: string };
    value = body.value ?? value;
    version = body.updated_at ?? `qa2-v${Date.now()}`;
    return jsonResponse([{ id: 'school-timer-main' }]);
  }
  if (url.includes('select=updated_at')) return jsonResponse([{ updated_at: version }]);
  if (url.includes('select=id,value,updated_at')) return jsonResponse([{ id: 'school-timer-main', value, updated_at: version }]);
  return jsonResponse([{ id: 'school-timer-main', value, updated_at: version }]);
};

globalThis.fetch = fakeFetch;
process.env.SUPABASE_URL = 'https://qa2-isolated.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'qa2-service-role';
process.env.DEVICE_SESSION_SECRET = secret;

const tokens = {
  student1: createDeviceSessionToken({ role: 'student', studentNumber: 1 }, secret),
  student2: createDeviceSessionToken({ role: 'student', studentNumber: 2 }, secret),
  student3: createDeviceSessionToken({ role: 'student', studentNumber: 3 }, secret),
  student4: createDeviceSessionToken({ role: 'student', studentNumber: 4 }, secret),
  student5: createDeviceSessionToken({ role: 'student', studentNumber: 5 }, secret),
  teacher: createDeviceSessionToken({ role: 'teacher' }, secret),
};

const requestBody = async (request: http.IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
};

const invoke = async (request: http.IncomingMessage, response: http.ServerResponse, target: 'student' | 'shared') => {
  const headers: Record<string, string> = {};
  Object.entries(request.headers).forEach(([name, header]) => {
    if (typeof header === 'string') headers[name] = header;
  });
  const result = {
    statusCode: 200,
    body: undefined as unknown,
  };
  const apiResponse = {
    setHeader: (name: string, headerValue: string) => response.setHeader(name, headerValue),
    status: (statusCode: number) => { result.statusCode = statusCode; return apiResponse; },
    json: (body: unknown) => { result.body = body; },
  };
  const query = Object.fromEntries(new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.entries());
  const apiRequest = { method: request.method, headers, body: await requestBody(request), query };
  if (target === 'student') await handlerStudentEconomy(apiRequest, apiResponse);
  else await handlerSharedSettings(apiRequest, apiResponse);
  response.statusCode = result.statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(result.body ?? null));
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/dump')) {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ version, value }));
      return;
    }
    if (request.url?.startsWith('/api/student-economy')) return await invoke(request, response, 'student');
    if (request.url?.startsWith('/api/shared-settings')) return await invoke(request, response, 'shared');
    response.statusCode = 404;
    response.end('not found');
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: String(error) }));
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('QA2_SERVER_ADDRESS_UNAVAILABLE');
  console.log(JSON.stringify({ port: address.port, secret, tokens }));
});
