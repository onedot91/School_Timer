import { HeartHandshake, Send, X } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { useModalFocus } from '../../lib/useModalFocus';
import { FailureAutosizeTextarea } from './FailureAutosizeTextarea';

interface FailureComposerDialogProps {
  readonly isSaving: boolean;
  readonly onCreate: (failure: string, lesson: string) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly returnFocusRef: RefObject<HTMLButtonElement | null>;
}

interface StoryDraft {
  readonly failure: string;
  readonly lesson: string;
}

const EMPTY_DRAFT: StoryDraft = { failure: '', lesson: '' };

export function FailureComposerDialog({
  isSaving,
  onCreate,
  onClose,
  onSaved,
  returnFocusRef,
}: FailureComposerDialogProps) {
  const [draft, setDraft] = useState<StoryDraft>(EMPTY_DRAFT);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = draft.failure.trim().length > 0 && draft.lesson.trim().length > 0;

  useModalFocus({
    dialogRef,
    isOpen: true,
    onDismiss: onClose,
    initialFocusRef: firstFieldRef,
    returnFocusRef,
    isDismissible: !isSaving,
  });

  const updateDraft = (key: keyof StoryDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div
      className="student-failure-compose-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!isSaving && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        id="student-failure-compose-dialog"
        className="student-failure-compose-dialog"
        role="dialog"
        aria-modal="true"
        aria-busy={isSaving}
        aria-labelledby="student-failure-compose-title"
      >
        <button
          type="button"
          className="student-failure-compose-close"
          aria-label="작성 창 닫기"
          disabled={isSaving}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <div className="student-failure-compose-heading">
          <HeartHandshake aria-hidden="true" />
          <h2 id="student-failure-compose-title">실패 전시하기</h2>
        </div>
        <form
          className="student-failure-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate(draft.failure, draft.lesson).then((saved) => {
              if (!saved) return;
              setDraft(EMPTY_DRAFT);
              onSaved();
            });
          }}
        >
          <label className="student-failure-form-question">
            <span className="student-failure-form-question-title"><b aria-hidden="true">1</b><span>어떤 일이 있었나요?</span></span>
            <FailureAutosizeTextarea
              ref={firstFieldRef}
              maxLength={400}
              required
              placeholder="실패했던 일을 편하게 적어 보세요."
              value={draft.failure}
              onChange={(event) => updateDraft('failure', event.target.value)}
            />
          </label>
          <label className="student-failure-form-question">
            <span className="student-failure-form-question-title"><b aria-hidden="true">2</b><span>다시 한다면 무엇을 바꿔 볼까요?</span></span>
            <FailureAutosizeTextarea
              maxLength={400}
              required
              placeholder="다시 한다면 어떤 방법으로 해볼까요?"
              value={draft.lesson}
              onChange={(event) => updateDraft('lesson', event.target.value)}
            />
          </label>
          <button type="submit" className="student-primary-action" disabled={isSaving || !canSubmit}>
            <Send aria-hidden="true" />{isSaving ? '저장하는 중' : '자랑하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
