import { normalizeClassDonationSettings, type ClassDonationSettings } from './classDonation.js';

export const CLASS_DONATION_SETTINGS_STORAGE_KEY = 'school-timer-class-donation-v1';

export const loadStoredClassDonationSettings = (
  storage: Pick<Storage, 'getItem'>,
): ClassDonationSettings => {
  try {
    const saved = storage.getItem(CLASS_DONATION_SETTINGS_STORAGE_KEY);
    return normalizeClassDonationSettings(saved ? JSON.parse(saved) : null);
  } catch (error) {
    if (error instanceof Error) return normalizeClassDonationSettings(null);
    throw error;
  }
};

export const storeClassDonationSettings = (
  storage: Pick<Storage, 'setItem'>,
  settings: ClassDonationSettings,
): boolean => {
  try {
    storage.setItem(
      CLASS_DONATION_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeClassDonationSettings(settings)),
    );
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
