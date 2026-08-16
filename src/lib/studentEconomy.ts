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
  { id: 'character-16', name: '사마귀 고마', imageSrc: '/goma-skins/mantis-goma.png' },
  { id: 'character-17', name: '배추흰나비 고마', imageSrc: '/goma-skins/cabbage-butterfly-goma.png' },
  { id: 'character-18', name: '몽타주 고마', imageSrc: '/goma-skins/montage-goma.png' },
  { id: 'character-19', name: '냉장고 고마', imageSrc: '/goma-skins/refrigerator-goma.png' },
  { id: 'character-20', name: '거꾸로 고마', imageSrc: '/goma-skins/upside-down-goma.png' },
  { id: 'character-21', name: '3D 고마', imageSrc: '/goma-skins/three-dimensional-goma.png' },
  { id: 'character-22', name: '책상 고마', imageSrc: '/goma-skins/desk-goma.png' },
  { id: 'character-23', name: '점묘법 고마', imageSrc: '/goma-skins/stipple-goma.png' },
  { id: 'character-24', name: '장수풍뎅이 고마', imageSrc: '/goma-skins/stag-beetle-goma.png' },
  { id: 'character-25', name: '컷아웃 고마', imageSrc: '/goma-skins/cutout-goma.png' },
  { id: 'character-26', name: '카피바라 고마', imageSrc: '/goma-skins/capybara-goma.png' },
  { id: 'character-27', name: '오리 고마', imageSrc: '/goma-skins/duck-goma.png' },
  { id: 'character-28', name: '선풍기 고마', imageSrc: '/goma-skins/fan-goma.png' },
  { id: 'character-29', name: '칠판 고마', imageSrc: '/goma-skins/chalkboard-goma.png' },
  { id: 'character-30', name: '청소기 고마', imageSrc: '/goma-skins/vacuum-goma.png' },
  { id: 'character-31', name: '사슴벌레 고마', imageSrc: '/goma-skins/beetle-goma.png' },
  { id: 'character-32', name: '간호사 고마', imageSrc: '/goma-skins/nurse-goma.png' },
  { id: 'character-33', name: '경찰관 고마', imageSrc: '/goma-skins/police-goma.png' },
  { id: 'character-34', name: '고전 게임 고마', imageSrc: '/goma-skins/retro-game-goma.png' },
  { id: 'character-35', name: '골판지 고마', imageSrc: '/goma-skins/cardboard-goma.png' },
  { id: 'character-36', name: '과학자 고마', imageSrc: '/goma-skins/scientist-goma.png' },
  { id: 'character-37', name: '교사 고마', imageSrc: '/goma-skins/teacher-goma.png' },
  { id: 'character-38', name: '구름 고마', imageSrc: '/goma-skins/cloud-goma.png' },
  { id: 'character-39', name: '군인 고마', imageSrc: '/goma-skins/soldier-goma.png' },
  { id: 'character-40', name: '금속 고마', imageSrc: '/goma-skins/metal-goma.png' },
  { id: 'character-41', name: '나무 고마', imageSrc: '/goma-skins/wood-goma.png' },
  { id: 'character-42', name: '리코더 고마', imageSrc: '/goma-skins/recorder-goma.png' },
  { id: 'character-43', name: '무지개 고마', imageSrc: '/goma-skins/rainbow-goma.png' },
  { id: 'character-44', name: '물 고마', imageSrc: '/goma-skins/water-goma.png' },
  { id: 'character-45', name: '바람 고마', imageSrc: '/goma-skins/wind-goma.png' },
  { id: 'character-46', name: '바이올린 고마', imageSrc: '/goma-skins/violin-goma.png' },
  { id: 'character-47', name: '불 고마', imageSrc: '/goma-skins/fire-goma.png' },
  { id: 'character-48', name: '색종이 고마', imageSrc: '/goma-skins/origami-goma.png' },
  { id: 'character-49', name: '소방관 고마', imageSrc: '/goma-skins/firefighter-goma.png' },
  { id: 'character-50', name: '얼음 고마', imageSrc: '/goma-skins/ice-goma.png' },
  { id: 'character-51', name: '우쿨렐레 고마', imageSrc: '/goma-skins/ukulele-goma.png' },
  { id: 'character-52', name: '유리 고마', imageSrc: '/goma-skins/glass-goma.png' },
  { id: 'character-53', name: '의사 고마', imageSrc: '/goma-skins/doctor-goma.png' },
  { id: 'character-54', name: '전기 고마', imageSrc: '/goma-skins/electric-goma.png' },
  { id: 'character-55', name: '제빵사 고마', imageSrc: '/goma-skins/baker-goma.png' },
  { id: 'character-56', name: '피아노 고마', imageSrc: '/goma-skins/piano-goma.png' },
] as const;

