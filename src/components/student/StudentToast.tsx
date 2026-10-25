import { CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStudentToastDurationMs, type StudentToast as StudentToastValue } from '../../lib/studentToast';

type StudentToastProps = {
  readonly toast: StudentToastValue | null;
  readonly onDone: (id: number) => void;
};

// Confirmed results only. Unconfirmed saves and failures that need a next step stay in a dialog.
const StudentToast = ({ toast, onDone }: StudentToastProps) => {
  const [shownToast, setShownToast] = useState<StudentToastValue | null>(null);

  // The live region stays mounted; the text arrives a frame later, after a closing confirm dialog drops `inert`, so it is announced.
  useEffect(() => {
    if (!toast) {
      setShownToast(null);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => setShownToast(toast));
    const timer = window.setTimeout(() => onDone(toast.id), getStudentToastDurationMs(toast.message));
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [toast, onDone]);

  return (
    <div className="student-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {shownToast ? (
        <p key={shownToast.id} className="student-toast">
          <CircleCheck className="student-toast-icon" aria-hidden="true" focusable="false" />
          <span>{shownToast.message}</span>
        </p>
      ) : null}
    </div>
  );
};

export default StudentToast;
