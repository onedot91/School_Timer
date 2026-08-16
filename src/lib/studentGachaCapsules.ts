export const STUDENT_GACHA_CAPSULES = [
  '/goma-capsules/capsule-1-pink.png',
  '/goma-capsules/capsule-2-red.png',
  '/goma-capsules/capsule-3-green.png',
  '/goma-capsules/capsule-4-purple.png',
  '/goma-capsules/capsule-5-peach.png',
  '/goma-capsules/capsule-6-orange.png',
  '/goma-capsules/capsule-7-blue.png',
  '/goma-capsules/capsule-8-brown.png',
  '/goma-capsules/capsule-9-gray.png',
] as const;

const DAILY_CAPSULE_COUNT = 5;

const DAILY_CAPSULE_ORDER = [
  STUDENT_GACHA_CAPSULES[6],
  STUDENT_GACHA_CAPSULES[0],
  STUDENT_GACHA_CAPSULES[8],
  STUDENT_GACHA_CAPSULES[3],
  STUDENT_GACHA_CAPSULES[5],
  STUDENT_GACHA_CAPSULES[1],
  STUDENT_GACHA_CAPSULES[7],
  STUDENT_GACHA_CAPSULES[2],
  STUDENT_GACHA_CAPSULES[4],
] as const;

const getKoreanDateNumber = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const getDailyGachaCapsules = (dateKey: string) => {
  const dayNumber = getKoreanDateNumber(dateKey);
  const startIndex = ((dayNumber * 4) % DAILY_CAPSULE_ORDER.length + DAILY_CAPSULE_ORDER.length) % DAILY_CAPSULE_ORDER.length;

  return Array.from(
    { length: DAILY_CAPSULE_COUNT },
    (_, index) => DAILY_CAPSULE_ORDER[(startIndex + index) % DAILY_CAPSULE_ORDER.length],
  );
};
