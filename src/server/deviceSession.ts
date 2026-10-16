import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEVICE_SESSION_COOKIE_NAME = '__Host-school-timer-device';

export type DeviceSession =
  | {
      readonly role: 'teacher';
      readonly expiresAt: number;
    }
  | {
      readonly role: 'student';
      readonly studentNumber: number;
      readonly expiresAt: number;
    };

export type DeviceSessionRegistration =
  | { readonly role: 'teacher' }
  | { readonly role: 'student'; readonly studentNumber: number };

type DeviceTokenSubject = DeviceSessionRegistration | { readonly role: 'enrolled' };

export type RequestHeaders = Record<string, string | readonly string[] | undefined>;

// Version 2 student tokens are issued only after the class code check; version 1 student tokens predate it.
const LEGACY_TEACHER_SESSION_VERSION = 1;
const SESSION_VERSION = 2;
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 180;

const getHeader = (headers: RequestHeaders | undefined, name: string) => {
  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const signPayload = (payload: string, secret: string) => (
  createHmac('sha256', secret).update(payload).digest('base64url')
);

type ParsedDeviceToken = DeviceSession | { readonly role: 'enrolled'; readonly expiresAt: number };

const parseTokenPayload = (value: unknown, nowSeconds: number): ParsedDeviceToken | null => {
  if (!value || typeof value !== 'object') return null;
  const version = Reflect.get(value, 'version');
  const role = Reflect.get(value, 'role');
  const expiresAt = Reflect.get(value, 'expiresAt');
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds) return null;
  if (role === 'teacher' && (version === SESSION_VERSION || version === LEGACY_TEACHER_SESSION_VERSION)) return { role, expiresAt };
  if (version !== SESSION_VERSION) return null;
  if (role === 'enrolled') return { role, expiresAt };
  const studentNumber = Reflect.get(value, 'studentNumber');
  if (
    role !== 'student'
    || !Number.isInteger(studentNumber)
    || studentNumber < 1
    || studentNumber > 24
  ) return null;
  return { role, studentNumber, expiresAt };
};

export const createDeviceSessionToken = (
  registration: DeviceTokenSubject,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) => {
  const expiresAt = nowSeconds + SESSION_DURATION_SECONDS;
  const payload = Buffer.from(JSON.stringify(registration.role !== 'student'
    ? { version: SESSION_VERSION, role: registration.role, expiresAt }
    : {
        version: SESSION_VERSION,
        role: registration.role,
        studentNumber: registration.studentNumber,
        expiresAt,
      })).toString('base64url');
  return `${payload}.${signPayload(payload, secret)}`;
};

const parseDeviceToken = (
  token: string,
  secret: string,
  nowSeconds: number,
): ParsedDeviceToken | null => {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = signPayload(payload, secret);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (signatureBytes.length !== expectedBytes.length || !timingSafeEqual(signatureBytes, expectedBytes)) return null;

  try {
    return parseTokenPayload(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), nowSeconds);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

export const parseDeviceSessionToken = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DeviceSession | null => {
  const parsed = parseDeviceToken(token, secret, nowSeconds);
  return parsed?.role === 'enrolled' ? null : parsed;
};

const getDeviceToken = (headers: RequestHeaders | undefined, secret: string, nowSeconds: number) => {
  const cookieHeader = getHeader(headers, 'cookie');
  if (!cookieHeader) return null;
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEVICE_SESSION_COOKIE_NAME}=`))
    ?.slice(DEVICE_SESSION_COOKIE_NAME.length + 1);
  return token ? parseDeviceToken(token, secret, nowSeconds) : null;
};

export const getDeviceSession = (
  headers: RequestHeaders | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DeviceSession | null => {
  const parsed = getDeviceToken(headers, secret, nowSeconds);
  return parsed?.role === 'enrolled' ? null : parsed;
};

// A device that once passed the class code keeps that proof across number changes.
export const hasClassEnrollment = (
  headers: RequestHeaders | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) => getDeviceToken(headers, secret, nowSeconds) !== null;

export const createDeviceSessionCookie = (token: string) => (
  `${DEVICE_SESSION_COOKIE_NAME}=${token}; Max-Age=${SESSION_DURATION_SECONDS}; Path=/; Secure; HttpOnly; SameSite=Strict`
);

export const clearDeviceSessionCookie = () => (
  `${DEVICE_SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`
);
