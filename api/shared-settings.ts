import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: RequestHeaders;
  readonly query?: Record<string, string | readonly string[] | undefined>;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

interface SettingsRow {
  readonly id: string;
  readonly value: unknown;
  readonly updated_at?: string;
  readonly scope?: 'full' | 'student';
}

const SETTINGS_ID = 'school-timer-main';
const MAX_SETTINGS_BYTES = 1_048_576;
const STUDENT_SHARED_FIELDS = [
  'auctionBids',
  'auctionItems',
  'auctionBidHistory',
  'auctionAwards',
  'auctionMissions',
  'classroomRoleMission',
  'studentMissionVisibility',
  'classDonation',
  'studentShopCatalog',
  'studentStockMarket',
  'studentLife',
  'dailyWriting',
  'studentSudoku',
  'studentNumberBaseball',
] as const;
const STUDENT_SCOPED_MAP_FIELDS = [
  'currencyBalances',
  'currencyHistory',
  'studentEmotionHistory',
  'studentPets',
  'studentEconomy',
] as const;
const STUDENT_MUTABLE_FIELDS = new Set([
  'auctionBids',
  'auctionBidHistory',
  'currencyBalances',
  'currencyHistory',
  'studentEmotionHistory',
  'studentPets',
  'studentLife',
  'studentEconomy',
  'studentSudoku',
  'studentNumberBaseball',
]);

const parseBody = (body: unknown) => {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== 'object') return null;
  const value = Reflect.get(parsed, 'value');
  const expectedUpdatedAt = Reflect.get(parsed, 'expectedUpdatedAt');
  if (expectedUpdatedAt !== null && expectedUpdatedAt !== undefined && typeof expectedUpdatedAt !== 'string') return null;
  return { value, expectedUpdatedAt: expectedUpdatedAt ?? null } as const;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
);

const valuesEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const onlyOwnMapEntryChanged = (
  previous: unknown,
  next: unknown,
  studentNumber: number,
  missingValue?: unknown,
) => {
  const studentKey = String(studentNumber);
  const previousRecord = asRecord(previous);
  const nextRecord = asRecord(next);
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    const previousValue = key in previousRecord ? previousRecord[key] : missingValue;
    const nextValue = key in nextRecord ? nextRecord[key] : missingValue;
    if (key !== studentKey && !valuesEqual(previousValue, nextValue)) return false;
  }
  return true;
};

const onlyOwnProgressChanged = (
  previous: unknown,
  next: unknown,
  studentNumber: number,
) => {
  const prefix = `${studentNumber}:`;
  const previousRecord = asRecord(previous);
  const nextRecord = asRecord(next);
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    if (!key.startsWith(prefix) && !valuesEqual(previousRecord[key], nextRecord[key])) return false;
  }
  return true;
};

const canStudentUpdate = (previous: unknown, next: unknown, studentNumber: number) => {
  const previousRecord = asRecord(previous);
  const nextRecord = asRecord(next);
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    if (!STUDENT_MUTABLE_FIELDS.has(key) && !valuesEqual(previousRecord[key], nextRecord[key])) return false;
  }

  for (const key of ['currencyBalances', 'currencyHistory', 'studentEmotionHistory', 'studentPets', 'studentEconomy']) {
    const missingValue = key === 'currencyBalances' ? 100 : key === 'currencyHistory' ? [] : undefined;
    if (!onlyOwnMapEntryChanged(previousRecord[key], nextRecord[key], studentNumber, missingValue)) return false;
  }
  if (!onlyOwnProgressChanged(previousRecord.studentSudoku, nextRecord.studentSudoku, studentNumber)) return false;
  return onlyOwnProgressChanged(previousRecord.studentNumberBaseball, nextRecord.studentNumberBaseball, studentNumber);
};

const getConfiguration = () => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  return url && key && sessionSecret?.length >= 32 ? { url: url.replace(/\/$/, ''), key, sessionSecret } : null;
};

const supabaseHeaders = (key: string) => ({
  Accept: 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
});

