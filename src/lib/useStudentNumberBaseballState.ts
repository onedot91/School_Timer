import { clearStudentStorageFormDraft, executeStudentStorageCommand, hasUnconfirmedStudentStorageDraft, isRejectedStudentStorageDraft, loadStudentStorageDraft, readyStudentStorageDrafts, saveStudentStorageFormDraft, subscribeStudentStorageDrafts } from './studentStorageCommand.js';
import { StorageCommandError } from './storageCommandClient.js';
import { loadLatestStudentGameForm, useStudentGameConflict } from './useStudentGameConflict.js';
import { confirmGameProgressEdit, reconcileGameProgress, restoreNumberBaseballProgressDraft, type GameProgressEdits } from './studentGameProgressDraft.js';
import { reportSaveFailure } from './saveFailureClient.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  claimNumberBaseballRewardInSettings,
  hasNumberBaseballReward,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency';
import {
  createNumberBaseballAnswer,
  createNumberBaseballProgressEntry,
  getNumberBaseballGameId,
  getNumberBaseballReward,
  getNumberBaseballProgressKey,
  getNumberBaseballStatus,
  getStudentNumberBaseballProgressFromSettings,
  loadStoredStudentNumberBaseballProgress,
  storeStudentNumberBaseballProgress,
  type NumberBaseballProgressEntry,
  type StudentNumberBaseballProgress,
} from './numberBaseball';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import { isSupabaseSettingsEnabled } from './supabaseSettings';
import { getKoreanIsoWeekKey } from './weeklyMission';

type UseStudentNumberBaseballStateOptions = {
  readonly studentNumber: number;
  readonly currencyHistory: CurrencyHistory;
  readonly onSharedSettingsChange: (value: Record<string, unknown>, updatedAt: string) => boolean;
  readonly onCurrencyBalancesChange: (balances: CurrencyBalances) => void;
  readonly onCurrencyHistoryChange: (history: CurrencyHistory) => void;
};

const matchesBaseballAttempts = (left: NumberBaseballProgressEntry, right: NumberBaseballProgressEntry) => (
  left.gameId === right.gameId && left.attempts.length === right.attempts.length
  && left.attempts.every((attempt, index) => attempt.guess.every((digit, digitIndex) => digit === right.attempts[index]?.guess[digitIndex]))
);

