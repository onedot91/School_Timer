import { clearStudentStorageFormDraft, executeStudentStorageCommand, hasUnconfirmedStudentStorageDraft, isRejectedStudentStorageDraft, loadStudentStorageAcknowledgement, loadStudentStorageDraft, readyStudentStorageDrafts, saveStudentStorageFormDraft, subscribeStudentStorageDrafts } from './studentStorageCommand.js';
import { StorageCommandError } from './storageCommandClient.js';
import { loadLatestStudentGameForm, useStudentGameConflict } from './useStudentGameConflict.js';
import { captureStudentEditRevisions } from './studentEditRevision.js';
import { assembleStorageState, canonicalStorageJson, isStorageRecord } from './storageV2Codec.js';
import { confirmGameProgressEdit, reconcileGameProgress, restoreSudokuProgressDraft, type GameProgressEdits } from './studentGameProgressDraft.js';
import { reportSaveFailure } from './saveFailureClient.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type SudokuWrite = {
  key: string;
  version: number;
  action: 'student.sudoku.save' | 'student.sudoku.complete';
  payload: { key: string; cells: readonly number[]; expectedRevisions?: Record<string, number> };
  started: boolean;
  blocked?: boolean;
};
const matchesSudokuCells = (left: SudokuProgressEntry, right: SudokuProgressEntry) => (
  left.puzzleId === right.puzzleId && left.cells.every((cell, index) => cell === right.cells[index])
);

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
  const owner = `${studentNumber}:${koreanWeekKey}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const versionRef = useRef(0);
  const editsRef = useRef<GameProgressEdits<SudokuProgressEntry>>({});
  const restoredKeysRef = useRef(new Set<string>());
  const writesRef = useRef(new Set<SudokuWrite>());
  const editBaseRef = useRef<Record<string, Record<string, number> | undefined>>({});
  const conflictKeysRef = useRef(new Set<string>());
  const gameConflict = useStudentGameConflict(studentNumber, owner, 'sudoku');
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

  const prepareWrite = useCallback((key: string, entry: SudokuProgressEntry, action: SudokuWrite['action']) => {
    restoredKeysRef.current.delete(key);
    const expectedRevisions = editBaseRef.current[key]
      ?? (isSupabaseSettingsEnabled ? captureStudentEditRevisions(studentNumber, action) : undefined);
    if (expectedRevisions) editBaseRef.current[key] = expectedRevisions;
    const payload = { key, cells: entry.cells, ...(expectedRevisions ? { expectedRevisions } : {}) };
    saveStudentStorageFormDraft(studentNumber, action, payload, key);
    const version = ++versionRef.current;
    editsRef.current = { ...editsRef.current, [key]: { version, entry, confirmed: false } };
    setStudentSudokuProgress((current) => ({ ...current, [key]: entry }));
    const write: SudokuWrite = { key, version, action, payload, started: false };
    writesRef.current.add(write);
    return write;
  }, [studentNumber]);

  const applyProgress = useCallback((remote: StudentSudokuProgress) => {
    const next = reconcileGameProgress(remote, editsRef.current, matchesSudokuCells);
    editsRef.current = next.edits;
    for (const key of Object.keys(editBaseRef.current)) if (!next.edits[key]) delete editBaseRef.current[key];
    setStudentSudokuProgress(next.progress);
  }, []);

  const inspectSudokuConflict = async (key: string) => {
    const difficulty = key.endsWith(':basic') ? 'basic' : 'challenge';
    const latest = loadLatestStudentGameForm(studentNumber, 'sudoku', key);
    const local = restoreSudokuProgressDraft(studentNumber, koreanWeekKey, difficulty, latest?.draft.payload) ?? editsRef.current[key]?.entry;
    if (!local) return;
    conflictKeysRef.current.add(key);
    for (const queued of writesRef.current) if (queued.key === key) queued.blocked = true;
    const puzzle = createSudokuPuzzle(studentNumber, koreanWeekKey, difficulty);
    const format = (cells: readonly number[]) => Array.from({ length: puzzle.gridSize }, (_, row) => (
      cells.slice(row * puzzle.gridSize, (row + 1) * puzzle.gridSize).map(cell => cell || '·').join(' ')
    )).join('\n');
    await gameConflict.inspect(key, { key, cells: local.cells }, format(local.cells), value => {
      const remote = getStudentSudokuProgressFromSettings(value)[key]?.cells ?? puzzle.puzzle;
      const differences = local.cells.filter((cell, index) => cell !== remote[index]).length;
      return { remoteText: format(remote), summary: `최신 기록과 ${differences}칸이 달라요. 입력을 확인해 주세요.` };
    });
  };

  const continueSudokuFromLatest = async () => {
    const snapshot = await gameConflict.adopt();
    if (!snapshot || ownerRef.current !== owner) return false;
    const key = snapshot.key;
    editsRef.current = Object.fromEntries(Object.entries(editsRef.current).filter(([entryKey]) => entryKey !== key));
    delete editBaseRef.current[key];
    const revisionKey = `scope:studentSudoku:${studentNumber}`;
    const revision = snapshot.revisions[revisionKey];
    if (revision !== undefined) editBaseRef.current[key] = { [revisionKey]: revision };
    conflictKeysRef.current.delete(key);
    applyProgress(getStudentSudokuProgressFromSettings(snapshot.value));
    onSharedSettingsChange(snapshot.value, snapshot.updatedAt);
    return true;
  };

  const confirmPriorWrites = useCallback(async (write: SudokuWrite): Promise<boolean> => {
    for (const action of ['student.sudoku.save', 'student.sudoku.complete'] as const) {
      const prior = loadStudentStorageDraft(studentNumber, action, write.key);
      if (isRejectedStudentStorageDraft(studentNumber, action, write.key)) {
        await inspectSudokuConflict(write.key);
        return false;
      }
      if (!prior) {
        const acknowledgement = loadStudentStorageAcknowledgement(studentNumber, action, write.key);
        if (!acknowledgement || !isStorageRecord(acknowledgement.payload) || !isStorageRecord(acknowledgement.payload.expectedRevisions)) continue;
        const revisionKey = `scope:studentSudoku:${studentNumber}`;
        const previousRevision = acknowledgement.payload.expectedRevisions[revisionKey];
        if (previousRevision !== write.payload.expectedRevisions?.[revisionKey]) continue;
        const patch = acknowledgement.storagePatch;
        const revision = patch?.revisions[revisionKey];
        const difficulty = write.key.endsWith(':basic') ? 'basic' : 'challenge';
        const priorEntry = restoreSudokuProgressDraft(studentNumber, koreanWeekKey, difficulty, acknowledgement.payload);
        const acknowledgedEntry = patch ? getStudentSudokuProgressFromSettings(assembleStorageState(patch))[write.key] : undefined;
        if (revision === undefined || !priorEntry || !acknowledgedEntry || !matchesSudokuCells(acknowledgedEntry, priorEntry)) return false;
        const nextBase = { [revisionKey]: revision };
        editBaseRef.current[write.key] = nextBase;
        for (const queued of writesRef.current) {
          if (queued.key !== write.key || queued.payload.expectedRevisions?.[revisionKey] !== previousRevision) continue;
          queued.payload = { ...queued.payload, expectedRevisions: nextBase };
          if (editsRef.current[write.key]?.version === queued.version) saveStudentStorageFormDraft(studentNumber, queued.action, queued.payload, write.key);
        }
        continue;
      }
      if (action === write.action && canonicalStorageJson(prior.payload) === canonicalStorageJson(write.payload)) continue;
      if (!hasUnconfirmedStudentStorageDraft(studentNumber, action, write.key) || !isStorageRecord(prior.payload) || !isStorageRecord(prior.payload.expectedRevisions)) return false;
      const revisionKey = `scope:studentSudoku:${studentNumber}`;
      const previousRevision = prior.payload.expectedRevisions[revisionKey];
      if (typeof previousRevision !== 'number' || write.payload.expectedRevisions?.[revisionKey] !== previousRevision) return false;
      const difficulty = write.key.endsWith(':basic') ? 'basic' : 'challenge';
      const priorEntry = restoreSudokuProgressDraft(studentNumber, koreanWeekKey, difficulty, prior.payload);
      if (!priorEntry) return false;
      const response = await executeStudentStorageCommand(studentNumber, action, prior.payload, write.key);
      if (ownerRef.current !== owner) return false;
      const revision = response.storagePatch?.revisions[revisionKey];
      const returnedEntry = response.value ? getStudentSudokuProgressFromSettings(response.value)[write.key] : undefined;
      if (revision === undefined || !returnedEntry || !matchesSudokuCells(returnedEntry, priorEntry)) return false;
      const nextBase = { [revisionKey]: revision };
      editBaseRef.current[write.key] = nextBase;
      for (const queued of writesRef.current) {
        if (queued.key !== write.key || queued.payload.expectedRevisions?.[revisionKey] !== previousRevision) continue;
        queued.payload = { ...queued.payload, expectedRevisions: nextBase };
        if (editsRef.current[write.key]?.version === queued.version) saveStudentStorageFormDraft(studentNumber, queued.action, queued.payload, write.key);
      }
      if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
    }
    return true;
  }, [koreanWeekKey, onSharedSettingsChange, owner, studentNumber]);

  const saveSudokuProgress = useCallback((key: string, entry: SudokuProgressEntry) => {
    const write = prepareWrite(key, entry, 'student.sudoku.save');
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        if (write.blocked || conflictKeysRef.current.has(key) || ownerRef.current !== owner || getKoreanIsoWeekKey() !== koreanWeekKey) return false;
        write.started = true;
        let savedProgress: StudentSudokuProgress = {};
        if (isSupabaseSettingsEnabled) {
          if (!write.payload.expectedRevisions) return false;
          if (!await confirmPriorWrites(write)) return false;
          const response = await executeStudentStorageCommand(studentNumber, write.action, write.payload, key);
          if (ownerRef.current !== owner) return false;
          editsRef.current = confirmGameProgressEdit(editsRef.current, key, write.version);
          const revisionKey = `scope:studentSudoku:${studentNumber}`;
          const revision = response.storagePatch?.revisions[revisionKey];
          const returnedEntry = response.value ? getStudentSudokuProgressFromSettings(response.value)[key] : undefined;
          if (revision !== undefined && returnedEntry && matchesSudokuCells(returnedEntry, entry)) {
            const nextBase = { [revisionKey]: revision };
            editBaseRef.current[key] = nextBase;
            for (const queued of writesRef.current) {
              if (queued.started || queued.key !== key || queued.payload.expectedRevisions?.[revisionKey] !== write.payload.expectedRevisions[revisionKey]) continue;
              queued.payload = { ...queued.payload, expectedRevisions: nextBase };
              if (editsRef.current[key]?.version === queued.version) saveStudentStorageFormDraft(studentNumber, queued.action, queued.payload, key);
            }
          } else {
            for (const queued of writesRef.current) if (!queued.started && queued.key === key) queued.blocked = true;
          }
          if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
          return true;
        } else {
          savedProgress = { ...loadStoredStudentSudokuProgress(), [key]: entry };
          if (!storeStudentSudokuProgress(savedProgress)) { reportSaveFailure('sudoku', 'storage', studentNumber); return false; }
        }
        if (editsRef.current[key]?.version === write.version) clearStudentStorageFormDraft(studentNumber, write.action, key);
        editsRef.current = confirmGameProgressEdit(editsRef.current, key, write.version);
        applyProgress(savedProgress);
        return true;
      } catch (error) {
        if (error instanceof StorageCommandError && error.status === 409 && ownerRef.current === owner) await inspectSudokuConflict(key);
        console.error('Failed to save Sudoku progress.', error);
        return false;
      } finally {
        writesRef.current.delete(write);
      }
    });
    return saveQueueRef.current;
  }, [applyProgress, confirmPriorWrites, koreanWeekKey, onSharedSettingsChange, owner, prepareWrite, studentNumber]);

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
    const write = prepareWrite(key, entry, 'student.sudoku.complete');
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const completedAt = new Date().toISOString();
      let savedProgress: StudentSudokuProgress = {};
      let savedBalances = normalizeCurrencyBalances(null);
      let savedHistory = normalizeCurrencyHistory(null);
      let completionSaved = false;
      try {
        if (write.blocked || conflictKeysRef.current.has(key) || ownerRef.current !== owner || getKoreanIsoWeekKey() !== koreanWeekKey) return false;
        write.started = true;
        if (isSupabaseSettingsEnabled) {
          if (!write.payload.expectedRevisions) return false;
          if (!await confirmPriorWrites(write)) return false;
          const response = await executeStudentStorageCommand(studentNumber, write.action, write.payload, key);
          if (ownerRef.current !== owner) return false;
          editsRef.current = confirmGameProgressEdit(editsRef.current, key, write.version);
          if (response.value) onSharedSettingsChange(response.value, response.updatedAt);
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
        if (editsRef.current[key]?.version === write.version) clearStudentStorageFormDraft(studentNumber, write.action, key);
        editsRef.current = confirmGameProgressEdit(editsRef.current, key, write.version);
        applyProgress(savedProgress);
        onCurrencyBalancesChange(savedBalances);
        onCurrencyHistoryChange(savedHistory);
        return true;
      } catch (error) {
        if (error instanceof StorageCommandError && error.status === 409 && ownerRef.current === owner) await inspectSudokuConflict(key);
        console.error('Failed to complete Sudoku mission.', error);
        return false;
      } finally {
        writesRef.current.delete(write);
      }
    });
    return saveQueueRef.current;
  }, [applyProgress, confirmPriorWrites, koreanWeekKey, onSharedSettingsChange, onCurrencyBalancesChange, onCurrencyHistoryChange, owner, prepareWrite, studentNumber, weeklyMissionId]);

  const applySharedStudentSudoku = useCallback((value: unknown) => {
    applyProgress(getStudentSudokuProgressFromSettings(value));
  }, [applyProgress]);

  const refreshLocalStudentSudoku = useCallback(() => {
    applyProgress(loadStoredStudentSudokuProgress());
  }, [applyProgress]);

  useEffect(() => {
    editsRef.current = {};
    restoredKeysRef.current.clear();
    editBaseRef.current = {};
    conflictKeysRef.current.clear();
    gameConflict.reset();
    let active = true;
    const restore = (resume = false) => {
      if (!active || ownerRef.current !== owner) return;
      for (const difficulty of ['basic', 'challenge'] as const) {
        const key = getSudokuProgressKey(studentNumber, koreanWeekKey, difficulty);
        gameConflict.restoreCopy(key);
        if (conflictKeysRef.current.has(key)) continue;
        if ([...writesRef.current].some((write) => write.key === key)) continue;
        const currentEdit = editsRef.current[key];
        if (currentEdit && (currentEdit.confirmed || (!resume && !restoredKeysRef.current.has(key)))) continue;
        const latest = loadLatestStudentGameForm(studentNumber, 'sudoku', key);
        const payload = latest?.draft.payload;
        const entry = restoreSudokuProgressDraft(studentNumber, koreanWeekKey, difficulty, payload);
        const completed = latest?.action === 'student.sudoku.complete';
        if (!entry) continue;
        const expected = isStorageRecord(payload) ? payload.expectedRevisions : undefined;
        if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
          const revision = Reflect.get(expected, `scope:studentSudoku:${studentNumber}`);
          if (typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0) editBaseRef.current[key] = { [`scope:studentSudoku:${studentNumber}`]: revision };
        }
        const matchesCurrent = currentEdit && matchesSudokuCells(currentEdit.entry, entry);
        if (currentEdit && !matchesCurrent && !restoredKeysRef.current.has(key)) continue;
        if (!currentEdit || !matchesCurrent) {
          const version = ++versionRef.current;
          restoredKeysRef.current.add(key);
          editsRef.current = { ...editsRef.current, [key]: { version, entry, confirmed: false } };
          setStudentSudokuProgress((current) => ({ ...current, [key]: entry }));
        }
        if (resume && editBaseRef.current[key]) {
          const action = completed ? 'student.sudoku.complete' : 'student.sudoku.save';
          if (isRejectedStudentStorageDraft(studentNumber, action, key)) {
            void inspectSudokuConflict(key);
            continue;
          }
          if (loadStudentStorageDraft(studentNumber, action, key) && !hasUnconfirmedStudentStorageDraft(studentNumber, action, key)) continue;
          if (completed) void completeSudoku(key, entry, difficulty);
          else void saveSudokuProgress(key, entry);
        }
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
  }, [koreanWeekKey, owner, studentNumber]);

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
    sudokuConflict: gameConflict.review,
    inspectSudokuConflict,
    continueSudokuFromLatest,
  };
};
