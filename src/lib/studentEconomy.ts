import type { CurrencyHistoryReason } from './currency';

export const STUDENT_ECONOMY_AMOUNT_STEP = 5;
export const STUDENT_ECONOMY_AMOUNT_MAX = 500;

export const STUDENT_CHARACTER_DRAW_PRICE = 100;
export const STUDENT_CUSTOM_HOUSE_COUPON_PRICE = 150;

export interface StudentShopCatalogItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export const DEFAULT_STUDENT_SHOP_CATALOG: StudentShopCatalogItem[] = [
  { id: 'pencil', name: '연필', price: 10, isActive: true },
  { id: 'snack', name: '간식 쿠폰', price: 25, isActive: true },
  { id: 'seat', name: '자리 선택권', price: 50, isActive: true },
];

export const STUDENT_SHOP_ITEMS = [
  { id: 'pencil', name: '연필', emoji: '✏️', price: 10 },
  { id: 'snack', name: '간식 쿠폰', emoji: '🍪', price: 25 },
  { id: 'seat', name: '자리 선택권', emoji: '🪑', price: 50 },
  { id: 'house_repair', name: '집 고치기', imageSrc: '/student-house-after.png', price: 100 },
] as const;

export const STUDENT_CHARACTER_PRIZES = [
  { id: 'character-1', name: '늑대 고마', imageSrc: '/goma-skins/늑대 고마.png' },
  { id: 'character-2', name: '돼지 고마', imageSrc: '/goma-skins/돼지 고마.png' },
  { id: 'character-3', name: '배드민턴 고마', imageSrc: '/goma-skins/배드민턴 고마.png' },
  { id: 'character-4', name: '상어 고마', imageSrc: '/goma-skins/상어 고마.png' },
  { id: 'character-5', name: '야구 고마', imageSrc: '/goma-skins/야구 고마.png' },
  { id: 'character-6', name: '여우 고마', imageSrc: '/goma-skins/여우 고마.png' },
  { id: 'character-7', name: '오리너구리 고마', imageSrc: '/goma-skins/오리너구리 고마.png' },
  { id: 'character-8', name: '축구 고마', imageSrc: '/goma-skins/축구 고마.png' },
  { id: 'character-9', name: '카멜레온 고마', imageSrc: '/goma-skins/카멜레온 고마.png' },
  { id: 'character-10', name: '피구 고마', imageSrc: '/goma-skins/피구 고마.png' },
  { id: 'character-11', name: '강아지 고마', imageSrc: '/goma-skins/강아지 고마.png' },
  { id: 'character-12', name: '고래 고마', imageSrc: '/goma-skins/고래 고마.png' },
  { id: 'character-13', name: '고릴라 고마', imageSrc: '/goma-skins/고릴라 고마.png' },
  { id: 'character-14', name: '고양이 고마', imageSrc: '/goma-skins/고양이 고마.png' },
  { id: 'character-15', name: '농구 고마', imageSrc: '/goma-skins/농구 고마.png' },
] as const;

export const STUDENT_HOUSE_DESIGNS = [
  { id: 'cozy-wood', name: '포근한 나무집', imageSrc: '/student-house-after.png', price: 100 },
] as const;

export const STUDENT_STOCKS = [
  { id: 'sunny', name: '햇살문구', emoji: '☀️', basePrice: 15 },
  { id: 'sprout', name: '새싹식품', emoji: '🌱', basePrice: 25 },
  { id: 'cloud', name: '구름운수', emoji: '☁️', basePrice: 35 },
  { id: 'star', name: '별빛미디어', emoji: '⭐', basePrice: 20 },
] as const;

export type StudentShopItemId = string;
export type StudentStockId = (typeof STUDENT_STOCKS)[number]['id'];
export type StudentCharacterPrizeId = (typeof STUDENT_CHARACTER_PRIZES)[number]['id'];
export type StudentHouseDesignId = (typeof STUDENT_HOUSE_DESIGNS)[number]['id'];
export type StudentCustomHouseTheme = 'natural' | 'blue' | 'green';

