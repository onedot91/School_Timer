import { useId } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Flag,
  HeartHandshake,
  PencilLine,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import {
  FAILURE_STAMP_OPTIONS,
  getFailureProfileImage,
  getSelectedFailureStamp,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureStory,
} from '../../lib/failureExhibition';
import type { FailureStoryTone } from '../../lib/failureStoryTone';

interface StudentFailureMessageProps {
  readonly key?: string;
  readonly story: FailureStory;
  readonly tone: FailureStoryTone;
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly isSaving: boolean;
  readonly isStampMenuOpen: boolean;
  readonly onStampMenuToggle: (storyId: string) => void;
  readonly onStamp: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
}

interface FailureStampPresentation {
  readonly Icon: LucideIcon;
  readonly sentLabel: string;
}

const FAILURE_STAMP_PRESENTATIONS: Readonly<Record<FailureStampId, FailureStampPresentation>> = {
  'me-too': { Icon: UsersRound, sentLabel: '공감 보냄' },
  brave: { Icon: Flag, sentLabel: '도전 보냄' },
  cheer: { Icon: Sparkles, sentLabel: '응원 보냄' },
};

export default function StudentFailureMessage({
  story,
  tone,
  studentNumber,
  profileAssignments,
  isSaving,
  isStampMenuOpen,
  onStampMenuToggle,
  onStamp,
}: StudentFailureMessageProps) {
  const isMine = story.studentNumber === studentNumber;
  const selectedStamp = getSelectedFailureStamp(story, studentNumber);
  const selectedStampOption = FAILURE_STAMP_OPTIONS.find((stamp) => stamp.id === selectedStamp);
  const selectedStampPresentation = selectedStamp ? FAILURE_STAMP_PRESENTATIONS[selectedStamp] : null;
  const StampTriggerIcon = selectedStampPresentation?.Icon ?? HeartHandshake;
  const profileImage = getFailureProfileImage(story.studentNumber, profileAssignments);
  const stampMenuId = useId();

  return (
    <article
      className={`student-failure-message${isMine ? ' is-mine' : ''}`}
      data-story-tone={tone}
    >
      <div className="student-failure-message-main">
        <span className="student-failure-message-content">
          <span className="student-failure-message-text">{story.failure}</span>
          <span className="student-failure-message-next">
            <ArrowRight aria-hidden="true" />
            <span>{story.lesson}</span>
          </span>
        </span>
      </div>
      <footer className="student-failure-message-footer">
        <span
          className="student-failure-message-profile"
          data-profile-tone={(story.studentNumber - 1) % 4}
          aria-hidden="true"
        >
          <img src={profileImage} alt="" width="192" height="192" decoding="async" />
        </span>
        {isMine ? (
          <span className="student-failure-owner-badge">
            <PencilLine aria-hidden="true" />
            <span>내가 쓴 글</span>
          </span>
        ) : <div className="student-failure-message-reactions">
          <div className="student-failure-stamp-control">
            <button
              type="button"
              className={`student-failure-stamp-trigger${selectedStamp ? ' is-selected' : ''}`}
              data-stamp-id={selectedStamp ?? undefined}
              aria-label={selectedStampOption ? `${selectedStampOption.label} 응원 바꾸기` : '응원 도장 선택'}
              aria-expanded={isStampMenuOpen}
              aria-controls={isStampMenuOpen ? stampMenuId : undefined}
              title={selectedStampOption?.label}
              disabled={isSaving}
              onClick={() => onStampMenuToggle(story.id)}
            >
              <StampTriggerIcon aria-hidden="true" />
              <span>{selectedStampPresentation?.sentLabel ?? '응원하기'}</span>
              <ChevronDown className="student-failure-stamp-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>}
      </footer>
      {!isMine && isStampMenuOpen ? (
        <div id={stampMenuId} className="student-failure-stamps" role="group" aria-label="응원 도장 선택">
          <span className="student-failure-stamps-title"><HeartHandshake aria-hidden="true" />어떤 마음을 보낼까요?</span>
          {FAILURE_STAMP_OPTIONS.map((stamp) => {
            const StampIcon = FAILURE_STAMP_PRESENTATIONS[stamp.id].Icon;

            return (
              <button
                type="button"
                key={stamp.id}
                data-stamp-id={stamp.id}
                className={selectedStamp === stamp.id ? 'is-selected' : ''}
                aria-pressed={selectedStamp === stamp.id}
                disabled={isSaving}
                onClick={() => void onStamp(story.id, stamp.id)}
              >
                <span className="student-failure-stamp-choice-icon" aria-hidden="true">
                  <StampIcon />
                </span>
                <span>{stamp.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
