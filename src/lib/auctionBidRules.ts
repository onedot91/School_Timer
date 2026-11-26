import {
  getMinimumAuctionBid,
  hasAuctionBidAmount,
  type AuctionAwards,
  type AuctionBid,
  type AuctionBidHistory,
  type AuctionBids,
  type AuctionItem,
} from './currency.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_OFFSET_SECONDS = 24 * 60 * 60;

type ScheduleSlot = { readonly type: string; readonly start: number; readonly end: number };

/** The running lunch slot, in real time. Awards happen at lunch, so bids during it are sealed. */
export interface AuctionSealedWindow {
  readonly startMs: number;
  readonly endMs: number;
}

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
  });
};

/**
 * The lunch slot of the classroom timetable that contains `nowMs`, read in Korean time shifted by
 * the teacher's clock offset, or null outside lunch.
 */
export const getAuctionSealedWindow = (
  nowMs: number, weeklySchedule: unknown, clockOffsetSeconds: unknown,
): AuctionSealedWindow | null => {
  if (!Number.isFinite(nowMs)) return null;
  const offsetMs = (typeof clockOffsetSeconds === 'number' && Number.isFinite(clockOffsetSeconds)
    ? Math.max(-MAX_CLOCK_OFFSET_SECONDS, Math.min(MAX_CLOCK_OFFSET_SECONDS, clockOffsetSeconds)) : 0) * 1000;
  const classroomMs = nowMs + offsetMs + KST_OFFSET_MS;
  const dayStartMs = Math.floor(classroomMs / DAY_MS) * DAY_MS;
  const minutes = (classroomMs - dayStartMs) / 60_000;
  const lunch = parseDaySlots(weeklySchedule, new Date(dayStartMs).getUTCDay())
    .find(slot => slot.type === 'lunch' && minutes >= slot.start && minutes < slot.end);
  if (!lunch) return null;
  const toRealMs = (minute: number) => dayStartMs + minute * 60_000 - offsetMs - KST_OFFSET_MS;
  return { startMs: toRealMs(lunch.start), endMs: toRealMs(lunch.end) };
};

const isInWindow = (createdAt: string, window: AuctionSealedWindow) => {
  const time = Date.parse(createdAt);
  return Number.isFinite(time) && time >= window.startMs && time < window.endMs;
};

/** The lead as it stood when lunch began: the highest earlier bid, the earliest one on a tie. */
export const getAuctionLeadBeforeWindow = (
  history: AuctionBidHistory, itemId: string, window: AuctionSealedWindow,
): AuctionBid | null => (history[itemId] ?? []).reduce<AuctionBid | null>((lead, entry) => (
  !isInWindow(entry.createdAt, window) && (lead === null || entry.amount > lead.amount)
    ? { amount: entry.amount, bidder: entry.bidder } : lead
), null);

/** The student's highest bid on an item during this lunch, or null before they bid. */
export const getOwnWindowBidAmount = (
  history: AuctionBidHistory, itemId: string, studentNumber: number, window: AuctionSealedWindow,
): number | null => (history[itemId] ?? []).reduce<number | null>((highest, entry) => (
  entry.bidder === studentNumber && isInWindow(entry.createdAt, window) && (highest === null || entry.amount > highest)
    ? entry.amount : highest
), null);

/**
 * Coins held for items still open. A leading bid holds its coins; during lunch the lead from before
 * lunch and every own lunch bid hold coins too, so the balance never reveals the hidden lead.
 */
export const getStudentReservedAuctionAmount = (input: {
  readonly bids: AuctionBids; readonly history: AuctionBidHistory; readonly awards: AuctionAwards;
  readonly activeItemIds: readonly string[]; readonly studentNumber: number;
  readonly window: AuctionSealedWindow | null; readonly excludedItemId?: string;
}): number => input.activeItemIds.reduce((total, itemId) => {
  if (itemId === input.excludedItemId || input.awards[itemId]) return total;
  const bid = input.bids[itemId];
  const leading = bid?.bidder === input.studentNumber ? bid.amount : 0;
  if (!input.window) return total + leading;
  const before = getAuctionLeadBeforeWindow(input.history, itemId, input.window);
  const leadingBefore = before?.bidder === input.studentNumber ? before.amount : 0;
  const own = getOwnWindowBidAmount(input.history, itemId, input.studentNumber, input.window) ?? 0;
  return total + Math.max(leading, leadingBefore, own);
}, 0);

export type AuctionBidRejection = 'ALREADY_AWARDED' | 'ALREADY_HIGHEST_BIDDER'
  | 'BID_TOO_LOW' | 'DUPLICATE_BID_AMOUNT' | 'INSUFFICIENT_FUNDS';

