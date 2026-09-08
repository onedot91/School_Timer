import { randomInt } from 'node:crypto';
import {
  AUCTION_ITEM_IDS,
  CURRENCY_BALANCE_MAX,
  DEFAULT_CURRENCY_BALANCE,
  appendCurrencyHistoryEntry,
  getReservedAuctionBidAmount,
  normalizeAuctionAwards,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
} from '../src/lib/currency.js';
import { createHousePurchaseLetter, HOUSE_CREATOR_REWARD } from '../src/lib/studentHouseReward.js';
import { createBankMailboxLetters } from '../src/lib/bankMailbox.js';
import {
  applyStudentEconomyAction,
  normalizeStudentEconomyState,
  normalizeStudentEconomyStates,
  type StudentEconomyAction,
} from '../src/lib/studentEconomy.js';
import { patchStudentEconomySettings } from '../src/lib/studentEconomySettings.js';
import { createStudentLetter, normalizeStudentLifeState } from '../src/lib/studentLife.js';
import {
  purchaseStudentProfile,
  type StudentProfileEconomyAction,
  type StudentProfilePurchaseReason,
} from '../src/lib/studentProfilePurchase.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { isCrossSiteRequest } from '../src/server/requestRateLimit.js';
import { commitScopedStorageMutation, getStorageReceipt, loadScopedStorageSnapshot, StorageRepositoryError } from '../src/server/storageV2Repository.js';
import { createStorageProjectionPatch } from '../src/server/storageProjection.js';
import { economyResultScope, economyStorageScope } from '../src/server/economyStorageScope.js';

