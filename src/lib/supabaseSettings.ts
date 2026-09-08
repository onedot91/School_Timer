import { createClient } from '@supabase/supabase-js';
import { parseClassDonationResult } from './classDonation.js';
import { isReadOnlyDataMode } from './dataMode.js';
import { createStudentSettingsUpdate, STUDENT_MUTABLE_MAP_FIELDS } from './studentSettingsUpdate.js';
import { getSaveFailureFeature, withSaveFailureReporting } from './saveFailureClient.js';
import {
  isSupabaseSettingsEnabled,
  shouldEnableSupabaseSettings,
  supabaseAnonKey,
  supabaseUrl,
  useServerProxy,
} from './supabaseConfig.js';

export { isSupabaseSettingsEnabled, shouldEnableSupabaseSettings } from './supabaseConfig.js';

export const SHARED_SETTINGS_ID = 'school-timer-main';

export type SettingsRow = {
  id: string;
  value: unknown;
  updated_at?: string;
  scope?: 'full' | 'student';
};

let cachedWritableSharedSettingsRow: SettingsRow | null | undefined;
let settingsCacheGeneration = 0;
let sharedSettingsRead: {
  generation: number;
  cachedRow: SettingsRow | null | undefined;
  promise: Promise<SettingsRow | null>;
} | undefined;
let sharedSettingsUpdateQueue: Promise<unknown> = Promise.resolve();

const enqueueSharedSettingsUpdate = <T>(update: () => Promise<T>) => {
  const result = sharedSettingsUpdateQueue.then(update);
  sharedSettingsUpdateQueue = result.catch(() => undefined);
  return result;
};

export const invalidateSharedSettingsCache = () => {
  settingsCacheGeneration += 1;
  cachedWritableSharedSettingsRow = undefined;
};

export interface AnnouncementNoteRecord {
  date_key: string;
  date_text: string;
  note: string;
  updated_at?: string;
}

const supabase = isSupabaseSettingsEnabled && !useServerProxy
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const fetchJsonOnce = async (input: string, init?: RequestInit) => {
  const requestTimeoutMs = !init?.method || init.method === 'GET' ? 12_000 : 45_000;
  const controller = new AbortController();
  const abort = () => controller.abort(init?.signal?.reason);
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException('SHARED_SETTINGS_REQUEST_TIMEOUT', 'TimeoutError');
      controller.abort(error);
      reject(error);
    }, requestTimeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(input, {
        credentials: 'same-origin', cache: 'no-store', ...init, signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`SHARED_API_HTTP_${response.status}`);
        Reflect.set(error, 'status', response.status);
        const body: unknown = await response.json().catch(() => null);
        if (body && typeof body === 'object') Reflect.set(error, 'serverCode', Reflect.get(body, 'error'));
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const delay = /^\d+(\.\d+)?$/.test(retryAfter)
            ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(delay)) Reflect.set(error, 'retryAfterMs', Math.max(0, delay));
        }
        throw error;
      }
      const value: unknown = response.status === 204 ? null : await response.json();
      if (input === '/api/shared-settings' && init?.method === 'PUT'
        && (!value || typeof value !== 'object' || typeof Reflect.get(value, 'updatedAt') !== 'string'
          || !Reflect.get(value, 'updatedAt'))) {
        const error = new Error('SHARED_SETTINGS_INVALID_RESPONSE');
        Reflect.set(error, 'uncertainWrite', true);
        throw error;
      }
      return value;
    })()]);
  } catch (error) {
    if (error instanceof Error || error instanceof DOMException) Reflect.set(error, 'endpoint', input.split('?')[0]);
    throw error;
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
};

