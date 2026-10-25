import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStudentToastDurationMs, type StudentToast as StudentToastValue } from '../../lib/studentToast';

type StudentToastProps = {
  readonly toast: StudentToastValue | null;
  readonly onDone: (id: number) => void;
};

// Confirmed results and normal rejections only. Unconfirmed saves, storage failures and unknown errors stay in a dialog.
const StudentToast = ({ toast, onDone }: StudentToastProps) => {
  const [shownToast, setShownToast] = useState<StudentToastValue | null>(null);

  // The live region stays mounted; the text arrives a frame later, after a closing confirm dialog drops `inert`, so it is announced.
  useEffect(() => {
    if (!toast) {
      setShownToast(null);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => setShownToast(toast));
    const timer = window.setTimeout(() => onDone(toast.id), getStudentToastDurationMs(toast.message, toast.tone));
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [toast, onDone]);

  const Icon = shownToast?.tone === 'warning' ? TriangleAlert : CircleCheck;
  // A body-level region marked for useModalFocus, so a confirm dialog that stays open (shop) does not make it inert.
  const region = (
    <div className="student-toast-region" role="status" aria-live="polite" aria-atomic="true" data-modal-live-region="true">
      {shownToast ? (
        <p key={shownToast.id} className="student-toast" data-tone={shownToast.tone}>
          <Icon className="student-toast-icon" aria-hidden="true" focusable="false" />
          <span>{shownToast.message}</span>
        </p>
      ) : null}
    </div>
  );
  return typeof document === 'undefined' ? region : createPortal(region, document.body);
};

export default StudentToast;
