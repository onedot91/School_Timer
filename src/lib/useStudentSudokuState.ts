import { useCallback, useMemo, useRef, useState } from 'react';
import {
  claimSudokuRewardInSettings,
  hasSudokuReward,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import { isSupabaseSettingsEnabled, updateSharedSettings } from './supabaseSettings';
import {
  SUDOKU_REWARDS,
  createSudokuPuzzle,
  getActiveSudokuDifficulty,
  getCompletedSudokuDifficulty,
  getStudentSudokuProgressFromSettings,
  getSudokuPuzzleId,
  getSudokuProgressKey,
  getSudokuWeeklyMissionId,
  loadStoredStudentSudokuProgress,
  storeStudentSudokuProgress,
  type StudentSudokuProgress,
  type SudokuDifficulty,
  type SudokuProgressEntry,
} from './sudoku';
import { getKoreanIsoWeekKey } from './weeklyMission';

type UseStudentSudokuStateOptions = {
  readonly studentNumber: number;
  readonly currencyHistory: CurrencyHistory;
  readonly onCurrencyBalancesChange: (balances: CurrencyBalances) => void;
  readonly onCurrencyHistoryChange: (history: CurrencyHistory) => void;
};

export const useStudentSudokuState = ({
  studentNumber,
  currencyHistory,
  onCurrencyBalancesChange,
  onCurrencyHistoryChange,
}: UseStudentSudokuStateOptions) => {
  const [studentSudokuProgress, setStudentSudokuProgress] = useState<StudentSudokuProgress>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentSudokuProgress()
  ));
  const saveQueueRef = useRef(Promise.resolve(true));
  const koreanWeekKey = getKoreanIsoWeekKey();
  const weeklyMissionId = getSudokuWeeklyMissionId(studentNumber, koreanWeekKey);
  const hasCompletedWeeklySudokuMission = hasSudokuReward(
    currencyHistory,
    studentNumber,
    weeklyMissionId,
  );
  const activeSudokuDifficulty = useMemo(() => getActiveSudokuDifficulty(
    studentSudokuProgress,
    studentNumber,
    koreanWeekKey,
  ), [koreanWeekKey, studentNumber, studentSudokuProgress]);
  const completedSudokuDifficulty = useMemo(() => getCompletedSudokuDifficulty(
    studentSudokuProgress,
    studentNumber,
    koreanWeekKey,
  ), [koreanWeekKey, studentNumber, studentSudokuProgress]);

  const saveSudokuProgress = useCallback((key: string, entry: SudokuProgressEntry) => {
    setStudentSudokuProgress((current) => ({ ...current, [key]: entry }));
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        let savedProgress: StudentSudokuProgress = {};
        if (isSupabaseSettingsEnabled) {
          await updateSharedSettings((currentValue) => {
            savedProgress = { ...getStudentSudokuProgressFromSettings(currentValue), [key]: entry };
            const current = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
              ? Object.fromEntries(Object.entries(currentValue))
              : {};
            return { ...current, studentSudoku: savedProgress };
          });
        } else {
          savedProgress = { ...loadStoredStudentSudokuProgress(), [key]: entry };
          if (!storeStudentSudokuProgress(savedProgress)) return false;
        }
        setStudentSudokuProgress(savedProgress);
        return true;
      } catch (error) {
        console.error('Failed to save Sudoku progress.', error);
        return false;
      }
    });
    return saveQueueRef.current;
  }, []);

  const startSudoku = useCallback(async (difficulty: SudokuDifficulty) => {
    const activeDifficulty = getActiveSudokuDifficulty(studentSudokuProgress, studentNumber, koreanWeekKey);
    if (activeDifficulty) return activeDifficulty;
    const puzzle = createSudokuPuzzle(studentNumber, koreanWeekKey, difficulty);
    const key = getSudokuProgressKey(studentNumber, koreanWeekKey, difficulty);
    const existingEntry = studentSudokuProgress[key];
    if (existingEntry?.puzzleId === puzzle.id && existingEntry.completedAt !== null) return difficulty;
    const saved = await saveSudokuProgress(key, {
      puzzleId: puzzle.id,
      cells: puzzle.puzzle,
      completedAt: null,
    });
    return saved ? difficulty : null;
  }, [koreanWeekKey, saveSudokuProgress, studentNumber, studentSudokuProgress]);

  const completeSudoku = useCallback((
    key: string,
    entry: SudokuProgressEntry,
    difficulty: SudokuDifficulty,
  ) => {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const completedAt = new Date().toISOString();
      let savedProgress: StudentSudokuProgress = {};
      let savedBalances = normalizeCurrencyBalances(null);
      let savedHistory = normalizeCurrencyHistory(null);
      let completionSaved = false;
      try {
        if (isSupabaseSettingsEnabled) {
          await updateSharedSettings((currentValue) => {
            const reward = claimSudokuRewardInSettings(
              currentValue,
              studentNumber,
              weeklyMissionId,
              SUDOKU_REWARDS[difficulty],
              completedAt,
            );
            completionSaved = reward.awarded || hasSudokuReward(
              reward.value.currencyHistory,
              studentNumber,
              weeklyMissionId,
            );
            savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
            savedHistory = reward.history;
            savedProgress = getStudentSudokuProgressFromSettings(reward.value);
            if (!completionSaved) return reward.value;
            savedProgress = {
              ...savedProgress,
              [key]: { ...entry, completedAt: savedProgress[key]?.completedAt ?? completedAt },
            };
            return { ...reward.value, studentSudoku: savedProgress };
          });
        } else {
          const snapshot = loadStoredStudentPetSnapshot();
          const reward = claimSudokuRewardInSettings(
            snapshot,
            studentNumber,
            weeklyMissionId,
            SUDOKU_REWARDS[difficulty],
            completedAt,
          );
          completionSaved = reward.awarded || hasSudokuReward(
            reward.value.currencyHistory,
            studentNumber,
            weeklyMissionId,
          );
          if (!completionSaved) return false;
          savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
          savedHistory = reward.history;
          if (!storeStudentPetSnapshot({
            ...snapshot,
            currencyBalances: savedBalances,
            currencyHistory: savedHistory,
          })) return false;
          savedProgress = {
            ...loadStoredStudentSudokuProgress(),
            [key]: { ...entry, completedAt },
          };
          if (!storeStudentSudokuProgress(savedProgress)) return false;
        }
        if (!completionSaved) return false;
        setStudentSudokuProgress(savedProgress);
        onCurrencyBalancesChange(savedBalances);
        onCurrencyHistoryChange(savedHistory);
        return true;
      } catch (error) {
        console.error('Failed to complete Sudoku mission.', error);
        return false;
      }
    });
    return saveQueueRef.current;
  }, [onCurrencyBalancesChange, onCurrencyHistoryChange, studentNumber, weeklyMissionId]);

  const applySharedStudentSudoku = useCallback((value: unknown) => {
    setStudentSudokuProgress(getStudentSudokuProgressFromSettings(value));
  }, []);

  const refreshLocalStudentSudoku = useCallback(() => {
    setStudentSudokuProgress(loadStoredStudentSudokuProgress());
  }, []);

  return {
    studentSudokuProgress,
    hasCompletedWeeklySudokuMission,
    activeSudokuDifficulty,
    completedSudokuDifficulty,
    saveSudokuProgress,
    startSudoku,
    completeSudoku,
    applySharedStudentSudoku,
    refreshLocalStudentSudoku,
  };
};