const fetchJson = async (
  input: string,
  init?: RequestInit,
  retryNetwork = false,
  confirmUncertainWrite?: () => Promise<{ updatedAt: string } | undefined>,
) => {
  const retryLimit = !init?.method || init.method === 'GET' ? 1 : 2;
  let uncertainWrite = false;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchJsonOnce(input, init);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const transient = ['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)
        || [502, 503, 504].includes(Reflect.get(error, 'status'));
      uncertainWrite ||= init?.method === 'PUT' && (transient || error.name === 'SyntaxError');
      if (uncertainWrite) Reflect.set(error, 'uncertainWrite', true);
      if (uncertainWrite && attempt === 0 && confirmUncertainWrite) {
        const receipt = await confirmUncertainWrite().catch(() => undefined);
        if (receipt) return receipt;
      }
      if (!retryNetwork || attempt >= retryLimit || !transient || init?.signal?.aborted
        || Reflect.get(error, 'retryAfterMs') > 3000) throw error;
      const delay = Math.max(250 * 2 ** attempt + Math.random() * 250, Reflect.get(error, 'retryAfterMs') ?? 0);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const SHARED_SETTINGS_UPDATE_RETRY_LIMIT = 5;

const parseSettingsRow = (value: unknown): SettingsRow | null => {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SHARED_SETTINGS_INVALID_RESPONSE');
  const id = Reflect.get(value, 'id');
  const settings: unknown = Reflect.get(value, 'value');
  const timestamp = Reflect.get(value, 'updated_at');
  const scope = Reflect.get(value, 'scope');
  if (id !== SHARED_SETTINGS_ID || !settings || typeof settings !== 'object' || Array.isArray(settings)
    || typeof timestamp !== 'string' || !timestamp
    || (scope !== undefined && scope !== 'student' && scope !== 'full')) throw new Error('SHARED_SETTINGS_INVALID_RESPONSE');
  return { id, value: settings, updated_at: timestamp, ...(scope === 'student' || scope === 'full' ? { scope } : {}) };
};

const equalJson = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => equalJson(item, right[index]));
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && equalJson(Reflect.get(left, key), Reflect.get(right, key)));
};

const matchesSavedUpdate = (actual: unknown, intended: unknown, studentNumber?: number) => {
  if (studentNumber === undefined) return equalJson(actual, intended);
  if (!actual || !intended || typeof actual !== 'object' || typeof intended !== 'object') return false;
  return Object.entries(intended).every(([field, expected]) => {
    const received = Reflect.get(actual, field);
    if (STUDENT_MUTABLE_MAP_FIELDS.some((name) => name === field)) {
      return !!received && !!expected && typeof received === 'object' && typeof expected === 'object'
        && equalJson(Reflect.get(received, String(studentNumber)), Reflect.get(expected, String(studentNumber)));
    }
    return equalJson(received, expected);
  });
};

export const loadSharedSettings = async () => {
  const data = await loadSharedSettingsRow();
  return data?.value ?? null;
};

const fetchSharedSettingsRow = async () => {
  if (!isSupabaseSettingsEnabled) return null;
  if (useServerProxy) {
    const generation = settingsCacheGeneration;
    const row = parseSettingsRow(await fetchJson('/api/shared-settings', undefined, true));
    // Student projections contain every field the scoped writer needs. Keep newer receipts
    // when a background read that started before a save arrives afterwards.
    const currentTimestamp = cachedWritableSharedSettingsRow?.updated_at;
    const isFresh = !currentTimestamp || (row?.updated_at && row.updated_at >= currentTimestamp);
    if (generation === settingsCacheGeneration && isFresh && (row?.scope === 'full' || row?.scope === 'student')) {
      cachedWritableSharedSettingsRow = row;
    } else if (generation === settingsCacheGeneration && isFresh && row?.updated_at !== currentTimestamp) {
      cachedWritableSharedSettingsRow = undefined;
    }
    return row;
  }
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('id,value,updated_at')
    .eq('id', SHARED_SETTINGS_ID)
    .maybeSingle<SettingsRow>();

  if (error) {
    throw error;
  }

  cachedWritableSharedSettingsRow = data ?? null;
  return data ?? null;
};

export const loadSharedSettingsRow = (): Promise<SettingsRow | null> => {
  if (sharedSettingsRead?.generation === settingsCacheGeneration
    && sharedSettingsRead.cachedRow === cachedWritableSharedSettingsRow) return sharedSettingsRead.promise;
  const request = {
    generation: settingsCacheGeneration,
    cachedRow: cachedWritableSharedSettingsRow,
    promise: fetchSharedSettingsRow(),
  };
  sharedSettingsRead = request;
  const clear = () => { if (sharedSettingsRead === request) sharedSettingsRead = undefined; };
  void request.promise.then(clear, clear);
  return request.promise;
};