export const DEFAULT_STUDENT_CHARACTER = {
  id: null,
  name: '기본 고마',
  imageSrc: '/goma-canvas-character.png',
} as const;

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
export type StudentInvestmentStage = 'big_rise' | 'rise' | 'flat' | 'fall' | 'big_fall';
export type StudentInvestmentRounding = 'round' | 'floor' | 'ceil';
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
  investments: Partial<Record<StudentStockId, StudentInvestmentPosition>>;
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

export interface StudentInvestmentPosition {
  investedAmount: number;
  currentAmount: number;
  lastSettledDateKey: string;
  lastChangeAmount: number;
  lastStage: StudentInvestmentStage;
}

export interface StudentInvestmentSettings {
  multipliers: Record<StudentInvestmentStage, number>;
  rounding: StudentInvestmentRounding;
  minimumAmount: number;
  maximumAmount: number;
}

export const DEFAULT_STUDENT_INVESTMENT_SETTINGS: StudentInvestmentSettings = {
  multipliers: { big_rise: 1.2, rise: 1.1, flat: 1, fall: 0.9, big_fall: 0.8 },
  rounding: 'round',
  minimumAmount: 5,
  maximumAmount: 500,
};

const INVESTMENT_STAGE_PRESENTATION: Record<StudentInvestmentStage, { symbol: string; studentLabel: string }> = {
  big_rise: { symbol: '▲▲', studentLabel: '많이 올랐어요' },
  rise: { symbol: '▲', studentLabel: '올랐어요' },
  flat: { symbol: '─', studentLabel: '그대로예요' },
  fall: { symbol: '▼', studentLabel: '내렸어요' },
  big_fall: { symbol: '▼▼', studentLabel: '많이 내렸어요' },
};

export const getInvestmentStagePresentation = (stage: StudentInvestmentStage) => INVESTMENT_STAGE_PRESENTATION[stage];

export const investmentPercentToMultiplier = (percent: number) => (
  1 + Math.max(-50, Math.min(50, Math.round(percent))) / 100
);

export const investmentMultiplierToPercent = (multiplier: number) => (
  Math.max(-50, Math.min(50, Math.round((multiplier - 1) * 100)))
);

export const getInvestmentStageFromPercent = (percent: number): StudentInvestmentStage => {
  const normalizedPercent = Math.max(-50, Math.min(50, Math.round(percent)));
  if (normalizedPercent >= 30) return 'big_rise';
  if (normalizedPercent > 0) return 'rise';
  if (normalizedPercent <= -30) return 'big_fall';
  if (normalizedPercent < 0) return 'fall';
  return 'flat';
};

export const getInvestmentWeekDateKeys = (dateKey: string) => {
  const selectedDate = new Date(`${dateKey}T12:00:00Z`);
  const selectedDay = selectedDate.getUTCDay();
  const daysFromMonday = selectedDay === 0 ? 6 : selectedDay - 1;
  selectedDate.setUTCDate(selectedDate.getUTCDate() - daysFromMonday);
  return Array.from({ length: 5 }, (_, index) => {
    const weekday = new Date(selectedDate);
    weekday.setUTCDate(selectedDate.getUTCDate() + index);
    return weekday.toISOString().slice(0, 10);
  });
};

export const calculateInvestmentAmount = (
  amount: number,
  multiplier: number,
  rounding: StudentInvestmentRounding,
) => Math.max(0, Math[rounding](amount * multiplier));

export interface StudentStockMarketEntry {
  dateKey: string;
  stage: StudentInvestmentStage;
  returnPercent?: number;
  comment: string;
}

export type StudentStockMarket = Partial<Record<StudentStockId, StudentStockMarketEntry[]>> & {
  settings?: StudentInvestmentSettings;
};

