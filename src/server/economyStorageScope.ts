import { STUDENT_HOUSE_DESIGNS, type StudentEconomyAction } from '../lib/studentEconomy.js';
import type { StudentProfileEconomyAction } from '../lib/studentProfilePurchase.js';
import { storageResourceKey } from '../lib/storageV2Codec.js';
import { parseStorageScope, type StorageScope, type StorageResourceSelector } from './storageScope.js';

export const economyStorageScope = (
  studentNumber: number,
  action: StudentEconomyAction | StudentProfileEconomyAction,
  requestId: string,
): StorageScope => {
  const own = String(studentNumber);
  const resources: StorageResourceSelector[] = [
    { path: storageResourceKey('studentEconomy', own) },
    { path: '/auctionItems' }, { path: '/auctionBids' }, { path: '/auctionAwards' },
    { path: '/studentLife/letters', mail: { actor: studentNumber, direction: 'participant' } },
  ];
  const writeResources: StorageResourceSelector[] = [{ path: storageResourceKey('studentEconomy', own) }];
  const wallets = new Set([studentNumber]);
  const revisionKeys = new Set([
    `wallet:${studentNumber}`, storageResourceKey('studentEconomy', own),
    'scope:auctionItems:shared', 'scope:auctionBids:shared', 'scope:auctionAwards:shared',
  ]);
  const addLetter = (id: string) => {
    const selector = { path: storageResourceKey('studentLife', 'letters', `@${id}`) };
    resources.push(selector); writeResources.push(selector); revisionKeys.add(selector.path);
  };
  const requestKey = requestId.slice(-36);
  if (action.type === 'borrow') addLetter(`bank-${requestKey}-loan`);
  if (action.type === 'claim_deposit') addLetter(`bank-${requestKey}-deposit-mature`);
  if (action.type === 'transfer' && Number.isInteger(action.recipientNumber) && action.recipientNumber >= 1 && action.recipientNumber <= 23) {
    wallets.add(action.recipientNumber);
    addLetter(`bank-${requestKey}-transfer-in`);
  }
  if (action.type === 'buy_house') {
    const house = STUDENT_HOUSE_DESIGNS.find(item => item.id === action.houseId);
    if (house && 'creatorStudentNumber' in house && house.creatorStudentNumber !== studentNumber) {
      wallets.add(house.creatorStudentNumber);
      addLetter(`house-sale-${house.id}-${studentNumber}`);
    }
  }
  if (action.type === 'buy_item') {
    resources.push({ path: '/studentShopCatalog' }); revisionKeys.add('scope:studentShopCatalog:shared');
  }
  if (action.type === 'invest' || action.type === 'withdraw_investment' || action.type === 'settle_investments') {
    resources.push({ path: '/studentStockMarket' }); revisionKeys.add('scope:studentStockMarket:shared');
  }
  if (action.type === 'draw_profile' || action.type === 'select_profile') {
    resources.push({ path: '/studentLife/failureProfileAssignments' });
    writeResources.push({ path: storageResourceKey('studentLife', 'failureProfileAssignments', own) });
    for (let number = 1; number <= 23; number += 1) revisionKeys.add(storageResourceKey('studentLife', 'failureProfileAssignments', String(number)));
  } else resources.push({ path: storageResourceKey('studentLife', 'failureProfileAssignments', own) });
  for (const number of wallets) revisionKeys.add(`wallet:${number}`);
  return parseStorageScope({ resources, wallets: [...wallets], history: [...wallets], writeResources, writeWallets: [...wallets], revisionKeys: [...revisionKeys] });
};

export const economyResultScope = (studentNumber: number): StorageScope => parseStorageScope({
  resources: [
    { path: storageResourceKey('studentEconomy', String(studentNumber)) },
    { path: '/studentLife/letters', mail: { actor: studentNumber, direction: 'participant' } },
    { path: storageResourceKey('studentLife', 'failureProfileAssignments', String(studentNumber)) },
  ],
  wallets: [studentNumber], history: [studentNumber], writeResources: [], writeWallets: [],
});