const loadWritableSharedSettingsRow = async () => {
  if (!isSupabaseSettingsEnabled) return null;
  return loadSharedSettingsRow();
};

export const loadSharedSettingsUpdatedAt = async () => {
  if (!isSupabaseSettingsEnabled) return null;
  if (useServerProxy) return ((await fetchJson('/api/shared-settings?metadata=1', undefined, true)) as { updatedAt: string | null }).updatedAt;
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('updated_at')
    .eq('id', SHARED_SETTINGS_ID)
    .maybeSingle<Pick<SettingsRow, 'updated_at'>>();

  if (error) {
    throw error;
  }

  return data?.updated_at ?? null;
};

export const saveSharedSettings = async (value: unknown) => {
  return withSaveFailureReporting('settings', async () => {
    if (!isSupabaseSettingsEnabled) return null;
    if (isReadOnlyDataMode) return (await loadSharedSettingsRow())?.updated_at ?? null;

    if (useServerProxy) {
      const result = await fetchJson('/api/shared-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }) as { updatedAt: string };
      cachedWritableSharedSettingsRow = {
        id: SHARED_SETTINGS_ID,
        value,
        updated_at: result.updatedAt,
        scope: 'full',
      };
      return result.updatedAt;
    }
    if (!supabase) return null;

    const updatedAt = new Date().toISOString();

    const { error } = await supabase.from('app_settings').upsert({
      id: SHARED_SETTINGS_ID,
      value,
      updated_at: updatedAt,
    });

    if (error) {
      throw error;
    }

    return updatedAt;
  });
};

export const updateSharedSettings = async (
  updater: (currentValue: unknown) => unknown,
  studentNumber?: number,
) => {
  return withSaveFailureReporting(getSaveFailureFeature(), () => enqueueSharedSettingsUpdate(async () => {
    if (!isSupabaseSettingsEnabled) return null;
    if (isReadOnlyDataMode) return (await loadSharedSettingsRow())?.updated_at ?? null;

    if (useServerProxy) {
      for (let attempt = 0; attempt < SHARED_SETTINGS_UPDATE_RETRY_LIMIT; attempt += 1) {
        const generation = settingsCacheGeneration;
        const currentRow = cachedWritableSharedSettingsRow === undefined
          ? await loadWritableSharedSettingsRow()
          : cachedWritableSharedSettingsRow;
        const nextValue = updater(currentRow?.value ?? null);
        const studentUpdate = studentNumber === undefined
          ? null
          : createStudentSettingsUpdate(currentRow?.value, nextValue, studentNumber);
        const confirmSavedUpdate = async () => {
          invalidateSharedSettingsCache();
          const savedRow = await loadWritableSharedSettingsRow();
          if (typeof savedRow?.updated_at === 'string'
            && savedRow.updated_at !== currentRow?.updated_at
            && matchesSavedUpdate(savedRow.value, studentUpdate?.patch ?? nextValue, studentNumber)) {
            return { updatedAt: savedRow.updated_at };
          }
          return undefined;
        };
        try {
          const result = await fetchJson('/api/shared-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: studentUpdate?.patch ?? nextValue, expectedUpdatedAt: currentRow?.updated_at ?? null }),
          }, typeof currentRow?.updated_at === 'string', confirmSavedUpdate) as { updatedAt: string };
          if (generation === settingsCacheGeneration) cachedWritableSharedSettingsRow = {
            id: SHARED_SETTINGS_ID,
            value: studentUpdate?.value ?? nextValue,
            updated_at: result.updatedAt,
            scope: currentRow?.scope,
          };
          return result.updatedAt;
        } catch (error) {
          if (error instanceof Error && Reflect.get(error, 'uncertainWrite')) {
            const receipt = await confirmSavedUpdate();
            if (receipt) return receipt.updatedAt;
            throw new Error('SHARED_SETTINGS_SAVE_UNCONFIRMED', { cause: error });
          }
          if (error instanceof Error && Reflect.get(error, 'status') === 409) {
            invalidateSharedSettingsCache();
            continue;
          }
          throw error;
        }
      }
      throw new Error('SHARED_SETTINGS_CONFLICT');
    }
    if (!supabase) return null;

    for (let attempt = 0; attempt < SHARED_SETTINGS_UPDATE_RETRY_LIMIT; attempt += 1) {
      const currentRow = await loadSharedSettingsRow();
      const updatedValue = updater(currentRow?.value ?? null);
      const nextValue = studentNumber === undefined
        ? updatedValue
        : createStudentSettingsUpdate(currentRow?.value, updatedValue, studentNumber).value;
      const updatedAt = new Date().toISOString();

      if (!currentRow) {
        const { error } = await supabase.from('app_settings').insert({
          id: SHARED_SETTINGS_ID,
          value: nextValue,
          updated_at: updatedAt,
        });

        if (!error) return updatedAt;
        if (error.code === '23505') continue;
        throw error;
      }

      const { data, error } = await supabase
        .from('app_settings')
        .update({
          value: nextValue,
          updated_at: updatedAt,
        })
        .eq('id', SHARED_SETTINGS_ID)
        .eq('updated_at', currentRow.updated_at ?? '')
        .select('id')
        .maybeSingle<{ id: string }>();

      if (error) {
        throw error;
      }

      if (data) return updatedAt;
    }

    throw new Error('SHARED_SETTINGS_CONFLICT');
  }), studentNumber);
};

