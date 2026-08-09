import { AlertCircle, CheckCircle2, Circle, ExternalLink, LoaderCircle, TriangleAlert } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

export type StudentMissionStatus = 'incomplete' | 'loading' | 'completed' | 'unavailable' | 'error';

interface StudentMissionCardProps {
  title: string;
  description: string;
  rewardAmount: number;
  status: StudentMissionStatus;
  destinationUrl?: string;
  actionLabel: string;
}

const STATUS_CONTENT: Record<StudentMissionStatus, { label: string; icon: typeof Circle }> = {
  incomplete: { label: '진행 전', icon: Circle },
  loading: { label: '확인 중', icon: LoaderCircle },
  completed: { label: '완료', icon: CheckCircle2 },
  unavailable: { label: '확인 불가', icon: AlertCircle },
  error: { label: '오류', icon: TriangleAlert },
};

export default function StudentMissionCard({
  title,
  description,
  rewardAmount,
  status,
  destinationUrl,
  actionLabel,
}: StudentMissionCardProps) {
  const statusContent = STATUS_CONTENT[status];
  const StatusIcon = statusContent.icon;

  return (
    <article className={`student-mission-card student-mission-card-${status}`}>
      <div className="student-mission-card-topline">
        <span className="student-mission-status">
          <StatusIcon className={status === 'loading' ? 'student-spin' : ''} size={18} aria-hidden="true" />
          {statusContent.label}
        </span>
        <span className="student-mission-reward">+{formatCurrency(rewardAmount)}</span>
      </div>
      <div className="student-mission-copy">
        <h3>{title}</h3>
        <p>{description}</p>
        {status === 'completed' ? <span className="student-mission-awarded">보상 지급 완료</span> : null}
      </div>
      {destinationUrl ? (
        <a
          className="student-mission-action"
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${actionLabel}, 외부 사이트가 새 탭에서 열림`}
        >
          <span>{actionLabel}</span>
          <ExternalLink size={18} aria-hidden="true" />
        </a>
      ) : (
        <button type="button" className="student-mission-action" disabled>
          {actionLabel}
        </button>
      )}
    </article>
  );
}