const loadRow = async (url: string, key: string) => {
  const result = await fetch(`${url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&select=id,value,updated_at`, {
    headers: supabaseHeaders(key),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${result.status}`);
  const rows: unknown = await result.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] as SettingsRow : null;
};

const loadStudentRow = async (url: string, key: string, studentNumber: number) => {
  const studentKey = String(studentNumber);
  const select = [
    'id',
    'updated_at',
    ...STUDENT_SHARED_FIELDS.map((field) => `${field}:value->${field}`),
    ...STUDENT_SCOPED_MAP_FIELDS.map((field) => `${field}:value->${field}->"${studentKey}"`),
  ].join(',');
  const endpoint = new URL(`${url}/rest/v1/app_settings`);
  endpoint.searchParams.set('id', `eq.${SETTINGS_ID}`);
  endpoint.searchParams.set('select', select);
  const result = await fetch(endpoint, {
    headers: supabaseHeaders(key),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${result.status}`);
  const rows: unknown = await result.json();
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0] || typeof rows[0] !== 'object') return null;
  const projectedRow = rows[0];
  const value = Object.fromEntries([
    ...STUDENT_SHARED_FIELDS.map((field) => [field, Reflect.get(projectedRow, field)]),
    ...STUDENT_SCOPED_MAP_FIELDS.map((field) => {
      const ownValue = Reflect.get(projectedRow, field);
      return [field, ownValue === null || ownValue === undefined ? {} : { [studentKey]: ownValue }];
    }),
  ]);
  const updatedAt = Reflect.get(projectedRow, 'updated_at');
  return {
    id: SETTINGS_ID,
    value,
    updated_at: typeof updatedAt === 'string' ? updatedAt : undefined,
    scope: 'student' as const,
  };
};

const loadUpdatedAt = async (url: string, key: string) => {
  const result = await fetch(`${url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&select=updated_at`, {
    headers: supabaseHeaders(key),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${result.status}`);
  const rows: unknown = await result.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const updatedAt = Reflect.get(rows[0], 'updated_at');
  return typeof updatedAt === 'string' ? updatedAt : null;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const configuration = getConfiguration();
  if (!configuration) {
    response.status(503).json({ error: 'SHARED_SETTINGS_NOT_CONFIGURED' });
    return;
  }
  const session = getDeviceSession(request.headers, configuration.sessionSecret);
  if (!session) {
    response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
    return;
  }
  if (request.method === 'GET') {
    try {
      const metadataOnly = request.query?.metadata === '1';
      if (metadataOnly) {
        response.status(200).json({ updatedAt: await loadUpdatedAt(configuration.url, configuration.key) });
        return;
      }
      const shouldLoadFullRow = session.role === 'teacher' || request.query?.full === '1';
      const row = shouldLoadFullRow
        ? await loadRow(configuration.url, configuration.key)
        : await loadStudentRow(configuration.url, configuration.key, session.studentNumber);
      response.status(200).json(row && shouldLoadFullRow ? { ...row, scope: 'full' } : row);
    } catch (error) {
      console.error('Failed to load shared settings.', error);
      response.status(502).json({ error: 'SHARED_SETTINGS_READ_FAILED' });
    }
    return;
  }
  if (request.method !== 'PUT') {
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (isCrossSiteRequest(request.headers)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
    return;
  }

  try {
    const parsed = parseBody(request.body);
    if (!parsed || Buffer.byteLength(JSON.stringify(parsed.value), 'utf8') > MAX_SETTINGS_BYTES) {
      response.status(400).json({ error: 'INVALID_SHARED_SETTINGS' });
      return;
    }
    const canUseKnownTeacherVersion = session.role === 'teacher' && parsed.expectedUpdatedAt !== null;
    const current = canUseKnownTeacherVersion
      ? null
      : await loadRow(configuration.url, configuration.key);
    if (!canUseKnownTeacherVersion
      && parsed.expectedUpdatedAt !== null
      && parsed.expectedUpdatedAt !== (current?.updated_at ?? null)) {
      response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
      return;
    }
    if (session.role === 'student' && !canStudentUpdate(current?.value ?? null, parsed.value, session.studentNumber)) {
      response.status(403).json({ error: 'STUDENT_SETTINGS_SCOPE_VIOLATION' });
      return;
    }
    const updatedAt = new Date().toISOString();
    const hasCurrentRow = canUseKnownTeacherVersion || current !== null;
    const expectedUpdatedAt = canUseKnownTeacherVersion
      ? parsed.expectedUpdatedAt
      : current?.updated_at ?? '';
    const endpoint = hasCurrentRow
      ? `${configuration.url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt ?? '')}`
      : `${configuration.url}/rest/v1/app_settings?on_conflict=id`;
    const result = await fetch(endpoint, {
      method: hasCurrentRow ? 'PATCH' : 'POST',
      headers: {
        ...supabaseHeaders(configuration.key),
        'Content-Type': 'application/json',
        Prefer: hasCurrentRow ? 'return=representation' : 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(hasCurrentRow
        ? { value: parsed.value, updated_at: updatedAt }
        : { id: SETTINGS_ID, value: parsed.value, updated_at: updatedAt }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`SHARED_SETTINGS_WRITE_HTTP_${result.status}`);
    const savedRows: unknown = await result.json();
    if (!Array.isArray(savedRows) || savedRows.length === 0) {
      response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
      return;
    }
    response.status(200).json({ updatedAt });
  } catch (error) {
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    console.error('Failed to save shared settings.', error);
    response.status(502).json({ error: 'SHARED_SETTINGS_WRITE_FAILED' });
  }
}
