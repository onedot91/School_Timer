import { parseClassDonationResult } from '../src/lib/classDonation.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest { readonly method?: string; readonly body?: unknown; readonly headers?: RequestHeaders }
interface ApiResponse { status: (code: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }

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
  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  if (!body || typeof body !== 'object') return void response.status(400).json({ error: 'INVALID_BODY' });
  const requestedStudent = Reflect.get(body, 'studentNumber');
  const amount = Reflect.get(body, 'amount');
  const requestId = Reflect.get(body, 'requestId');
  if (!Number.isInteger(requestedStudent) || requestedStudent < 1 || requestedStudent > 23 || !Number.isInteger(amount) || typeof requestId !== 'string') {
    return void response.status(400).json({ error: 'INVALID_CLASS_DONATION' });
  }
  if (session.role === 'student' && session.studentNumber !== requestedStudent) {
    return void response.status(403).json({ error: 'STUDENT_NUMBER_MISMATCH' });
  }
  try {
    const result = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/donate_to_class_goal`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_student_number: requestedStudent, p_amount: amount, p_request_id: requestId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`CLASS_DONATION_HTTP_${result.status}`);
    response.status(200).json(parseClassDonationResult(await result.json()));
  } catch (error) {
    console.error('Failed to donate to the class goal.', error);
    response.status(502).json({ error: 'CLASS_DONATION_FAILED' });
  }
}
