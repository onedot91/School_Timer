import { isDeepStrictEqual } from 'node:util';

import {
  applyLibraryPlacementCommand,
  parseLibraryPlacementCommand,
  replaceSnapshotBooksWithAuthoritative,
  type LibraryPlacementCommand,
} from '../src/lib/canvasLibraryPlacement.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';
import { parseLibraryCompetitionState } from '../src/lib/libraryCompetition.js';
import { competitionView, ensureCompetition, isCompetitionCommand, updateCompetitionSettings } from '../src/server/libraryCompetitionService.js';
import { commitCompetition, competitionRecord, LibraryCompetitionError, loadCompetitionHistory, loadCompetitionRow } from '../src/server/libraryCompetitionRepository.js';

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

type WritableSettingsRow = {
  readonly id: typeof SETTINGS_ID;
  readonly value: Record<string, unknown>;
  readonly updated_at: string;
};

const SETTINGS_ID = 'school-timer-main';
const MAX_SETTINGS_BYTES = 1_048_576;
const UPDATED_AT_CACHE_TTL_MS = 1_000;
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
  'libraryCompetition',
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

type UpdatedAtCache = {
  readonly url: string;
  readonly value: string | null;
  readonly expiresAt: number;
};

let updatedAtCache: UpdatedAtCache | null = null;
let updatedAtRequest: { readonly url: string; readonly promise: Promise<string | null> } | null = null;
let updatedAtCacheGeneration = 0;

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

const parseWritableRow = (value: unknown): WritableSettingsRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
  }
  const id = Reflect.get(value, 'id');
  const rowValue = Reflect.get(value, 'value');
  const updatedAt = Reflect.get(value, 'updated_at');
  if (id !== SETTINGS_ID || !rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)
    || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
  }
  return { id: SETTINGS_ID, value: asRecord(rowValue), updated_at: updatedAt };
};

const valuesEqual = (left: unknown, right: unknown) => isDeepStrictEqual(left, right);

const getProtectedCurrencyHistoryEntries = (value: unknown, studentNumber: number) => {
  const entries = asRecord(value)[String(studentNumber)];
  return Array.isArray(entries)
    ? entries.filter((entry) => {
        const reason = asRecord(entry).reason;
        return reason === 'shop_purchase'
          || reason === 'stock_trade'
          || reason === 'bank_transfer'
          || reason === 'teacher_deduction'
          || reason === 'reset';
      })
    : [];
};

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
  const previousStudentEconomy = asRecord(previousRecord.studentEconomy)[String(studentNumber)];
  const nextStudentEconomy = asRecord(nextRecord.studentEconomy)[String(studentNumber)];
  if (!valuesEqual(previousStudentEconomy, nextStudentEconomy)) return false;
  if (!valuesEqual(
    getProtectedCurrencyHistoryEntries(previousRecord.currencyHistory, studentNumber),
    getProtectedCurrencyHistoryEntries(nextRecord.currencyHistory, studentNumber),
  )) return false;
  if (!onlyOwnProgressChanged(previousRecord.studentSudoku, nextRecord.studentSudoku, studentNumber)) return false;
  return onlyOwnProgressChanged(previousRecord.studentNumberBaseball, nextRecord.studentNumberBaseball, studentNumber);
};

const mergeStudentUpdate = (previous: unknown, next: unknown) => {
  const previousRecord = asRecord(previous);
  const nextRecord = asRecord(next);
  const merged = { ...previousRecord, ...nextRecord };
  for (const key of STUDENT_SCOPED_MAP_FIELDS) {
    if (!(key in nextRecord)) continue;
    merged[key] = { ...asRecord(previousRecord[key]), ...asRecord(nextRecord[key]) };
  }
  return merged;
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
  if (!Array.isArray(rows)) throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
  return rows.length > 0 ? parseWritableRow(rows[0]) : null;
};

