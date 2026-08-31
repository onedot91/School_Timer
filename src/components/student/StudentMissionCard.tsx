import { formatMissionReward } from '../../lib/currency';

export type StudentMissionStatus = 'incomplete' | 'inProgress' | 'loading' | 'completed' | 'exhausted' | 'unavailable' | 'error';

interface StudentMissionCardBaseProps {
  readonly title: string;
  readonly description?: string;
  readonly illustrationSrc?: string;
  readonly illustrationCaption?: string;
  readonly illustrationTitle?: string;
  readonly rewardAmount: number | readonly number[];
  readonly destinationUrl?: string;
  readonly onAction?: () => void;
  readonly actionLabel: string;
  readonly disabledAppearance?: boolean;
}

interface AutomaticStudentMissionCardProps extends StudentMissionCardBaseProps {
  readonly verificationMode: 'automatic';
  readonly status: StudentMissionStatus;
  readonly statusPresentation?: 'status' | 'teacher';
}

interface ManualStudentMissionCardProps extends StudentMissionCardBaseProps {
  readonly verificationMode: 'manual';
  readonly status?: never;
  readonly statusPresentation?: never;
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

const STATUS_FACE_IMAGE: Record<StudentMissionStatus, string> = {
  incomplete: '/mission-status-faces/incomplete.png',
  inProgress: '/mission-status-faces/in-progress.png',
  loading: '/mission-status-faces/in-progress.png',
  completed: '/mission-status-faces/completed.png',
  exhausted: '/mission-status-faces/error.png',
  unavailable: '/mission-status-faces/incomplete.png',
  error: '/mission-status-faces/error.png',
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
      <img src={STATUS_FACE_IMAGE[status]} alt="" width="192" height="192" />
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
      <img src="/mission-status-faces/teacher.png" alt="" width="192" height="192" />
    </span>
  );
}

export default function StudentMissionCard({
  title,
  description,
  illustrationSrc,
  illustrationCaption,
  illustrationTitle,
  rewardAmount,
  verificationMode,
  status,
  destinationUrl,
  onAction,
  actionLabel,
  disabledAppearance,
  statusPresentation,
}: StudentMissionCardProps) {
  const isAutomatic = verificationMode === 'automatic';
  const usesTeacherPresentation = isAutomatic && statusPresentation === 'teacher';
  const statusContent = isAutomatic ? STATUS_CONTENT[status] : null;
  const rewardLabel = formatMissionReward(rewardAmount);
  const missionContext = usesTeacherPresentation
    ? '당일 마감 후 자동으로 확인하는 미션.'
    : isAutomatic
    ? `상태: ${statusContent.label}.`
    : '선생님이 직접 확인하는 미션.';
  const accessibleDescription = illustrationCaption ?? description;
  const actionAriaLabel = accessibleDescription
    ? `${title}. ${missionContext} 보상 ${rewardLabel}. ${accessibleDescription}. ${actionLabel}`
    : `${title}. ${missionContext} 보상 ${rewardLabel}. ${actionLabel}`;
  const isInteractive = Boolean(destinationUrl || onAction);
  const isDisabledAppearance = disabledAppearance ?? !isInteractive;
  const statusClassName = isAutomatic && !usesTeacherPresentation
    ? ` student-mission-card-${status}`
    : ' student-mission-card-manual';
  const illustrationTitleLength = illustrationTitle?.trim().length ?? 0;
  const illustrationTitleSize = illustrationTitleLength > 36
    ? ' is-extra-long'
    : illustrationTitleLength > 24
      ? ' is-long'
      : illustrationTitleLength > 12
        ? ' is-medium'
        : '';

  return (
    <article className={`student-mission-card${statusClassName}${illustrationSrc ? ' has-illustration' : ''}${isInteractive ? ' is-interactive' : ''}${isDisabledAppearance ? ' is-disabled' : ''}`}>
      <div className={`student-mission-illustration-placeholder${illustrationSrc ? ' has-illustration' : ''}`} aria-hidden="true">
        {illustrationSrc ? (
          <img
            className="student-mission-illustration"
            src={illustrationSrc}
            alt=""
            width="724"
            height="543"
          />
        ) : <span>4:3 일러스트 영역</span>}
        {illustrationTitle ? (
          <h3 className={`student-mission-illustration-title${illustrationTitleSize}`}>
            {illustrationTitle}
          </h3>
        ) : null}
        {!illustrationSrc || illustrationCaption ? (
          <div className="student-mission-card-copy">
            {!illustrationSrc ? <h3>{title}</h3> : null}
            {!illustrationSrc && description ? <p>{description}</p> : null}
            {illustrationCaption ? <p>{illustrationCaption}</p> : null}
          </div>
        ) : null}
        <div className="student-mission-card-meta">
          {isAutomatic && !usesTeacherPresentation
            ? <StudentMissionStatusFace status={status} />
            : <StudentMissionTeacherFace />}
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
