import { appendCurrencyHistoryEntry, claimDailyEmotionRewardInSettings, claimWeeklyEmotionRewardInSettings, claimSudokuRewardInSettings, claimNumberBaseballRewardInSettings, normalizeCurrencyBalances, normalizeCurrencyHistory, normalizeAuctionBids, normalizeAuctionBidHistory, normalizeAuctionAwards, normalizeAuctionItems, getReservedAuctionBidAmount, getMinimumAuctionBid, hasAuctionBidAmount, getAuctionVisibleDayCount } from '../lib/currency.js';
import { TEST_STUDENT_NUMBER, formatStudentNumberLabel } from '../lib/studentIdentity.js';
import { createStudentLetter, isStudentLetterRetained, markStudentLetterRead, normalizeStudentLifeState, pruneExpiredStudentLetters } from '../lib/studentLife.js';
import { FAILURE_STAMP_OPTIONS, toggleFailureStamp } from '../lib/failureExhibition.js';
import { createFailureExhibitionMissionEntry } from '../lib/failureExhibitionMission.js';
import { getStudentPetState, feedStudentPetEgg, nameStudentPet, selectStudentPet, moveStudentPet, moveGomaCharacter, STUDENT_PET_FEED_AMOUNT } from '../lib/studentPet.js';
import { STUDENT_EMOTIONS, createStudentEmotionEntry, normalizeStudentEmotionHistory, getTodayStudentEmotionEntry, upsertStudentEmotionEntry, getSchoolWeekDateKeys } from '../lib/studentEmotion.js';
import { createSudokuPuzzle, isSudokuSolved, getSudokuWeeklyMissionId, SUDOKU_REWARDS, getStudentSudokuProgressFromSettings, getActiveSudokuDifficulty } from '../lib/sudoku.js';
import { getNumberBaseballGameId, createNumberBaseballAnswer, createNumberBaseballProgressEntry, appendNumberBaseballAttempt, getStudentNumberBaseballProgressFromSettings, getNumberBaseballStatus, getNumberBaseballReward } from '../lib/numberBaseball.js';
import { getKoreanIsoWeekKey } from '../lib/weeklyMission.js';
import { getKoreanDateKey } from '../lib/classword.js';

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const fail = (code = 'STUDENT_COMMAND_INVALID'): never => { throw Object.assign(new Error(code), { code, status: 400 }); };
const text = (value: unknown, max = 5000): string => typeof value === 'string' && value.length <= max ? value : fail();
const rawList = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** The transport commits this result with all read resources under revision checks. */
export const applyStudentStorageCommand = (
  currentValue: unknown, studentNumber: number, action: string, payload: unknown,
  context: { requestId: string; createdAt: string },
): { value: Record<string, unknown>; result: unknown } | null => {
  if (!action.startsWith('student.')) return null;
  if (!Number.isInteger(studentNumber) || studentNumber < 1
    || (studentNumber > 23 && !(studentNumber === TEST_STUDENT_NUMBER
      && (action === 'student.letter.send' || action === 'student.letter.read')))) return fail();
  const current = record(currentValue), input = record(payload), studentKey = String(studentNumber);
  const date = new Date(context.createdAt), weekKey = getKoreanIsoWeekKey(date);
  const life = pruneExpiredStudentLetters(normalizeStudentLifeState(current.studentLife), context.createdAt);
  const storedLife = record(current.studentLife);
  const rawLife: Record<string, unknown> = {
    ...storedLife,
    letters: rawList(storedLife.letters).filter((letter) => isStudentLetterRetained(record(letter).createdAt, context.createdAt)),
  };
  const finish = (value: Record<string, unknown>, result: unknown = { applied: true }) => {
    if (value.currencyHistory !== current.currencyHistory) {
      const knownIds = new Set((normalizeCurrencyHistory(current.currencyHistory)[studentKey] ?? []).map(({ id }) => id));
      const additions = (normalizeCurrencyHistory(value.currencyHistory)[studentKey] ?? []).filter(({ id }) => !knownIds.has(id));
      value.currencyHistory = { ...record(current.currencyHistory), [studentKey]: [...additions, ...rawList(record(current.currencyHistory)[studentKey])] };
    }
    // A domain normalizer may synthesize other students. Only this actor's maps are writable here.
    for (const field of ['currencyBalances', 'currencyHistory', 'studentPets', 'studentEmotionHistory']) {
      if (value[field] !== current[field]) value[field] = { ...record(current[field]), [studentKey]: record(value[field])[studentKey] };
    }
    return { value, result };
  };
  if (action === 'student.letter.send') {
    const recipient = input.recipient;
    if (!Number.isInteger(recipient) || typeof recipient !== 'number' || recipient < 0 || recipient > 23 || recipient === studentNumber) return fail();
    const letterId = input.letterId === undefined ? context.requestId : text(input.letterId, 200);
    if (input.letterId !== undefined && !new RegExp(`^today-friend-recommendation-\\d{4}-\\d{2}-\\d{2}-${studentNumber}-r\\d+$`).test(letterId)) return fail();
    const existing = rawList(rawLife.letters).find((item) => record(item).id === letterId);
    if (existing) {
      const prior = record(existing);
      if (prior.senderStudentNumber !== studentNumber || prior.recipient !== recipient || prior.title !== input.title || prior.content !== input.content) return fail('LETTER_ID_CONFLICT');
      return finish(current);
    }
    const next = createStudentLetter(life, { id: letterId, recipient, senderLabel: formatStudentNumberLabel(studentNumber), senderStudentNumber: studentNumber, title: text(input.title, 200), content: text(input.content), ...(input.replyToId === undefined ? {} : { replyToId: text(input.replyToId, 200) }), createdAt: context.createdAt });
    const letter = next.letters.find(({ id }) => id === letterId);
    if (!letter) return fail();
    return finish({ ...current, studentLife: { ...rawLife, letters: [...rawList(rawLife.letters).filter((item) => record(item).id !== letterId), letter] } });
  }
  if (action === 'student.letter.read') {
    const letterId = text(input.letterId, 200);
    const letter = life.letters.find(({ id, recipient }) => id === letterId && recipient === studentNumber);
    if (!letter) return fail('LETTER_NOT_FOUND');
    const next = markStudentLetterRead(life, studentNumber, letterId, letter.readAt ?? context.createdAt).letters.find(({ id }) => id === letterId);
    return finish({ ...current, studentLife: { ...rawLife, letters: rawList(rawLife.letters).map((item) => record(item).id === letterId ? { ...record(item), readAt: next?.readAt } : item) } });
  }
  if (action === 'student.failure.create') {
    const result = createFailureExhibitionMissionEntry({ ...current, studentLife: { ...rawLife, failureStories: [] } }, { id: context.requestId, studentNumber, failure: text(input.failure), lesson: text(input.lesson), createdAt: context.createdAt });
    if (!result.applied) return fail('FAILURE_STORY_REJECTED');
    const story = result.studentLife.failureStories.find(({ id }) => id === context.requestId);
    return finish({ ...result.value, studentLife: { ...rawLife, failureStories: [...rawList(rawLife.failureStories), story] } }, { applied: true, awarded: result.awarded });
  }
  if (action === 'student.failure.stamp') {
    const storyId = text(input.storyId, 200), stamp = FAILURE_STAMP_OPTIONS.find(({ id }) => id === input.stampId);
    if (!stamp || !life.failureStories.some(({ id }) => id === storyId)) return fail();
    const next = toggleFailureStamp(life.failureStories, storyId, studentNumber, stamp.id).find(({ id }) => id === storyId);
    return finish({ ...current, studentLife: { ...rawLife, failureStories: rawList(rawLife.failureStories).map((item) => record(item).id === storyId ? { ...record(item), stamps: next?.stamps } : item) } });
  }
  if (action.startsWith('student.pet.')) {
    const pet = getStudentPetState(current.studentPets, studentNumber);
    let next = pet;
    let value = current;
    if (action === 'student.pet.feed') {
      const balances = normalizeCurrencyBalances(current.currencyBalances), history = normalizeCurrencyHistory(current.currencyHistory);
      const items = normalizeAuctionItems(current.auctionItems), itemIds = items.map(({ id }) => id);
      const reserved = getReservedAuctionBidAmount(normalizeAuctionBids(current.auctionBids, itemIds), studentNumber, undefined, normalizeAuctionAwards(current.auctionAwards, itemIds), itemIds);
      const before = balances[studentKey];
      if (before - reserved < STUDENT_PET_FEED_AMOUNT) return fail('INSUFFICIENT_FUNDS');
      next = feedStudentPetEgg(pet);
      value = { ...current, currencyBalances: { ...record(current.currencyBalances), [studentKey]: before - STUDENT_PET_FEED_AMOUNT }, currencyHistory: appendCurrencyHistoryEntry(history, { id: `pet-feed-${context.requestId}`, studentNumber, before, after: before - STUDENT_PET_FEED_AMOUNT, reason: 'pet_feed', createdAt: context.createdAt }) };
    } else if (action === 'student.pet.name') {
      next = nameStudentPet(pet, text(input.name, 12)) ?? fail('PET_UPDATE_REJECTED');
    } else if (action === 'student.pet.select') {
      next = selectStudentPet(pet, text(input.petId, 200)) ?? fail('PET_UPDATE_REJECTED');
    } else if (action === 'student.pet.move') {
      const position = record(input.position);
      if (typeof position.x !== 'number' || typeof position.y !== 'number' || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return fail();
      if (input.target !== 'pet' && input.target !== 'goma') return fail();
      next = (input.target === 'pet' ? moveStudentPet : moveGomaCharacter)(pet, { x: position.x, y: position.y }) ?? fail('PET_UPDATE_REJECTED');
    } else return null;
    return finish({ ...value, studentPets: { ...record(current.studentPets), [studentKey]: next } });
  }
  if (action === 'student.emotion.save') {
    if (input.dateKey !== undefined && input.dateKey !== getKoreanDateKey(date))
      throw Object.assign(new Error('STUDENT_SAVE_CONTEXT_CHANGED'), { code: 'STUDENT_SAVE_CONTEXT_CHANGED', status: 409 });
    const emotion = STUDENT_EMOTIONS.find(({ id }) => id === input.emotionId);
    if (!emotion) return fail();
    const history = normalizeStudentEmotionHistory(current.studentEmotionHistory);
    const entry = createStudentEmotionEntry(studentNumber, emotion.id, text(input.comment, 60), date, getTodayStudentEmotionEntry(history, studentNumber, date), text(input.selfMessage, 30));
    const daily = claimDailyEmotionRewardInSettings({ ...current, studentEmotionHistory: upsertStudentEmotionEntry(history, entry) }, studentNumber, entry.dateKey, context.createdAt);
    const weekly = claimWeeklyEmotionRewardInSettings(daily.value, studentNumber, getSchoolWeekDateKeys(date), context.createdAt);
    return finish({ ...weekly.value, studentEmotionHistory: { ...record(current.studentEmotionHistory), [studentKey]: [entry, ...rawList(record(current.studentEmotionHistory)[studentKey]).filter((item) => record(item).dateKey !== entry.dateKey)] } });
  }
  if (action === 'student.auction.bid') {
    const items = normalizeAuctionItems(current.auctionItems), ids = items.map(({ id }) => id);
    const item = items.find(({ id }) => id === input.itemId), amount = input.amount;
    if (!item || item.dayIndex >= getAuctionVisibleDayCount(date) || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) return fail();
    const bids = normalizeAuctionBids(current.auctionBids, ids), awards = normalizeAuctionAwards(current.auctionAwards, ids), history = normalizeAuctionBidHistory(current.auctionBidHistory, ids);
    if (awards[item.id]) return fail('ALREADY_AWARDED');
    if (bids[item.id]?.bidder === studentNumber) return fail('ALREADY_HIGHEST_BIDDER');
    if (amount < getMinimumAuctionBid(item, bids[item.id]?.amount ?? 0)) return fail('BID_TOO_LOW');
    if (hasAuctionBidAmount(history, item.id, amount)) return fail('DUPLICATE_BID_AMOUNT');
    if (amount > normalizeCurrencyBalances(current.currencyBalances)[studentKey] - getReservedAuctionBidAmount(bids, studentNumber, item.id, awards, ids)) return fail('INSUFFICIENT_FUNDS');
    return finish({ ...current, auctionBids: { ...record(current.auctionBids), [item.id]: { bidder: studentNumber, amount } }, auctionBidHistory: { ...record(current.auctionBidHistory), [item.id]: [...rawList(record(current.auctionBidHistory)[item.id]), { itemId: item.id, bidder: studentNumber, amount, createdAt: context.createdAt }] } });
  }
  if (action === 'student.sudoku.save' || action === 'student.sudoku.complete') {
    const key = text(input.key, 100), match = /^(\d+):(\d{4}-\d{2}):(basic|challenge)$/.exec(key);
    if (!match || Number(match[1]) !== studentNumber || match[2] !== weekKey || (match[3] !== 'basic' && match[3] !== 'challenge')) return fail();
    const difficulty = match[3], puzzle = createSudokuPuzzle(studentNumber, weekKey, difficulty);
    const progress = getStudentSudokuProgressFromSettings(current), existing = progress[key];
    const active = getActiveSudokuDifficulty(progress, studentNumber, weekKey);
    if (active && active !== difficulty) return fail('SUDOKU_DIFFICULTY_LOCKED');
    const cells = input.cells;
    if (!Array.isArray(cells) || cells.length !== puzzle.puzzle.length || !cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= puzzle.gridSize) || puzzle.puzzle.some((cell, index) => cell !== 0 && cells[index] !== cell)) return fail();
    const complete = action.endsWith('.complete');
    if (complete && !isSudokuSolved(puzzle, cells)) return fail('SUDOKU_NOT_SOLVED');
    const value = complete ? claimSudokuRewardInSettings(current, studentNumber, getSudokuWeeklyMissionId(studentNumber, weekKey), SUDOKU_REWARDS[difficulty], context.createdAt).value : current;
    return finish({ ...value, studentSudoku: { ...record(current.studentSudoku), [key]: existing?.completedAt ? existing : { puzzleId: puzzle.id, cells, completedAt: complete ? context.createdAt : null } } });
  }
  if (action === 'student.baseball.save' || action === 'student.baseball.complete') {
    const key = text(input.key, 100);
    if (key !== `${studentNumber}:${weekKey}` || !Array.isArray(input.attempts) || input.attempts.length > 9) return fail();
    const answer = createNumberBaseballAnswer(studentNumber, weekKey), existing = getStudentNumberBaseballProgressFromSettings(current)[key];
    let entry = createNumberBaseballProgressEntry(getNumberBaseballGameId(studentNumber, weekKey));
    // The existing guess prefix cannot be rewritten to obtain a larger reward.
    for (let index = 0; index < input.attempts.length; index++) {
      const attempt = record(input.attempts[index]), guess = attempt.guess;
      if (!Array.isArray(guess) || guess.length !== 3 || !guess.every((digit) => Number.isInteger(digit) && digit >= 1 && digit <= 9) || new Set(guess).size !== 3) return fail();
      if (existing?.attempts[index] && JSON.stringify(existing.attempts[index].guess) !== JSON.stringify(guess)) return fail('GAME_PROGRESS_CONFLICT');
      entry = appendNumberBaseballAttempt(entry, answer, [guess[0], guess[1], guess[2]], existing?.attempts[index]?.createdAt ?? context.createdAt) ?? fail('GAME_ALREADY_FINISHED');
    }
    if (existing && entry.attempts.length < existing.attempts.length) return fail('GAME_PROGRESS_CONFLICT');
    const completed = getNumberBaseballStatus(entry, answer) === 'completed';
    if (action.endsWith('.complete') && !completed) return fail('GAME_NOT_SOLVED');
    const reward = getNumberBaseballReward(entry.attempts.length);
    const value = completed && reward !== null ? claimNumberBaseballRewardInSettings(current, studentNumber, entry.gameId, reward, context.createdAt).value : current;
    return finish({ ...value, studentNumberBaseball: { ...record(current.studentNumberBaseball), [key]: entry } });
  }
  return null;
};