export interface StudentCustomHouseDesign {
  name: string;
  theme: StudentCustomHouseTheme;
}

export interface StudentEconomyState {
  deposit: number;
  savings: number;
  loan: number;
  inventory: Record<StudentShopItemId, number>;
  holdings: Partial<Record<StudentStockId, number>>;
  stockPurchases: Partial<Record<StudentStockId, StudentStockPurchase>>;
  ownedCharacterIds: StudentCharacterPrizeId[];
  activeCharacterId: StudentCharacterPrizeId | null;
  ownedHouseIds: StudentHouseDesignId[];
  activeHouseId: StudentHouseDesignId | 'custom' | null;
  hasCustomHouseCoupon: boolean;
  customHouseDesign: StudentCustomHouseDesign | null;
  processedRequestIds: string[];
}

export type StudentEconomyStates = Record<string, StudentEconomyState>;

export interface StudentStockPurchase {
  dateKey: string;
  price: number;
}

export interface StudentStockMarketEntry {
  dateKey: string;
  changeAmount: number;
  comment: string;
}

export type StudentStockMarket = Partial<Record<StudentStockId, StudentStockMarketEntry[]>>;

export type StudentEconomyAction =
  | { type: 'deposit'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'save'; amount: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'buy_item'; itemId: StudentShopItemId }
  | { type: 'draw_character' }
  | { type: 'select_character'; characterId: StudentCharacterPrizeId }
  | { type: 'buy_house'; houseId: StudentHouseDesignId }
  | { type: 'select_house'; houseId: StudentHouseDesignId }
  | { type: 'buy_custom_house_coupon' }
  | { type: 'register_custom_house'; name: string; theme: StudentCustomHouseTheme }
  | { type: 'buy_stock'; stockId: StudentStockId; dateKey: string }
  | { type: 'sell_stock'; stockId: StudentStockId; dateKey: string };

export interface StudentEconomyResult {
  state: StudentEconomyState;
  wallet: number;
  reason: CurrencyHistoryReason;
  message: string;
  applied: boolean;
}

const MAX_PROCESSED_REQUESTS = 24;
const MAX_STOCK_MARKET_HISTORY = 30;
const STOCK_IDS = new Set<string>(STUDENT_STOCKS.map((stock) => stock.id));
const CHARACTER_IDS = new Set<string>(STUDENT_CHARACTER_PRIZES.map((character) => character.id));
const HOUSE_IDS = new Set<string>(STUDENT_HOUSE_DESIGNS.map((house) => house.id));

const clampAmount = (value: unknown) => {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.min(999_999, Math.floor(amount))) : 0;
};

const normalizeCountMap = <T extends string>(value: unknown, allowed: Set<string>) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.entries(source).reduce<Partial<Record<T, number>>>((result, [key, count]) => {
    if (allowed.has(key)) result[key as T] = clampAmount(count);
    return result;
  }, {});
};

const normalizeInventory = (value: unknown) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.entries(source).reduce<Record<string, number>>((result, [key, count]) => {
    if (/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) result[key] = clampAmount(count);
    return result;
  }, {});
};

const normalizeIdList = <T extends string>(value: unknown, allowed: Set<string>) => (
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is T => typeof id === 'string' && allowed.has(id)))]
    : []
);

const normalizeStockMarketEntry = (value: unknown): StudentStockMarketEntry | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const dateKey = typeof source.dateKey === 'string' ? source.dateKey : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const rawAmount = typeof source.changeAmount === 'number'
    ? source.changeAmount
    : Number(source.changeAmount ?? source.changePercent);
  const changeAmount = Number.isFinite(rawAmount)
    ? Math.max(-20, Math.min(20, Math.round(rawAmount)))
    : 0;
  const comment = typeof source.comment === 'string' ? source.comment.trim().slice(0, 120) : '';
  return { dateKey, changeAmount, comment };
};

