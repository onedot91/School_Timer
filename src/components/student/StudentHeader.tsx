import { ArrowLeft } from 'lucide-react';

interface StudentHeaderProps {
  title: string;
  onBack: () => void;
}

export default function StudentHeader({
  title,
  onBack,
}: StudentHeaderProps) {
  return (
    <header className="student-header">
      <div className="student-header-identity">
        <button type="button" className="student-back-button" onClick={onBack}>
          <ArrowLeft size={20} aria-hidden="true" />
          <span>개요로</span>
        </button>
        <div className="student-header-copy">
          <h1>{title}</h1>
        </div>
      </div>
    </header>
  );
}
