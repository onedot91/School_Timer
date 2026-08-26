import {
  AUCTION_ITEM_IDS,
  DEFAULT_CURRENCY_BALANCE,
  appendCurrencyHistoryEntry,
  getReservedAuctionBidAmount,
  normalizeAuctionAwards,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
} from '../src/lib/currency.js';
import { createBankMailboxLetters } from '../src/lib/bankMailbox.js';
import {
  applyStudentEconomyAction,
  normalizeStudentEconomyStates,
  type StudentEconomyAction,
} from '../src/lib/studentEconomy.js';
import { patchStudentEconomySettings } from '../src/lib/studentEconomySettings.js';
import { createStudentLetter, normalizeStudentLifeState } from '../src/lib/studentLife.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: RequestHeaders;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

interface SettingsRow {
  readonly id: string;
  readonly value: unknown;
  readonly updated_at?: string;
}

const SETTINGS_ID = 'school-timer-main';
const MAX_REQUEST_BYTES = 8_192;
const UPDATE_RETRY_LIMIT = 5;
const ACTION_TYPES = new Set([
  'deposit',
  'withdraw',
  'save',
  'open_deposit',
  'close_deposit',
  'claim_deposit',
  'borrow',
  'repay',
  'transfer',
  'buy_item',
  'draw_character',
  'select_character',
  'buy_house',
  'select_house',
  'buy_custom_house_coupon',
  'register_custom_house',
  'invest',
  'withdraw_investment',
  'settle_investments',
]);
const ACTION_ERRORS = new Set([
  'ALL_CHARACTERS_OWNED',
  'CHARACTER_NOT_OWNED',
  'CUSTOM_HOUSE_COUPON_OWNED',
  'CUSTOM_HOUSE_COUPON_REQUIRED',
  'CUSTOM_HOUSE_NAME_REQUIRED',
  'DEPOSIT_NOT_AVAILABLE_TODAY',
  'DEPOSIT_NOT_FOUND',
  'DEPOSIT_NOT_MATURED',
  'EXCESSIVE_LOAN_REPAYMENT',
  'HOUSE_ALREADY_OWNED',
  'HOUSE_ALREADY_REPAIRED',
  'HOUSE_NOT_OWNED',
  'HOUSE_SHOP_LOCKED',
  'INSUFFICIENT_AVAILABLE_CURRENCY',
  'INSUFFICIENT_BANK_BALANCE',
  'INVALID_BANK_AMOUNT',
  'INVALID_BANK_DATE',
  'INVALID_ECONOMY_AMOUNT',
  'INVALID_INVESTMENT_AMOUNT',
  'INVALID_TRANSFER_RECIPIENT',
  'INVESTMENT_LIMIT_EXCEEDED',
  'INVESTMENT_NOT_FOUND',
  'LOAN_LIMIT_EXCEEDED',
  'STOCK_MARKET_CLOSED',
  'TRANSFER_AMOUNT_LIMIT_EXCEEDED',
  'TRANSFER_DAILY_LIMIT_REACHED',
  'UNKNOWN_HOUSE',
  'UNKNOWN_SHOP_ITEM',
  'UNKNOWN_STOCK',
]);

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
);

const parseBody = (body: unknown) => {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== 'object') return null;
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > MAX_REQUEST_BYTES) return null;
  const studentNumber = Reflect.get(parsed, 'studentNumber');
  const requestId = Reflect.get(parsed, 'requestId');
  const action = Reflect.get(parsed, 'action');
  const actionType = action && typeof action === 'object' ? Reflect.get(action, 'type') : null;
  if (
    !Number.isInteger(studentNumber)
    || studentNumber < 1
    || studentNumber > 23
    || typeof requestId !== 'string'
    || requestId.length < 8
    || requestId.length > 160
    || !/^[a-zA-Z0-9-]+$/.test(requestId)
    || typeof actionType !== 'string'
    || !ACTION_TYPES.has(actionType)
  ) return null;
  return { studentNumber, requestId, action: action as StudentEconomyAction } as const;
};

const getConfiguration = () => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  return url && key && sessionSecret?.length >= 32 ? { url: url.replace(/\/$/, ''), key, sessionSecret } : null;
};

const supabaseHeaders = (key: string) => ({
  Accept: 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
});

const loadRow = async (url: string, key: string) => {
  const result = await fetch(`${url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&select=id,value,updated_at`, {
    headers: supabaseHeaders(key),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`STUDENT_ECONOMY_READ_HTTP_${result.status}`);
  const rows: unknown = await result.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] as SettingsRow : null;
};

