import { timingSafeEqual } from 'node:crypto';

import {
  clearDeviceSessionCookie,
  createDeviceSessionCookie,
  createDeviceSessionToken,
  getDeviceSession,
  type DeviceSessionRegistration,
  type RequestHeaders,
} from '../src/server/deviceSession.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: RequestHeaders;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

const parseRegistration = (body: unknown): { readonly registration: DeviceSessionRegistration; readonly key: string | null } | null => {
  let parsedBody: unknown;
  try {
    parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!parsedBody || typeof parsedBody !== 'object') return null;
  const entryNumber = Reflect.get(parsedBody, 'entryNumber');
  const key = Reflect.get(parsedBody, 'registrationKey');
  if (!Number.isInteger(entryNumber) || entryNumber < 0 || entryNumber > 23) return null;
  if (entryNumber === 0 && typeof key !== 'string') return null;
  return {
    registration: entryNumber === 0
      ? { role: 'teacher' }
      : { role: 'student', studentNumber: entryNumber },
    key: entryNumber === 0 ? key : null,
  };
};

const secretsMatch = (actual: string, expected: string) => {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

export default function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    response.status(503).json({ error: 'DEVICE_SECURITY_NOT_CONFIGURED' });
    return;
  }

  if (request.method === 'GET') {
    const session = getDeviceSession(request.headers, sessionSecret);
    if (!session) {
      response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
      return;
    }
    response.status(200).json(session);
    return;
  }

  if (isCrossSiteRequest(request.headers)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
    return;
  }

  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', clearDeviceSessionCookie());
    response.status(204).json(null);
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const parsed = parseRegistration(request.body);
  if (!parsed) {
    response.status(400).json({ error: 'INVALID_DEVICE_REGISTRATION' });
    return;
  }
  const entryNumber = parsed.registration.role === 'teacher' ? 0 : parsed.registration.studentNumber;
  const rateLimit = consumeRequestRateLimit('device-registration', request.headers, entryNumber);
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    response.status(429).json({ error: 'TOO_MANY_REQUESTS' });
    return;
  }
  if (parsed.registration.role === 'teacher') {
    const registrationKey = process.env.DEVICE_REGISTRATION_KEY;
    if (!registrationKey || registrationKey.length < 8) {
      response.status(503).json({ error: 'DEVICE_SECURITY_NOT_CONFIGURED' });
      return;
    }
    if (parsed.key === null || !secretsMatch(parsed.key, registrationKey)) {
      response.status(403).json({ error: 'DEVICE_REGISTRATION_DENIED' });
      return;
    }
  }

  const token = createDeviceSessionToken(parsed.registration, sessionSecret);
  response.setHeader('Set-Cookie', createDeviceSessionCookie(token));
  response.status(200).json(parsed.registration);
}
