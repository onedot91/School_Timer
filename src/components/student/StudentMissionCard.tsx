import { formatMissionReward } from '../../lib/currency';

export type StudentMissionStatus = 'incomplete' | 'inProgress' | 'loading' | 'completed' | 'exhausted' | 'unavailable' | 'error';

interface StudentMissionCardBaseProps {
  readonly title: string;
  readonly description?: string;
  readonly rewardAmount: number | readonly number[];
  readonly destinationUrl?: string;
  readonly onAction?: () => void;
  readonly actionLabel: string;
}

interface AutomaticStudentMissionCardProps extends StudentMissionCardBaseProps {
  readonly verificationMode: 'automatic';
  readonly status: StudentMissionStatus;
}

interface ManualStudentMissionCardProps extends StudentMissionCardBaseProps {
  readonly verificationMode: 'manual';
  readonly status?: never;
}

type StudentMissionCardProps = AutomaticStudentMissionCardProps | ManualStudentMissionCardProps;

const STATUS_CONTENT: Record<StudentMissionStatus, { label: string; mood: 'blank' | 'working' | 'happy' | 'worried' }> = {
  incomplete: { label: '진행 전', mood: 'blank' },
  inProgress: { label: '진행 중', mood: 'working' },
  loading: { label: '확인 중', mood: 'working' },
  completed: { label: '완료', mood: 'happy' },
  exhausted: { label: '기회 소진', mood: 'worried' },
  unavailable: { label: '확인 불가', mood: 'blank' },
  error: { label: '오류 발생', mood: 'worried' },
};

export function StudentMissionStatusFace({
  status,
  compact = false,
}: {
  status: StudentMissionStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={`student-mission-status student-mission-status-face${compact ? ' is-compact' : ''}`}
      data-status={status}
      data-mood={STATUS_CONTENT[status].mood}
      aria-hidden="true"
    >
      <span className="student-mission-face-eye is-left" />
      <span className="student-mission-face-eye is-right" />
      <span className="student-mission-face-mouth" />
    </span>
  );
}

export function StudentMissionTeacherFace({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span
      className={`student-mission-status student-mission-status-face student-mission-teacher-face${compact ? ' is-compact' : ''}`}
      data-mood="happy"
      aria-hidden="true"
    >
      <span className="student-mission-face-eye is-left" />
      <span className="student-mission-face-eye is-right" />
      <span className="student-mission-face-mouth" />
    </span>
  );
}

export default function StudentMissionCard({
  title,
  description,
  rewardAmount,
  verificationMode,
  status,
  destinationUrl,
  onAction,
  actionLabel,
}: StudentMissionCardProps) {
  const isAutomatic = verificationMode === 'automatic';
  const statusContent = isAutomatic ? STATUS_CONTENT[status] : null;
  const rewardLabel = formatMissionReward(rewardAmount);
  const missionContext = isAutomatic
    ? `상태: ${statusContent.label}.`
    : '선생님이 직접 확인하는 미션.';
  const actionAriaLabel = description
    ? `${title}. ${missionContext} 보상 ${rewardLabel}. ${description}. ${actionLabel}`
    : `${title}. ${missionContext} 보상 ${rewardLabel}. ${actionLabel}`;
  const isInteractive = Boolean(destinationUrl || onAction);
  const statusClassName = isAutomatic ? ` student-mission-card-${status}` : ' student-mission-card-manual';

  return (
    <article className={`student-mission-card${statusClassName}${isInteractive ? ' is-interactive' : ' is-disabled'}`}>
      <div className="student-mission-illustration-placeholder" aria-hidden="true">
        <span>4:3 일러스트 영역</span>
        <h3>{title}</h3>
        <div className="student-mission-card-meta">
          {isAutomatic ? <StudentMissionStatusFace status={status} /> : <StudentMissionTeacherFace />}
          <span className="student-mission-reward">
            {rewardLabel}
          </span>
        </div>
      </div>
      {isAutomatic && status === 'completed' ? <span className="sr-only">보상 지급 완료</span> : null}
      {destinationUrl ? (
        <a
          className="student-mission-card-action"
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${actionAriaLabel}, 외부 사이트가 새 탭에서 열림`}
        />
      ) : onAction ? (
        <button type="button" className="student-mission-card-action" onClick={onAction} aria-label={actionAriaLabel} />
      ) : (
        <button type="button" className="student-mission-card-action" aria-label={actionAriaLabel} disabled />
      )}
    </article>
  );
}