const createMutation = (
  currentValue: unknown,
  studentNumber: number,
  action: StudentEconomyAction,
  requestId: string,
  createdAt: string,
) => {
  const current = asRecord(currentValue);
  const studentKey = String(studentNumber);
  const balances = normalizeCurrencyBalances(current.currencyBalances);
  const history = normalizeCurrencyHistory(current.currencyHistory);
  const economyStates = normalizeStudentEconomyStates(current.studentEconomy);
  const studentLife = normalizeStudentLifeState(current.studentLife);
  const bids = normalizeAuctionBids(current.auctionBids, AUCTION_ITEM_IDS);
  const awards = normalizeAuctionAwards(current.auctionAwards, AUCTION_ITEM_IDS);
  const activeAuctionItemIds = normalizeAuctionItems(current.auctionItems).map((item) => item.id);
  const wallet = balances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
  const reserved = getReservedAuctionBidAmount(
    bids,
    studentNumber,
    undefined,
    awards,
    activeAuctionItemIds,
  );
  const result = applyStudentEconomyAction({
    state: economyStates[studentKey],
    action,
    wallet,
    availableWallet: Math.max(0, wallet - reserved),
    requestId,
    shopCatalog: current.studentShopCatalog,
    stockMarket: current.studentStockMarket,
  });

  let nextBalances = { ...balances, [studentKey]: result.wallet };
  let nextHistory = result.applied && result.wallet !== wallet
    ? appendCurrencyHistoryEntry(history, {
        studentNumber,
        before: wallet,
        after: result.wallet,
        reason: result.reason,
        createdAt,
      })
    : history;
  const changedStudentKeys = [studentKey];

  if (result.applied && action.type === 'transfer') {
    const recipientKey = String(action.recipientNumber);
    const recipientWallet = balances[recipientKey] ?? DEFAULT_CURRENCY_BALANCE;
    changedStudentKeys.push(recipientKey);
    nextBalances = { ...nextBalances, [recipientKey]: recipientWallet + action.amount };
    nextHistory = appendCurrencyHistoryEntry(nextHistory, {
      studentNumber: action.recipientNumber,
      before: recipientWallet,
      after: recipientWallet + action.amount,
      reason: result.reason,
      createdAt,
    });
  }

  const nextStudentLife = result.applied
    ? createBankMailboxLetters({ action, studentNumber, requestId, createdAt }).reduce(
        (life, letter) => createStudentLetter(life, letter),
        studentLife,
      )
    : studentLife;
  const currencyBalanceEntries = Object.fromEntries(
    changedStudentKeys.map((key) => [key, nextBalances[key] ?? DEFAULT_CURRENCY_BALANCE]),
  );
  const currencyHistoryEntries = Object.fromEntries(
    changedStudentKeys.map((key) => [key, nextHistory[key] ?? []]),
  );
  const nextValue = patchStudentEconomySettings({
    currentValue: current,
    currencyBalanceEntries,
    currencyHistoryEntries,
    studentEconomyEntries: { [studentKey]: result.state },
    studentLife: nextStudentLife,
  });

  return {
    nextValue,
    response: {
      balance: result.wallet,
      currencyBalanceEntries,
      currencyHistoryEntries,
      studentEconomy: result.state,
      studentLife: nextStudentLife,
      message: result.message,
      applied: result.applied,
    },
  };
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const configuration = getConfiguration();
  if (!configuration) {
    response.status(503).json({ error: 'STUDENT_ECONOMY_NOT_CONFIGURED' });
    return;
  }
  const session = getDeviceSession(request.headers, configuration.sessionSecret);
  if (!session) {
    response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (isCrossSiteRequest(request.headers)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
    return;
  }

  try {
    const parsed = parseBody(request.body);
    if (!parsed) {
      response.status(400).json({ error: 'INVALID_STUDENT_ECONOMY_ACTION' });
      return;
    }
    if (session.role === 'student' && session.studentNumber !== parsed.studentNumber) {
      response.status(403).json({ error: 'STUDENT_ECONOMY_SCOPE_VIOLATION' });
      return;
    }

    const createdAt = new Date().toISOString();
    for (let attempt = 0; attempt < UPDATE_RETRY_LIMIT; attempt += 1) {
      const current = await loadRow(configuration.url, configuration.key);
      if (!current) {
        response.status(409).json({ error: 'SHARED_SETTINGS_NOT_FOUND' });
        return;
      }
      const mutation = createMutation(
        current.value,
        parsed.studentNumber,
        parsed.action,
        parsed.requestId,
        createdAt,
      );
      const updatedAt = new Date().toISOString();
      const endpoint = `${configuration.url}/rest/v1/app_settings?id=eq.${SETTINGS_ID}&updated_at=eq.${encodeURIComponent(current.updated_at ?? '')}&select=id`;
      const result = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders(configuration.key),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ value: mutation.nextValue, updated_at: updatedAt }),
        signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) throw new Error(`STUDENT_ECONOMY_WRITE_HTTP_${result.status}`);
      const savedRows: unknown = await result.json();
      if (!Array.isArray(savedRows) || savedRows.length === 0) continue;
      response.status(200).json({ ...mutation.response, updatedAt });
      return;
    }
    response.status(409).json({ error: 'SHARED_SETTINGS_CONFLICT' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (ACTION_ERRORS.has(message)) {
      response.status(400).json({ error: message });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    console.error('Failed to apply student economy action.', error);
    response.status(502).json({ error: 'STUDENT_ECONOMY_UPDATE_FAILED' });
  }
}
