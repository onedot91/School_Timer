import { Check, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

type SaveInput = {
  readonly entryId?: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
};

type ClasswordBoardProps = {
  readonly board: ClasswordBoardData;
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly saving: boolean;
  readonly onSave: (input: SaveInput) => Promise<boolean>;
  readonly onDelete: (entryId: string) => Promise<boolean>;
  readonly onSelect: (initial: ClasswordInitial) => void;
};

export default function ClasswordBoard({
  board,
  studentNumber,
  profileAssignments,
  saving,
  onSave,
  onDelete,
  onSelect,
}: ClasswordBoardProps) {
  const [selectedInitial, setSelectedInitial] = useState<ClasswordInitial | null>(null);
  const [word, setWord] = useState('');
  const [pendingWord, setPendingWord] = useState('');
  const [message, setMessage] = useState('');
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const entriesByInitial = useMemo(
    () => new Map(board.entries.map((entry) => [entry.initial, entry])),
    [board.entries],
  );
  const ownEntry = board.entries.find((entry) => entry.studentNumber === studentNumber) ?? null;

  useEffect(() => {
    if (!pendingWord || !selectedInitial) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || saving) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        void confirmSave();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingWord('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const closeEditor = (): void => {
    setSelectedInitial(null);
    setWord('');
    setPendingWord('');
    setMessage('');
  };

  const selectInitial = (initial: ClasswordInitial): void => {
    const entry = entriesByInitial.get(initial);
    if (entry && entry.studentNumber !== studentNumber) return;
    if (!entry && ownEntry) return;
    setSelectedInitial(initial);
    setWord(entry?.word ?? '');
    setPendingWord('');
    setMessage('');
    setDeleteEntryId(null);
    onSelect(initial);
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
    const saved = await onSave({
      ...(ownEntry ? { entryId: ownEntry.id } : {}),
      initial: selectedInitial,
      word: pendingWord,
    });
    if (saved) closeEditor();
  };

  const confirmDelete = async (entryId: string): Promise<void> => {
    const deleted = await onDelete(entryId);
    if (deleted) {
      setDeleteEntryId(null);
      closeEditor();
    }
  };

  return (
    <section className="classword-grid" aria-label="초성 낱말판">
      {CLASSWORD_INITIALS.map((initial) => {
        const entry = entriesByInitial.get(initial);
        const profileImage = entry
          ? getFailureProfileImage(entry.studentNumber, profileAssignments)
          : null;
        const initialAlias = getClasswordInitialLabel(initial).slice(initial.length);
        const isOwn = entry?.studentNumber === studentNumber;
        const isSelected = selectedInitial === initial;
        const canSelect = isOwn || (!entry && !ownEntry);
        return (
          <article
            key={initial}
            className={`classword-cell${entry ? ' is-filled' : ''}${isOwn ? ' is-own' : ''}${isSelected ? ' is-selected' : ''}`}
          >
            {isSelected ? (
              <div className="classword-cell-editor">
                <div className="classword-cell-editor-heading">
                  <strong>{getClasswordInitialLabel(initial)}</strong>
                  <button type="button" onClick={closeEditor} aria-label="낱말 입력 닫기" disabled={saving}>
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
                  </div>
                ) : (
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    prepareSave();
                  }}>
                    <label>
                      <span className="sr-only">{getClasswordInitialLabel(initial)}으로 시작하는 낱말</span>
                      <input
                        value={word}
                        onChange={(event) => setWord(sanitizeClasswordInput(event.target.value))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            prepareSave();
                          }
                        }}
                        maxLength={8}
                        autoFocus
                        autoComplete="off"
                        placeholder="낱말 입력"
                        disabled={saving}
                      />
                    </label>
                    <button type="submit" disabled={saving || !word.trim()}>
                      <Check aria-hidden="true" /> 입력
                    </button>
                  </form>
                )}
                {message ? <p role="alert">{message}</p> : null}
              </div>
            ) : (
              <button
                type="button"
                className="classword-cell-main"
                onClick={() => selectInitial(initial)}
                disabled={!canSelect || saving}
                aria-label={entry
                  ? `${getClasswordInitialLabel(initial)}, ${entry.word}, ${entry.studentNumber}번${isOwn ? ', 내 낱말 수정' : ''}`
                  : `${getClasswordInitialLabel(initial)} 낱말 입력`}
              >
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
            {isOwn && !isSelected ? (
              deleteEntryId === entry.id ? (
                <div className="classword-delete-confirm" role="group" aria-label="내 낱말 삭제 확인">
                  <span>삭제할까요?</span>
                  <button type="button" onClick={() => void confirmDelete(entry.id)} disabled={saving}>삭제</button>
                  <button type="button" onClick={() => setDeleteEntryId(null)} disabled={saving}>취소</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="classword-delete-button"
                  onClick={() => setDeleteEntryId(entry.id)}
                  aria-label={`${entry.word} 삭제`}
                  disabled={saving}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
