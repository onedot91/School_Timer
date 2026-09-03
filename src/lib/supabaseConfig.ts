import {
  appDataMode,
  canReadSharedBackend,
  type AppDataMode,
} from './dataMode.js';

export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const useServerProxy = import.meta.env?.DEV === true || import.meta.env?.PROD === true;

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
