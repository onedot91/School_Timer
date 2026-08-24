import { useId } from 'react';
import { ArrowRight, Check, ChevronDown, HeartHandshake } from 'lucide-react';
import {
  FAILURE_STAMP_OPTIONS,
  getFailureProfileImage,
  getSelectedFailureStamp,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureStory,
} from '../../lib/failureExhibition';

interface StudentFailureMessageProps {
  readonly key?: string;
  readonly story: FailureStory;
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly isSaving: boolean;
  readonly isExpanded: boolean;
  readonly isPinned?: boolean;
  readonly isStampMenuOpen: boolean;
  readonly onExpandToggle: (storyId: string) => void;
  readonly onStampMenuToggle: (storyId: string) => void;
  readonly onStamp: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
}

export default function StudentFailureMessage({
  story,
  studentNumber,
  profileAssignments,
  isSaving,
  isExpanded,
  isPinned = false,
  isStampMenuOpen,
  onExpandToggle,
  onStampMenuToggle,
  onStamp,
}: StudentFailureMessageProps) {
  const isMine = story.studentNumber === studentNumber;
  const selectedStamp = getSelectedFailureStamp(story, studentNumber);
  const selectedStampOption = FAILURE_STAMP_OPTIONS.find((stamp) => stamp.id === selectedStamp);
  const profileImage = getFailureProfileImage(story.studentNumber, profileAssignments);
  const stampMenuId = useId();

  return (
    <article className={`student-failure-message${isMine ? ' is-mine' : ''}${isExpanded ? ' is-expanded' : ''}${isPinned ? ' is-pinned' : ''}`}>
      <button
        type="button"
        className="student-failure-message-main"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? '이야기 접기' : '이야기 전체 보기'}
        onClick={() => onExpandToggle(story.id)}
      >
        <span
          className="student-failure-message-profile"
          data-profile-tone={(story.studentNumber - 1) % 4}
          aria-hidden="true"
        >
          <img src={profileImage} alt="" width="192" height="192" decoding="async" />
        </span>
        <span className="student-failure-message-content">
          <span className="student-failure-message-text">{story.failure}</span>
          <span className="student-failure-message-next">
            <ArrowRight aria-hidden="true" />
            <span>{story.lesson}</span>
          </span>
        </span>
      </button>
      {!isMine ? <div className="student-failure-message-reactions">
        <div className="student-failure-stamp-control">
          <button
            type="button"
            className={`student-failure-stamp-trigger${selectedStamp ? ' is-selected' : ''}`}
            aria-label={selectedStamp ? '응원 도장 바꾸기' : '응원 도장 선택'}
            aria-expanded={isStampMenuOpen}
            aria-controls={isStampMenuOpen ? stampMenuId : undefined}
            disabled={isSaving}
            onClick={() => onStampMenuToggle(story.id)}
          >
            <HeartHandshake aria-hidden="true" />
            <span>{selectedStampOption ? '응원 보냄' : '응원하기'}</span>
            <ChevronDown className="student-failure-stamp-chevron" aria-hidden="true" />
          </button>
        </div>
      </div> : null}
      {!isMine && isStampMenuOpen ? (
        <div id={stampMenuId} className="student-failure-stamps" role="group" aria-label="응원 도장 선택">
          <span className="student-failure-stamps-title"><HeartHandshake aria-hidden="true" />어떤 마음을 보낼까요?</span>
          {FAILURE_STAMP_OPTIONS.map((stamp) => (
            <button
              type="button"
              key={stamp.id}
              className={selectedStamp === stamp.id ? 'is-selected' : ''}
              aria-pressed={selectedStamp === stamp.id}
              disabled={isSaving}
              onClick={() => void onStamp(story.id, stamp.id)}
            >
              <span className="student-failure-stamp-choice-icon" aria-hidden="true">
                {selectedStamp === stamp.id ? <Check /> : <HeartHandshake />}
              </span>
              <span>{stamp.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