export const useStudentNumberBaseballState = ({
  studentNumber,
  currencyHistory,
  onSharedSettingsChange,
  onCurrencyBalancesChange,
  onCurrencyHistoryChange,
}: UseStudentNumberBaseballStateOptions) => {
  const [progress, setProgress] = useState<StudentNumberBaseballProgress>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentNumberBaseballProgress()
  ));
  const weekKey = getKoreanIsoWeekKey();
  const owner = `${studentNumber}:${weekKey}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const versionRef = useRef(0);
  const editsRef = useRef<GameProgressEdits<NumberBaseballProgressEntry>>({});
  const restoredKeysRef = useRef(new Set<string>());
  const savingKeysRef = useRef(new Map<string, number>());
  const saveQueueRef = useRef(Promise.resolve(true));
  const conflictRef = useRef(false);
  const gameConflict = useStudentGameConflict(studentNumber, owner, 'baseball');
  const progressKey = getNumberBaseballProgressKey(studentNumber, weekKey);
  const gameId = getNumberBaseballGameId(studentNumber, weekKey);
  const progressEntry = progress[progressKey] ?? null;
  const answer = useMemo(() => createNumberBaseballAnswer(studentNumber, weekKey), [studentNumber, weekKey]);
  const status = progressEntry === null ? 'incomplete' : getNumberBaseballStatus(progressEntry, answer);
  const hasReward = useMemo(() => hasNumberBaseballReward(
    currencyHistory,
    studentNumber,
    gameId,
  ), [currencyHistory, gameId, studentNumber]);

  const prepareWrite = useCallback((key: string, entry: NumberBaseballProgressEntry, action: string) => {
    restoredKeysRef.current.delete(key);
    const payload = { key, attempts: entry.attempts.map(({ guess }) => ({ guess })) };
    saveStudentStorageFormDraft(studentNumber, action, payload, key);
    const version = ++versionRef.current;
    editsRef.current = { ...editsRef.current, [key]: { version, entry: { ...entry, completedAt: null }, confirmed: false } };
    setProgress((current) => ({ ...current, [key]: { ...entry, completedAt: null } }));
    savingKeysRef.current.set(key, version);
    return { payload, version };
  }, [studentNumber]);

  const applyProgress = useCallback((remote: StudentNumberBaseballProgress) => {
    const next = reconcileGameProgress(remote, editsRef.current, matchesBaseballAttempts);
    editsRef.current = next.edits;
    setProgress(next.progress);
  }, []);

  const inspectBaseballConflict = async () => {
    const latest = loadLatestStudentGameForm(studentNumber, 'baseball', progressKey);
    const local = restoreNumberBaseballProgressDraft(studentNumber, weekKey, latest?.draft.payload) ?? editsRef.current[progressKey]?.entry;
    if (!local) return;
    conflictRef.current = true;
    const format = (entry: NumberBaseballProgressEntry | undefined) => entry?.attempts.map((attempt, index) => `${index + 1}회: ${attempt.guess.join('')}`).join('\n') || '입력 없음';
    await gameConflict.inspect(progressKey, { key: progressKey, attempts: local.attempts.map(({ guess }) => ({ guess })) }, format(local), value => {
      const remote = getStudentNumberBaseballProgressFromSettings(value)[progressKey];
      return { remoteText: format(remote), summary: `다른 기기에서 기록이 바뀌었어요. 내 입력 ${local.attempts.length}회 · 최신 기록 ${remote?.attempts.length ?? 0}회` };
    });
  };

  const continueBaseballFromLatest = async () => {
    const snapshot = await gameConflict.adopt();
    if (!snapshot || ownerRef.current !== owner) return false;
    editsRef.current = Object.fromEntries(Object.entries(editsRef.current).filter(([key]) => key !== progressKey));
    conflictRef.current = false;
    applyProgress(getStudentNumberBaseballProgressFromSettings(snapshot.value));
    onSharedSettingsChange(snapshot.value, snapshot.updatedAt);
    return true;
  };

  const saveProgressAtKey = useCallback((targetProgressKey: string, entry: NumberBaseballProgressEntry) => {
    const write = prepareWrite(targetProgressKey, entry, 'student.baseball.save');
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        if (conflictRef.current || ownerRef.current !== owner || getKoreanIsoWeekKey() !== weekKey) return false;
        let savedProgress: StudentNumberBaseballProgress = {};
        if (isSupabaseSettingsEnabled) {
          const response = await executeStudentStorageCommand(studentNumber, 'student.baseball.save', write.payload, targetProgressKey);
          if (ownerRef.current !== owner) return false;
          editsRef.current = confirmGameProgressEdit(editsRef.current, targetProgressKey, write.version);
          if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
          return true;
        } else {
          savedProgress = { ...loadStoredStudentNumberBaseballProgress(), [targetProgressKey]: entry };
          if (!storeStudentNumberBaseballProgress(savedProgress)) { reportSaveFailure('numberBaseball', 'storage', studentNumber); return false; }
        }
        if (editsRef.current[targetProgressKey]?.version === write.version) clearStudentStorageFormDraft(studentNumber, 'student.baseball.save', targetProgressKey);
        editsRef.current = confirmGameProgressEdit(editsRef.current, targetProgressKey, write.version);
        applyProgress(savedProgress);
        return true;
      } catch (error) {
        if (error instanceof StorageCommandError && (error.status === 409 || error.serverCode === 'GAME_PROGRESS_CONFLICT') && ownerRef.current === owner) await inspectBaseballConflict();
        console.error('Failed to save number baseball progress.', error);
        return false;
      } finally {
        if (savingKeysRef.current.get(targetProgressKey) === write.version) savingKeysRef.current.delete(targetProgressKey);
      }
    });
    return saveQueueRef.current;
  }, [applyProgress, onSharedSettingsChange, owner, prepareWrite, studentNumber, weekKey]);

  const saveProgress = useCallback((entry: NumberBaseballProgressEntry) => (
    saveProgressAtKey(progressKey, entry)
  ), [progressKey, saveProgressAtKey]);

  const startGame = useCallback(async () => {
    if (progress[progressKey]?.gameId === gameId) return true;
    return saveProgressAtKey(progressKey, createNumberBaseballProgressEntry(gameId));
  }, [gameId, progress, progressKey, saveProgressAtKey]);

  const completeGame = useCallback((entry: NumberBaseballProgressEntry, rewardAmount: number) => {
    const write = prepareWrite(progressKey, entry, 'student.baseball.complete');
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      let savedProgress: StudentNumberBaseballProgress = {};
      let savedBalances = normalizeCurrencyBalances(null);
      let savedHistory = normalizeCurrencyHistory(null);
      let completionSaved = false;
      try {
        if (conflictRef.current || ownerRef.current !== owner || getKoreanIsoWeekKey() !== weekKey) return false;
        if (isSupabaseSettingsEnabled) {
          const response = await executeStudentStorageCommand(studentNumber, 'student.baseball.complete', write.payload, progressKey);
          if (ownerRef.current !== owner) return false;
          editsRef.current = confirmGameProgressEdit(editsRef.current, progressKey, write.version);
          if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
          return true;
        } else {
          const snapshot = loadStoredStudentPetSnapshot();
          const reward = claimNumberBaseballRewardInSettings(
            snapshot,
            studentNumber,
            entry.gameId,
            rewardAmount,
            entry.completedAt ?? new Date().toISOString(),
          );
          completionSaved = reward.awarded || hasNumberBaseballReward(
            reward.value.currencyHistory,
            studentNumber,
            entry.gameId,
          );
          if (!completionSaved) return false;
          savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
          savedHistory = reward.history;
          if (!storeStudentPetSnapshot({
            ...snapshot,
            currencyBalances: savedBalances,
            currencyHistory: savedHistory,
          })) { reportSaveFailure('numberBaseball', 'storage', studentNumber); return false; }
          savedProgress = { ...loadStoredStudentNumberBaseballProgress(), [progressKey]: entry };
          if (!storeStudentNumberBaseballProgress(savedProgress)) { reportSaveFailure('numberBaseball', 'storage', studentNumber); return false; }
        }
        if (!completionSaved) return false;
        if (editsRef.current[progressKey]?.version === write.version) clearStudentStorageFormDraft(studentNumber, 'student.baseball.complete', progressKey);
        editsRef.current = confirmGameProgressEdit(editsRef.current, progressKey, write.version);
        applyProgress(savedProgress);
        onCurrencyBalancesChange(savedBalances);
        onCurrencyHistoryChange(savedHistory);
        return true;
      } catch (error) {
        if (error instanceof StorageCommandError && (error.status === 409 || error.serverCode === 'GAME_PROGRESS_CONFLICT') && ownerRef.current === owner) await inspectBaseballConflict();
        console.error('Failed to complete number baseball mission.', error);
        return false;
      } finally {
        if (savingKeysRef.current.get(progressKey) === write.version) savingKeysRef.current.delete(progressKey);
      }
    });
    return saveQueueRef.current;
  }, [applyProgress, onSharedSettingsChange, onCurrencyBalancesChange, onCurrencyHistoryChange, owner, prepareWrite, progressKey, studentNumber, weekKey]);

  const applySharedProgress = useCallback((value: unknown) => {
    applyProgress(getStudentNumberBaseballProgressFromSettings(value));
  }, [applyProgress]);

  const refreshLocalProgress = useCallback(() => {
    applyProgress(loadStoredStudentNumberBaseballProgress());
  }, [applyProgress]);

  useEffect(() => {
    editsRef.current = {};
    restoredKeysRef.current.clear();
    conflictRef.current = false;
    gameConflict.reset();
    let active = true;
    const restore = (resume = false) => {
      if (!active || ownerRef.current !== owner || savingKeysRef.current.has(progressKey)) return;
      gameConflict.restoreCopy(progressKey);
      if (conflictRef.current) return;
      const currentEdit = editsRef.current[progressKey];
      if (currentEdit && (currentEdit.confirmed || (!resume && !restoredKeysRef.current.has(progressKey)))) return;
      const latest = loadLatestStudentGameForm(studentNumber, 'baseball', progressKey);
      const complete = latest?.action === 'student.baseball.complete';
      const entry = restoreNumberBaseballProgressDraft(studentNumber, weekKey, latest?.draft.payload);
      if (!entry) return;
      const matchesCurrent = currentEdit && matchesBaseballAttempts(currentEdit.entry, entry);
      if (currentEdit && !matchesCurrent && !restoredKeysRef.current.has(progressKey)) return;
      if (!currentEdit || !matchesCurrent) {
        const version = ++versionRef.current;
        restoredKeysRef.current.add(progressKey);
        editsRef.current = { ...editsRef.current, [progressKey]: { version, entry, confirmed: false } };
        setProgress((current) => ({ ...current, [progressKey]: entry }));
      }
      if (resume) {
        const action = complete ? 'student.baseball.complete' : 'student.baseball.save';
        if (isRejectedStudentStorageDraft(studentNumber, action, progressKey, 'GAME_PROGRESS_CONFLICT') || isRejectedStudentStorageDraft(studentNumber, action, progressKey, 'STUDENT_EDIT_CONFLICT')) {
          void inspectBaseballConflict();
          return;
        }
        if (loadStudentStorageDraft(studentNumber, action, progressKey) && !hasUnconfirmedStudentStorageDraft(studentNumber, action, progressKey)) return;
        const reward = complete ? getNumberBaseballReward(entry.attempts.length) : null;
        if (reward !== null) void completeGame(entry, reward);
        else void saveProgressAtKey(progressKey, entry);
      }
    };
    restore();
    void readyStudentStorageDrafts().then(() => restore(true));
    const unsubscribe = subscribeStudentStorageDrafts(() => restore());
    const resume = () => restore(true);
    window.addEventListener('school-timer-save-recovered', resume);
    window.addEventListener('online', resume);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('school-timer-save-recovered', resume);
      window.removeEventListener('online', resume);
    };
  }, [owner, progressKey, studentNumber, weekKey]);

  return {
    progress,
    progressEntry,
    status,
    hasReward,
    weekKey,
    gameId,
    startGame,
    saveProgress,
    completeGame,
    applySharedProgress,
    refreshLocalProgress,
    baseballConflict: gameConflict.review,
    inspectBaseballConflict,
    continueBaseballFromLatest,
  };
};