interface ApiRequest {
  readonly method?: string;
  readonly query?: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body?: unknown;
  readonly headers?: RequestHeaders;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

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
  'draw_profile',
  'select_profile',
]);
const ACTION_ERRORS = new Set([
  'HOUSE_CREATOR_BALANCE_LIMIT',
  'ALL_CHARACTERS_OWNED',
  'CHARACTER_NOT_OWNED',
  'CUSTOM_HOUSE_COUPON_OWNED',
  'CUSTOM_HOUSE_COUPON_REQUIRED',
  'CUSTOM_HOUSE_NAME_REQUIRED',
  'CUSTOM_HOUSE_NOT_REGISTERED',
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

type StudentEconomyApiAction = StudentEconomyAction | StudentProfileEconomyAction;

const isStudentProfileAction = (action: StudentEconomyApiAction): action is StudentProfileEconomyAction => (
  action.type === 'draw_profile' || action.type === 'select_profile'
);

const getProfilePurchaseMessage = (reason: StudentProfilePurchaseReason, price: number) => {
  if (reason === 'purchased') return price > 0 ? `${price} 고마로 프로필을 바꿨습니다.` : '첫 프로필을 받았습니다.';
  if (reason === 'profile_in_use') return '다른 학생이 사용 중인 프로필입니다.';
  if (reason === 'insufficient_currency') return '사용 가능한 고마가 부족합니다.';
  if (reason === 'first_profile_must_be_random') return '첫 프로필은 랜덤으로만 받을 수 있습니다.';
  if (reason === 'no_profile_available') return '지금은 받을 수 있는 프로필이 없습니다.';
  if (reason === 'already_selected') return '이미 사용 중인 프로필입니다.';
  return '프로필을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

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
  if (actionType === 'select_profile' && typeof Reflect.get(action as object, 'profileImage') !== 'string') return null;
  return { studentNumber, requestId, action: action as StudentEconomyApiAction } as const;
};

const getConfiguration = () => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  return url && key && sessionSecret?.length >= 32 ? { url: url.replace(/\/$/, ''), key, sessionSecret } : null;
};

const createDomainMutation = (
  currentValue: unknown,
  studentNumber: number,
  action: StudentEconomyApiAction,
  requestId: string,
  createdAt: string,
  characterDrawRoll?: number,
  profileDrawRoll = 0,
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

  if (isStudentProfileAction(action)) {
    const currentEconomy = normalizeStudentEconomyState(economyStates[studentKey]);
    const assignedProfile = studentLife.failureProfileAssignments[studentKey] ?? null;
    const profileHistoryId = `currency-profile-${requestId}`;
    if (currentEconomy.processedRequestIds.includes(requestId)) {
      const profilePrice = Math.abs(
        history[studentKey]?.find((entry) => entry.id === profileHistoryId)?.delta ?? 0,
      );
      return {
        nextValue: current,
        response: {
          balance: wallet,
          currencyBalanceEntries: { [studentKey]: wallet },
          currencyHistoryEntries: { [studentKey]: history[studentKey] ?? [] },
          studentEconomy: currentEconomy,
          studentLife,
          message: '이미 처리되었습니다.',
          applied: true,
          profileImage: assignedProfile,
          profilePrice,
          profileReason: 'purchased' as const,
        },
      };
    }

    const purchase = action.type === 'draw_profile'
      ? { type: 'random' as const }
      : { type: 'selected' as const, profileImage: action.profileImage };
    const profileResult = purchaseStudentProfile(
      current,
      studentNumber,
      purchase,
      Math.max(0, wallet - reserved),
      () => profileDrawRoll,
      createdAt,
      profileHistoryId,
    );
    const nextEconomy = profileResult.applied
      ? {
          ...currentEconomy,
          processedRequestIds: [...currentEconomy.processedRequestIds, requestId].slice(-24),
        }
      : currentEconomy;
    const nextValue = profileResult.applied
      ? patchStudentEconomySettings({
          currentValue: profileResult.value,
          currencyBalanceEntries: { [studentKey]: profileResult.balances[studentKey] ?? DEFAULT_CURRENCY_BALANCE },
          currencyHistoryEntries: { [studentKey]: profileResult.history[studentKey] ?? [] },
          studentEconomyEntries: { [studentKey]: nextEconomy },
          studentLife: profileResult.studentLife,
        })
      : current;

    return {
      nextValue,
      response: {
        balance: profileResult.balances[studentKey] ?? DEFAULT_CURRENCY_BALANCE,
        currencyBalanceEntries: { [studentKey]: profileResult.balances[studentKey] ?? DEFAULT_CURRENCY_BALANCE },
        currencyHistoryEntries: { [studentKey]: profileResult.history[studentKey] ?? [] },
        studentEconomy: nextEconomy,
        studentLife: profileResult.studentLife,
        message: getProfilePurchaseMessage(profileResult.reason, profileResult.price),
        applied: profileResult.applied,
        profileImage: profileResult.profileImage,
        profilePrice: profileResult.price,
        profileReason: profileResult.reason,
      },
    };
  }

  const result = applyStudentEconomyAction({
    state: economyStates[studentKey],
    action,
    wallet,
    availableWallet: Math.max(0, wallet - reserved),
    requestId,
    shopCatalog: current.studentShopCatalog,
    stockMarket: current.studentStockMarket,
    characterDrawRoll,
  });

  let nextBalances = { ...balances, [studentKey]: result.wallet };
  let nextHistory = result.applied && result.wallet !== wallet
    ? appendCurrencyHistoryEntry(history, {
        id: `currency-economy-${requestId}-${studentKey}`,
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
      id: `currency-economy-${requestId}-${recipientKey}`,
      studentNumber: action.recipientNumber,
      before: recipientWallet,
      after: recipientWallet + action.amount,
      reason: result.reason,
      createdAt,
    });
  }

  const houseLetter = createHousePurchaseLetter({ action, studentNumber, applied: result.applied, createdAt });
  if (houseLetter) {
    const creatorKey = String(houseLetter.recipient);
    const before = balances[creatorKey] ?? DEFAULT_CURRENCY_BALANCE;
    if (before > CURRENCY_BALANCE_MAX - HOUSE_CREATOR_REWARD) throw new Error('HOUSE_CREATOR_BALANCE_LIMIT');
    changedStudentKeys.push(creatorKey);
    nextBalances[creatorKey] = before + HOUSE_CREATOR_REWARD;
    nextHistory = appendCurrencyHistoryEntry(nextHistory, {
      id: `currency-economy-${requestId}-${creatorKey}`,
      studentNumber: houseLetter.recipient,
      before,
      after: before + HOUSE_CREATOR_REWARD,
      reason: 'house_creator_reward',
      createdAt,
    });
  }

  const nextStudentLife = result.applied
    ? [...createBankMailboxLetters({ action, studentNumber, requestId, createdAt }), ...(houseLetter ? [houseLetter] : [])].reduce(
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

// Domain normalizers are for calculation. Persist only new ledger/letter records and the actor's state.
const createMutation = (...args: Parameters<typeof createDomainMutation>) => {
  const mutation = createDomainMutation(...args);
  const current = asRecord(args[0]);
  const rawLife = asRecord(current.studentLife);
  const rawHistory = asRecord(current.currencyHistory);
  const rawLetters = Array.isArray(rawLife.letters) ? rawLife.letters : [];
  const existingLetterIds = new Set(rawLetters.map((letter) => asRecord(letter).id));
  const addedLetters = mutation.response.studentLife.letters.filter((letter) => !existingLetterIds.has(letter.id));
  const currencyHistory = { ...rawHistory };
  for (const [studentKey, entries] of Object.entries(mutation.response.currencyHistoryEntries)) {
    const original = Array.isArray(rawHistory[studentKey]) ? rawHistory[studentKey] : [];
    const originalIds = new Set(original.map((entry) => asRecord(entry).id));
    currencyHistory[studentKey] = [...original, ...entries.filter((entry) => !originalIds.has(entry.id))];
  }
  const studentKey = String(args[1]);
  const profile = mutation.response.studentLife.failureProfileAssignments[studentKey];
  const rawProfiles = asRecord(rawLife.failureProfileAssignments);
  const studentLife = {
    ...rawLife,
    ...(addedLetters.length ? { letters: [...rawLetters, ...addedLetters] } : {}),
    ...(profile !== undefined && profile !== rawProfiles[studentKey]
      ? { failureProfileAssignments: { ...rawProfiles, [studentKey]: profile } } : {}),
  };
  return { ...mutation, nextValue: {
    ...mutation.nextValue, currencyHistory, studentLife,
    studentEconomy: { ...asRecord(current.studentEconomy), [studentKey]: {
      ...asRecord(asRecord(current.studentEconomy)[studentKey]), ...mutation.response.studentEconomy,
    } },
  } };
};

const scopeEconomyResult = (value: unknown, studentNumber: number, role: 'teacher' | 'student'): unknown => {
  if (role === 'teacher') return value;
  const result = asRecord(value), life = asRecord(result.studentLife);
  const own = String(studentNumber);
  const ownEntries = (entries: unknown): Record<string, unknown> => {
    const record = asRecord(entries);
    return Object.hasOwn(record, own) ? { [own]: record[own] } : {};
  };
  return { ...result,
    currencyBalanceEntries: ownEntries(result.currencyBalanceEntries),
    currencyHistoryEntries: ownEntries(result.currencyHistoryEntries),
    studentLife: { ...life, letters: (Array.isArray(life.letters) ? life.letters : []).filter(letter => {
      const row = asRecord(letter);
      return row.recipient === studentNumber || row.senderStudentNumber === studentNumber;
    }) },
  };
};

const currentEconomyResponse = async (
  configuration: NonNullable<ReturnType<typeof getConfiguration>>, value: unknown, studentNumber: number,
) => {
  const snapshot = await loadScopedStorageSnapshot(configuration, economyResultScope(studentNumber));
  const own = String(studentNumber), current = snapshot.value;
  const balance = normalizeCurrencyBalances(current.currencyBalances)[own];
  const history = normalizeCurrencyHistory(current.currencyHistory)[own] ?? [];
  const economy = normalizeStudentEconomyState(asRecord(current.studentEconomy)[own]);
  const life = normalizeStudentLifeState(current.studentLife);
  const result = asRecord(scopeEconomyResult(value, studentNumber, 'student'));
  return { ...result, balance, currencyBalanceEntries: { [own]: balance }, currencyHistoryEntries: { [own]: history },
    studentEconomy: economy, studentLife: life, updatedAt: snapshot.updated_at,
    ...('profileImage' in result ? { profileImage: life.failureProfileAssignments[own] ?? null } : {}),
    storagePatch: createStorageProjectionPatch(snapshot, current),
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
  if (request.method === 'GET') {
    const requestId = request.query?.requestId;
    const studentNumber = Number(request.query?.studentNumber);
    if (request.query?.protocolVersion !== '2' || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,160}$/.test(requestId)
      || !Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) {
      response.status(400).json({ error: 'INVALID_STUDENT_ECONOMY_REQUEST' }); return;
    }
    if (session.role === 'student' && session.studentNumber !== studentNumber) {
      response.status(403).json({ error: 'STUDENT_ECONOMY_SCOPE_VIOLATION' }); return;
    }
    if (request.headers?.['x-storage-projection'] !== '1') {
      response.status(426).json({ error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' }); return;
    }
    try {
      const receipt = await getStorageReceipt(configuration, `${session.role}:${session.role === 'student' ? session.studentNumber : 0}:economy:${studentNumber}`, requestId);
      response.status(200).json(receipt.found ? { status: 'committed', result: await currentEconomyResponse(configuration, receipt.result, studentNumber) } : { status: 'unknown' });
    } catch (error) {
      response.status(error instanceof StorageRepositoryError ? error.status : 502).json({ error: error instanceof StorageRepositoryError ? error.code : 'STUDENT_ECONOMY_STATUS_UNAVAILABLE' });
    }
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
    const rawBody: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (asRecord(rawBody).protocolVersion !== 2) {
      response.status(426).json({ error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' }); return;
    }
    const parsed = parseBody(rawBody);
    if (!parsed) {
      response.status(400).json({ error: 'INVALID_STUDENT_ECONOMY_ACTION' });
      return;
    }
    if (session.role === 'student' && session.studentNumber !== parsed.studentNumber) {
      response.status(403).json({ error: 'STUDENT_ECONOMY_SCOPE_VIOLATION' });
      return;
    }

    if (request.headers?.['x-storage-projection'] !== '1') {
      response.status(426).json({ error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' }); return;
    }
    const actorKey = `${session.role}:${session.role === 'student' ? session.studentNumber : 0}:economy:${parsed.studentNumber}`;
    const receipt = await getStorageReceipt(configuration, actorKey, parsed.requestId, {
      action: 'student-economy', payload: { studentNumber: parsed.studentNumber, action: parsed.action },
    });
    if (receipt.found) { response.status(200).json(await currentEconomyResponse(configuration, receipt.result, parsed.studentNumber)); return; }
    const scope = economyStorageScope(parsed.studentNumber, parsed.action, parsed.requestId);
    const createdAt = new Date().toISOString();
    const characterDrawRoll = parsed.action.type === 'draw_character' ? randomInt(10) : undefined;
    const profileDrawRoll = parsed.action.type === 'draw_profile' ? randomInt(1_000_000) / 1_000_000 : 0;
    for (let attempt = 0; attempt < UPDATE_RETRY_LIMIT; attempt += 1) {
      try {
        const current = await loadScopedStorageSnapshot(configuration, scope);
        const confirmed = await getStorageReceipt(configuration, actorKey, parsed.requestId, {
          action: 'student-economy', payload: { studentNumber: parsed.studentNumber, action: parsed.action },
        });
        if (confirmed.found) { response.status(200).json(await currentEconomyResponse(configuration, confirmed.result, parsed.studentNumber)); return; }
        const mutation = createMutation(current.value, parsed.studentNumber, parsed.action, parsed.requestId, createdAt, characterDrawRoll, profileDrawRoll);
        const committed = await commitScopedStorageMutation(configuration, {
          snapshot: current, value: mutation.nextValue, actorKey, requestId: parsed.requestId,
          action: 'student-economy', payload: { studentNumber: parsed.studentNumber, action: parsed.action },
          result: scopeEconomyResult({ ...mutation.response, updatedAt: createdAt }, parsed.studentNumber, session.role),
        });
        if (committed.saved) {
          response.status(200).json(await currentEconomyResponse(configuration, committed.result, parsed.studentNumber)); return;
        }
      } catch (error) {
        const retryable = error instanceof StorageRepositoryError && error.code === 'STORAGE_SERIALIZATION_RETRY';
        if (!retryable || attempt + 1 >= UPDATE_RETRY_LIMIT) throw error;
      }
      if (attempt + 1 < UPDATE_RETRY_LIMIT) await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt + randomInt(40)));
    }
    response.status(409).json({ error: 'STORAGE_CONFLICT' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (ACTION_ERRORS.has(message)) {
      response.status(400).json({ error: message, businessRejected: true });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    if (error instanceof StorageRepositoryError) {
      response.status(error.status).json({ error: error.code }); return;
    }
    console.error('Failed to apply student economy action.');
    response.status(502).json({ error: 'STUDENT_ECONOMY_UPDATE_FAILED' });
  }
}
