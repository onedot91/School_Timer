import { CURRENCY_STUDENT_NUMBERS, type AuctionAward } from './currency.js';
import { isStorageRecord } from './storageV2Codec.js';

export const readConfirmedAuctionAward = (result: unknown): AuctionAward | null => {
  if (!isStorageRecord(result) || typeof result.awarded !== 'boolean' || !isStorageRecord(result.award)) return null;
  const award = result.award;
  if (typeof award.itemId !== 'string' || !award.itemId.trim()
    || typeof award.winner !== 'number' || !CURRENCY_STUDENT_NUMBERS.includes(award.winner)
    || typeof award.amount !== 'number' || !Number.isSafeInteger(award.amount) || award.amount <= 0 || award.amount > 999999
    || typeof award.awardedAt !== 'string' || !Number.isFinite(Date.parse(award.awardedAt))) return null;
  return { itemId: award.itemId, winner: award.winner, amount: award.amount, awardedAt: award.awardedAt };
};
