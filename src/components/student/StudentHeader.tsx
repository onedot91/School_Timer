import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface StudentHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  backText?: string;
  status?: string;
  actions?: ReactNode;
}

export default function StudentHeader({
  title,
  onBack,
  backLabel = '개요로 돌아가기',
  backText = '홈',
  status,
  actions,
}: StudentHeaderProps) {
  return (
    <header className="student-header">
      <div className="student-header-identity">
        <button
          type="button"
          className="student-back-button"
          aria-label={backLabel}
          title={backLabel}
          onClick={onBack}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span>{backText}</span>
        </button>
        <div className="student-header-copy">
          <h1>{title}</h1>
          {status ? <span className="student-header-status">{status}</span> : null}
        </div>
      </div>
      {actions ? <div className="student-header-actions">{actions}</div> : null}
    </header>
  );
}
