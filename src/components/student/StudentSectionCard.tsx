import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';

interface StudentSectionCardProps {
  tone: 'mission' | 'store';
  icon: LucideIcon;
  title: string;
  actionLabel: string;
  direction?: 'left' | 'right';
  onClick: () => void;
}

export default function StudentSectionCard({
  tone,
  icon: Icon,
  title,
  actionLabel,
  direction = 'right',
  onClick,
}: StudentSectionCardProps) {
  const DirectionIcon = direction === 'left' ? ArrowLeft : ArrowRight;

  return (
    <section className={`student-section-card student-section-card-${tone} student-section-card-direction-${direction}`}>
      <div className="student-section-card-heading">
        <span className="student-section-icon"><Icon size={25} aria-hidden="true" /></span>
        <h2>{title}</h2>
      </div>
      <button type="button" className="student-section-action" onClick={onClick}>
        {direction === 'left' ? <DirectionIcon size={20} aria-hidden="true" /> : null}
        <span>{actionLabel}</span>
        {direction === 'right' ? <DirectionIcon size={20} aria-hidden="true" /> : null}
      </button>
    </section>
  );
}
