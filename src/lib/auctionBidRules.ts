import {
  getMinimumAuctionBid,
  hasAuctionBidAmount,
  AUCTION_ITEM_IDS,
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionBids,
  type AuctionItem,
} from './currency.js';

/** Raise steps by time of day: periods 1-3, from period 4 on, and during lunch. */
export const AUCTION_BID_STEP_MORNING = 5;
export const AUCTION_BID_STEP_AFTERNOON = 10;
export const AUCTION_BID_STEP_LUNCH = 20;
/** Teacher setting: ids of items that take sealed bids. Kept apart from the items so it stays tiny. */
export const AUCTION_SEALED_ITEMS_FIELD = 'auctionSealedItemIds';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_CLOCK_OFFSET_SECONDS = 24 * 60 * 60;

type ScheduleSlot = { readonly type: string; readonly start: number; readonly end: number };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const parseDaySlots = (schedule: unknown, day: number): ScheduleSlot[] => {
  if (!isRecord(schedule)) return [];
  const slots = schedule[String(day)];
  if (!Array.isArray(slots)) return [];
  return slots.flatMap((slot): ScheduleSlot[] => {
    if (!isRecord(slot)) return [];
    const { type, start, end } = slot;
    return typeof type === 'string' && typeof start === 'number' && typeof end === 'number'
      && Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ type, start, end }] : [];
  }).sort((left, right) => left.start - right.start);
};

/**
 * The classroom timetable decides the step, in Korean time shifted by the teacher's clock offset:
 * 5 during periods 1-3, 10 from the start of period 4, and 20 while a lunch slot is running.
 */
export const getAuctionBidStep = (nowMs: number, weeklySchedule: unknown, clockOffsetSeconds: unknown): number => {
  const offset = typeof clockOffsetSeconds === 'number' && Number.isFinite(clockOffsetSeconds)
    ? Math.max(-MAX_CLOCK_OFFSET_SECONDS, Math.min(MAX_CLOCK_OFFSET_SECONDS, clockOffsetSeconds)) : 0;
  const korean = new Date(nowMs + offset * 1000 + KST_OFFSET_MS);
  const minutes = korean.getUTCHours() * 60 + korean.getUTCMinutes() + korean.getUTCSeconds() / 60;
  const slots = parseDaySlots(weeklySchedule, korean.getUTCDay());
  if (slots.some(slot => slot.type === 'lunch' && minutes >= slot.start && minutes < slot.end)) return AUCTION_BID_STEP_LUNCH;
  const fourthPeriod = slots.filter(slot => slot.type === 'class')[3];
  return fourthPeriod && minutes >= fourthPeriod.start ? AUCTION_BID_STEP_AFTERNOON : AUCTION_BID_STEP_MORNING;
};

export const normalizeAuctionSealedItemIds = (value: unknown): string[] => (
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && AUCTION_ITEM_IDS.includes(id)))]
    : []
);

/** The student's own bid on an item, or null when they have not bid on it. */
export const getOwnAuctionBidAmount = (history: AuctionBidHistory, itemId: string, studentNumber: number): number | null => (
  (history[itemId] ?? []).reduce<number | null>((highest, entry) => (
    entry.bidder === studentNumber && (highest === null || entry.amount > highest) ? entry.amount : highest
  ), null)
);

/**
 * Coins held for open items. An open item holds coins only for the leading bid. A sealed item holds
 * every own bid, so the balance does not reveal whether the student is leading.
 */
export const getStudentReservedAuctionAmount = (input: {
  readonly bids: AuctionBids; readonly history: AuctionBidHistory; readonly awards: AuctionAwards;
  readonly activeItemIds: readonly string[]; readonly sealedItemIds: ReadonlySet<string>;
  readonly studentNumber: number; readonly excludedItemId?: string;
}): number => input.activeItemIds.reduce((total, itemId) => {
  if (itemId === input.excludedItemId || input.awards[itemId]) return total;
  const bid = input.bids[itemId];
  const leading = bid?.bidder === input.studentNumber ? bid.amount : 0;
  const own = input.sealedItemIds.has(itemId) ? getOwnAuctionBidAmount(input.history, itemId, input.studentNumber) ?? 0 : 0;
  return total + Math.max(leading, own);
}, 0);

