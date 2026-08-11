import type { CurrencyHistoryReason } from './currency';

export const STUDENT_ECONOMY_AMOUNT_STEP = 5;
export const STUDENT_ECONOMY_AMOUNT_MAX = 500;

export const STUDENT_SHOP_ITEMS = [
  { id: 'pencil', name: '연필', emoji: '✏️', price: 10 },
  { id: 'snack', name: '간식 쿠폰', emoji: '🍪', price: 25 },
  { id: 'seat', name: '자리 선택권', emoji: '🪑', price: 50 },
  { id: 'house_repair', name: '집 고치기', imageSrc: '/student-house-after.png', price: 100 },
] as const;

export const STUDENT_STOCKS = [
  { id: 'sunny', name: '햇살문구', emoji: '☀️', basePrice: 15 },
  { id: 'sprout', name: '새싹식품', emoji: '🌱', basePrice: 25 },
  { id: 'cloud', name: '구름운수', emoji: '☁️', basePrice: 35 },
] as const;

export type StudentShopItemId = (typeof STUDENT_SHOP_ITEMS)[number]['id'];
export type StudentStockId = (typeof STUDENT_STOCKS)[number]['id'];

export interface StudentEconomyState {
  deposit: number;
  savings: number;
  loan: number;
  inventory: Partial<Record<StudentShopItemId, number>>;
  holdings: Partial<Record<StudentStockId, number>>;
  processedRequestIds: string[];
}

export type StudentEconomyStates = Record<string, StudentEconomyState>;

export type StudentEconomyAction =
  | { type: 'deposit'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'save'; amount: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'buy_item'; itemId: StudentShopItemId }
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
const SHOP_ITEM_IDS = new Set<string>(STUDENT_SHOP_ITEMS.map((item) => item.id));
const STOCK_IDS = new Set<string>(STUDENT_STOCKS.map((stock) => stock.id));

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

export const createStudentEconomyState = (): StudentEconomyState => ({
  deposit: 0,
  savings: 0,
  loan: 0,
  inventory: {},
  holdings: {},
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
    inventory: normalizeCountMap<StudentShopItemId>(source.inventory, SHOP_ITEM_IDS),
    holdings: normalizeCountMap<StudentStockId>(source.holdings, STOCK_IDS),
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

export const getDailyStockQuotes = (dateKey: string) => STUDENT_STOCKS.map((stock) => {
  const todayOffset = (hashText(`${dateKey}-${stock.id}`) % 11) - 5;
  const previousOffset = (hashText(`${dateKey}-previous-${stock.id}`) % 11) - 5;
  const price = Math.max(5, stock.basePrice + todayOffset);
  const previousPrice = Math.max(5, stock.basePrice + previousOffset);
  return { ...stock, price, change: price - previousPrice };
});

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
}: {
  state: unknown;
  action: StudentEconomyAction;
  wallet: number;
  availableWallet: number;
  requestId: string;
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
    const item = STUDENT_SHOP_ITEMS.find((candidate) => candidate.id === action.itemId);
    if (!item) throw new Error('UNKNOWN_SHOP_ITEM');
    if (item.id === 'house_repair' && (state.inventory.house_repair ?? 0) > 0) {
      throw new Error('HOUSE_ALREADY_REPAIRED');
    }
    spend(item.price);
    reason = 'shop_purchase';
    nextState = { ...state, inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] ?? 0) + 1 } };
    message = `${item.name}을(를) 샀습니다.`;
  } else {
    const quote = getDailyStockQuotes(action.dateKey).find((candidate) => candidate.id === action.stockId);
    if (!quote) throw new Error('UNKNOWN_STOCK');
    reason = 'stock_trade';
    const currentCount = state.holdings[quote.id] ?? 0;
    if (action.type === 'buy_stock') {
      spend(quote.price);
      nextWallet = wallet - quote.price;
      nextState = { ...state, holdings: { ...state.holdings, [quote.id]: currentCount + 1 } };
      message = `${quote.name} 1주를 샀습니다.`;
    } else {
      if (currentCount < 1) throw new Error('NO_STOCK_HOLDING');
      nextWallet += quote.price;
      nextState = { ...state, holdings: { ...state.holdings, [quote.id]: currentCount - 1 } };
      message = `${quote.name} 1주를 팔았습니다.`;
    }
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