export type StudentEconomyAction =
  | { type: 'deposit'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'save'; amount: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'buy_item'; itemId: StudentShopItemId }
  | { type: 'draw_character' }
  | { type: 'select_character'; characterId: StudentCharacterPrizeId | null }
  | { type: 'buy_house'; houseId: StudentHouseDesignId }
  | { type: 'select_house'; houseId: StudentHouseDesignId }
  | { type: 'buy_custom_house_coupon' }
  | { type: 'register_custom_house'; name: string; theme: StudentCustomHouseTheme }
  | { type: 'invest'; stockId: StudentStockId; amount: number; dateKey: string }
  | { type: 'withdraw_investment'; stockId: StudentStockId; dateKey: string }
  | { type: 'settle_investments'; dateKey: string };

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
const INVESTMENT_STAGES = new Set<StudentInvestmentStage>(['big_rise', 'rise', 'flat', 'fall', 'big_fall']);

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
  const rawAmount = Number(source.changeAmount ?? source.changePercent ?? 0);
  const legacyStage: StudentInvestmentStage = rawAmount >= 5 ? 'big_rise'
    : rawAmount > 0 ? 'rise'
      : rawAmount <= -5 ? 'big_fall'
        : rawAmount < 0 ? 'fall' : 'flat';
  const rawReturnPercent = Number(source.returnPercent);
  const returnPercent = Number.isFinite(rawReturnPercent)
    ? Math.max(-50, Math.min(50, Math.round(rawReturnPercent)))
    : null;
  const stage = returnPercent === null
    ? typeof source.stage === 'string' && INVESTMENT_STAGES.has(source.stage as StudentInvestmentStage)
      ? source.stage as StudentInvestmentStage
      : legacyStage
    : getInvestmentStageFromPercent(returnPercent);
  const comment = typeof source.comment === 'string' ? source.comment.trim().slice(0, 120) : '';
  return returnPercent === null ? { dateKey, stage, comment } : { dateKey, stage, returnPercent, comment };
};

export const normalizeStudentInvestmentSettings = (value: unknown): StudentInvestmentSettings => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawMultipliers = source.multipliers && typeof source.multipliers === 'object' && !Array.isArray(source.multipliers)
    ? source.multipliers as Record<string, unknown> : {};
  const multipliers = Object.fromEntries([...INVESTMENT_STAGES].map((stage) => {
    const candidate = Number(rawMultipliers[stage]);
    return [stage, Number.isFinite(candidate) && candidate >= 0.5 && candidate <= 1.5 ? candidate : DEFAULT_STUDENT_INVESTMENT_SETTINGS.multipliers[stage]];
  })) as Record<StudentInvestmentStage, number>;
  const minimumAmount = Math.max(1, Math.min(999_999, Math.round(Number(source.minimumAmount) || DEFAULT_STUDENT_INVESTMENT_SETTINGS.minimumAmount)));
  const maximumAmount = Math.max(minimumAmount, Math.min(999_999, Math.round(Number(source.maximumAmount) || DEFAULT_STUDENT_INVESTMENT_SETTINGS.maximumAmount)));
  const rounding = source.rounding === 'floor' || source.rounding === 'ceil' ? source.rounding : 'round';
  return { multipliers, minimumAmount, maximumAmount, rounding };
};

export const normalizeStudentStockMarket = (value: unknown): StudentStockMarket => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const market = STUDENT_STOCKS.reduce<StudentStockMarket>((result, stock) => {
    const entries = Array.isArray(source[stock.id]) ? source[stock.id] as unknown[] : [];
    const uniqueEntries = new Map<string, StudentStockMarketEntry>();
    entries.forEach((entry) => {
      const normalized = normalizeStockMarketEntry(entry);
      if (normalized) uniqueEntries.set(normalized.dateKey, normalized);
    });
    result[stock.id] = [...uniqueEntries.values()]
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
      .slice(0, MAX_STOCK_MARKET_HISTORY);
    return result;
  }, {});
  market.settings = normalizeStudentInvestmentSettings(source.settings);
  return market;
};

export const updateStudentInvestmentSettings = (value: unknown, settings: StudentInvestmentSettings) => ({
  ...normalizeStudentStockMarket(value),
  settings: normalizeStudentInvestmentSettings(settings),
});

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
  investments: {},
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
    investments: normalizeStudentInvestments(source.investments),
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
      stage: currentEntry?.stage ?? 'flat',
      changeAmount: currentEntry?.stage === 'big_rise' ? 2 : currentEntry?.stage === 'rise' ? 1 : currentEntry?.stage === 'fall' ? -1 : currentEntry?.stage === 'big_fall' ? -2 : 0,
      comment: currentEntry?.comment ?? '',
      history,
    };
  });
};

const normalizeStudentInvestments = (value: unknown) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return STUDENT_STOCKS.reduce<Partial<Record<StudentStockId, StudentInvestmentPosition>>>((positions, stock) => {
    const raw = source[stock.id];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return positions;
    const position = raw as Record<string, unknown>;
    const investedAmount = clampAmount(position.investedAmount);
    const currentAmount = clampAmount(position.currentAmount);
    const lastSettledDateKey = typeof position.lastSettledDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(position.lastSettledDateKey) ? position.lastSettledDateKey : '';
    const lastStage = typeof position.lastStage === 'string' && INVESTMENT_STAGES.has(position.lastStage as StudentInvestmentStage) ? position.lastStage as StudentInvestmentStage : 'flat';
    const lastChangeAmount = Number.isFinite(Number(position.lastChangeAmount)) ? Math.round(Number(position.lastChangeAmount)) : 0;
    if (investedAmount > 0 && currentAmount >= 0 && lastSettledDateKey) positions[stock.id] = { investedAmount, currentAmount, lastSettledDateKey, lastChangeAmount, lastStage };
    return positions;
  }, {});
};

