import { createClient } from '@supabase/supabase-js';
import { parseClassDonationResult } from './classDonation.js';

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

const SHARED_SETTINGS_UPDATE_RETRY_LIMIT = 5;

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
};

export const updateSharedSettings = async (updater: (currentValue: unknown) => unknown) => {
  if (!supabase) return null;

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
