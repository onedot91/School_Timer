import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const EXPECTED_PROFILE_HASHES = {
  'nyamnyam-food.png': '77a8f8d510bbbd7116cf605d97207ed8a0e36014b3748f6aae75d6c753862abb',
  'pangpang-games.png': '1b8558c4c863d7bde3b4e9982f31f2af3788dcfa4598171b978681fe1ab7b701',
  'cheokcheok-tech.png': '993323d81fb3d77b472049bc50d48dbaeda50ed56c4519205432eedf6fa9a88c',
  'banjjak-entertainment.png': '263b4d8f8caec3d4f05a769be1878d013bc607089358f717de62e3599e6da9f5',
} as const;

test('증권 종목 프로필은 각 종목에 맞는 생성 이미지와 연결된다', () => {
  Object.entries(EXPECTED_PROFILE_HASHES).forEach(([fileName, expectedHash]) => {
    const profilePath = new URL(`../../public/stock-profiles/${fileName}`, import.meta.url);
    const actualHash = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    assert.equal(actualHash, expectedHash, `${fileName} 프로필 이미지가 다른 종목 이미지와 바뀌었습니다.`);
  });
});
