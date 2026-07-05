export type CurrencyBalances = Record<string, number>;
export interface AuctionBid {
  amount: number;
  bidder: number | null;
}

export interface AuctionItem {
  id: string;
  name: string;
  startPrice: number;
  dayIndex: number;
}

export interface AuctionMission {
  id: string;
  content: string;
  rewardAmount: number;
}

export type AuctionBids = Record<string, AuctionBid>;

export interface AuctionBidHistoryEntry {
  itemId: string;
  bidder: number;
  amount: number;
  createdAt: string;
}

export type AuctionBidHistory = Record<string, AuctionBidHistoryEntry[]>;

export interface AuctionAward {
  itemId: string;
  winner: number;
  amount: number;
  awardedAt: string;
}

export type AuctionAwards = Record<string, AuctionAward | null>;

export const CURRENCY_STUDENT_NUMBERS = Array.from({ length: 23 }, (_, index) => index + 1);
export const DEFAULT_CURRENCY_BALANCE = 100;
export const WEEKLY_CURRENCY_ALLOWANCE = 100;
export const CURRENCY_BALANCE_MIN = 0;
export const CURRENCY_BALANCE_MAX = 999999;
export const CURRENCY_BALANCE_STEP = 5;
export const CURRENCY_UNIT_LABEL = '고마';
export const AUCTION_BID_STEP = 1;
export const AUCTION_MISSIONS_STORAGE_KEY = 'auctionMissions-v1';
export const AUCTION_MISSION_CONTENT_MAX_LENGTH = 80;
export const AUCTION_WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];
export const AUCTION_WEEKDAY_NAMES = ['월요일', '화요일', '수요일', '목요일', '금요일'];
export const AUCTION_DAY_ACCENTS = [
  { border: '#9CCDBE', soft: '#F6FBF8', chip: '#007A57' },
  { border: '#E1C38F', soft: '#FFFBF3', chip: '#9A6418' },
  { border: '#9CCFDA', soft: '#F6FCFD', chip: '#1C7D88' },
  { border: '#BFADE0', soft: '#FBF9FE', chip: '#6A4B9B' },
  { border: '#E3AAA5', soft: '#FFFAF9', chip: '#A34F45' },
] as const;
export const DEFAULT_AUCTION_ITEM_COUNT = AUCTION_WEEKDAY_LABELS.length;
export const AUCTION_MAX_ITEMS_PER_DAY = 4;
export const AUCTION_MAX_ITEM_COUNT = 20;
const AUCTION_LEGACY_ITEM_IDS = ['item-a', 'item-b', 'item-c', 'item-d', 'item-e'];

export const createAuctionItemTemplate = (dayIndex: number, slotIndex: number): AuctionItem => {
  const normalizedDayIndex = Math.max(0, Math.min(AUCTION_WEEKDAY_LABELS.length - 1, dayIndex));
  const normalizedSlotIndex = Math.max(0, Math.min(AUCTION_MAX_ITEMS_PER_DAY - 1, slotIndex));

  return {
    id: normalizedSlotIndex === 0
      ? AUCTION_LEGACY_ITEM_IDS[normalizedDayIndex] ?? `item-${normalizedDayIndex + 1}-1`
      : `item-${normalizedDayIndex + 1}-${normalizedSlotIndex + 1}`,
    name: normalizedSlotIndex === 0
      ? '물품'
      : `물품 ${normalizedSlotIndex + 1}`,
    startPrice: 10,
    dayIndex: normalizedDayIndex,
  };
};
export const AUCTION_ITEM_TEMPLATES: AuctionItem[] = AUCTION_WEEKDAY_LABELS.flatMap((_, dayIndex) =>
  Array.from({ length: AUCTION_MAX_ITEMS_PER_DAY }, (_slot, slotIndex) =>
    createAuctionItemTemplate(dayIndex, slotIndex),
  ),
);
export const DEFAULT_AUCTION_ITEMS: AuctionItem[] = AUCTION_WEEKDAY_LABELS.map((_, dayIndex) =>
  createAuctionItemTemplate(dayIndex, 0),
);
export const AUCTION_ITEM_IDS = AUCTION_ITEM_TEMPLATES.map((item) => item.id);
export const STUDENT_LABEL_COLORS = [
  '#2F6F73',
  '#315E9B',
  '#A95545',
  '#7A5A9E',
  '#B2793A',
  '#4F7F52',
  '#8A4F76',
  '#3E7895',
  '#9A6642',
  '#5E6F9F',
  '#7A783C',
  '#A34D64',
  '#4D697E',
  '#6F5C8F',
  '#8D6A3D',
  '#59646A',
  '#8F4E86',
  '#5A7B63',
  '#4D7D88',
  '#76548A',
  '#9B5F3F',
  '#3F7A6B',
  '#6A5F58',
];

