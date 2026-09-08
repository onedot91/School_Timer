import { executeStudentStorageCommand } from './studentStorageCommand.js';
import { reportSaveFailure } from './saveFailureClient.js';
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
import { isSupabaseSettingsEnabled } from './supabaseSettings';
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
  readonly onSharedSettingsChange: (value: Record<string, unknown>, updatedAt: string) => boolean;
  readonly onCurrencyBalancesChange: (balances: CurrencyBalances) => void;
  readonly onCurrencyHistoryChange: (history: CurrencyHistory) => void;
};

export const useStudentSudokuState = ({
  studentNumber,
  currencyHistory,
  onSharedSettingsChange,
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
          const response = await executeStudentStorageCommand(studentNumber, 'student.sudoku.save', { key, cells: entry.cells }, key);
          onSharedSettingsChange(response.value, response.updatedAt);
          return true;
        } else {
          savedProgress = { ...loadStoredStudentSudokuProgress(), [key]: entry };
          if (!storeStudentSudokuProgress(savedProgress)) { reportSaveFailure('sudoku', 'storage', studentNumber); return false; }
        }
        setStudentSudokuProgress(savedProgress);
        return true;
      } catch (error) {
        console.error('Failed to save Sudoku progress.', error);
        return false;
      }
    });
    return saveQueueRef.current;
  }, [onSharedSettingsChange, studentNumber]);

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
          const response = await executeStudentStorageCommand(studentNumber, 'student.sudoku.complete', { key, cells: entry.cells }, key);
          onSharedSettingsChange(response.value, response.updatedAt);
          return true;
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
          })) { reportSaveFailure('sudoku', 'storage', studentNumber); return false; }
          savedProgress = {
            ...loadStoredStudentSudokuProgress(),
            [key]: { ...entry, completedAt },
          };
          if (!storeStudentSudokuProgress(savedProgress)) { reportSaveFailure('sudoku', 'storage', studentNumber); return false; }
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
  }, [onSharedSettingsChange, onCurrencyBalancesChange, onCurrencyHistoryChange, studentNumber, weeklyMissionId]);

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
