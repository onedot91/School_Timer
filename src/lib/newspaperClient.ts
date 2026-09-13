import { appDataMode, canWriteSharedBackend } from './dataMode.js';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError } from './storageResponseOrder.js';
import { claimPersonalQuestionRewardInSettings, getKoreanIsoWeekKey, parseWeeklyMissionResult } from './weeklyMission.js';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency.js';
import { NewspaperError, isQuestionRecord, parseNewspaperData, parseNewspaperQuestion, type NewspaperData } from './newspaperQuestion.js';
import { applyLocalNewspaperCommand, readLocalNewspaper, projectLocalNewspaper, NEWSPAPER_LOCAL_KEY, isNewspaperCommandResult } from './newspaperLocalStore.js';

export const NEWSPAPER_CHANGE_EVENT = 'school-timer-newspaper-change';
export const loadNewspaper = async (actor: number, weekKey = getKoreanIsoWeekKey()): Promise<NewspaperData> => {
  if (appDataMode === 'mock') return projectLocalNewspaper(readLocalNewspaper(), actor, weekKey);
  const context = captureStorageResponseContext();
  const response = await fetch(`/api/newspaper?weekKey=${encodeURIComponent(weekKey)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new NewspaperError('QUESTION_LOAD_FAILED', response.status);
  const result = parseNewspaperData(await response.json());
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  return result;
};
const parseCommandResult = (value: unknown): Record<string, unknown> => {
  if (!isQuestionRecord(value) || !isNewspaperCommandResult(value)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
  if (value.question !== undefined) parseNewspaperQuestion(value.question);
  if (value.questions !== undefined) {
    if (!Array.isArray(value.questions)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
    value.questions.forEach(parseNewspaperQuestion);
  }
  if (value.reward !== null && value.reward !== undefined) parseWeeklyMissionResult(value.reward);
  return value;
};
const pendingKey = (actor: number) => `school-timer-newspaper-pending-v1:${actor}`;
type PendingRequest = { requestId: string; command: Record<string, unknown> };
export const readPendingNewspaperRequests = (actor: number): PendingRequest[] => {
  if (appDataMode === 'mock') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(pendingKey(actor)) ?? '[]');
    return (Array.isArray(value) ? value : [value]).filter((item): item is PendingRequest =>
      isQuestionRecord(item) && typeof item.requestId === 'string' && isQuestionRecord(item.command));
  } catch { return []; }
};
export const newspaperCommand = async (actor: number, command: Record<string, unknown>): Promise<Record<string, unknown>> => {
  if (appDataMode !== 'mock' && !canWriteSharedBackend(appDataMode)) throw new NewspaperError('QUESTION_READ_ONLY');
  const context = captureStorageResponseContext();
  const execute = async () => {
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (appDataMode === 'mock') {
      const current = readLocalNewspaper();
      const { data, result } = applyLocalNewspaperCommand(current, actor, command);
      window.localStorage.setItem(NEWSPAPER_LOCAL_KEY, JSON.stringify(data));
      if (command.action === 'submit' && command.questionType === 'personal') {
        const snapshot = loadStoredStudentPetSnapshot();
        const claim = claimPersonalQuestionRewardInSettings(snapshot, actor, true, String(command.weekKey));
        if (claim.awarded && !storeStudentPetSnapshot({ ...snapshot, currencyBalances: normalizeCurrencyBalances(claim.value.currencyBalances), currencyHistory: normalizeCurrencyHistory(claim.value.currencyHistory) })) throw new NewspaperError('QUESTION_LOCAL_SAVE_FAILED', 500);
      }
      window.dispatchEvent(new Event(NEWSPAPER_CHANGE_EVENT));
      return parseCommandResult(result);
    }
    const key = pendingKey(actor);
    const pending = readPendingNewspaperRequests(actor);
    const existing = pending.find(item => JSON.stringify(item.command) === JSON.stringify(command));
    const request = existing ?? { requestId: crypto.randomUUID(), command };
    window.localStorage.setItem(key, JSON.stringify(existing ? pending : [...pending, request]));
    const forgetConfirmed = () => {
      try { window.localStorage.setItem(key, JSON.stringify(readPendingNewspaperRequests(actor).filter(item => item.requestId !== request.requestId))); }
      catch { /* A confirmed receipt can safely be replayed if local cleanup is unavailable. */ }
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('/api/newspaper', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request), signal: AbortSignal.timeout(15000) });
        const value: unknown = await response.json();
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        if (!response.ok) {
          const code = isQuestionRecord(value) && typeof value.error === 'string' ? value.error : 'QUESTION_SAVE_FAILED';
          if (response.status < 500) { forgetConfirmed(); throw new NewspaperError(code, response.status); }
          throw new NewspaperError('QUESTION_CONFIRMATION_REQUIRED', response.status);
        }
        const result = parseCommandResult(value);
        forgetConfirmed();
        window.dispatchEvent(new Event(NEWSPAPER_CHANGE_EVENT));
        return result;
      } catch (error) {
        if (error instanceof StorageResponseActorChangedError || error instanceof NewspaperError && error.status < 500) throw error;
        if (attempt === 1) throw new NewspaperError('QUESTION_CONFIRMATION_REQUIRED', 502);
      }
    }
    throw new NewspaperError('QUESTION_CONFIRMATION_REQUIRED', 502);
  };
  return withSaveFailureReporting('newspaper', async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`newspaper:${appDataMode}`, execute);
    return execute();
  }, actor);
};
