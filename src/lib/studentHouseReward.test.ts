import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { STUDENT_HOUSE_DESIGNS } from './studentEconomy.js';
import { createHousePurchaseLetter, HOUSE_MAIL_STAMP } from './studentHouseReward.js';

const createdAt = '2026-09-07T00:00:00.000Z';
test('학생 작품 열두 채의 제작자와 원본 이미지, 우표가 연결되어 있다', async () => {
  const houses = STUDENT_HOUSE_DESIGNS.filter(house => 'creatorStudentNumber' in house);
  assert.deepEqual(houses.map(house => house.creatorStudentNumber), [18, 10, 13, 6, 16, 4, 11, 12, 8, 20, 15, 7]);
  for (const house of houses) {
    await access(`public${house.imageSrc}`);
    const letter = createHousePurchaseLetter({ action: { type: 'buy_house', houseId: house.id }, studentNumber: 1, applied: true, createdAt });
    assert.equal(letter?.recipient, house.creatorStudentNumber);
    assert.match(letter?.content ?? '', new RegExp(house.name));
    assert.equal(createHousePurchaseLetter({ action: { type: 'buy_house', houseId: house.id }, studentNumber: house.creatorStudentNumber, applied: true, createdAt }), null);
    assert.equal(createHousePurchaseLetter({ action: { type: 'buy_house', houseId: house.id }, studentNumber: 1, applied: false, createdAt }), null);
  }
  await access(`public${HOUSE_MAIL_STAMP}`);
  assert.equal(createHousePurchaseLetter({ action: { type: 'buy_house', houseId: 'pink-cottage' }, studentNumber: 1, applied: true, createdAt }), null);
});