export const getStudentLabelStyle = (studentNumber: number) => ({
  backgroundColor: STUDENT_LABEL_COLORS[(studentNumber - 1) % STUDENT_LABEL_COLORS.length],
  color: '#FFFFFF',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.28)',
});

export const formatCurrency = (value: number) =>
  `${value.toLocaleString('ko-KR')} ${CURRENCY_UNIT_LABEL}`;

export const formatCurrencyAmount = (value: number) =>
  value.toLocaleString('ko-KR');

export const getAuctionItemDisplayName = (itemName: string, dayIndex: number) => {
  const weekdayName = AUCTION_WEEKDAY_NAMES[dayIndex];
  if (!weekdayName) return itemName;

  const prefix = `${weekdayName} `;
  if (!itemName.startsWith(prefix)) return itemName;

  const displayName = itemName.slice(prefix.length);
  return displayName.length > 0 ? displayName : itemName;
};

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

export const clampAuctionMissionRewardAmount = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(CURRENCY_BALANCE_MIN, Math.min(CURRENCY_BALANCE_MAX, Math.floor(numericValue)));
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

export const collectCurrencyTax = (balances: CurrencyBalances): CurrencyBalances =>
  CURRENCY_STUDENT_NUMBERS.reduce<CurrencyBalances>((nextBalances, studentNumber) => {
    const key = String(studentNumber);
    nextBalances[key] = clampCurrencyBalance(Math.ceil((balances[key] ?? DEFAULT_CURRENCY_BALANCE) / 2));
    return nextBalances;
  }, {});

export const grantWeeklyCurrencyAllowance = (balances: CurrencyBalances): CurrencyBalances =>
  CURRENCY_STUDENT_NUMBERS.reduce<CurrencyBalances>((nextBalances, studentNumber) => {
    const key = String(studentNumber);
    nextBalances[key] = clampCurrencyBalance((balances[key] ?? DEFAULT_CURRENCY_BALANCE) + WEEKLY_CURRENCY_ALLOWANCE);
    return nextBalances;
  }, {});

export const normalizeAuctionItems = (value: unknown): AuctionItem[] => {
  const parsedItems = Array.isArray(value) ? value : [];
  if (parsedItems.length === 0) return DEFAULT_AUCTION_ITEMS.map((item) => ({ ...item }));

  const usedIds = new Set<string>();
  const daySlotCounts = Array.from({ length: AUCTION_WEEKDAY_LABELS.length }, () => 0);
  const normalizedItems: AuctionItem[] = [];

  parsedItems.slice(0, AUCTION_MAX_ITEM_COUNT).forEach((rawItem, index) => {
    const item = rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    const rawDayIndex = typeof item.dayIndex === 'number'
      ? item.dayIndex
      : index < AUCTION_WEEKDAY_LABELS.length
        ? index
        : AUCTION_WEEKDAY_LABELS.length - 1;
    const dayIndex = Math.max(0, Math.min(AUCTION_WEEKDAY_LABELS.length - 1, Math.floor(rawDayIndex)));
    const slotIndex = daySlotCounts[dayIndex];
    if (slotIndex >= AUCTION_MAX_ITEMS_PER_DAY) return;

    daySlotCounts[dayIndex] += 1;
    const defaultItem = createAuctionItemTemplate(dayIndex, slotIndex);
    const rawId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : '';
    const fallbackItem = AUCTION_ITEM_TEMPLATES.find((template) => (
      template.dayIndex === dayIndex && !usedIds.has(template.id)
    ));
    const id = AUCTION_ITEM_IDS.includes(rawId) && !usedIds.has(rawId)
      ? rawId
      : !usedIds.has(defaultItem.id)
        ? defaultItem.id
        : fallbackItem?.id ?? defaultItem.id;
    usedIds.add(id);

    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim().slice(0, 24)
      : defaultItem.name;

    normalizedItems.push({
      id,
      name,
      startPrice: defaultItem.startPrice,
      dayIndex,
    });
  });

  return normalizedItems.length > 0 ? normalizedItems : DEFAULT_AUCTION_ITEMS.map((item) => ({ ...item }));
};

const getObjectField = (value: unknown, field: string): unknown => {
  if (!value || typeof value !== 'object' || !(field in value)) return undefined;
  return Reflect.get(value, field);
};

