import { createClient } from '@supabase/supabase-js';

export const SHARED_SETTINGS_ID = 'school-timer-main';

type SettingsRow = {
  id: string;
  value: unknown;
  updated_at?: string;
};

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
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('id,value,updated_at')
    .eq('id', SHARED_SETTINGS_ID)
    .maybeSingle<SettingsRow>();

  if (error) {
    throw error;
  }

  return data?.value ?? null;
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
