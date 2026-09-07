import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';
import { parseSaveFailureAlert, parseSaveFailureReport, SAVE_FAILURE_ROW_PREFIX } from '../src/lib/saveFailure.js';

interface ApiRequest { method?: string; body?: unknown; headers?: RequestHeaders }
interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(value: unknown): void;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.DEVICE_SESSION_SECRET;
  if (!url || !key || !secret || secret.length < 32) {
    response.status(503).json({ error: 'SAVE_ALERTS_NOT_CONFIGURED' }); return;
  }
  const session = getDeviceSession(request.headers, secret);
  if (!session) { response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' }); return; }
  if (request.method !== 'GET' && request.method !== 'POST') { response.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  if (request.method === 'GET' && session.role !== 'teacher') { response.status(403).json({ error: 'TEACHER_REQUIRED' }); return; }
  if (request.method !== 'GET' && isCrossSiteRequest(request.headers)) { response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' }); return; }
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/app_settings`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const query = async (suffix: string, init: RequestInit = {}) => {
    const result = await fetch(`${endpoint}${suffix}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(8000) });
    if (!result.ok) throw new Error('SAVE_ALERTS_DATABASE_FAILED');
    return init.method === 'POST' || init.method === 'PATCH' || result.status === 204 ? null : result.json() as Promise<unknown>;
  };
  try {
    if (request.method === 'GET') {
      const rows = await query(`?id=like.${SAVE_FAILURE_ROW_PREFIX}*&value->>acknowledgedAt=is.null&select=value&order=updated_at.desc&limit=101`);
      if (!Array.isArray(rows)) throw new Error('INVALID_RESPONSE');
      const alerts = rows.map((row: unknown) => parseSaveFailureAlert(row && typeof row === 'object' ? Reflect.get(row, 'value') : null));
      if (alerts.some((alert) => !alert)) throw new Error('INVALID_RESPONSE');
      response.status(200).json({ alerts: alerts.slice(0, 100), hasMore: alerts.length > 100 }); return;
    }
    if (Buffer.byteLength(JSON.stringify(request.body) ?? '', 'utf8') > 2048) {
      response.status(400).json({ error: 'INVALID_SAVE_ALERT' }); return;
    }
    const body: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) { response.status(400).json({ error: 'INVALID_SAVE_ALERT' }); return; }
    const actor = session.role === 'teacher' ? 0 : session.studentNumber;
    if (Reflect.get(body, 'action') === 'acknowledge') {
      if (session.role !== 'teacher') { response.status(403).json({ error: 'TEACHER_REQUIRED' }); return; }
      const report = parseSaveFailureReport(Reflect.get(body, 'alert'));
      if (!report) { response.status(400).json({ error: 'INVALID_SAVE_ALERT' }); return; }
      const id = `${SAVE_FAILURE_ROW_PREFIX}${report.studentNumber}-${report.id}`;
      const rows = await query(`?id=eq.${encodeURIComponent(id)}&select=value`);
      if (!Array.isArray(rows) || rows.length !== 1) { response.status(404).json({ error: 'SAVE_ALERT_NOT_FOUND' }); return; }
      const alert = parseSaveFailureAlert(rows[0]?.value);
      if (!alert) throw new Error('INVALID_RESPONSE');
      await query(`?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ value: { ...alert, acknowledgedAt: new Date().toISOString() } }),
      });
      response.status(200).json({ ok: true }); return;
    }
    const report = parseSaveFailureReport(body);
    if (!report) { response.status(400).json({ error: 'INVALID_SAVE_ALERT' }); return; }
    if (report.studentNumber !== actor) { response.status(403).json({ error: 'STUDENT_SCOPE_VIOLATION' }); return; }
    const limit = consumeRequestRateLimit('save-alerts', request.headers, actor);
    if (!limit.allowed) { response.setHeader('Retry-After', String(limit.retryAfterSeconds)); response.status(429).json({ error: 'TOO_MANY_REQUESTS' }); return; }
    await query('?on_conflict=id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ id: `${SAVE_FAILURE_ROW_PREFIX}${actor}-${report.id}`, value: { ...report, acknowledgedAt: null }, updated_at: new Date().toISOString() }),
    });
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(error instanceof SyntaxError ? 400 : 502).json({ error: error instanceof SyntaxError ? 'INVALID_SAVE_ALERT' : 'SAVE_ALERTS_UNAVAILABLE' });
  }
}
