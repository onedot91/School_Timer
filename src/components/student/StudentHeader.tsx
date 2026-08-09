import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface StudentHeaderProps {
  title: string;
  onBack: () => void;
  actions?: ReactNode;
}

export default function StudentHeader({
  title,
  onBack,
  actions,
}: StudentHeaderProps) {
  return (
    <header className="student-header">
      <div className="student-header-identity">
        <button
          type="button"
          className="student-back-button"
          aria-label="개요로 돌아가기"
          title="개요로 돌아가기"
          onClick={onBack}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="student-header-copy">
          <h1>{title}</h1>
        </div>
      </div>
      {actions ? <div className="student-header-actions">{actions}</div> : null}
    </header>
  );
}