export const normalizeStudentStockMarket = (value: unknown): StudentStockMarket => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return STUDENT_STOCKS.reduce<StudentStockMarket>((market, stock) => {
    const entries = Array.isArray(source[stock.id]) ? source[stock.id] as unknown[] : [];
    const uniqueEntries = new Map<string, StudentStockMarketEntry>();
    entries.forEach((entry) => {
      const normalized = normalizeStockMarketEntry(entry);
      if (normalized) uniqueEntries.set(normalized.dateKey, normalized);
    });
    market[stock.id] = [...uniqueEntries.values()]
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
      .slice(0, MAX_STOCK_MARKET_HISTORY);
    return market;
  }, {});
};

export const upsertStudentStockMarketEntry = (
  value: unknown,
  stockId: StudentStockId,
  entry: StudentStockMarketEntry,
) => {
  const market = normalizeStudentStockMarket(value);
  return normalizeStudentStockMarket({
    ...market,
    [stockId]: [...(market[stockId] ?? []), entry],
  });
};

const STUDENT_STOCK_MARKET_STORAGE_KEY = 'school-timer-student-stock-market-v1';

export const loadStoredStudentStockMarket = () => {
  if (typeof window === 'undefined') return normalizeStudentStockMarket(undefined);
  try {
    const raw = window.localStorage.getItem(STUDENT_STOCK_MARKET_STORAGE_KEY);
    return raw === null ? normalizeStudentStockMarket(undefined) : normalizeStudentStockMarket(JSON.parse(raw));
  } catch {
    return normalizeStudentStockMarket(undefined);
  }
};

export const storeStudentStockMarket = (market: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STUDENT_STOCK_MARKET_STORAGE_KEY, JSON.stringify(normalizeStudentStockMarket(market)));
};

export const normalizeStudentShopCatalog = (value: unknown): StudentShopCatalogItem[] => {
  if (!Array.isArray(value)) return DEFAULT_STUDENT_SHOP_CATALOG.map((item) => ({ ...item }));
  const normalized = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const source = entry as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const name = typeof source.name === 'string' ? source.name.trim().slice(0, 30) : '';
    const price = clampAmount(source.price);
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !name || price < 1) return [];
    return [{ id, name, price, isActive: source.isActive !== false }];
  });
  return normalized.slice(0, 24);
};

const STUDENT_SHOP_CATALOG_STORAGE_KEY = 'school-timer-student-shop-catalog-v1';

export const loadStoredStudentShopCatalog = () => {
  if (typeof window === 'undefined') return normalizeStudentShopCatalog(undefined);
  try {
    const raw = window.localStorage.getItem(STUDENT_SHOP_CATALOG_STORAGE_KEY);
    return raw === null ? normalizeStudentShopCatalog(undefined) : normalizeStudentShopCatalog(JSON.parse(raw));
  } catch {
    return normalizeStudentShopCatalog(undefined);
  }
};

export const storeStudentShopCatalog = (catalog: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STUDENT_SHOP_CATALOG_STORAGE_KEY, JSON.stringify(normalizeStudentShopCatalog(catalog)));
};

export const createStudentEconomyState = (): StudentEconomyState => ({
  deposit: 0,
  savings: 0,
  loan: 0,
  inventory: {},
  holdings: {},
  stockPurchases: {},
  ownedCharacterIds: [],
  activeCharacterId: null,
  ownedHouseIds: [],
  activeHouseId: null,
  hasCustomHouseCoupon: false,
  customHouseDesign: null,
  processedRequestIds: [],
});

