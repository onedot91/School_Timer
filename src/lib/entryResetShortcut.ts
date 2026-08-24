export type EntryResetPlatform = 'mac' | 'windows' | 'chromeos' | 'other';

export interface EntryResetKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export const detectEntryResetPlatform = (platformText: string): EntryResetPlatform => {
  if (/CrOS|Chrome OS|Chromebook/i.test(platformText)) return 'chromeos';
  if (/Windows|Win32|Win64/i.test(platformText)) return 'windows';
  if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(platformText)) return 'mac';
  return 'other';
};

export const isEntryResetShortcut = (
  event: EntryResetKeyEvent,
  platform: EntryResetPlatform,
) => {
  const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
  if (!isEnter || event.shiftKey) return false;

  if (platform === 'mac') {
    return event.altKey && event.metaKey && !event.ctrlKey;
  }

  return event.altKey && event.ctrlKey && !event.metaKey;
};
