import { getStorageAvailability } from './storageAvailability.js';

export const storageAvailabilityMessage = (error: unknown): string | null => {
  const availability = getStorageAvailability(error);
  return availability === 'maintenance' ? '점검 중입니다. 잠시 후 다시 저장해 주세요.'
    : availability === 'update' ? '업데이트가 필요합니다. 새로고침 후 다시 저장해 주세요.' : null;
};
