export const APP_DATA_MODES = ['mock', 'readonly', 'production'] as const;

export type AppDataMode = typeof APP_DATA_MODES[number];

export const resolveAppDataMode = (
  isProduction: boolean,
  requestedMode: string | undefined,
): AppDataMode => {
  if (isProduction) return 'production';
  return requestedMode === 'readonly' ? 'readonly' : 'mock';
};

export const appDataMode = resolveAppDataMode(
  import.meta.env?.PROD === true,
  import.meta.env?.VITE_DATA_MODE,
);

export const isReadOnlyDataMode = appDataMode === 'readonly';

export const canReadSharedBackend = (dataMode: AppDataMode) => dataMode !== 'mock';

export const canWriteSharedBackend = (dataMode: AppDataMode) => dataMode === 'production';
