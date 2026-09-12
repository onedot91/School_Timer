import { canonicalStorageJson } from '../lib/storageV2Codec.js';
import {
  AUCTION_ITEM_IDS, CURRENCY_BALANCE_MAX, CURRENCY_STUDENT_NUMBERS, DEFAULT_CURRENCY_BALANCE, TEST_STUDENT_NUMBER,
  appendCurrencyHistoryEntry, applyTeacherCurrencyDeductionsInSettings, clampCurrencyBalance,
  createWeeklyCurrencyCycle, finalizeAuctionAwardInSettings, normalizeAuctionAwards,
  normalizeAuctionBids, normalizeAuctionItems, normalizeCurrencyBalances, normalizeCurrencyHistory,
} from '../lib/currency.js';
import { applyClassroomRoleMissionResultInSettings } from '../lib/classroomRoleMission.js';
import { normalizeClassDonationSettings } from '../lib/classDonation.js';
import { isStudentLetterRetained, isTeacherMailSender, createStudentLetters, markTeacherLettersRead, normalizeStudentLifeState, pruneExpiredStudentLetters } from '../lib/studentLife.js';
import {
  DAILY_WRITING_REWARD, markDailyWritingStudentRewarded,
  normalizeDailyWritingState, publishDailyWritingAssignment, unmarkDailyWritingStudentRewarded,
} from '../lib/dailyWriting.js';
import {
  TEACHER_SETTING_FIELDS, applyAcknowledgedTeacherChanges, isStorageRecord, selectTeacherSettings,
  type TeacherSettingChange,
} from '../lib/teacherStorageCommand.js';

export class TeacherStorageCommandError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
const invalid = (): never => { throw new TeacherStorageCommandError('INVALID_TEACHER_COMMAND'); };
const text = (value: unknown, max = 5000): string => typeof value === 'string' && value.length <= max ? value : invalid();
const student = (value: unknown): number => typeof value === 'number' && CURRENCY_STUDENT_NUMBERS.includes(value) ? value : invalid();
const mailStudent = (value: unknown): number => typeof value === 'number'
  && (CURRENCY_STUDENT_NUMBERS.includes(value) || value === TEST_STUDENT_NUMBER) ? value : invalid();
const integer = (value: unknown, min: number, max: number): number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : invalid();
const date = (value: unknown): string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : invalid();
const students = (value: unknown): number[] => Array.isArray(value) && value.length > 0 && value.length <= 23 ? [...new Set(value.map(student))] : invalid();
const mailRecipients = (value: unknown): number[] => Array.isArray(value) && value.length > 0 && value.length <= 24
  ? [...new Set(value.map(mailStudent))] : invalid();
const preserveLife = (before: unknown, after: unknown, referenceAt: string): unknown => {
  if (before === after || !isStorageRecord(before) || !isStorageRecord(after)) return after;
  const next = { ...before, ...after };
  for (const field of ['letters', 'books', 'failureStories']) {
    const oldItems = before[field]; const newItems = after[field];
    if (!Array.isArray(oldItems) || !Array.isArray(newItems)) continue;
    const ids = new Set(newItems.filter(isStorageRecord).map(item => item.id));
    next[field] = [...newItems, ...oldItems.filter(item => (
      (!isStorageRecord(item) || !ids.has(item.id))
      && (field !== 'letters' || !isStorageRecord(item) || isStudentLetterRetained(item.createdAt, referenceAt))
    ))];
  }
  return next;
};

