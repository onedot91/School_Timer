import { canonicalStorageJson } from './storageV2Codec.js';

export const featurePayloadHash = async (action: string, payload: unknown): Promise<string> => {
  const encoded = new TextEncoder().encode(canonicalStorageJson({ action, payload }));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
};

export const featureRetryAfterMs = (response: Response): number | undefined => {
  const value = response.headers.get('Retry-After');
  if (value === null) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : undefined;
};
