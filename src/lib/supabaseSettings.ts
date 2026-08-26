import { createClient } from '@supabase/supabase-js';
import { parseClassDonationResult } from './classDonation.js';
import {
  appDataMode,
  canReadSharedBackend,
  isReadOnlyDataMode,
  type AppDataMode,
} from './dataMode.js';

export const SHARED_SETTINGS_ID = 'school-timer-main';

export type SettingsRow = {
  id: string;
  value: unknown;
  updated_at?: string;
  scope?: 'full' | 'student';
};

let cachedWritableSharedSettingsRow: SettingsRow | null | undefined;

export const invalidateSharedSettingsCache = () => {
  cachedWritableSharedSettingsRow = undefined;
};

export interface AnnouncementNoteRecord {
  date_key: string;
  date_text: string;
  note: string;
  updated_at?: string;
}

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const useServerProxy = import.meta.env?.DEV === true || import.meta.env?.PROD === true;

type SupabaseSettingsAvailability = {
  readonly hasSupabaseCredentials: boolean;
  readonly usesServerProxy: boolean;
  readonly dataMode: AppDataMode;
};

export const shouldEnableSupabaseSettings = ({
  hasSupabaseCredentials,
  usesServerProxy,
  dataMode,
}: SupabaseSettingsAvailability) => (
  canReadSharedBackend(dataMode) && hasSupabaseCredentials && usesServerProxy
);

const hasSupabaseCredentials =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.trim().length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.trim().length > 0;

export const isSupabaseSettingsEnabled = shouldEnableSupabaseSettings({
  hasSupabaseCredentials,
  usesServerProxy: useServerProxy,
  dataMode: appDataMode,
});

const supabase = isSupabaseSettingsEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const fetchJson = async (input: string, init?: RequestInit) => {
  const response = await fetch(input, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) {
    const error = new Error(`SHARED_API_HTTP_${response.status}`);
    Reflect.set(error, 'status', response.status);
    throw error;
  }
  return response.status === 204 ? null : response.json();
};

const SHARED_SETTINGS_UPDATE_RETRY_LIMIT = 5;

export const loadSharedSettings = async () => {
  const data = await loadSharedSettingsRow();
  return data?.value ?? null;
};

export const loadSharedSettingsRow = async () => {
  if (!supabase) return null;
  if (useServerProxy) {
    const row = await fetchJson('/api/shared-settings') as SettingsRow | null;
    if (row?.scope === 'full') {
      cachedWritableSharedSettingsRow = row;
    } else if (row?.updated_at !== cachedWritableSharedSettingsRow?.updated_at) {
      cachedWritableSharedSettingsRow = undefined;
    }
    return row;
  }

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

const loadWritableSharedSettingsRow = async () => {
  if (!supabase) return null;
  if (!useServerProxy) return loadSharedSettingsRow();
  const row = await fetchJson('/api/shared-settings?full=1') as SettingsRow | null;
  cachedWritableSharedSettingsRow = row;
  return row;
};

export const loadSharedSettingsUpdatedAt = async () => {
  if (!supabase) return null;
  if (useServerProxy) return ((await fetchJson('/api/shared-settings?metadata=1')) as { updatedAt: string | null }).updatedAt;

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
  if (!supabase) return null;
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
};

export const updateSharedSettings = async (updater: (currentValue: unknown) => unknown) => {
  if (!supabase) return null;
  if (isReadOnlyDataMode) return (await loadSharedSettingsRow())?.updated_at ?? null;

  if (useServerProxy) {
    for (let attempt = 0; attempt < SHARED_SETTINGS_UPDATE_RETRY_LIMIT; attempt += 1) {
      const currentRow = cachedWritableSharedSettingsRow === undefined
        ? await loadWritableSharedSettingsRow()
        : cachedWritableSharedSettingsRow;
      const nextValue = updater(currentRow?.value ?? null);
      try {
        const result = await fetchJson('/api/shared-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: nextValue, expectedUpdatedAt: currentRow?.updated_at ?? null }),
        }) as { updatedAt: string };
        cachedWritableSharedSettingsRow = {
          id: SHARED_SETTINGS_ID,
          value: nextValue,
          updated_at: result.updatedAt,
          scope: 'full',
        };
        return result.updatedAt;
      } catch (error) {
        if (error instanceof Error && Reflect.get(error, 'status') === 409) {
          cachedWritableSharedSettingsRow = undefined;
          continue;
        }
        throw error;
      }
    }
    throw new Error('SHARED_SETTINGS_CONFLICT');
  }

  for (let attempt = 0; attempt < SHARED_SETTINGS_UPDATE_RETRY_LIMIT; attempt += 1) {
    const currentRow = await loadSharedSettingsRow();
    const nextValue = updater(currentRow?.value ?? null);
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
};

export const donateToClassGoal = async (
  studentNumber: number,
  amount: number,
  requestId: string,
) => {
  if (!supabase) throw new Error('CLASS_DONATION_NOT_CONFIGURED');
  if (isReadOnlyDataMode) throw new Error('READ_ONLY_DATA_MODE');
  if (useServerProxy) {
    return parseClassDonationResult(await fetchJson('/api/class-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentNumber, amount, requestId }),
    }));
  }
  const { data, error } = await supabase.rpc('donate_to_class_goal', {
    p_student_number: studentNumber,
    p_amount: amount,
    p_request_id: requestId,
  });
  if (error) throw error;
  return parseClassDonationResult(data);
};

export const loadAnnouncementNote = async (dateKey: string) => {
  if (!supabase) return null;
  if (useServerProxy) {
    return fetchJson(`/api/announcement-notes?dateKey=${encodeURIComponent(dateKey)}`) as Promise<AnnouncementNoteRecord | null>;
  }

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
  if (!supabase) return [];
  if (useServerProxy) {
    return fetchJson(`/api/announcement-notes?limit=${Math.min(120, Math.max(1, Math.floor(limit)))}`) as Promise<AnnouncementNoteRecord[]>;
  }

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
  if (!supabase) return;
  if (isReadOnlyDataMode) return;

  if (useServerProxy) {
    await fetchJson('/api/announcement-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return;
  }

  const { error } = await supabase.from('announcement_notes').upsert({
    date_key: record.date_key,
    date_text: record.date_text,
    note: record.note,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
};