export const applyTeacherStorageCommand = (
  currentValue: unknown, action: string, payload: unknown,
  context: { readonly requestId: string; readonly createdAt: string },
): { value: Record<string, unknown>; result: unknown } | null => {
  if (!action.startsWith('teacher.')) return null;
  if (!isStorageRecord(payload)) return invalid();
  const current = isStorageRecord(currentValue) ? currentValue : {};
  const finish = (value: Record<string, unknown>, result: unknown = null) => ({
    value: { ...value, ...(value.studentLife !== undefined ? { studentLife: preserveLife(current.studentLife, value.studentLife, context.createdAt) } : {}) }, result,
  });
  if (action === 'teacher.settings.patch') {
    if (!Array.isArray(payload.changes) || payload.changes.length > 40) return invalid();
    const allowed = new Set<string>([...TEACHER_SETTING_FIELDS,
      'classroomRoleMission.enabled', 'classroomRoleMission.anchorDateKey', 'classroomRoleMission.anchorStartStudentNumber',
      'classDonation.enabled', 'classDonation.itemName', 'classDonation.targetAmount']);
    const present = selectTeacherSettings(current);
    const changes: TeacherSettingChange[] = payload.changes.map(change => {
      if (!isStorageRecord(change) || typeof change.field !== 'string' || !allowed.has(change.field)
        || !('before' in change) || !('after' in change)) return invalid();
      const currentField = present[change.field] ?? null;
      const expectedValues = [canonicalStorageJson(change.before), canonicalStorageJson(change.after)];
      const matchesCurrent = expectedValues.includes(canonicalStorageJson(currentField));
      const matchesAuctionDefaults = change.field === 'auctionItems'
        && expectedValues.includes(canonicalStorageJson(normalizeAuctionItems(currentField)));
      if (!matchesCurrent && !matchesAuctionDefaults) {
        throw new TeacherStorageCommandError('TEACHER_SETTING_CONFLICT', 409);
      }
      return { field: change.field, before: change.before, after: change.after };
    });
    return finish(applyAcknowledgedTeacherChanges(current, changes));
  }
  if (action === 'teacher.currency.adjust' || action === 'teacher.currency.set' || action === 'teacher.currency.reset') {
    const targets = action === 'teacher.currency.reset' ? CURRENCY_STUDENT_NUMBERS : students(payload.studentNumbers);
    const amount = action === 'teacher.currency.reset' ? DEFAULT_CURRENCY_BALANCE
      : integer(payload.amount, action === 'teacher.currency.adjust' ? -CURRENCY_BALANCE_MAX : 0, CURRENCY_BALANCE_MAX);
    const balances = normalizeCurrencyBalances(current.currencyBalances);
    if (action === 'teacher.currency.set' && targets.some(number => balances[String(number)] !== payload.expectedBalance)) {
      throw new TeacherStorageCommandError('CURRENCY_BALANCE_CHANGED', 409);
    }
    let history = normalizeCurrencyHistory(current.currencyHistory);
    for (const number of targets) {
      const key = String(number); const before = balances[key];
      const after = clampCurrencyBalance(action === 'teacher.currency.adjust' ? before + amount : amount);
      history = appendCurrencyHistoryEntry(history, { id: `teacher-${context.requestId}-${number}`, studentNumber: number,
        before, after, reason: action === 'teacher.currency.reset' ? 'reset' : targets.length === 1 ? 'manual' : 'bulk_adjust', createdAt: context.createdAt });
      balances[key] = after;
    }
    return finish({ ...current, currencyBalances: balances, currencyHistory: history });
  }
  if (action === 'teacher.currency.deduct') {
    const result = applyTeacherCurrencyDeductionsInSettings(current, { studentNumbers: students(payload.studentNumbers),
      amount: integer(payload.amount, 1, CURRENCY_BALANCE_MAX), teacherReason: text(payload.teacherReason, 300), ...context });
    return finish(result.value);
  }
  if (action === 'teacher.role.result') {
    const nextResult = payload.nextResult === null || payload.nextResult === undefined ? undefined
      : payload.nextResult === 'rewarded' || payload.nextResult === 'penalized' ? payload.nextResult : invalid();
    return finish(applyClassroomRoleMissionResultInSettings(current, { studentNumber: student(payload.studentNumber),
      nextResult, dateKey: date(payload.dateKey), ...context }));
  }
  if (action === 'teacher.auction.finalize') {
    const itemId = text(payload.itemId, 100);
    const bid = normalizeAuctionBids(current.auctionBids, AUCTION_ITEM_IDS)[itemId];
    if (!bid?.bidder || bid.amount <= 0) throw new TeacherStorageCommandError('AUCTION_BID_CHANGED', 409);
    if (payload.expectedBidder !== bid.bidder || payload.expectedAmount !== bid.amount) throw new TeacherStorageCommandError('AUCTION_BID_CHANGED', 409);
    const result = finalizeAuctionAwardInSettings(current, { itemId, winner: bid.bidder, amount: bid.amount, awardedAt: context.createdAt });
    return finish(result.value, { awarded: result.awarded });
  }
  if (action === 'teacher.auction.remove') {
    const itemId = text(payload.itemId, 100);
    const items = normalizeAuctionItems(current.auctionItems);
    if (items.length <= 1 || !items.some(item => item.id === itemId)) throw new TeacherStorageCommandError('AUCTION_ITEM_NOT_REMOVABLE', 409);
    const awards = normalizeAuctionAwards(current.auctionAwards, AUCTION_ITEM_IDS);
    const bids = normalizeAuctionBids(current.auctionBids, AUCTION_ITEM_IDS);
    const history = isStorageRecord(current.auctionBidHistory) ? current.auctionBidHistory : {};
    const award = awards[itemId];
    const balances = normalizeCurrencyBalances(current.currencyBalances);
    let currencyHistory = normalizeCurrencyHistory(current.currencyHistory);
    if (award) {
      const key = String(award.winner); const before = balances[key];
      if (before + award.amount > CURRENCY_BALANCE_MAX) throw new TeacherStorageCommandError('CURRENCY_BALANCE_LIMIT', 409);
      balances[key] = before + award.amount;
      currencyHistory = appendCurrencyHistoryEntry(currencyHistory, { id: `auction-cancel-${context.requestId}`,
        studentNumber: award.winner, before, after: balances[key], reason: 'auction_award', createdAt: context.createdAt });
    }
    const archives = Array.isArray(current.auctionArchives) ? current.auctionArchives : [];
    return finish({ ...current, auctionItems: items.filter(item => item.id !== itemId),
      auctionBids: { ...bids, [itemId]: { bidder: null, amount: 0 } }, auctionBidHistory: { ...history, [itemId]: [] },
      auctionAwards: { ...awards, [itemId]: null }, currencyBalances: balances, currencyHistory,
      auctionArchives: [...archives, { id: context.requestId, item: items.find(item => item.id === itemId),
        bid: bids[itemId], history: history[itemId] ?? [], award, closedAt: context.createdAt }] });
  }
  if (action === 'teacher.auction.weekly-close') {
    const cycleKey = date(payload.cycleKey);
    const settled = isStorageRecord(current.teacherWeeklySettlements) ? current.teacherWeeklySettlements : {};
    if (settled[cycleKey]) return finish(current, { settled: false });
    const result = createWeeklyCurrencyCycle(current, context.createdAt, context.createdAt, context.createdAt);
    const archives = Array.isArray(current.auctionArchives) ? current.auctionArchives : [];
    return finish({ ...current, currencyBalances: result.balances, currencyHistory: result.history, studentEconomy: result.economy,
      auctionItems: normalizeAuctionItems(null), auctionBids: {}, auctionBidHistory: {}, auctionAwards: {},
      auctionArchives: [...archives, { id: context.requestId, cycleKey, items: current.auctionItems ?? [],
        bids: current.auctionBids ?? {}, bidHistory: current.auctionBidHistory ?? {}, awards: current.auctionAwards ?? {}, closedAt: context.createdAt }],
      teacherWeeklySettlements: { ...settled, [cycleKey]: context.requestId } }, { settled: true });
  }
  if (action === 'teacher.mail.send') {
    const recipients = mailRecipients(payload.recipients); const content = text(payload.content, 10000); const title = text(payload.title, 200);
    if (!content.trim()) return invalid();
    const senderLabel = payload.senderLabel === undefined ? '선생님' : payload.senderLabel;
    if (!isTeacherMailSender(senderLabel)) return invalid();
    return finish({ ...current, studentLife: createStudentLetters(pruneExpiredStudentLetters(normalizeStudentLifeState(current.studentLife), context.createdAt), recipients.map(recipient => ({
      id: `${senderLabel === '선생님' ? '' : 'teacher-character-'}${context.requestId}-${recipient}`, recipient, senderLabel, senderStudentNumber: null, title, content, createdAt: context.createdAt,
    }))) });
  }
  if (action === 'teacher.mail.read') {
    if (!Array.isArray(payload.letterIds) || payload.letterIds.length > 600) return invalid();
    return finish({ ...current, studentLife: markTeacherLettersRead(pruneExpiredStudentLetters(normalizeStudentLifeState(current.studentLife), context.createdAt),
      payload.letterIds.map(id => text(id, 150)), context.createdAt) });
  }
  if (action === 'teacher.writing.publish') {
    const published = publishDailyWritingAssignment(normalizeDailyWritingState(current.dailyWriting), normalizeStudentLifeState(current.studentLife), {
      dateKey: date(payload.dateKey), topic: text(payload.topic, 3000), requiredWord: text(payload.requiredWord, 200),
      requiredWordMeaning: text(payload.requiredWordMeaning, 3000), publishedAt: context.createdAt,
    });
    return finish({ ...current, dailyWriting: published.state, studentLife: published.studentLife });
  }
  if (action === 'teacher.writing.reward' || action === 'teacher.writing.cancel') {
    const number = student(payload.studentNumber); const dateKey = date(payload.dateKey); const key = String(number);
    const history = normalizeCurrencyHistory(current.currencyHistory); const balances = normalizeCurrencyBalances(current.currencyBalances);
    const rewardId = `daily-writing-reward-${dateKey}-${number}`;
    const entries = history[key] ?? [];
    const net = entries.filter(entry => entry.id === rewardId || entry.id.startsWith(`${rewardId}:`)).reduce((total, entry) => total + entry.delta, 0);
    const cancelling = action === 'teacher.writing.cancel';
    const permitted = cancelling ? net > 0 && balances[key] >= DAILY_WRITING_REWARD : net <= 0 && balances[key] <= CURRENCY_BALANCE_MAX - DAILY_WRITING_REWARD;
    if (!permitted) return finish(current, { awarded: false, cancelled: false });
    const delta = cancelling ? -DAILY_WRITING_REWARD : DAILY_WRITING_REWARD; const before = balances[key];
    const nextHistory = appendCurrencyHistoryEntry(history, { id: entries.some(entry => entry.id === rewardId)
      ? `${rewardId}:${context.requestId}` : rewardId, studentNumber: number, before, after: before + delta, reason: 'daily_writing', createdAt: context.createdAt });
    const writing = normalizeDailyWritingState(current.dailyWriting);
    return finish({ ...current, currencyBalances: { ...balances, [key]: before + delta }, currencyHistory: nextHistory,
      dailyWriting: cancelling ? unmarkDailyWritingStudentRewarded(writing, number, dateKey) : markDailyWritingStudentRewarded(writing, number, dateKey) },
    { awarded: !cancelling, cancelled: cancelling });
  }
  if (action === 'teacher.donation.reset') {
    const donation = normalizeClassDonationSettings(current.classDonation);
    const archives = Array.isArray(current.classDonationArchives) ? current.classDonationArchives : [];
    return finish({ ...current, classDonation: { ...donation, totalAmount: 0, history: [] },
      classDonationArchives: [...archives, { id: context.requestId, ...donation, closedAt: context.createdAt }] });
  }
  return null;
};