export type AuctionBidRejection = 'ALREADY_AWARDED' | 'ALREADY_HIGHEST_BIDDER' | 'ALREADY_BID'
  | 'BID_TOO_LOW' | 'DUPLICATE_BID_AMOUNT' | 'INSUFFICIENT_FUNDS';

export interface AuctionBidInput {
  readonly item: AuctionItem;
  readonly bids: AuctionBids;
  readonly history: AuctionBidHistory;
  readonly awards: AuctionAwards;
  readonly activeItemIds: readonly string[];
  readonly sealedItemIds: ReadonlySet<string>;
  readonly studentNumber: number;
  readonly amount: number;
  readonly balance: number;
  readonly step: number;
}

export const getAuctionBidMinimum = (input: Pick<AuctionBidInput, 'item' | 'bids' | 'step' | 'sealedItemIds'>): number => (
  input.sealedItemIds.has(input.item.id)
    ? input.item.startPrice
    : getMinimumAuctionBid(input.item, input.bids[input.item.id]?.amount ?? 0, input.step)
);

/** Shared by the server command and the student screen so both reject the same bids. */
export const checkAuctionBid = (input: AuctionBidInput): AuctionBidRejection | null => {
  const { item, studentNumber, amount } = input;
  const sealed = input.sealedItemIds.has(item.id);
  if (input.awards[item.id]) return 'ALREADY_AWARDED';
  if (sealed) {
    if (getOwnAuctionBidAmount(input.history, item.id, studentNumber) !== null) return 'ALREADY_BID';
  } else if (input.bids[item.id]?.bidder === studentNumber) return 'ALREADY_HIGHEST_BIDDER';
  if (amount < getAuctionBidMinimum(input)) return 'BID_TOO_LOW';
  if (!sealed && hasAuctionBidAmount(input.history, item.id, amount)) return 'DUPLICATE_BID_AMOUNT';
  const reserved = getStudentReservedAuctionAmount({ ...input, excludedItemId: item.id });
  return amount > input.balance - reserved ? 'INSUFFICIENT_FUNDS' : null;
};

/** A sealed bid only takes the lead when it beats the current lead; ties keep the earlier bid. */
export const auctionBidTakesLead = (bids: AuctionBids, itemId: string, amount: number, sealed: boolean): boolean => (
  !sealed || amount > (bids[itemId]?.amount ?? 0)
);

/**
 * For sealed items a student receives no leading bid and only their own bid history. Awards stay
 * visible, so results appear once the teacher closes the item. Values without the sealed list are
 * left as they are, so every scope that sends bids to a student must also read that list.
 */
export const redactSealedAuctionForStudent = (
  value: Record<string, unknown>, studentNumber: number,
): Record<string, unknown> => {
  const sealedIds = new Set(normalizeAuctionSealedItemIds(value[AUCTION_SEALED_ITEMS_FIELD]));
  if (sealedIds.size === 0) return value;
  const next = { ...value };
  if (isRecord(value.auctionBids)) {
    next.auctionBids = Object.fromEntries(Object.entries(value.auctionBids).map(([itemId, bid]) => [
      itemId, sealedIds.has(itemId) ? { amount: 0, bidder: null } : bid,
    ]));
  }
  if (isRecord(value.auctionBidHistory)) {
    next.auctionBidHistory = Object.fromEntries(Object.entries(value.auctionBidHistory).map(([itemId, entries]) => [
      itemId, !sealedIds.has(itemId) ? entries
        : Array.isArray(entries) ? entries.filter(entry => isRecord(entry) && entry.bidder === studentNumber) : [],
    ]));
  }
  return next;
};
