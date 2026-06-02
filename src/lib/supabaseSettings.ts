import { createClient } from '@supabase/supabase-js';

export const SHARED_SETTINGS_ID = 'school-timer-main';

export type SettingsRow = {
  id: string;
  value: unknown;
  updated_at?: string;
};

export interface AnnouncementNoteRecord {
  date_key: string;
  date_text: string;
  note: string;
  updated_at?: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseSettingsEnabled =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.trim().length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.trim().length > 0;

const supabase = isSupabaseSettingsEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const loadSharedSettings = async () => {
  const data = await loadSharedSettingsRow();
  return data?.value ?? null;
};

export const loadSharedSettingsRow = async () => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('id,value,updated_at')
    .eq('id', SHARED_SETTINGS_ID)
    .maybeSingle<SettingsRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const saveSharedSettings = async (value: unknown) => {
  if (!supabase) return;

  const { error } = await supabase.from('app_settings').upsert({
    id: SHARED_SETTINGS_ID,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
};

export const loadAnnouncementNote = async (dateKey: string) => {
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
};
