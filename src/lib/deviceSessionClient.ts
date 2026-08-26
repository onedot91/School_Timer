export type BrowserDeviceSession =
  | { readonly role: 'teacher' }
  | { readonly role: 'student'; readonly studentNumber: number };

const parseSession = (value: unknown): BrowserDeviceSession | null => {
  if (!value || typeof value !== 'object') return null;
  const role = Reflect.get(value, 'role');
  if (role === 'teacher') return { role };
  const studentNumber = Reflect.get(value, 'studentNumber');
  if (
    role === 'student'
    && Number.isInteger(studentNumber)
    && studentNumber >= 1
    && studentNumber <= 23
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

export const loadDeviceSession = () => requestSession();

export const registerDeviceSession = (entryNumber: number, registrationKey?: string) => requestSession({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entryNumber, registrationKey }),
});

export const clearDeviceSession = () => requestSession({ method: 'DELETE' });
