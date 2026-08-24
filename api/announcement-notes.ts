import { getDeviceSession, type RequestHeaders } from './deviceSession.js';
import { isCrossSiteRequest } from './requestRateLimit.js';

interface ApiRequest { readonly method?: string; readonly body?: unknown; readonly query?: Record<string, string | readonly string[] | undefined>; readonly headers?: RequestHeaders }
interface ApiResponse { status: (code: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }

const getQuery = (query: ApiRequest['query'], name: string) => {
  const value = query?.[name];
  return Array.isArray(value) ? value[0] : value;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.DEVICE_SESSION_SECRET;
  if (!url || !key || !secret || secret.length < 32) return void response.status(503).json({ error: 'ANNOUNCEMENT_NOTES_NOT_CONFIGURED' });
  const session = getDeviceSession(request.headers, secret);
  if (!session) return void response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
  if (session.role !== 'teacher') return void response.status(403).json({ error: 'TEACHER_DEVICE_REQUIRED' });
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/announcement_notes`;
  const authHeaders = { Accept: 'application/json', apikey: key, Authorization: `Bearer ${key}` };

  if (request.method === 'GET') {
    const dateKey = getQuery(request.query, 'dateKey');
    const limit = Math.min(120, Math.max(1, Number.parseInt(getQuery(request.query, 'limit') ?? '120', 10) || 120));
    const suffix = dateKey
      ? `?date_key=eq.${encodeURIComponent(dateKey)}&select=date_key,date_text,note,updated_at`
      : `?select=date_key,date_text,note,updated_at&order=date_key.desc&limit=${limit}`;
    try {
      const result = await fetch(`${endpoint}${suffix}`, { headers: authHeaders, signal: AbortSignal.timeout(8000) });
      if (!result.ok) throw new Error(`ANNOUNCEMENT_NOTES_READ_HTTP_${result.status}`);
      const rows: unknown = await result.json();
      response.status(200).json(dateKey ? (Array.isArray(rows) ? rows[0] ?? null : null) : rows);
    } catch (error) {
      console.error('Failed to load announcement notes.', error);
      response.status(502).json({ error: 'ANNOUNCEMENT_NOTES_READ_FAILED' });
    }
    return;
  }
  if (request.method !== 'PUT') return void response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (isCrossSiteRequest(request.headers)) return void response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  if (!body || typeof body !== 'object') return void response.status(400).json({ error: 'INVALID_ANNOUNCEMENT_NOTE' });
  const dateKey = Reflect.get(body, 'date_key');
  const dateText = Reflect.get(body, 'date_text');
  const note = Reflect.get(body, 'note');
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || typeof dateText !== 'string' || typeof note !== 'string' || note.length > 10_000) {
    return void response.status(400).json({ error: 'INVALID_ANNOUNCEMENT_NOTE' });
  }
  try {
    const result = await fetch(`${endpoint}?on_conflict=date_key`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ date_key: dateKey, date_text: dateText.slice(0, 200), note, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`ANNOUNCEMENT_NOTES_WRITE_HTTP_${result.status}`);
    response.status(204).json(null);
  } catch (error) {
    console.error('Failed to save announcement note.', error);
    response.status(502).json({ error: 'ANNOUNCEMENT_NOTES_WRITE_FAILED' });
  }
}
