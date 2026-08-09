import { ArrowRight, type LucideIcon } from 'lucide-react';

interface StudentSectionCardProps {
  tone: 'mission' | 'store';
  icon: LucideIcon;
  title: string;
  actionLabel: string;
  onClick: () => void;
}

export default function StudentSectionCard({
  tone,
  icon: Icon,
  title,
  actionLabel,
  onClick,
}: StudentSectionCardProps) {
  return (
    <section className={`student-section-card student-section-card-${tone}`}>
      <div className="student-section-card-heading">
        <span className="student-section-icon"><Icon size={25} aria-hidden="true" /></span>
        <h2>{title}</h2>
      </div>
      <button type="button" className="student-section-action" onClick={onClick}>
        <span>{actionLabel}</span>
        <ArrowRight size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
