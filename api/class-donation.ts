import { createClassDonationThankYouLetter, parseClassDonationResult } from '../src/lib/classDonation.js';
import { normalizeStudentLifeState } from '../src/lib/studentLife.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest { readonly method?: string; readonly body?: unknown; readonly headers?: RequestHeaders }
interface ApiResponse { status: (code: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }

const DOMAIN_ERRORS = new Set([
  'CLASS_DONATION_DISABLED', 'CLASS_DONATION_COMPLETED', 'CLASS_DONATION_EXCEEDS_REMAINING',
  'INSUFFICIENT_AVAILABLE_CURRENCY', 'INVALID_DONATION_AMOUNT', 'INVALID_DONATION_REQUEST_ID',
]);

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return void response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (isCrossSiteRequest(request.headers)) return void response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.DEVICE_SESSION_SECRET;
  if (!url || !key || !secret || secret.length < 32) return void response.status(503).json({ error: 'CLASS_DONATION_NOT_CONFIGURED' });
  const session = getDeviceSession(request.headers, secret);
  if (!session) return void response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
  let body: unknown;
  try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; }
  catch { return void response.status(400).json({ error: 'INVALID_BODY' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return void response.status(400).json({ error: 'INVALID_BODY' });
  const requestedStudent: unknown = Reflect.get(body, 'studentNumber');
  const amount: unknown = Reflect.get(body, 'amount');
  const requestId: unknown = Reflect.get(body, 'requestId');
  if (typeof requestedStudent !== 'number' || !Number.isInteger(requestedStudent) || requestedStudent < 1 || requestedStudent > 23
    || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 999999
    || typeof requestId !== 'string' || !requestId.trim() || requestId.length > 100) {
    return void response.status(400).json({ error: 'INVALID_CLASS_DONATION' });
  }
  if (session.role === 'student' && session.studentNumber !== requestedStudent) {
    return void response.status(403).json({ error: 'STUDENT_NUMBER_MISMATCH' });
  }
  if (Reflect.get(body, 'protocolVersion') !== 2) return void response.status(409).json({ error: 'LEGACY_CLIENT_UPDATE_REQUIRED' });
  const letter = createClassDonationThankYouLetter(normalizeStudentLifeState(null), {
    studentNumber: requestedStudent, donatedAmount: amount, requestId, createdAt: new Date().toISOString(),
  }).letters[0];
  try {
    const result = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/donate_to_class_goal_v2`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_student_number: requestedStudent, p_amount: amount, p_request_id: requestId, p_protocol_version: 2, p_thank_you_letter: letter }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) {
      const failure: unknown = await result.json().catch(() => null);
      const code: unknown = failure && typeof failure === 'object' ? Reflect.get(failure, 'message') : null;
      if (typeof code === 'string' && DOMAIN_ERRORS.has(code)) return void response.status(400).json({ error: code });
      if (code === 'STORAGE_MAINTENANCE' || code === 'STORAGE_NOT_ACTIVE') return void response.status(503).json({ error: code });
      if (code === 'LEGACY_CLIENT_UPDATE_REQUIRED' || code === 'STORAGE_REQUEST_PAYLOAD_MISMATCH' || code === 'STORAGE_LEGACY_REQUEST_ALREADY_COMMITTED') {
        return void response.status(409).json({ error: code });
      }
      return void response.status(502).json({ error: 'CLASS_DONATION_FAILED' });
    }
    response.status(200).json(parseClassDonationResult(await result.json()));
  } catch {
    response.status(502).json({ error: 'CLASS_DONATION_FAILED' });
  }
}
