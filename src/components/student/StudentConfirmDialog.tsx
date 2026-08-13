import { useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '../../lib/useModalFocus';

interface StudentConfirmDialogProps {
  readonly isOpen: boolean;
  readonly kicker?: string;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly isPending: boolean;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export default function StudentConfirmDialog({
  isOpen,
  kicker,
  title,
  description,
  confirmLabel,
  isPending,
  returnFocusRef,
  onCancel,
  onConfirm,
}: StudentConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useModalFocus({
    dialogRef,
    isOpen,
    onDismiss: onCancel,
    returnFocusRef,
    isDismissible: !isPending,
  });

  if (!isOpen) return null;

  return (
    <div className="student-confirm-dialog-backdrop" role="presentation" onClick={() => {
      if (!isPending) onCancel();
    }}>
      <section
        ref={dialogRef}
        className="student-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-confirm-dialog-title"
        aria-describedby="student-confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="student-confirm-dialog-close" aria-label="확인창 닫기" disabled={isPending} onClick={onCancel}>
          <X aria-hidden="true" />
        </button>
        {kicker ? <span className="student-confirm-dialog-kicker">{kicker}</span> : null}
        <h2 id="student-confirm-dialog-title">{title}</h2>
        <p id="student-confirm-dialog-description">{description}</p>
        <div className="student-confirm-dialog-actions">
          <button type="button" disabled={isPending} onClick={onCancel}>취소</button>
          <button type="button" disabled={isPending} onClick={onConfirm}>{isPending ? '처리 중' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