const nextUpdatedAt = (currentUpdatedAt: string | null): string => {
  const currentTime = currentUpdatedAt === null ? -1 : Date.parse(currentUpdatedAt);
  if (currentUpdatedAt !== null && !Number.isFinite(currentTime)) {
    throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
  }
  return new Date(Math.max(Date.now(), currentTime + 1)).toISOString();
};

const cacheUpdatedAt = (url: string, updatedAt: string) => {
  updatedAtCacheGeneration += 1;
  updatedAtCache = {
    url,
    value: updatedAt,
    expiresAt: Date.now() + UPDATED_AT_CACHE_TTL_MS,
  };
};

const projectStudentValue = (value: unknown, studentNumber: number): Record<string, unknown> => {
  const source = asRecord(value);
  const studentKey = String(studentNumber);
  return Object.fromEntries([
    ...STUDENT_SHARED_FIELDS.map((field) => [field, source[field]]),
    ...STUDENT_SCOPED_MAP_FIELDS.map((field) => {
      const ownValue = asRecord(source[field])[studentKey];
      return [field, ownValue === undefined ? {} : { [studentKey]: ownValue }];
    }),
  ]);
};

const saveValue = async (
  url: string,
  key: string,
  current: WritableSettingsRow | null,
  value: Record<string, unknown>,
  updatedAt: string,
): Promise<'saved' | 'conflict'> => {
  const endpoint = current
    ? `${url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&updated_at=eq.${encodeURIComponent(current.updated_at)}&select=id`
    : `${url}/rest/v1/app_settings?select=id`;
  const result = await fetch(endpoint, {
    method: current ? 'PATCH' : 'POST',
    headers: {
      ...supabaseHeaders(key),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(current
      ? { value, updated_at: updatedAt }
      : { id: SETTINGS_ID, value, updated_at: updatedAt }),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) {
    if (!current) {
      const failure: unknown = await result.json().catch(() => null);
      if (result.status === 409 || asRecord(failure).code === '23505') return 'conflict';
    }
    throw new Error(`SHARED_SETTINGS_WRITE_HTTP_${result.status}`);
  }
  const savedRows: unknown = await result.json();
  if (!Array.isArray(savedRows)) throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
  return savedRows.length > 0 ? 'saved' : 'conflict';
};

const waitForRetry = async () => {
  const delayMs = 20 + Math.floor(Math.random() * 81);
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

const handleLibraryPlacement = async (
  command: LibraryPlacementCommand,
  studentNumber: number,
  configuration: { readonly url: string; readonly key: string },
  response: ApiResponse,
) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loaded = await loadRow(configuration.url, configuration.key);
    const current = loaded?.value.libraryCompetition
      ? (await ensureCompetition(configuration, false)).row
      : loaded;
    const createdAt = nextUpdatedAt(current?.updated_at ?? null);
    const placement = applyLibraryPlacementCommand(current?.value ?? {}, studentNumber, command, createdAt);
    if (placement.ok === false) {
      response.status(placement.error.status).json({ error: placement.error.code });
      return;
    }
    if (placement.replayed) {
      if (!current) throw new Error('SHARED_SETTINGS_DATABASE_INVALID_RESPONSE');
      cacheUpdatedAt(configuration.url, current.updated_at);
      response.status(200).json({
        book: placement.book,
        updatedAt: current.updated_at,
        value: projectStudentValue(current.value, studentNumber),
      });
      return;
    }
    if (Buffer.byteLength(JSON.stringify(placement.value), 'utf8') > MAX_SETTINGS_BYTES) {
      response.status(400).json({ error: 'INVALID_LIBRARY_COMMAND' });
      return;
    }
    try {
      const state = parseLibraryCompetitionState(current?.value.libraryCompetition);
      const value = placement.value;
      const saved = state
        ? (await commitCompetition(configuration, { current, value, updatedAt: createdAt }) ? 'saved' : 'conflict')
        : await saveValue(configuration.url, configuration.key, current, value, createdAt);
      if (saved === 'saved') {
        cacheUpdatedAt(configuration.url, createdAt);
        response.status(200).json({
          book: placement.book,
          updatedAt: createdAt,
          value: projectStudentValue(value, studentNumber),
        });
        return;
      }
    } catch (error) {
      const isAmbiguousTimeout = error instanceof TypeError
        || (error instanceof DOMException && error.name === 'TimeoutError');
      if (!isAmbiguousTimeout) throw error;
    }
    if (attempt < 4) await waitForRetry();
  }
  response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
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
  if (updatedAtCache?.url === url && updatedAtCache.expiresAt > Date.now()) {
    return updatedAtCache.value;
  }
  if (updatedAtRequest?.url === url) return updatedAtRequest.promise;

  const cacheGeneration = updatedAtCacheGeneration;
  const cacheExpiresAt = Date.now() + UPDATED_AT_CACHE_TTL_MS;
  const fetchPromise = (async () => {
    const result = await fetch(`${url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&select=updated_at`, {
      headers: supabaseHeaders(key),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${result.status}`);
    const rows: unknown = await result.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const updatedAt = Reflect.get(rows[0], 'updated_at');
    return typeof updatedAt === 'string' ? updatedAt : null;
  })();
  const promise = fetchPromise.then((value) => {
    if (cacheGeneration !== updatedAtCacheGeneration && updatedAtCache?.url === url) {
      return updatedAtCache.value;
    }
    updatedAtCache = { url, value, expiresAt: cacheExpiresAt };
    return value;
  });
  const request = { url, promise };
  updatedAtRequest = request;

  try {
    return await promise;
  } finally {
    if (updatedAtRequest === request) updatedAtRequest = null;
  }
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
      if (request.query?.libraryCompetitionHistory === '1') {
        const month = request.query.month;
        if (month !== undefined && (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
          response.status(400).json({ error: 'INVALID_LIBRARY_COMPETITION_COMMAND' });
          return;
        }
        response.status(200).json(await loadCompetitionHistory(configuration, typeof month === 'string' ? month : undefined));
        return;
      }
      if (request.query?.libraryCompetition === '1') {
        const row = await loadCompetitionRow(configuration);
        response.status(200).json({ ok: true, competition: competitionView(row), value: session.role === 'teacher' ? row?.value ?? {} : projectStudentValue(row?.value, session.studentNumber), updatedAt: row?.updated_at ?? null, rolledOver: false });
        return;
      }
      const metadataOnly = request.query?.metadata === '1';
      if (metadataOnly) {
        response.status(200).json({ updatedAt: await loadUpdatedAt(configuration.url, configuration.key) });
        return;
      }
      const shouldLoadFullRow = session.role === 'teacher';
      const row = shouldLoadFullRow
        ? await loadRow(configuration.url, configuration.key)
        : await loadStudentRow(configuration.url, configuration.key, session.studentNumber);
      response.status(200).json(row && shouldLoadFullRow ? { ...row, scope: 'full' } : row);
    } catch (error) {
      if (error instanceof LibraryCompetitionError) {
        response.status(error.status).json({ error: error.code });
        return;
      }
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
    const commandBody: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (isCompetitionCommand(commandBody)) {
      const command = competitionRecord(commandBody);
      if (command.action === 'libraryCompetitionSettings' && session.role !== 'teacher') {
        response.status(403).json({ error: 'LIBRARY_COMPETITION_FORBIDDEN' });
        return;
      }
      try {
        if (Buffer.byteLength(JSON.stringify(command), 'utf8') > 16_384) throw new LibraryCompetitionError('INVALID_LIBRARY_COMPETITION_COMMAND', 400);
        if (command.action === 'libraryCompetitionHistory') {
          if (command.month !== undefined && (typeof command.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(command.month))) throw new LibraryCompetitionError('INVALID_LIBRARY_COMPETITION_COMMAND', 400);
          response.status(200).json(await loadCompetitionHistory(configuration, typeof command.month === 'string' ? command.month : undefined));
          return;
        }
        if (command.action === 'libraryCompetition' && command.intent !== 'open' && command.intent !== 'enter') throw new LibraryCompetitionError('INVALID_LIBRARY_COMPETITION_COMMAND', 400);
        const result = command.action === 'libraryCompetitionSettings'
          ? await updateCompetitionSettings(configuration, command)
          : await ensureCompetition(configuration, command.intent === 'open');
        const row = result.row;
        if (row) cacheUpdatedAt(configuration.url, row.updated_at);
        response.status(200).json({ ok: true, competition: competitionView(row), value: session.role === 'teacher' ? row?.value ?? {} : projectStudentValue(row?.value, session.studentNumber), updatedAt: row?.updated_at ?? null, rolledOver: result.rolledOver });
      } catch (error) {
        if (error instanceof LibraryCompetitionError) response.status(error.status).json({ error: error.code });
        else response.status(502).json({ error: 'LIBRARY_COMPETITION_SAVE_FAILED' });
      }
      return;
    }
    const placement = parseLibraryPlacementCommand(request.body);
    if (placement.ok) {
      if (session.role !== 'student') {
        response.status(403).json({ error: 'LIBRARY_BOOK_FORBIDDEN' });
        return;
      }
      try {
        await handleLibraryPlacement(
          placement.command,
          session.studentNumber,
          configuration,
          response,
        );
      } catch (error) {
        if (error instanceof LibraryCompetitionError) response.status(error.status).json({ error: error.code });
        else response.status(502).json({ error: 'LIBRARY_SAVE_FAILED' });
      }
      return;
    }
    if (request.body && typeof request.body === 'object'
      && Reflect.get(request.body, 'action') === 'placeLibraryBook') {
      response.status(400).json({ error: 'INVALID_LIBRARY_COMMAND' });
      return;
    }
    const parsed = parseBody(request.body);
    const serializedIncoming = parsed ? JSON.stringify(parsed.value) : undefined;
    if (!parsed || serializedIncoming === undefined
      || Buffer.byteLength(serializedIncoming, 'utf8') > MAX_SETTINGS_BYTES) {
      response.status(400).json({ error: 'INVALID_SHARED_SETTINGS' });
      return;
    }
    const current = await loadRow(configuration.url, configuration.key);
    if (parsed.expectedUpdatedAt !== null
      && parsed.expectedUpdatedAt !== (current?.updated_at ?? null)) {
      response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
      return;
    }
    const mergedValue = session.role === 'student'
      ? mergeStudentUpdate(current?.value ?? null, parsed.value)
      : parsed.value;
    if (Buffer.byteLength(JSON.stringify(mergedValue), 'utf8') > MAX_SETTINGS_BYTES) {
      response.status(400).json({ error: 'INVALID_SHARED_SETTINGS' });
      return;
    }
    const mergedRecord = asRecord(mergedValue);
    const currentRecord = asRecord(current?.value);
    const nextValue = Reflect.has(mergedRecord, 'studentLife') || Reflect.has(currentRecord, 'studentLife') || Reflect.has(mergedRecord, 'libraryCompetition') || Reflect.has(currentRecord, 'libraryCompetition')
      ? replaceSnapshotBooksWithAuthoritative(mergedValue, current?.value ?? {})
      : mergedRecord;
    if (Buffer.byteLength(JSON.stringify(nextValue), 'utf8') > MAX_SETTINGS_BYTES) {
      response.status(400).json({ error: 'INVALID_SHARED_SETTINGS' });
      return;
    }
    if (session.role === 'student' && !canStudentUpdate(current?.value ?? null, nextValue, session.studentNumber)) {
      response.status(403).json({ error: 'STUDENT_SETTINGS_SCOPE_VIOLATION' });
      return;
    }
    const updatedAt = nextUpdatedAt(current?.updated_at ?? null);
    const saved = await saveValue(configuration.url, configuration.key, current, nextValue, updatedAt);
    if (saved === 'conflict') {
      response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
      return;
    }
    cacheUpdatedAt(configuration.url, updatedAt);
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
