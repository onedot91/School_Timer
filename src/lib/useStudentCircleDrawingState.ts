import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  decodeCircleDrawingPoints,
  getCircleDrawingChallenge,
  getCircleDrawingDateKey,
  getCircleDrawingProgressKey,
  getCircleDrawingReward,
  getCircleDrawingRewardId,
  getStudentCircleDrawingProgressFromSettings,
  loadStoredCircleDrawingTries,
  loadStoredStudentCircleDrawingProgress,
  recordCircleDrawingTry,
  storeCircleDrawingTries,
  type CircleDrawingTries,
  scoreCircleDrawing,
  storeStudentCircleDrawingProgress,
  type StudentCircleDrawingProgress,
} from './circleDrawing';
import {
  claimCircleDrawingRewardInSettings,
  hasCircleDrawingReward,
  normalizeCurrencyBalances,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency';
import { reportSaveFailure } from './saveFailureClient.js';
import { StorageCommandError } from './storageCommandClient.js';
import { executeStudentStorageCommand } from './studentStorageCommand.js';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import { isSupabaseSettingsEnabled } from './supabaseSettings';

export type CircleDrawingSubmitOutcome = 'saved' | 'alreadySubmitted' | 'failed';

type Options = {
  readonly studentNumber: number;
  readonly currencyHistory: CurrencyHistory;
  readonly onSharedSettingsChange: (value: Record<string, unknown>, updatedAt: string) => boolean;
  readonly onCurrencyBalancesChange: (balances: CurrencyBalances) => void;
  readonly onCurrencyHistoryChange: (history: CurrencyHistory) => void;
};

export const useStudentCircleDrawingState = ({
  studentNumber,
  currencyHistory,
  onSharedSettingsChange,
  onCurrencyBalancesChange,
  onCurrencyHistoryChange,
}: Options) => {
  const [progress, setProgress] = useState<StudentCircleDrawingProgress>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentCircleDrawingProgress()
  ));
  const dateKey = getCircleDrawingDateKey();
  const key = getCircleDrawingProgressKey(studentNumber, dateKey);
  const keyRef = useRef(key);
  keyRef.current = key;
  const entry = progress[key] ?? null;
  const challenge = useMemo(() => getCircleDrawingChallenge(studentNumber, dateKey), [dateKey, studentNumber]);
  const rewardId = getCircleDrawingRewardId(studentNumber, dateKey);
  const [tries, setTries] = useState<CircleDrawingTries>(() => loadStoredCircleDrawingTries(key));
  useEffect(() => { setTries(loadStoredCircleDrawingTries(key)); }, [key]);

  /** Counts one scored drawing before it is confirmed. */
  const recordTry = useCallback((points: string): CircleDrawingTries => {
    const next = recordCircleDrawingTry(loadStoredCircleDrawingTries(key), points);
    storeCircleDrawingTries(key, next);
    setTries(next);
    return next;
  }, [key]);
  const hasReward = useMemo(
    () => hasCircleDrawingReward(currencyHistory, studentNumber, rewardId),
    [currencyHistory, rewardId, studentNumber],
  );

  const submit = useCallback(async (points: string): Promise<CircleDrawingSubmitOutcome> => {
    const submittedKey = key;
    try {
      if (isSupabaseSettingsEnabled) {
        const response = await executeStudentStorageCommand(studentNumber, 'student.circle.submit', { key: submittedKey, points }, submittedKey);
        if (keyRef.current !== submittedKey) return 'failed';
        if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
        const saved = getStudentCircleDrawingProgressFromSettings(response.value)[submittedKey];
        if (saved) setProgress((current) => ({ ...current, [submittedKey]: saved }));
        return 'saved';
      }
      const decoded = decodeCircleDrawingPoints(points);
      const scored = decoded ? scoreCircleDrawing(decoded, challenge) : null;
      if (!scored) return 'failed';
      const stored = loadStoredStudentCircleDrawingProgress();
      if (stored[submittedKey]) {
        setProgress(stored);
        return 'alreadySubmitted';
      }
      const submittedAt = new Date().toISOString();
      const snapshot = loadStoredStudentPetSnapshot();
      const reward = claimCircleDrawingRewardInSettings(snapshot, studentNumber, rewardId, getCircleDrawingReward(scored.score), submittedAt);
      if (!reward.awarded && !hasCircleDrawingReward(reward.history, studentNumber, rewardId)) return 'failed';
      const balances = normalizeCurrencyBalances(reward.value.currencyBalances);
      if (!storeStudentPetSnapshot({ ...snapshot, currencyBalances: balances, currencyHistory: reward.history })) {
        reportSaveFailure('circleDrawing', 'storage', studentNumber);
        return 'failed';
      }
      const next = { ...stored, [submittedKey]: { score: scored.score, points, submittedAt } };
      if (!storeStudentCircleDrawingProgress(next)) {
        reportSaveFailure('circleDrawing', 'storage', studentNumber);
        return 'failed';
      }
      setProgress(next);
      onCurrencyBalancesChange(balances);
      onCurrencyHistoryChange(reward.history);
      return 'saved';
    } catch (error) {
      if (error instanceof StorageCommandError && error.serverCode === 'CIRCLE_ALREADY_SUBMITTED') return 'alreadySubmitted';
      console.error('Failed to save circle drawing.', error);
      return 'failed';
    }
  }, [challenge, key, onCurrencyBalancesChange, onCurrencyHistoryChange, onSharedSettingsChange, rewardId, studentNumber]);

  const applySharedProgress = useCallback((value: unknown) => {
    const remote = getStudentCircleDrawingProgressFromSettings(value);
    // A partial response without the field must not erase what this screen already knows.
    if (value && typeof value === 'object' && 'studentCircleDrawing' in value) setProgress(remote);
  }, []);

  const refreshLocalProgress = useCallback(() => {
    setProgress(loadStoredStudentCircleDrawingProgress());
  }, []);

  return {
    entry,
    challenge,
    dateKey,
    hasReward,
    tries,
    recordTry,
    submit,
    applySharedProgress,
    refreshLocalProgress,
  };
};
