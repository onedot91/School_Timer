import { Check, Trash2, UserRoundCheck, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import {
  CLASSWORD_INITIALS,
  getClasswordInitialLabel,
  sanitizeClasswordInput,
  validateClasswordWord,
  type ClasswordBoard as ClasswordBoardData,
  type ClasswordInitial,
} from '../../lib/classword';
import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import StudentConfirmDialog from './StudentConfirmDialog';

type SaveInput = {
  readonly entryId?: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
};

export type ClasswordSaveResult = 'saved' | 'conflict' | 'error';

type ClasswordBoardProps = {
  readonly board: ClasswordBoardData;
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly disabled: boolean;
  readonly saving: boolean;
  readonly onSave: (input: SaveInput) => Promise<ClasswordSaveResult>;
  readonly onDelete: (entryId: string) => Promise<boolean>;
  readonly onSelect: (initial: ClasswordInitial) => void;
};

export default function ClasswordBoard({
  board,
  studentNumber,
  profileAssignments,
  disabled,
  saving,
  onSave,
  onDelete,
  onSelect,
}: ClasswordBoardProps) {
  const [selectedInitial, setSelectedInitial] = useState<ClasswordInitial | null>(null);
  const [word, setWord] = useState('');
  const [pendingWord, setPendingWord] = useState('');
  const [message, setMessage] = useState('');
  const [moveTarget, setMoveTarget] = useState<ClasswordInitial | null>(null);
  const [movingFromInitial, setMovingFromInitial] = useState<ClasswordInitial | null>(null);
  const moveTriggerRef = useRef<HTMLButtonElement | null>(null);
  const entriesByInitial = useMemo(
    () => new Map(board.entries.map((entry) => [entry.initial, entry])),
    [board.entries],
  );
  const ownEntry = board.entries.find((entry) => entry.studentNumber === studentNumber) ?? null;

  const closeEditor = (): void => {
    setSelectedInitial(null);
    setMovingFromInitial(null);
    setWord('');
    setPendingWord('');
    setMessage('');
  };

  const openEditor = (initial: ClasswordInitial, initialWord = ''): void => {
    setSelectedInitial(initial);
    setWord(initialWord);
    setPendingWord('');
    setMessage('');
    onSelect(initial);
  };

  const selectInitial = (initial: ClasswordInitial, trigger: HTMLButtonElement): void => {
    const entry = entriesByInitial.get(initial);
    if (entry && entry.studentNumber !== studentNumber) return;
    if (!entry && ownEntry) {
      moveTriggerRef.current = trigger;
      setMoveTarget(initial);
      return;
    }
    openEditor(initial, entry?.word);
  };

  const confirmMove = (): void => {
    if (!moveTarget || !ownEntry) return;
    const target = moveTarget;
    setMoveTarget(null);
    setMovingFromInitial(ownEntry.initial);
    openEditor(target);
  };

  const prepareSave = (): void => {
    if (!selectedInitial) return;
    const validation = validateClasswordWord(word, selectedInitial, board.topic);
    if (validation.ok === false) {
      setMessage(validation.message);
      return;
    }
    setPendingWord(validation.word);
    setMessage('');
  };

  const confirmSave = async (): Promise<void> => {
    if (!selectedInitial || !pendingWord) return;
    const result = await onSave({
      ...(ownEntry ? { entryId: ownEntry.id } : {}),
      initial: selectedInitial,
      word: pendingWord,
    });
    if (result !== 'error') closeEditor();
  };

  const confirmEdit = async (): Promise<void> => {
    if (!selectedInitial || !ownEntry) return;
    const validation = validateClasswordWord(word, selectedInitial, board.topic);
    if (validation.ok === false) {
      setMessage(validation.message);
      return;
    }
    setMessage('');
    const result = await onSave({
      entryId: ownEntry.id,
      initial: selectedInitial,
      word: validation.word,
    });
    if (result !== 'error') closeEditor();
  };

  const removeOwnEntry = async (): Promise<void> => {
    if (!ownEntry) return;
    const deleted = await onDelete(ownEntry.id);
    if (deleted) closeEditor();
  };

  return (
    <>
      <section className="classword-grid" aria-label="초성 낱말판">
        {CLASSWORD_INITIALS.map((initial) => {
          const storedEntry = entriesByInitial.get(initial);
          const entry = movingFromInitial === initial ? undefined : storedEntry;
          const profileImage = entry
            ? getFailureProfileImage(entry.studentNumber, profileAssignments)
            : null;
          const initialAlias = getClasswordInitialLabel(initial).slice(initial.length);
          const isOwn = entry?.studentNumber === studentNumber;
          const isSelected = selectedInitial === initial;
          const canSelect = selectedInitial === null && (isOwn || !entry);
          return (
            <article
              key={initial}
              className={`classword-cell${entry ? ' is-filled' : ''}${isOwn ? ' is-own' : ''}${isSelected ? ' is-selected' : ''}`}
            >
            {isSelected ? (
              <div className="classword-cell-editor" aria-busy={saving}>
                <div className="classword-cell-editor-heading">
                  <strong>{getClasswordInitialLabel(initial)}</strong>
                  <button type="button" onClick={closeEditor} aria-label="낱말 입력 닫기" disabled={disabled || saving}>
                    <X aria-hidden="true" />
                  </button>
                </div>
                {pendingWord ? (
                  <div className="classword-confirm">
                    <strong>{pendingWord}</strong>
                    <div>
                      <button
                        type="button"
                        className="classword-confirm-accept"
                        onClick={() => void confirmSave()}
                        aria-label="낱말 확인"
                        disabled={saving}
                      >
                        <Check aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="classword-confirm-revise"
                        onClick={() => setPendingWord('')}
                        aria-label="낱말 고치기"
                        disabled={saving}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                    {saving ? (
                      <div className="classword-save-progress" role="progressbar" aria-label="낱말 저장 중">
                        <span aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    if (ownEntry && !movingFromInitial) void confirmEdit();
                    else prepareSave();
                  }}>
                    <label>
                      <span className="sr-only">{getClasswordInitialLabel(initial)}으로 시작하는 낱말</span>
                      <input
                        value={word}
                        onChange={(event) => setWord(sanitizeClasswordInput(event.target.value))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            if (ownEntry && !movingFromInitial) void confirmEdit();
                            else prepareSave();
                          }
                        }}
                        maxLength={8}
                        autoFocus
                        autoComplete="off"
                        placeholder="낱말 입력"
                        disabled={disabled || saving}
                      />
                    </label>
                    {ownEntry && !movingFromInitial ? (
                      <div className="classword-editor-actions">
                        <button
                          type="submit"
                          className="classword-editor-confirm"
                          aria-label="수정한 낱말 확정"
                          disabled={disabled || saving || !word.trim()}
                        >
                          <Check aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="classword-editor-remove"
                          onClick={() => void removeOwnEntry()}
                          aria-label="내 낱말 삭제"
                          disabled={disabled || saving}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button type="submit" disabled={disabled || saving || !word.trim()}>
                        <Check aria-hidden="true" /> 입력
                      </button>
                    )}
                  </form>
                )}
                {message ? <p role="alert">{message}</p> : null}
              </div>
            ) : (
              <button
                type="button"
                className="classword-cell-main"
                onClick={(event) => selectInitial(initial, event.currentTarget)}
                disabled={!canSelect || disabled || saving}
                aria-label={entry
                  ? `${getClasswordInitialLabel(initial)}, ${entry.word}, ${entry.studentNumber}번${isOwn ? ', 내 낱말 수정' : ''}`
                  : `${getClasswordInitialLabel(initial)}${ownEntry ? '으로 내 낱말 옮기기' : ' 낱말 입력'}`}
              >
                {isOwn ? (
                  <span className="classword-own-mark" aria-hidden="true">
                    <UserRoundCheck />
                  </span>
                ) : null}
                <span className="classword-initial">
                  <strong>{initial}</strong>
                  {initialAlias ? <small>{initialAlias}</small> : null}
                </span>
                {entry ? (
                  <span className="classword-entry-copy">
                    <strong>{entry.word}</strong>
                    <span className="classword-student-profile">
                      <img
                        src={profileImage ?? undefined}
                        alt=""
                        width={192}
                        height={192}
                      />
                    </span>
                  </span>
                ) : <span className="classword-empty-mark" aria-hidden="true">+</span>}
              </button>
            )}
            </article>
          );
        })}
      </section>
      <StudentConfirmDialog
        isOpen={moveTarget !== null}
        kicker="낱말 옮기기"
        title={moveTarget ? `${getClasswordInitialLabel(moveTarget)} 칸에 새로 쓸까요?` : ''}
        description={moveTarget ? '지금 카드를 이 칸으로 옮기고 새 낱말을 입력해요.' : ''}
        confirmLabel="옮기기"
        isPending={false}
        returnFocusRef={moveTriggerRef}
        onCancel={() => setMoveTarget(null)}
        onConfirm={confirmMove}
      />
    </>
  );
}
