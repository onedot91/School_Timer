import { captureStorageResponseContext, isStorageResponseContextCurrent, type StorageResponseContext } from './storageResponseOrder.js';

export type StorageAvailability = 'maintenance' | 'update';
export interface StorageAvailabilityNotice {
  readonly kind: StorageAvailability;
  readonly actor: number | null;
}

let notice: StorageAvailabilityNotice | null = null;
const listeners = new Set<() => void>();

export const getStorageAvailability = (error: unknown): StorageAvailability | null => {
  if (!error || typeof error !== 'object' || Reflect.get(error, 'uncertainWrite') === true) return null;
  const code = Reflect.get(error, 'serverCode') ?? Reflect.get(error, 'code');
  const status = Reflect.get(error, 'status');
  if (status === 503 && (code === 'STORAGE_MAINTENANCE' || code === 'STORAGE_NOT_ACTIVE')) return 'maintenance';
  if ((status === 409 || status === 426) && (code === 'STORAGE_PROTOCOL_REQUIRED' || code === 'LEGACY_CLIENT_UPDATE_REQUIRED')) return 'update';
  if (status === 426 && code === 'STORAGE_PROTOCOL_UPGRADE_REQUIRED') return 'update';
  return null;
};

export const getStorageAvailabilityNotice = (): StorageAvailabilityNotice | null => notice;
export const subscribeStorageAvailability = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const dismissStorageAvailabilityNotice = (): void => {
  if (!notice) return;
  notice = null;
  for (const listener of listeners) listener();
};
export const publishStorageAvailability = (error: unknown, context: StorageResponseContext = captureStorageResponseContext()): boolean => {
  const kind = getStorageAvailability(error);
  if (!kind) return false;
  if (!isStorageResponseContextCurrent(context)) return true;
  const actor = context.actor === null ? null : Number(context.actor);
  if (notice?.kind !== kind || notice.actor !== actor) {
    notice = { kind, actor };
    for (const listener of listeners) listener();
  }
  return true;
};
