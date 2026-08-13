import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';

interface StudentSectionCardProps {
  tone: 'mission' | 'store';
  icon: LucideIcon;
  title: string;
  direction?: 'left' | 'right';
  onClick: () => void;
}

export default function StudentSectionCard({
  tone,
  icon: Icon,
  title,
  direction = 'right',
  onClick,
}: StudentSectionCardProps) {
  const DirectionIcon = direction === 'left' ? ArrowLeft : ArrowRight;

  return (
    <button
      type="button"
      className={`student-section-card student-section-card-${tone} student-section-card-direction-${direction}`}
      aria-label={`${title} 열기`}
      onClick={onClick}
    >
      <span className="student-section-card-heading">
        <span className="student-section-icon"><Icon size={25} aria-hidden="true" /></span>
        <strong className="student-section-title">{title}</strong>
      </span>
      <span className="student-section-action" aria-hidden="true">
        <DirectionIcon size={24} aria-hidden="true" />
      </span>
    </button>
  );
}