export const normalizeStudentEconomyState = (value: unknown): StudentEconomyState => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    deposit: clampAmount(source.deposit),
    savings: clampAmount(source.savings),
    loan: clampAmount(source.loan),
    inventory: normalizeInventory(source.inventory),
    holdings: normalizeCountMap<StudentStockId>(source.holdings, STOCK_IDS),
    stockPurchases: normalizeStudentStockPurchases(source.stockPurchases),
    ownedCharacterIds: normalizeIdList<StudentCharacterPrizeId>(source.ownedCharacterIds, CHARACTER_IDS),
    activeCharacterId: typeof source.activeCharacterId === 'string' && CHARACTER_IDS.has(source.activeCharacterId)
      ? source.activeCharacterId as StudentCharacterPrizeId
      : null,
    ownedHouseIds: normalizeIdList<StudentHouseDesignId>(source.ownedHouseIds, HOUSE_IDS),
    activeHouseId: source.activeHouseId === 'custom' || (typeof source.activeHouseId === 'string' && HOUSE_IDS.has(source.activeHouseId))
      ? source.activeHouseId as StudentHouseDesignId | 'custom'
      : null,
    hasCustomHouseCoupon: source.hasCustomHouseCoupon === true,
    customHouseDesign: source.customHouseDesign && typeof source.customHouseDesign === 'object' && !Array.isArray(source.customHouseDesign)
      && typeof (source.customHouseDesign as Record<string, unknown>).name === 'string'
      && ['natural', 'blue', 'green'].includes(String((source.customHouseDesign as Record<string, unknown>).theme))
      ? {
          name: String((source.customHouseDesign as Record<string, unknown>).name).trim().slice(0, 20),
          theme: (source.customHouseDesign as Record<string, unknown>).theme as StudentCustomHouseTheme,
        }
      : null,
    processedRequestIds: Array.isArray(source.processedRequestIds)
      ? source.processedRequestIds.filter((id): id is string => typeof id === 'string').slice(-MAX_PROCESSED_REQUESTS)
      : [],
  };
};

export const normalizeStudentEconomyStates = (value: unknown): StudentEconomyStates => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.entries(source).reduce<StudentEconomyStates>((states, [studentKey, state]) => {
    if (/^(?:[1-9]|1\d|2[0-3])$/.test(studentKey)) states[studentKey] = normalizeStudentEconomyState(state);
    return states;
  }, {});
};

export const getStudentEconomyState = (states: unknown, studentNumber: number) => (
  normalizeStudentEconomyStates(states)[String(studentNumber)] ?? createStudentEconomyState()
);

const hashText = (value: string) => Array.from(value).reduce((hash, character) => (
  (hash * 31 + character.charCodeAt(0)) >>> 0
), 7);

export const getDailyStockQuotes = (dateKey: string, marketValue?: unknown) => {
  const market = normalizeStudentStockMarket(marketValue);
  return STUDENT_STOCKS.map((stock) => {
    const history = (market[stock.id] ?? []).filter((entry) => entry.dateKey <= dateKey);
    const currentEntry = history.find((entry) => entry.dateKey === dateKey) ?? null;
    return {
      ...stock,
      price: stock.basePrice,
      changeAmount: currentEntry?.changeAmount ?? 0,
      comment: currentEntry?.comment ?? '',
      history,
    };
  });
};

const normalizeStudentStockPurchases = (value: unknown) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return STUDENT_STOCKS.reduce<Partial<Record<StudentStockId, StudentStockPurchase>>>((purchases, stock) => {
    const rawPurchase = source[stock.id];
    if (!rawPurchase || typeof rawPurchase !== 'object' || Array.isArray(rawPurchase)) return purchases;
    const purchase = rawPurchase as Record<string, unknown>;
    const dateKey = typeof purchase.dateKey === 'string' ? purchase.dateKey : '';
    const price = clampAmount(purchase.price);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && price > 0) purchases[stock.id] = { dateKey, price };
    return purchases;
  }, {});
};

const assertTransactionAmount = (amount: number) => {
  if (!Number.isInteger(amount) || amount < STUDENT_ECONOMY_AMOUNT_STEP || amount > STUDENT_ECONOMY_AMOUNT_MAX) {
    throw new Error('INVALID_ECONOMY_AMOUNT');
  }
};

