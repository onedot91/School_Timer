import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  createStudentRapidClickState,
  STUDENT_RAPID_CLICK_WARNING_MS,
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `${useId()}-title`;

  const closeWarning = () => setIsWarningOpen(false);

  // No button, Escape, or backdrop close: the warning stays for a few seconds, then closes itself.
  useEffect(() => {
    if (!isWarningOpen) return undefined;
    const timer = window.setTimeout(closeWarning, STUDENT_RAPID_CLICK_WARNING_MS);
    return () => window.clearTimeout(timer);
  }, [isWarningOpen]);

  useModalFocus({
    dialogRef,
    isOpen: isWarningOpen,
    onDismiss: closeWarning,
    initialFocusRef: dialogRef,
    returnFocusRef,
    isDismissible: false,
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
            tabIndex={-1}
          >
            <span className="student-rapid-click-dialog-icon" aria-hidden="true">
              <TriangleAlert />
            </span>
            <h2 id={titleId}>천천히 눌러 주세요</h2>
            <span
              className="student-rapid-click-dialog-timer"
              style={{ animationDuration: `${STUDENT_RAPID_CLICK_WARNING_MS}ms` }}
              aria-hidden="true"
            />
          </section>
        </div>
      ) : null}
    </div>
  );
};