export const updateStudentSharedSettings = async (
  studentNumber: number,
  updater: (currentValue: unknown) => unknown,
) => {
  if (isReadOnlyDataMode) throw new Error('READ_ONLY_DATA_MODE');
  return updateSharedSettings(updater, studentNumber);
};

export const donateToClassGoal = async (
  studentNumber: number,
  amount: number,
  requestId: string,
) => {
  return withSaveFailureReporting('donation', async () => {
    if (!isSupabaseSettingsEnabled) throw new Error('CLASS_DONATION_NOT_CONFIGURED');
    if (isReadOnlyDataMode) throw new Error('READ_ONLY_DATA_MODE');
    if (useServerProxy) {
      return parseClassDonationResult(await fetchJson('/api/class-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNumber, amount, requestId }),
      }));
    }
    if (!supabase) throw new Error('CLASS_DONATION_NOT_CONFIGURED');
    const { data, error } = await supabase.rpc('donate_to_class_goal', {
      p_student_number: studentNumber,
      p_amount: amount,
      p_request_id: requestId,
    });
    if (error) throw error;
    return parseClassDonationResult(data);
  }, studentNumber);
};

export const loadAnnouncementNote = async (dateKey: string) => {
  if (!isSupabaseSettingsEnabled) return null;
  if (useServerProxy) {
    return fetchJson(`/api/announcement-notes?dateKey=${encodeURIComponent(dateKey)}`) as Promise<AnnouncementNoteRecord | null>;
  }
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('announcement_notes')
    .select('date_key,date_text,note,updated_at')
    .eq('date_key', dateKey)
    .maybeSingle<AnnouncementNoteRecord>();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const loadAnnouncementNoteHistory = async (limit = 120) => {
  if (!isSupabaseSettingsEnabled) return [];
  if (useServerProxy) {
    return fetchJson(`/api/announcement-notes?limit=${Math.min(120, Math.max(1, Math.floor(limit)))}`) as Promise<AnnouncementNoteRecord[]>;
  }
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('announcement_notes')
    .select('date_key,date_text,note,updated_at')
    .order('date_key', { ascending: false })
    .limit(limit)
    .returns<AnnouncementNoteRecord[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const saveAnnouncementNote = async (record: AnnouncementNoteRecord) => {
  return withSaveFailureReporting('announcement', async () => {
    if (!isSupabaseSettingsEnabled) return;
    if (isReadOnlyDataMode) return;

    if (useServerProxy) {
      await fetchJson('/api/announcement-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.from('announcement_notes').upsert({
      date_key: record.date_key,
      date_text: record.date_text,
      note: record.note,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  });
};
