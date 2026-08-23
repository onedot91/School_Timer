import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const EXPECTED_PROFILE_HASHES = {
  'nyamnyam-food.png': 'e32604132fc3626d5bd11335e79db1e1d932bfc8f7e27b73feb084a7f4109cd2',
  'pangpang-games.png': '8bccd7498d401e3a8e41142f595b28bd5a24ebde87ad131e3febfda7d1aa2c03',
  'cheokcheok-tech.png': 'e3363b74eefc00f6a37fc0e3f831a8419502754eb1f5129a34e6eca0e04fcabe',
  'banjjak-entertainment.png': '1bbf6b9f109698bbdd8ef80519dc489fe391d9ca00e3888a26d9aff0eea5e485',
} as const;

test('증권 종목 프로필은 각 종목에 맞는 생성 이미지와 연결된다', () => {
  Object.entries(EXPECTED_PROFILE_HASHES).forEach(([fileName, expectedHash]) => {
    const profilePath = new URL(`../../public/stock-profiles/${fileName}`, import.meta.url);
    const actualHash = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    assert.equal(actualHash, expectedHash, `${fileName} 프로필 이미지가 다른 종목 이미지와 바뀌었습니다.`);
  });
});
