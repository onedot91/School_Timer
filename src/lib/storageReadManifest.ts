import { isStorageRecord } from './storageV2Codec.js';

export const parseReadManifest = (value: unknown): Record<string, string> => {
  if (!isStorageRecord(value) || Object.keys(value).length > 256) throw new Error('STORAGE_INVALID_READ_MANIFEST');
  return Object.fromEntries(Object.entries(value).map(([key, digest]) => {
    if (!/^(?:resource:[A-Za-z][A-Za-z0-9]*|wallet:(?:[1-9]|1[0-9]|2[0-3]))$/.test(key)
      || typeof digest !== 'string' || !/^[a-f0-9]{32}$/.test(digest)) throw new Error('STORAGE_INVALID_READ_MANIFEST');
    return [key, digest];
  }));
};
