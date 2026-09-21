export type BrowserDeviceSession =
  | { readonly role: 'teacher' }
  | { readonly role: 'student'; readonly studentNumber: number };

export const deviceSessionMatchesEntry = (
  session: BrowserDeviceSession | null,
  entryNumber: number,
) => (
  session?.role === 'teacher'
  || (session?.role === 'student' && session.studentNumber === entryNumber)
);

const parseSession = (value: unknown): BrowserDeviceSession | null => {
  if (!value || typeof value !== 'object') return null;
  const role = Reflect.get(value, 'role');
  if (role === 'teacher') return { role };
  const studentNumber = Reflect.get(value, 'studentNumber');
  if (
    role === 'student'
    && Number.isInteger(studentNumber)
    && studentNumber >= 1
    && studentNumber <= 24
  ) {
    return { role, studentNumber };
  }
  return null;
};

const requestSession = async (init?: RequestInit) => {
  const response = await fetch('/api/device-session', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`DEVICE_SESSION_HTTP_${response.status}`);
  if (response.status === 204) return null;
  return parseSession(await response.json());
};

export const DEVICE_SESSION_READ_TIMEOUT_MS = 15_000;

export const DEVICE_SESSION_MUTATION_TIMEOUT_MS = 15_000;

const requestSessionWithTimeout = async (init: RequestInit = {}, timeoutMs = DEVICE_SESSION_READ_TIMEOUT_MS) => {
  const signal = init.signal;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  try {
    return await requestSession({ ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
};

export const loadDeviceSession = (signal?: AbortSignal) => requestSessionWithTimeout({ signal });

export const registerDeviceSession = (entryNumber: number, registrationKey?: string) => requestSessionWithTimeout({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entryNumber, registrationKey }),
}, DEVICE_SESSION_MUTATION_TIMEOUT_MS);

export const clearDeviceSession = () => requestSessionWithTimeout({ method: 'DELETE' }, DEVICE_SESSION_MUTATION_TIMEOUT_MS);
