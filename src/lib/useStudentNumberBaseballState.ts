import { useCallback, useMemo, useRef, useState } from 'react';
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
  getNumberBaseballProgressKey,
  getNumberBaseballStatus,
  getStudentNumberBaseballProgressFromSettings,
  loadStoredStudentNumberBaseballProgress,
  storeStudentNumberBaseballProgress,
  type NumberBaseballProgressEntry,
  type StudentNumberBaseballProgress,
} from './numberBaseball';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import { isSupabaseSettingsEnabled, updateSharedSettings } from './supabaseSettings';
import { getKoreanIsoWeekKey } from './weeklyMission';

type UseStudentNumberBaseballStateOptions = {
  readonly studentNumber: number;
  readonly currencyHistory: CurrencyHistory;
  readonly onCurrencyBalancesChange: (balances: CurrencyBalances) => void;
  readonly onCurrencyHistoryChange: (history: CurrencyHistory) => void;
};

export const useStudentNumberBaseballState = ({
  studentNumber,
  currencyHistory,
  onCurrencyBalancesChange,
  onCurrencyHistoryChange,
}: UseStudentNumberBaseballStateOptions) => {
  const [progress, setProgress] = useState<StudentNumberBaseballProgress>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentNumberBaseballProgress()
  ));
  const weekKey = getKoreanIsoWeekKey();
  const saveQueueRef = useRef(Promise.resolve(true));
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

  const saveProgressAtKey = useCallback((targetProgressKey: string, entry: NumberBaseballProgressEntry) => {
    setProgress((current) => ({ ...current, [targetProgressKey]: entry }));
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        let savedProgress: StudentNumberBaseballProgress = {};
        if (isSupabaseSettingsEnabled) {
          await updateSharedSettings((currentValue) => {
            savedProgress = {
              ...getStudentNumberBaseballProgressFromSettings(currentValue),
              [targetProgressKey]: entry,
            };
            const current = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
              ? Object.fromEntries(Object.entries(currentValue))
              : {};
            return { ...current, studentNumberBaseball: savedProgress };
          });
        } else {
          savedProgress = { ...loadStoredStudentNumberBaseballProgress(), [targetProgressKey]: entry };
          if (!storeStudentNumberBaseballProgress(savedProgress)) return false;
        }
        setProgress(savedProgress);
        return true;
      } catch (error) {
        console.error('Failed to save number baseball progress.', error);
        return false;
      }
    });
    return saveQueueRef.current;
  }, []);

  const saveProgress = useCallback((entry: NumberBaseballProgressEntry) => (
    saveProgressAtKey(progressKey, entry)
  ), [progressKey, saveProgressAtKey]);

  const startGame = useCallback(async () => {
    if (progress[progressKey]?.gameId === gameId) return true;
    return saveProgressAtKey(progressKey, createNumberBaseballProgressEntry(gameId));
  }, [gameId, progress, progressKey, saveProgressAtKey]);

  const completeGame = useCallback((entry: NumberBaseballProgressEntry, rewardAmount: number) => {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      let savedProgress: StudentNumberBaseballProgress = {};
      let savedBalances = normalizeCurrencyBalances(null);
      let savedHistory = normalizeCurrencyHistory(null);
      let completionSaved = false;
      try {
        if (isSupabaseSettingsEnabled) {
          await updateSharedSettings((currentValue) => {
            const reward = claimNumberBaseballRewardInSettings(
              currentValue,
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
            savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
            savedHistory = reward.history;
            savedProgress = {
              ...getStudentNumberBaseballProgressFromSettings(reward.value),
              [progressKey]: entry,
            };
            return completionSaved
              ? { ...reward.value, studentNumberBaseball: savedProgress }
              : reward.value;
          });
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
          })) return false;
          savedProgress = { ...loadStoredStudentNumberBaseballProgress(), [progressKey]: entry };
          if (!storeStudentNumberBaseballProgress(savedProgress)) return false;
        }
        if (!completionSaved) return false;
        setProgress(savedProgress);
        onCurrencyBalancesChange(savedBalances);
        onCurrencyHistoryChange(savedHistory);
        return true;
      } catch (error) {
        console.error('Failed to complete number baseball mission.', error);
        return false;
      }
    });
    return saveQueueRef.current;
  }, [onCurrencyBalancesChange, onCurrencyHistoryChange, progressKey, studentNumber]);

  const applySharedProgress = useCallback((value: unknown) => {
    setProgress(getStudentNumberBaseballProgressFromSettings(value));
  }, []);

  const refreshLocalProgress = useCallback(() => {
    setProgress(loadStoredStudentNumberBaseballProgress());
  }, []);

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
  };
};
