import assert from 'node:assert/strict';
import test from 'node:test';

import { getDailyDonationCharacterSource } from './dailyDonationCharacter.ts';

test('기부 캐릭터는 같은 날짜에 동일하게 유지된다', () => {
  const first = getDailyDonationCharacterSource('2026-08-12');
  const second = getDailyDonationCharacterSource('2026-08-12');

  assert.equal(first, second);
  assert.match(first, /^\/donation-character-[1-3]\.png$/);
});

test('기부 캐릭터는 날짜에 따라 세 캐릭터를 순환한다', () => {
  const sources = new Set([
    getDailyDonationCharacterSource('2026-08-12'),
    getDailyDonationCharacterSource('2026-08-13'),
    getDailyDonationCharacterSource('2026-08-14'),
  ]);

  assert.equal(sources.size, 3);
});