export const applyStudentEconomyAction = ({
  state: rawState,
  action,
  wallet,
  availableWallet,
  requestId,
  shopCatalog,
  stockMarket,
}: {
  state: unknown;
  action: StudentEconomyAction;
  wallet: number;
  availableWallet: number;
  requestId: string;
  shopCatalog?: unknown;
  stockMarket?: unknown;
}): StudentEconomyResult => {
  const state = normalizeStudentEconomyState(rawState);
  if (state.processedRequestIds.includes(requestId)) {
    return { state, wallet, reason: 'bank_transfer', message: '이미 처리되었습니다.', applied: false };
  }

  let nextState = state;
  let nextWallet = wallet;
  let reason: CurrencyHistoryReason = 'bank_transfer';
  let message = '';
  const spend = (amount: number) => {
    if (availableWallet < amount) throw new Error('INSUFFICIENT_AVAILABLE_CURRENCY');
    nextWallet -= amount;
  };

  if (action.type === 'deposit' || action.type === 'save') {
    assertTransactionAmount(action.amount);
    spend(action.amount);
    nextState = { ...state, [action.type === 'deposit' ? 'deposit' : 'savings']: state[action.type === 'deposit' ? 'deposit' : 'savings'] + action.amount };
    message = `${action.amount} 고마를 맡겼습니다.`;
  } else if (action.type === 'withdraw') {
    assertTransactionAmount(action.amount);
    if (state.deposit < action.amount) throw new Error('INSUFFICIENT_BANK_BALANCE');
    nextWallet += action.amount;
    nextState = { ...state, deposit: state.deposit - action.amount };
    message = `${action.amount} 고마를 찾았습니다.`;
  } else if (action.type === 'borrow') {
    assertTransactionAmount(action.amount);
    nextWallet += action.amount;
    nextState = { ...state, loan: state.loan + action.amount };
    message = `${action.amount} 고마를 빌렸습니다.`;
  } else if (action.type === 'repay') {
    assertTransactionAmount(action.amount);
    if (state.loan < action.amount) throw new Error('EXCESSIVE_LOAN_REPAYMENT');
    spend(action.amount);
    nextState = { ...state, loan: state.loan - action.amount };
    message = `${action.amount} 고마를 갚았습니다.`;
  } else if (action.type === 'buy_item') {
    const item = STUDENT_SHOP_ITEMS.find((candidate) => candidate.id === action.itemId)
      ?? normalizeStudentShopCatalog(shopCatalog).find((candidate) => candidate.id === action.itemId && candidate.isActive);
    if (!item) throw new Error('UNKNOWN_SHOP_ITEM');
    if (item.id === 'house_repair' && (state.inventory.house_repair ?? 0) > 0) {
      throw new Error('HOUSE_ALREADY_REPAIRED');
    }
    spend(item.price);
    reason = 'shop_purchase';
    nextState = { ...state, inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] ?? 0) + 1 } };
    message = `${item.name}을(를) 샀습니다.`;
  } else if (action.type === 'draw_character') {
    const remaining = STUDENT_CHARACTER_PRIZES.filter((character) => !state.ownedCharacterIds.includes(character.id));
    if (remaining.length < 1) throw new Error('ALL_CHARACTERS_OWNED');
    spend(STUDENT_CHARACTER_DRAW_PRICE);
    const character = remaining[hashText(requestId) % remaining.length];
    reason = 'shop_purchase';
    nextState = {
      ...state,
      ownedCharacterIds: [...state.ownedCharacterIds, character.id],
      activeCharacterId: character.id,
    };
    message = `${character.name} 스킨을 뽑았습니다.`;
  } else if (action.type === 'select_character') {
    if (!state.ownedCharacterIds.includes(action.characterId)) throw new Error('CHARACTER_NOT_OWNED');
    nextState = { ...state, activeCharacterId: action.characterId };
    message = '고마 스킨을 바꿨습니다.';
  } else if (action.type === 'buy_house') {
    if ((state.inventory.house_repair ?? 0) < 1) throw new Error('HOUSE_SHOP_LOCKED');
    const house = STUDENT_HOUSE_DESIGNS.find((candidate) => candidate.id === action.houseId);
    if (!house) throw new Error('UNKNOWN_HOUSE');
    if (state.ownedHouseIds.includes(house.id)) throw new Error('HOUSE_ALREADY_OWNED');
    spend(house.price);
    reason = 'shop_purchase';
    nextState = { ...state, ownedHouseIds: [...state.ownedHouseIds, house.id], activeHouseId: house.id };
    message = `${house.name}을(를) 샀습니다.`;
  } else if (action.type === 'select_house') {
    if (!state.ownedHouseIds.includes(action.houseId)) throw new Error('HOUSE_NOT_OWNED');
    nextState = { ...state, activeHouseId: action.houseId };
    message = '집을 바꿨습니다.';
  } else if (action.type === 'buy_custom_house_coupon') {
    if ((state.inventory.house_repair ?? 0) < 1) throw new Error('HOUSE_SHOP_LOCKED');
    if (state.hasCustomHouseCoupon) throw new Error('CUSTOM_HOUSE_COUPON_OWNED');
    spend(STUDENT_CUSTOM_HOUSE_COUPON_PRICE);
    reason = 'shop_purchase';
    nextState = { ...state, hasCustomHouseCoupon: true };
    message = '집 만들기 쿠폰을 샀습니다.';
  } else if (action.type === 'register_custom_house') {
    if (!state.hasCustomHouseCoupon) throw new Error('CUSTOM_HOUSE_COUPON_REQUIRED');
    const name = action.name.trim().slice(0, 20);
    if (!name) throw new Error('CUSTOM_HOUSE_NAME_REQUIRED');
    nextState = { ...state, customHouseDesign: { name, theme: action.theme }, activeHouseId: 'custom' };
    message = `${name} 디자인을 적용했습니다.`;
  } else if (action.type === 'buy_stock') {
    const quote = getDailyStockQuotes(action.dateKey, stockMarket).find((candidate) => candidate.id === action.stockId);
    if (!quote) throw new Error('UNKNOWN_STOCK');
    reason = 'stock_trade';
    if ((state.holdings[quote.id] ?? 0) > 0) throw new Error('STOCK_ALREADY_OWNED');
    spend(quote.price);
    nextState = {
      ...state,
      holdings: { ...state.holdings, [quote.id]: 1 },
      stockPurchases: { ...state.stockPurchases, [quote.id]: { dateKey: action.dateKey, price: quote.price } },
    };
    message = `${quote.name} 1주를 샀습니다.`;
  } else {
    const quote = getDailyStockQuotes(action.dateKey, stockMarket).find((candidate) => candidate.id === action.stockId);
    if (!quote) throw new Error('UNKNOWN_STOCK');
    if ((state.holdings[quote.id] ?? 0) < 1) throw new Error('STOCK_NOT_OWNED');
    const purchasePrice = state.stockPurchases[quote.id]?.price ?? quote.price;
    const nextHoldings = { ...state.holdings };
    const nextPurchases = { ...state.stockPurchases };
    delete nextHoldings[quote.id];
    delete nextPurchases[quote.id];
    reason = 'stock_trade';
    nextWallet += Math.max(0, purchasePrice + quote.changeAmount);
    nextState = { ...state, holdings: nextHoldings, stockPurchases: nextPurchases };
    message = `${quote.name} 1주를 팔았습니다.`;
  }

  return {
    state: {
      ...nextState,
      processedRequestIds: [...state.processedRequestIds, requestId].slice(-MAX_PROCESSED_REQUESTS),
    },
    wallet: nextWallet,
    reason,
    message,
    applied: true,
  };
};
