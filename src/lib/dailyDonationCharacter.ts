const DONATION_CHARACTER_SOURCES = [
  '/donation-character-1.png',
  '/donation-character-2.png',
  '/donation-character-3.png',
  '/donation-character-4.png',
] as const;

export const getDailyDonationCharacterSource = (dateKey: string) => {
  const hash = Array.from(dateKey).reduce((value, character) => (
    (value * 31 + character.charCodeAt(0)) >>> 0
  ), 7);
  return DONATION_CHARACTER_SOURCES[hash % DONATION_CHARACTER_SOURCES.length]
    ?? DONATION_CHARACTER_SOURCES[0];
};
