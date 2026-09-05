import { appDataMode, type AppDataMode } from './dataMode.js';
import { invalidateSharedSettingsCache, isSupabaseSettingsEnabled } from './supabaseSettings.js';
import { isCompetitionRecord, parseCompetitionHistoryResponse, parseCompetitionResponse } from './libraryCompetitionResponse.js';
import { LibraryCompetitionClientError } from './libraryCompetitionTransport.js';
import type { LibraryCompetitionHistoryResponse, LibraryCompetitionResponse, LibraryCompetitionSettingsInput } from './libraryCompetitionTransport.js';
import { LibraryCompetitionLocalError, readLocalLibraryCompetition, readLocalLibraryCompetitionHistory, settingsLocalLibraryCompetition } from './libraryCompetitionLocalStore.js';

export * from './libraryCompetitionTransport.js';
export type LibraryCompetitionReadIntent = 'open' | 'enter' | 'readonly';
export type LibraryCompetitionClientDependencies = {
  readonly dataMode: AppDataMode;
  readonly isSharedConfigured: boolean;
  readonly fetcher: typeof fetch;
  readonly localRead: (intent: LibraryCompetitionReadIntent) => LibraryCompetitionResponse;
  readonly localHistory: (month?: string) => LibraryCompetitionHistoryResponse;
  readonly localSettings: (input: LibraryCompetitionSettingsInput) => LibraryCompetitionResponse;
  readonly withLocalLock: <T>(action: () => T) => Promise<T>;
  readonly invalidate: () => void;
};

export const createLibraryCompetitionClient = (dependencies: LibraryCompetitionClientDependencies) => {
  const local = dependencies.dataMode === 'mock' || !dependencies.isSharedConfigured;
  const request = async <T>(url: string, command: unknown, parse: (value: unknown) => T | null): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await dependencies.fetcher(url, {
        method: command === null ? 'GET' : 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        ...(command === null ? {} : { body: JSON.stringify(command) }),
      });
      const value: unknown = await response.json();
      if (!response.ok) throw new LibraryCompetitionClientError(isCompetitionRecord(value) && typeof value.error === 'string' ? value.error : 'LIBRARY_COMPETITION_NETWORK');
      const parsed = parse(value);
      if (!parsed) throw new LibraryCompetitionClientError('LIBRARY_COMPETITION_INVALID_RESPONSE');
      if (command !== null) dependencies.invalidate();
      return parsed;
    } catch (error) {
      if (error instanceof LibraryCompetitionClientError) throw error;
      if (error instanceof SyntaxError) throw new LibraryCompetitionClientError('LIBRARY_COMPETITION_INVALID_RESPONSE');
      if (error instanceof Error) throw new LibraryCompetitionClientError('LIBRARY_COMPETITION_NETWORK');
      throw error;
    } finally { clearTimeout(timeout); }
  };
  const read = async (intent: LibraryCompetitionReadIntent): Promise<LibraryCompetitionResponse> => {
    const mode = dependencies.dataMode === 'readonly' ? 'readonly' : intent;
    if (local) return dependencies.withLocalLock(() => dependencies.localRead(mode));
    return mode === 'readonly'
      ? request('/api/shared-settings?libraryCompetition=1', null, parseCompetitionResponse)
      : request('/api/shared-settings', { action: 'libraryCompetition', intent: mode }, parseCompetitionResponse);
  };
  const history = async (month?: string): Promise<LibraryCompetitionHistoryResponse> => {
    if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new LibraryCompetitionClientError('LIBRARY_COMPETITION_INVALID');
    if (local) return dependencies.withLocalLock(() => dependencies.localHistory(month));
    return request(`/api/shared-settings?libraryCompetitionHistory=1${month ? `&month=${encodeURIComponent(month)}` : ''}`, null, parseCompetitionHistoryResponse);
  };
  const settings = async (input: LibraryCompetitionSettingsInput): Promise<LibraryCompetitionResponse> => {
    if (dependencies.dataMode === 'readonly') throw new LibraryCompetitionClientError('READ_ONLY_DATA_MODE');
    if (local) return dependencies.withLocalLock(() => dependencies.localSettings(input));
    return request('/api/shared-settings', { action: 'libraryCompetitionSettings', ...input }, parseCompetitionResponse);
  };
  return { read, history, settings };
};

const localAction = async <T>(action: () => T): Promise<T> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('school-timer-canvas-library:place', action);
    return action();
  } catch (error) {
    if (error instanceof LibraryCompetitionLocalError) throw new LibraryCompetitionClientError(error.code);
    throw error;
  }
};

export const libraryCompetitionClient = createLibraryCompetitionClient({
  dataMode: appDataMode, isSharedConfigured: isSupabaseSettingsEnabled,
  fetcher: (input, init) => fetch(input, init),
  localRead: readLocalLibraryCompetition, localHistory: readLocalLibraryCompetitionHistory,
  localSettings: settingsLocalLibraryCompetition, withLocalLock: localAction, invalidate: invalidateSharedSettingsCache,
});
