import { TriangleAlert } from 'lucide-react';
import { useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  createStudentRapidClickState,
  trackStudentRapidClick,
} from '../../lib/studentRapidClick';
import { useModalFocus } from '../../lib/useModalFocus';

type StudentRapidClickGuardProps = {
  readonly children: ReactNode;
};

export const StudentRapidClickGuard = ({ children }: StudentRapidClickGuardProps) => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const clickStateRef = useRef(createStudentRapidClickState());
  const dialogRef = useRef<HTMLElement>(null);
  const acknowledgeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  const closeWarning = () => setIsWarningOpen(false);

  useModalFocus({
    dialogRef,
    isOpen: isWarningOpen,
    onDismiss: closeWarning,
    initialFocusRef: acknowledgeRef,
    returnFocusRef,
  });

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    if (button.dataset.rapidClickIgnore === 'true' || event.nativeEvent.detail === 0) return;

    if (isWarningOpen) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = trackStudentRapidClick(clickStateRef.current, button, performance.now());
    clickStateRef.current = result.state;
    if (!result.shouldWarn) return;

    event.preventDefault();
    event.stopPropagation();
    returnFocusRef.current = button;
    setIsWarningOpen(true);
  };

  return (
    <div className="student-rapid-click-guard" onClickCapture={handleClickCapture}>
      {children}
      {isWarningOpen ? (
        <div className="student-confirm-dialog-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="student-confirm-dialog student-rapid-click-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <span className="student-rapid-click-dialog-icon" aria-hidden="true">
              <TriangleAlert />
            </span>
            <span className="student-confirm-dialog-kicker">잠깐 멈춰 주세요</span>
            <h2 id={titleId}>버튼을 너무 빠르게 누르고 있어요</h2>
            <p id={descriptionId}>
              같은 버튼을 장난으로 계속 누르지 말고, 필요한 동작을 천천히 한 번씩 눌러 주세요.
            </p>
            <div className="student-confirm-dialog-actions student-rapid-click-dialog-actions">
              <button ref={acknowledgeRef} type="button" data-rapid-click-ignore="true" onClick={closeWarning}>
                알겠어요
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