export interface AuctionBidInput {
  readonly item: AuctionItem;
  readonly bids: AuctionBids;
  readonly history: AuctionBidHistory;
  readonly awards: AuctionAwards;
  readonly activeItemIds: readonly string[];
  readonly studentNumber: number;
  readonly amount: number;
  readonly balance: number;
  readonly window: AuctionSealedWindow | null;
}

/**
 * Open bidding needs one coin over the lead. During lunch a bid needs one coin over the lead shown
 * from before lunch, and over the student's own lunch bid, which can be raised but never lowered.
 */
export const getAuctionBidMinimum = (
  input: Pick<AuctionBidInput, 'item' | 'bids' | 'history' | 'studentNumber' | 'window'>,
): number => {
  const { item, window } = input;
  if (!window) return getMinimumAuctionBid(item, input.bids[item.id]?.amount ?? 0);
  const before = getAuctionLeadBeforeWindow(input.history, item.id, window);
  const own = getOwnWindowBidAmount(input.history, item.id, input.studentNumber, window);
  return Math.max(getMinimumAuctionBid(item, before?.amount ?? 0), own === null ? 0 : own + 1);
};

/** Shared by the server command and the student screen so both reject the same bids. */
export const checkAuctionBid = (input: AuctionBidInput): AuctionBidRejection | null => {
  const { item, studentNumber, amount, window } = input;
  if (input.awards[item.id]) return 'ALREADY_AWARDED';
  if (!window && input.bids[item.id]?.bidder === studentNumber) return 'ALREADY_HIGHEST_BIDDER';
  if (amount < getAuctionBidMinimum(input)) return 'BID_TOO_LOW';
  // Equal lunch bids are allowed; the earlier one keeps the lead.
  if (!window && hasAuctionBidAmount(input.history, item.id, amount)) return 'DUPLICATE_BID_AMOUNT';
  const reserved = getStudentReservedAuctionAmount({ ...input, excludedItemId: item.id });
  return amount > input.balance - reserved ? 'INSUFFICIENT_FUNDS' : null;
};

/** A lunch bid only takes the lead when it beats the current lead; ties keep the earlier bid. */
export const auctionBidTakesLead = (
  bids: AuctionBids, itemId: string, amount: number, window: AuctionSealedWindow | null,
): boolean => !window || amount > (bids[itemId]?.amount ?? 0);

/**
 * During lunch a student sees each item's lead from before lunch and, of the lunch bids, only their
 * own. A lead is rebuilt only for items whose bid history is in `value`; other items' leads are left
 * out, so a partial read never sends a lunch lead and the browser keeps what it already has.
 */
export const redactSealedAuctionForStudent = (
  value: Record<string, unknown>, studentNumber: number, window: AuctionSealedWindow | null,
): Record<string, unknown> => {
  if (!window || (!('auctionBids' in value) && !('auctionBidHistory' in value))) return value;
  const rawHistory = isRecord(value.auctionBidHistory) ? value.auctionBidHistory : {};
  const next = { ...value };
  if (isRecord(value.auctionBids)) {
    next.auctionBids = Object.fromEntries(Object.keys(value.auctionBids).flatMap(itemId => {
      const entries = rawHistory[itemId];
      if (!Array.isArray(entries)) return [];
      const history: AuctionBidHistory = { [itemId]: entries.flatMap(entry => (
        isRecord(entry) && typeof entry.bidder === 'number' && typeof entry.amount === 'number'
          ? [{ itemId, bidder: entry.bidder, amount: entry.amount, createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '' }]
          : []
      )) };
      return [[itemId, getAuctionLeadBeforeWindow(history, itemId, window) ?? { amount: 0, bidder: null }]];
    }));
  }
  if (isRecord(value.auctionBidHistory)) {
    next.auctionBidHistory = Object.fromEntries(Object.entries(value.auctionBidHistory).map(([itemId, entries]) => [
      itemId, Array.isArray(entries) ? entries.filter(entry => isRecord(entry) && (
        entry.bidder === studentNumber || typeof entry.createdAt !== 'string' || !isInWindow(entry.createdAt, window)
      )) : entries,
    ]));
  }
  return next;
};

/** Redaction for a student response, using the timetable carried by the same value. */
export const redactAuctionForStudentNow = (
  value: Record<string, unknown>, studentNumber: number, nowMs = Date.now(),
): Record<string, unknown> => redactSealedAuctionForStudent(value, studentNumber,
  getAuctionSealedWindow(nowMs, value.weeklySchedule, value.scheduleClockOffsetSeconds));
