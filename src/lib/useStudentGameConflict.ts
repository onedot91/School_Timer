import { useRef, useState } from 'react';
import { discardRejectedStudentStorageDraft, loadStudentStorageFormDraft, loadStudentStorageFormSnapshot, saveStudentStorageFormDraftDurably } from './studentStorageCommand.js';
import { selectLatestGameDraft } from './studentGameProgressDraft.js';
import { isStorageRecord } from './storageV2Codec.js';
import { loadSharedSettingsRow } from './supabaseSettings.js';

export const loadLatestStudentGameForm = (studentNumber: number, feature: 'sudoku' | 'baseball', key: string) => selectLatestGameDraft(
  [`student.${feature}.complete`, `student.${feature}.save`].map(action => {
    const snapshot = loadStudentStorageFormSnapshot(studentNumber, action, key);
    return snapshot ? { action, draft: snapshot.draft } : null;
  }),
);

export type StudentGameConflictReview = {
  readonly key: string;
  readonly localText: string;
  readonly remoteText: string;
  readonly summary: string;
  readonly state: 'loading' | 'ready' | 'saving' | 'archived' | 'error';
  readonly error?: string;
};

type ConflictSnapshot = {
  key: string;
  payload: Record<string, unknown>;
  value: Record<string, unknown>;
  updatedAt: string;
  revisions: Readonly<Record<string, number>>;
  forms: Readonly<Record<string, Record<string, unknown>>>;
};

export const useStudentGameConflict = (studentNumber: number, owner: string, feature: 'sudoku' | 'baseball') => {
  const [review, setReview] = useState<StudentGameConflictReview | null>(null);
  const snapshotRef = useRef<ConflictSnapshot | null>(null);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const inspectingRef = useRef(false);
  const archiveAction = `student.${feature}.conflict-copy`;

  const restoreCopy = (key: string) => {
    const copy = loadStudentStorageFormDraft(studentNumber, archiveAction, key);
    if (copy.key === key && typeof copy.localText === 'string' && typeof copy.remoteText === 'string') {
      const { localText, remoteText } = copy;
      setReview(current => current && current.state !== 'archived' ? current : {
        key, localText, remoteText,
        summary: '보관한 이전 입력', state: 'archived',
      });
    }
  };

  const inspect = async (key: string, payload: Record<string, unknown>, localText: string,
    describe: (value: Record<string, unknown>) => { remoteText: string; summary: string }) => {
    if (inspectingRef.current) return;
    inspectingRef.current = true;
    snapshotRef.current = null;
    const forms = Object.fromEntries([`student.${feature}.save`, `student.${feature}.complete`].map(action => (
      [action, loadStudentStorageFormDraft(studentNumber, action, key)]
    )));
    setReview({ key, localText, remoteText: '', summary: '다른 기기의 기록을 확인하고 있어요.', state: 'loading' });
    try {
      const row = await loadSharedSettingsRow();
      if (ownerRef.current !== owner) return;
      if (!row || !isStorageRecord(row.value) || !row.updated_at) throw new Error('GAME_CONFLICT_REFRESH');
      const description = describe(row.value);
      snapshotRef.current = { key, payload, value: row.value, updatedAt: row.updated_at, revisions: row.storagePatch?.revisions ?? {}, forms };
      setReview({ key, localText, ...description, state: 'ready' });
    } catch {
      if (ownerRef.current === owner) setReview({ key, localText, remoteText: '', summary: '최신 기록을 확인하지 못했어요.', state: 'error', error: '연결을 확인한 뒤 다시 시도해 주세요.' });
    } finally {
      inspectingRef.current = false;
    }
  };

  const adopt = async (): Promise<ConflictSnapshot | null> => {
    const snapshot = snapshotRef.current;
    if (!snapshot || !review || review.state !== 'ready' || ownerRef.current !== owner) return null;
    setReview({ ...review, state: 'saving', error: undefined });
    try {
      const archived = await saveStudentStorageFormDraftDurably(studentNumber, archiveAction, {
        ...snapshot.payload, key: snapshot.key, localText: review.localText, remoteText: review.remoteText, forms: snapshot.forms,
      }, snapshot.key);
      if (!archived || ownerRef.current !== owner) throw new Error('GAME_CONFLICT_ARCHIVE');
      for (const action of [`student.${feature}.save`, `student.${feature}.complete`]) {
        if (!await discardRejectedStudentStorageDraft(studentNumber, action, snapshot.key, snapshot.forms[action])) throw new Error('GAME_CONFLICT_PENDING');
        if (snapshotRef.current === snapshot) snapshotRef.current = { ...snapshot, forms: { ...snapshot.forms, [action]: {} } };
        else if (snapshotRef.current) snapshotRef.current = { ...snapshotRef.current, forms: { ...snapshotRef.current.forms, [action]: {} } };
      }
      if (ownerRef.current !== owner) return null;
      setReview({ ...review, summary: '보관한 이전 입력', state: 'archived', error: undefined });
      snapshotRef.current = null;
      return snapshot;
    } catch {
      if (ownerRef.current === owner) setReview({ ...review, state: 'ready', error: '입력을 안전하게 보관하지 못했어요. 입력을 복사한 뒤 다시 시도해 주세요.' });
      return null;
    }
  };

  return { review, inspect, adopt, restoreCopy, reset: () => { snapshotRef.current = null; setReview(null); } };
};
