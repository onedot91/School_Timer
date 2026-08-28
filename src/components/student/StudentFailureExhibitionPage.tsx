import { ArrowRight, HeartHandshake, Library, Pencil, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FAILURE_STAMP_OPTIONS,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureStory,
} from '../../lib/failureExhibition';
import { useModalFocus } from '../../lib/useModalFocus';
import { FailureComposerDialog } from './FailureComposerDialog';
import StudentFailureRelay from './StudentFailureRelay';
import StudentHeader from './StudentHeader';

interface StudentFailureExhibitionPageProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly stories: readonly FailureStory[];
  readonly isSaving: boolean;
  readonly onCreate: (failure: string, lesson: string) => Promise<boolean>;
  readonly onStamp: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
  readonly onOpenBookshelf: () => void;
  readonly onBack: () => void;
}

type CheerNotice = {
  readonly count: number;
  readonly labels: readonly string[];
  readonly signature: string;
};

const CHEER_SEEN_STORAGE_PREFIX = 'school_failure_cheer_seen_v1';

const readSeenCheerKeys = (storageKey: string): readonly string[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const writeSeenCheerKeys = (storageKey: string, signature: string): void => {
  try {
    window.localStorage.setItem(storageKey, signature);
  } catch {
  }
};

export default function StudentFailureExhibitionPage({
  studentNumber,
  profileAssignments,
  stories,
  isSaving,
  onCreate,
  onStamp,
  onOpenBookshelf,
  onBack,
}: StudentFailureExhibitionPageProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [cheerNotice, setCheerNotice] = useState<CheerNotice | null>(null);
  const [relayRevealRequest, setRelayRevealRequest] = useState(0);
  const composerTriggerRef = useRef<HTMLButtonElement>(null);
  const cheerDialogRef = useRef<HTMLDivElement>(null);
  const cheerConfirmRef = useRef<HTMLButtonElement>(null);
  const isCheerNoticeOpen = cheerNotice !== null;
  const cheerSnapshot = useMemo(() => {
    const entries = stories
      .filter((story) => story.studentNumber === studentNumber)
      .flatMap((story) => story.stamps.map((stamp) => ({
        key: `${story.id}:${stamp.studentNumber}:${stamp.stampId}`,
        label: FAILURE_STAMP_OPTIONS.find((option) => option.id === stamp.stampId)?.label ?? '따뜻한 응원',
      })))
      .sort((left, right) => left.key.localeCompare(right.key));
    return {
      entries,
      signature: JSON.stringify(entries.map((entry) => entry.key)),
    };
  }, [stories, studentNumber]);

  const closeComposer = () => {
    if (!isSaving) setIsComposerOpen(false);
  };

  const acknowledgeCheer = () => {
    if (!cheerNotice) return;
    writeSeenCheerKeys(`${CHEER_SEEN_STORAGE_PREFIX}:${studentNumber}`, cheerNotice.signature);
    setCheerNotice(null);
  };

  useModalFocus({
    dialogRef: cheerDialogRef,
    isOpen: isCheerNoticeOpen,
    onDismiss: acknowledgeCheer,
    initialFocusRef: cheerConfirmRef,
  });

  useEffect(() => {
    if (isComposerOpen || cheerNotice) return;
    const storageKey = `${CHEER_SEEN_STORAGE_PREFIX}:${studentNumber}`;
    const seenKeys = new Set(readSeenCheerKeys(storageKey));
    const newEntries = cheerSnapshot.entries.filter((entry) => !seenKeys.has(entry.key));
    if (newEntries.length === 0) {
      writeSeenCheerKeys(storageKey, cheerSnapshot.signature);
      return;
    }
    setCheerNotice({
      count: newEntries.length,
      labels: [...new Set(newEntries.map((entry) => entry.label))],
      signature: cheerSnapshot.signature,
    });
  }, [cheerNotice, cheerSnapshot, isComposerOpen, studentNumber]);

  useEffect(() => {
    if (!isComposerOpen && !isCheerNoticeOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCheerNoticeOpen, isComposerOpen]);

  return (
    <div className="student-view student-failure-view">
      <StudentHeader
        title={(
          <span className="student-failure-header-title" aria-label="실패 자랑소. 실패의 의미는 한 판 더!">
            <span>실패 자랑소</span>
            <span className="student-failure-header-catchphrase">실패의 의미는 한 판 더!</span>
          </span>
        )}
        onBack={onBack}
        actions={(
          <nav className="student-failure-side" aria-label="실패 전시관 메뉴">
            <button type="button" className="student-bookshelf-entry student-failure-bookshelf-entry" onClick={onOpenBookshelf}>
              <span className="student-bookshelf-entry-icon"><Library aria-hidden="true" /></span>
              <span className="student-bookshelf-entry-copy"><strong>책장으로 가기</strong></span>
              <ArrowRight className="student-bookshelf-entry-arrow" aria-hidden="true" />
            </button>
          </nav>
        )}
      />
      <div className="student-failure-layout">
        <section className="student-failure-gallery-shell" aria-label="실패 이야기">
          <div
            className="student-failure-gallery"
            data-empty={stories.length === 0}
          >
            {stories.length === 0 ? (
              <div className="student-failure-empty">
                <HeartHandshake aria-hidden="true" />
                <strong>아직 전시된 이야기가 없어요</strong>
              </div>
            ) : (
              <StudentFailureRelay
                studentNumber={studentNumber}
                profileAssignments={profileAssignments}
                stories={stories}
                isSaving={isSaving}
                isExternallyPaused={isComposerOpen || isCheerNoticeOpen}
                latestRevealRequest={relayRevealRequest}
                onStamp={onStamp}
              />
            )}
          </div>
          <button
            ref={composerTriggerRef}
            type="button"
            className="student-failure-create-fab"
            aria-label="실패 이야기 전시하기"
            title="실패 이야기 전시하기"
            aria-haspopup="dialog"
            aria-expanded={isComposerOpen}
            aria-controls={isComposerOpen ? 'student-failure-compose-dialog' : undefined}
            onClick={() => {
              setIsComposerOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />
          </button>
        </section>

      </div>

      {isComposerOpen ? (
        <FailureComposerDialog
          isSaving={isSaving}
          onCreate={onCreate}
          onClose={closeComposer}
          onSaved={() => {
            setIsComposerOpen(false);
            setRelayRevealRequest((current) => current + 1);
          }}
          returnFocusRef={composerTriggerRef}
        />
      ) : null}

      {cheerNotice ? (
        <div
          className="student-failure-compose-backdrop student-failure-cheer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) acknowledgeCheer();
          }}
        >
          <div
            ref={cheerDialogRef}
            id="student-failure-cheer-dialog"
            className="student-failure-compose-dialog student-failure-cheer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-failure-cheer-title"
            aria-describedby="student-failure-cheer-description"
          >
            <button
              type="button"
              className="student-failure-compose-close"
              aria-label="응원 알림 닫기"
              onClick={acknowledgeCheer}
            >
              <X aria-hidden="true" />
            </button>
            <span className="student-failure-cheer-icon" aria-hidden="true"><HeartHandshake /></span>
            <div className="student-failure-cheer-copy">
              <span>친구의 마음이 도착했어요</span>
              <h2 id="student-failure-cheer-title">응원이 도착했어요!</h2>
              <p id="student-failure-cheer-description">
                {cheerNotice.count === 1
                  ? `친구가 “${cheerNotice.labels[0]}” 마음을 보내 줬어요.`
                  : `친구들이 따뜻한 응원 ${cheerNotice.count}개를 보내 줬어요.`}
              </p>
            </div>
            <button
              ref={cheerConfirmRef}
              type="button"
              className="student-primary-action student-failure-cheer-confirm"
              onClick={acknowledgeCheer}
            >
              <HeartHandshake aria-hidden="true" /> 응원 확인하기
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
