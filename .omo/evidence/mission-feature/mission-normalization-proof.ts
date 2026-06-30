import assert from 'node:assert/strict';

import {
  AUCTION_MISSION_CONTENT_MAX_LENGTH,
  CURRENCY_BALANCE_MAX,
  normalizeAuctionMissions,
} from '../../../src/lib/currency';

const resultForNonArray = normalizeAuctionMissions(null);
assert.deepEqual(resultForNonArray, []);

const normalized = normalizeAuctionMissions([
  { id: 'mission-existing', content: '  책상 정리하기  ', rewardAmount: 15 },
  { id: 'blank-content', content: '   ', rewardAmount: 20 },
  { id: 'mission-existing', content: '중복 아이디', rewardAmount: -10 },
  { content: '아이디 없음', rewardAmount: CURRENCY_BALANCE_MAX + 10_000 },
]);

assert.equal(normalized.length, 3);
assert.equal(normalized[0]?.id, 'mission-existing');
assert.equal(normalized[0]?.content, '책상 정리하기');
assert.equal(normalized[0]?.rewardAmount, 15);

assert.equal(normalized[1]?.content, '중복 아이디');
assert.equal(normalized[1]?.rewardAmount, 0);

assert.equal(normalized[2]?.content, '아이디 없음');
assert.equal(normalized[2]?.rewardAmount, CURRENCY_BALANCE_MAX);

const ids = normalized.map((mission) => mission.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(ids[1]?.startsWith('mission-'));
assert.ok(ids[2]?.startsWith('mission-'));
assert.deepEqual(
  normalized.map((mission) => mission.content),
  ['책상 정리하기', '중복 아이디', '아이디 없음'],
);

const longContent = '가'.repeat(AUCTION_MISSION_CONTENT_MAX_LENGTH);
const normalizedLongContent = normalizeAuctionMissions([
  { content: `  ${longContent}추가 내용  `, rewardAmount: 5 },
]);
assert.equal(normalizedLongContent.length, 1);
assert.equal(normalizedLongContent[0]?.content, longContent);
assert.equal(normalizedLongContent[0]?.content.length, AUCTION_MISSION_CONTENT_MAX_LENGTH);

console.log('mission normalization proof passed');
