import assert from 'node:assert/strict';
import test from 'node:test';
import { economyResultScope, economyStorageScope } from '../../src/server/economyStorageScope.js';
import { storageResourceMatchesScope } from '../../src/server/storageScope.js';
import { splitStorageState } from '../../src/lib/storageV2Codec.js';

const source = splitStorageState({ studentEconomy: { 1: { deposit: 10 }, 2: { deposit: 999 } },
  studentLife: { letters: [
    { id: 'own-letter', recipient: 1, senderStudentNumber: 0, content: 'own' },
    { id: 'other-letter', recipient: 2, senderStudentNumber: 0, content: 'secret' },
  ], books: [{ id: 'large-book', studentNumber: 2 }], failureStories: [{ id: 'large-story', studentNumber: 2 }], failureProfileAssignments: { 1: 'own', 2: 'other' } },
  studentPets: { 2: { name: 'outside' } }, studentShopCatalog: [], studentStockMarket: {},
});

test('예금은 본인 경제·편지만 읽고 타인 상태와 공개 도서·실패 이야기를 조회하지 않는다', () => {
  const scope = economyStorageScope(1, { type: 'deposit', amount: 30 }, 'deposit-scope-id');
  assert.deepEqual(scope.wallets, [1]);assert.deepEqual(scope.history, [1]);assert.deepEqual(scope.writeWallets, [1]);
  const keys = source.resources.filter(row=>storageResourceMatchesScope(row,scope.resources)).map(row=>row.resource_key);
  assert.ok(keys.includes('/studentEconomy/1'));assert.ok(keys.includes('/studentLife/letters/@own-letter'));
  for (const excluded of ['/studentEconomy/2','/studentLife/letters/@other-letter','/studentLife/books','/studentLife/failureStories','/studentPets/2','/studentShopCatalog','/studentStockMarket']) assert.ok(!keys.some(key=>key===excluded||key.startsWith(`${excluded}/`)),excluded);
  assert.deepEqual(scope.writeResources,[{path:'/studentEconomy/1'}]);
  assert.ok(!scope.revisionKeys?.includes('scope:studentEconomy:all'));
  assert.ok(!scope.revisionKeys?.includes('scope:studentLife:all'));
});

test('송금과 집 구매는 해당 상대방 지갑·원장과 생성할 편지 ID만 추가한다', () => {
  const transfer = economyStorageScope(1,{type:'transfer',recipientNumber:2,amount:20,dateKey:'2026-09-08'},'transfer-scope-id');
  assert.deepEqual(transfer.wallets,[1,2]);assert.deepEqual(transfer.history,[1,2]);
  assert.ok(transfer.writeResources.some(row=>row.path==='/studentLife/letters/@bank-transfer-scope-id-transfer-in'));
  assert.ok(!transfer.resources.some(row=>row.mail?.actor===2));
  const house = economyStorageScope(1,{type:'buy_house',houseId:'student-house-7'},'house-scope-id');
  assert.deepEqual(house.wallets,[1,7]);assert.deepEqual(house.history,[1,7]);
  assert.ok(house.writeResources.some(row=>row.path==='/studentLife/letters/@house-sale-student-house-7-1'));
  assert.deepEqual(economyStorageScope(7,{type:'buy_house',houseId:'student-house-7'},'self-house-scope').wallets,[7]);
});

test('프로필의 전체 배정 읽기는 선택 경쟁 검증만 하며 수정은 본인 배정 한 개로 제한한다', () => {
  const scope = economyStorageScope(1,{type:'draw_profile'},'profile-scope-id');
  assert.ok(scope.resources.some(row=>row.path==='/studentLife/failureProfileAssignments'));
  assert.ok(scope.writeResources.some(row=>row.path==='/studentLife/failureProfileAssignments/1'));
  assert.ok(!scope.writeResources.some(row=>row.path==='/studentLife/failureProfileAssignments'));
  for(let number=1;number<=23;number++)assert.ok(scope.revisionKeys?.includes(`/studentLife/failureProfileAssignments/${number}`));
  const result= economyResultScope(1);
  assert.deepEqual(result.wallets,[1]);assert.deepEqual(result.writeResources,[]);
  assert.ok(!result.resources.some(row=>row.path.startsWith('/auction')||row.path==='/studentLife/failureProfileAssignments'));
});

test('상품과 투자 명령만 해당 시세 설정을 읽고 revision을 검증한다', () => {
  const item=economyStorageScope(1,{type:'buy_item',itemId:'house_repair'},'buy-item-scope');
  assert.ok(item.resources.some(row=>row.path==='/studentShopCatalog'));assert.ok(item.revisionKeys?.includes('scope:studentShopCatalog:shared'));
  const stock=economyStorageScope(1,{type:'invest',stockId:'sunny',amount:30,dateKey:'2026-09-08'},'invest-scope-id');
  assert.ok(stock.resources.some(row=>row.path==='/studentStockMarket'));assert.ok(stock.revisionKeys?.includes('scope:studentStockMarket:shared'));
  assert.ok(!stock.resources.some(row=>row.path==='/studentShopCatalog'));
});