const createUniqueMissionId = (index: number, usedIds: ReadonlySet<string>) => {
  const baseId = `mission-${index + 1}`;
  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  let candidateId = `${baseId}-${suffix}`;
  while (usedIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${baseId}-${suffix}`;
  }
  return candidateId;
};

export const normalizeAuctionMissions = (value: unknown): AuctionMission[] => {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set<string>();
  const normalizedMissions: AuctionMission[] = [];

  value.forEach((rawMission, index) => {
    const rawContent = getObjectField(rawMission, 'content');
    const content = typeof rawContent === 'string'
      ? rawContent.trim().slice(0, AUCTION_MISSION_CONTENT_MAX_LENGTH)
      : '';
    if (!content) return;

    const rawId = getObjectField(rawMission, 'id');
    const trimmedId = typeof rawId === 'string' ? rawId.trim() : '';
    const id = trimmedId && !usedIds.has(trimmedId)
      ? trimmedId
      : createUniqueMissionId(index, usedIds);
    usedIds.add(id);

    normalizedMissions.push({
      id,
      content,
      rewardAmount: clampAuctionMissionRewardAmount(getObjectField(rawMission, 'rewardAmount')),
    });
  });

  return normalizedMissions;
};

export const getMinimumAuctionBid = (item: AuctionItem, currentAmount: number) => {
  const baseAmount = currentAmount > 0 ? currentAmount + AUCTION_BID_STEP : item.startPrice;
  return Math.max(item.startPrice, Math.ceil(baseAmount / AUCTION_BID_STEP) * AUCTION_BID_STEP);
};

export const getReservedAuctionBidAmount = (
  bids: AuctionBids,
  studentNumber: number,
  excludedItemId?: string,
  awards?: AuctionAwards,
  activeItemIds?: string[],
) =>
  Object.entries(bids).reduce((total, [itemId, bid]) => {
    if (activeItemIds && !activeItemIds.includes(itemId)) return total;
    if (itemId === excludedItemId || bid.bidder !== studentNumber) return total;
    if (awards?.[itemId]) return total;
    return total + bid.amount;
  }, 0);

export const getAuctionVisibleItemCount = (date = new Date(), itemCount = AUCTION_MAX_ITEM_COUNT) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return 0;
  if (day === 5) return Math.min(itemCount, AUCTION_MAX_ITEM_COUNT);
  return Math.min(day, itemCount, AUCTION_MAX_ITEM_COUNT);
};

export const getAuctionVisibleDayCount = (date = new Date()) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return 0;
  return Math.min(day, AUCTION_WEEKDAY_LABELS.length);
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
      amount: clampAuctionBidAmount(bid.amount ?? 0),
      bidder,
    };
    return bids;
  }, {});
};

export const normalizeAuctionBidHistory = (value: unknown, itemIds: string[]): AuctionBidHistory => {
  const parsed = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return itemIds.reduce<AuctionBidHistory>((history, itemId) => {
    const rawEntries = Array.isArray(parsed[itemId]) ? parsed[itemId] : [];
    history[itemId] = rawEntries
      .map((rawEntry): AuctionBidHistoryEntry | null => {
        const entry = rawEntry && typeof rawEntry === 'object' ? (rawEntry as Record<string, unknown>) : {};
        const bidder = typeof entry.bidder === 'number' && CURRENCY_STUDENT_NUMBERS.includes(entry.bidder)
          ? entry.bidder
          : null;
        const amount = clampAuctionBidAmount(entry.amount ?? 0);
        const createdAt = typeof entry.createdAt === 'string' && entry.createdAt.trim()
          ? entry.createdAt
          : '';

        if (!bidder || amount <= 0) return null;

        return {
          itemId,
          bidder,
          amount,
          createdAt,
        };
      })
      .filter((entry): entry is AuctionBidHistoryEntry => entry !== null)
      .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
    return history;
  }, {});
};

export const normalizeAuctionAwards = (value: unknown, itemIds: string[]): AuctionAwards => {
  const parsed = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return itemIds.reduce<AuctionAwards>((awards, itemId) => {
    const rawAward = parsed[itemId];
    const award = rawAward && typeof rawAward === 'object' ? (rawAward as Record<string, unknown>) : {};
    const winner = typeof award.winner === 'number' && CURRENCY_STUDENT_NUMBERS.includes(award.winner)
      ? award.winner
      : null;
    const amount = clampAuctionBidAmount(award.amount ?? 0);
    const awardedAt = typeof award.awardedAt === 'string' && award.awardedAt.trim()
      ? award.awardedAt
      : '';

    awards[itemId] = winner && amount > 0
      ? {
          itemId,
          winner,
          amount,
          awardedAt,
        }
      : null;
    return awards;
  }, {});
};
