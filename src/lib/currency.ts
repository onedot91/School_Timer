export type CurrencyBalances = Record<string, number>;
export interface AuctionBid {
  amount: number;
  bidder: number | null;
}

export interface AuctionItem {
  id: string;
  name: string;
  startPrice: number;
}

export type AuctionBids = Record<string, AuctionBid>;

export const CURRENCY_STUDENT_NUMBERS = Array.from({ length: 23 }, (_, index) => index + 1);
export const DEFAULT_CURRENCY_BALANCE = 100;
export const CURRENCY_BALANCE_MIN = 0;
export const CURRENCY_BALANCE_MAX = 999999;
export const CURRENCY_UNIT_LABEL = '고마';
export const AUCTION_BID_STEP = 5;
export const DEFAULT_AUCTION_ITEMS: AuctionItem[] = [
  { id: 'item-a', name: 'A', startPrice: 10 },
  { id: 'item-b', name: 'B', startPrice: 10 },
  { id: 'item-c', name: 'C', startPrice: 10 },
  { id: 'item-d', name: 'D', startPrice: 10 },
  { id: 'item-e', name: 'E', startPrice: 10 },
];
export const AUCTION_ITEM_IDS = DEFAULT_AUCTION_ITEMS.map((item) => item.id);

export const formatCurrency = (value: number) =>
  `${value.toLocaleString('ko-KR')} ${CURRENCY_UNIT_LABEL}`;

export const formatCurrencyAmount = (value: number) =>
  value.toLocaleString('ko-KR');

export const clampCurrencyBalance = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_CURRENCY_BALANCE;
  return Math.max(CURRENCY_BALANCE_MIN, Math.min(CURRENCY_BALANCE_MAX, Math.floor(numericValue)));
};

export const clampAuctionBidAmount = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.floor(numericValue / AUCTION_BID_STEP) * AUCTION_BID_STEP);
};

export const createDefaultCurrencyBalances = (): CurrencyBalances =>
  CURRENCY_STUDENT_NUMBERS.reduce<CurrencyBalances>((balances, studentNumber) => {
    balances[String(studentNumber)] = DEFAULT_CURRENCY_BALANCE;
    return balances;
  }, {});

export const normalizeCurrencyBalances = (value: unknown): CurrencyBalances => {
  const parsed = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return CURRENCY_STUDENT_NUMBERS.reduce<CurrencyBalances>((balances, studentNumber) => {
    const key = String(studentNumber);
    balances[key] = key in parsed ? clampCurrencyBalance(parsed[key]) : DEFAULT_CURRENCY_BALANCE;
    return balances;
  }, {});
};

export const normalizeAuctionItems = (value: unknown): AuctionItem[] => {
  const parsedItems = Array.isArray(value) ? value : [];
  return DEFAULT_AUCTION_ITEMS.map((defaultItem, index) => {
    const rawItem = parsedItems[index];
    const item = rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim().slice(0, 24)
      : defaultItem.name;
    return {
      id: defaultItem.id,
      name,
      startPrice: clampAuctionBidAmount(item.startPrice ?? defaultItem.startPrice),
    };
  });
};

export const normalizeAuctionBids = (value: unknown, itemIds: string[]): AuctionBids => {
  const parsed = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return itemIds.reduce<AuctionBids>((bids, itemId) => {
    const rawBid = parsed[itemId];
    const bid = rawBid && typeof rawBid === 'object' ? (rawBid as Record<string, unknown>) : {};
    const bidder = typeof bid.bidder === 'number' && CURRENCY_STUDENT_NUMBERS.includes(bid.bidder)
      ? bid.bidder
      : null;
    bids[itemId] = {
      amount: clampCurrencyBalance(bid.amount ?? 0),
      bidder,
    };
    return bids;
  }, {});
};