const isWeekdayDateKey = (dateKey: string) => {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};

const getPendingWeekdayDateKeys = (afterDateKey: string, throughDateKey: string) => {
  const cursor = new Date(`${afterDateKey}T12:00:00Z`);
  const end = new Date(`${throughDateKey}T12:00:00Z`);
  const dateKeys: string[] = [];
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const dateKey = cursor.toISOString().slice(0, 10);
    if (isWeekdayDateKey(dateKey)) dateKeys.push(dateKey);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dateKeys;
};

const settleStudentInvestments = (state: StudentEconomyState, dateKey: string, marketValue: unknown) => {
  const market = normalizeStudentStockMarket(marketValue);
  const settings = market.settings ?? DEFAULT_STUDENT_INVESTMENT_SETTINGS;
  const investments = { ...state.investments };
  STUDENT_STOCKS.forEach((stock) => {
    const current = investments[stock.id];
    if (!current) return;
    let next = current;
    getPendingWeekdayDateKeys(current.lastSettledDateKey, dateKey).forEach((pendingDateKey) => {
      const entry = (market[stock.id] ?? []).find((candidate) => candidate.dateKey === pendingDateKey);
      const stage = entry?.stage ?? 'flat';
      const multiplier = entry?.returnPercent === undefined
        ? settings.multipliers[stage]
        : investmentPercentToMultiplier(entry.returnPercent);
      const nextAmount = calculateInvestmentAmount(next.currentAmount, multiplier, settings.rounding);
      next = { ...next, currentAmount: nextAmount, lastChangeAmount: nextAmount - next.currentAmount, lastStage: stage, lastSettledDateKey: pendingDateKey };
    });
    investments[stock.id] = next;
  });
  return { ...state, investments };
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
    if (action.characterId !== null && !state.ownedCharacterIds.includes(action.characterId)) throw new Error('CHARACTER_NOT_OWNED');
    nextState = { ...state, activeCharacterId: action.characterId };
    message = action.characterId === null ? '기본 고마로 바꿨습니다.' : '고마 스킨을 바꿨습니다.';
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
  } else if (action.type === 'settle_investments') {
    const settledState = settleStudentInvestments(state, action.dateKey, stockMarket);
    const hasChangedPosition = STUDENT_STOCKS.some((stock) => settledState.investments[stock.id] !== state.investments[stock.id]);
    if (!hasChangedPosition) return { state, wallet, reason: 'stock_trade', message: '', applied: false };
    nextState = settledState;
    reason = 'stock_trade';
    message = '';
  } else if (action.type === 'invest') {
    if (!STOCK_IDS.has(action.stockId)) throw new Error('UNKNOWN_STOCK');
    if (!isWeekdayDateKey(action.dateKey)) throw new Error('STOCK_MARKET_CLOSED');
    const settings = normalizeStudentStockMarket(stockMarket).settings ?? DEFAULT_STUDENT_INVESTMENT_SETTINGS;
    if (!Number.isInteger(action.amount) || action.amount < settings.minimumAmount || action.amount > settings.maximumAmount) throw new Error('INVALID_INVESTMENT_AMOUNT');
    const settledState = settleStudentInvestments(state, action.dateKey, stockMarket);
    const current = settledState.investments[action.stockId];
    if ((current?.currentAmount ?? 0) + action.amount > settings.maximumAmount) throw new Error('INVESTMENT_LIMIT_EXCEEDED');
    spend(action.amount);
    reason = 'stock_trade';
    nextState = {
      ...settledState,
      investments: { ...settledState.investments, [action.stockId]: {
        investedAmount: (current?.investedAmount ?? 0) + action.amount,
        currentAmount: (current?.currentAmount ?? 0) + action.amount,
        lastSettledDateKey: action.dateKey,
        lastChangeAmount: current?.lastChangeAmount ?? 0,
        lastStage: current?.lastStage ?? 'flat',
      } },
    };
    message = `${action.amount} 고마를 투자했습니다.`;
  } else {
    if (!isWeekdayDateKey(action.dateKey)) throw new Error('STOCK_MARKET_CLOSED');
    const settledState = settleStudentInvestments(state, action.dateKey, stockMarket);
    const position = settledState.investments[action.stockId];
    if (!position) throw new Error('INVESTMENT_NOT_FOUND');
    const investments = { ...settledState.investments };
    delete investments[action.stockId];
    reason = 'stock_trade';
    nextWallet += position.currentAmount;
    nextState = { ...settledState, investments };
    message = `${position.currentAmount} 고마를 찾았습니다.`;
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
