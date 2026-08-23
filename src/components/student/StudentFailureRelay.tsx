import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FAILURE_RELAY_VISIBLE_COUNT,
  getFailureRelayWindow,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureStory,
} from '../../lib/failureExhibition';
import StudentFailureMessage from './StudentFailureMessage';

interface StudentFailureRelayProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly stories: readonly FailureStory[];
  readonly isSaving: boolean;
  readonly isExternallyPaused: boolean;
  readonly latestRevealRequest: number;
  readonly onStamp: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
}

type RelayDirection = 'newer' | 'older';

const RELAY_INTERVAL_MS = 5_500;
const RELAY_TRANSITION_SECONDS = 0.9;
const RELAY_SWIPE_THRESHOLD = 36;
const RELAY_TRANSITION = {
  type: 'tween',
  duration: RELAY_TRANSITION_SECONDS,
  ease: [0.22, 1, 0.36, 1],
} as const;

const relayMotionVariants = {
  enter: (direction: RelayDirection) => ({ y: direction === 'older' ? '100%' : '-100%' }),
  center: { y: 0 },
  exit: (direction: RelayDirection) => ({ y: direction === 'older' ? '-100%' : '100%' }),
};

export default function StudentFailureRelay({
  studentNumber,
  profileAssignments,
  stories,
  isSaving,
  isExternallyPaused,
  latestRevealRequest,
  onStamp,
}: StudentFailureRelayProps) {
  const shouldReduceMotion = useReducedMotion();
  const [relayOffset, setRelayOffset] = useState(0);
  const [relayDirection, setRelayDirection] = useState<RelayDirection>('older');
  const [isPointerPaused, setIsPointerPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [stampMenuStoryId, setStampMenuStoryId] = useState<string | null>(null);
  const [pendingStoryCount, setPendingStoryCount] = useState(0);
  const pointerStartYRef = useRef<number | null>(null);
  const transitionEndsAtRef = useRef(0);
  const pinnedStory = useMemo(
    () => stories.find((story) => story.studentNumber === studentNumber) ?? null,
    [stories, studentNumber],
  );
  const relayStories = useMemo(
    () => pinnedStory ? stories.filter((story) => story.id !== pinnedStory.id) : stories,
    [pinnedStory, stories],
  );
  const relayVisibleCount = pinnedStory ? FAILURE_RELAY_VISIBLE_COUNT - 1 : FAILURE_RELAY_VISIBLE_COUNT;
  const latestStoryIdRef = useRef(relayStories[0]?.id ?? null);
  const previousStoryCountRef = useRef(relayStories.length);
  const maximumOffset = relayStories.length > relayVisibleCount ? relayStories.length - 1 : 0;
  const isPaused = isExternallyPaused
    || isPointerPaused
    || isFocusPaused
    || expandedStoryId !== null
    || stampMenuStoryId !== null;
  const visibleStories = getFailureRelayWindow(relayStories, relayOffset, relayVisibleCount);
  const move = useCallback((amount: number) => {
    const now = Date.now();
    if (maximumOffset === 0 || now < transitionEndsAtRef.current) return;
    transitionEndsAtRef.current = now + RELAY_TRANSITION_SECONDS * 1_000;
    setExpandedStoryId(null);
    setRelayDirection(amount > 0 ? 'older' : 'newer');
    setRelayOffset((current) => (current + amount + relayStories.length) % relayStories.length);
  }, [maximumOffset, relayStories.length]);

  useEffect(() => {
    if (!stampMenuStoryId) return;
    const closeWithPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element
        && event.target.closest('.student-failure-stamp-control, .student-failure-stamps')
      ) return;
      setStampMenuStoryId(null);
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStampMenuStoryId(null);
    };
    document.addEventListener('pointerdown', closeWithPointer);
    document.addEventListener('keydown', closeWithKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeWithPointer);
      document.removeEventListener('keydown', closeWithKeyboard);
    };
  }, [stampMenuStoryId]);

  useEffect(() => {
    setRelayOffset((current) => maximumOffset === 0 ? 0 : current % relayStories.length);
  }, [maximumOffset, relayStories.length]);

  useEffect(() => {
    const latestStoryId = relayStories[0]?.id ?? null;
    const previousLatestId = latestStoryIdRef.current;
    const previousStoryCount = previousStoryCountRef.current;
    previousStoryCountRef.current = relayStories.length;
    if (!latestStoryId || latestStoryId === previousLatestId) return;

    const previousIndex = previousLatestId
      ? relayStories.findIndex((story) => story.id === previousLatestId)
      : -1;
    if (previousIndex < 0 && relayStories.length <= previousStoryCount) {
      latestStoryIdRef.current = latestStoryId;
      return;
    }
    const incomingCount = previousIndex > 0 ? previousIndex : Math.max(1, relayStories.length - previousStoryCount);
    if (isPaused) {
      setRelayOffset((current) => maximumOffset === 0 ? 0 : (current + incomingCount) % relayStories.length);
      setPendingStoryCount((current) => current + incomingCount);
    } else {
      setRelayDirection('newer');
      setRelayOffset(0);
      setPendingStoryCount(0);
    }
    latestStoryIdRef.current = latestStoryId;
  }, [isPaused, maximumOffset, relayStories]);

  useEffect(() => {
    if (latestRevealRequest === 0) return;
    setRelayDirection('newer');
    setRelayOffset(0);
    setPendingStoryCount(0);
  }, [latestRevealRequest]);

  useEffect(() => {
    if (isPaused || maximumOffset === 0) return;
    const timer = window.setInterval(() => {
      move(1);
    }, RELAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, maximumOffset, move]);

  const revealLatest = () => {
    setRelayDirection('newer');
    setRelayOffset(0);
    setPendingStoryCount(0);
    setExpandedStoryId(null);
  };

  return (
    <>
      {pinnedStory ? (
        <section className="student-failure-pinned" aria-labelledby="student-failure-pinned-title">
          <strong id="student-failure-pinned-title">실패의 의미는 한 판 더!</strong>
          <StudentFailureMessage
            story={pinnedStory}
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            isSaving={isSaving}
            isExpanded={expandedStoryId === pinnedStory.id}
            isPinned
            isStampMenuOpen={false}
            onExpandToggle={(storyId) => {
              setExpandedStoryId((current) => current === storyId ? null : storyId);
            }}
            onStampMenuToggle={() => undefined}
            onStamp={onStamp}
          />
        </section>
      ) : null}
      {relayStories.length > 0 ? <>
        <div className="student-failure-relay">
          <div className="student-failure-relay-toolbar" role="group" aria-label="실패 이야기 흐름 조작">
            <button type="button" aria-label="더 오래된 이야기 보기" title="더 오래된 이야기" disabled={maximumOffset === 0} onClick={() => move(1)}><ChevronUp aria-hidden="true" /></button>
            <button type="button" aria-label="더 새로운 이야기 보기" title="더 새로운 이야기" disabled={maximumOffset === 0} onClick={() => move(-1)}><ChevronDown aria-hidden="true" /></button>
          </div>
          {pendingStoryCount > 0 ? <button type="button" className="student-failure-new-stories" onClick={revealLatest}>새 이야기 {pendingStoryCount}개</button> : null}
          <div
            className="student-failure-feed"
            tabIndex={0}
            aria-label="실패 이야기 릴레이. 위아래 방향키나 휠로 다른 이야기를 볼 수 있어요."
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsPointerPaused(true); }}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') setIsPointerPaused(false); }}
            onPointerDown={(event) => {
              pointerStartYRef.current = event.clientY;
            }}
            onPointerUp={(event) => {
              const startY = pointerStartYRef.current;
              pointerStartYRef.current = null;
              if (startY === null) return;
              const distance = startY - event.clientY;
              if (Math.abs(distance) >= RELAY_SWIPE_THRESHOLD) move(distance > 0 ? 1 : -1);
            }}
            onFocusCapture={() => setIsFocusPaused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusPaused(false); }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
              event.preventDefault();
              move(event.key === 'ArrowUp' ? 1 : -1);
            }}
            onWheel={(event) => {
              if (Math.abs(event.deltaY) < 20) return;
              event.preventDefault();
              move(event.deltaY > 0 ? 1 : -1);
            }}
          >
            <div className="student-failure-feed-window" data-direction={relayDirection}>
              <AnimatePresence initial={false} mode="popLayout" custom={relayDirection}>
                {visibleStories.map((story) => (
                  <motion.div
                    key={story.id}
                    className="student-failure-relay-item student-failure-relay-item-motion"
                    layout={shouldReduceMotion ? false : 'position'}
                    custom={relayDirection}
                    variants={relayMotionVariants}
                    initial={shouldReduceMotion ? false : 'enter'}
                    animate="center"
                    exit={shouldReduceMotion ? undefined : 'exit'}
                    transition={shouldReduceMotion ? { duration: 0 } : {
                      layout: RELAY_TRANSITION,
                      y: RELAY_TRANSITION,
                    }}
                  >
                    <StudentFailureMessage
                      story={story}
                      studentNumber={studentNumber}
                      profileAssignments={profileAssignments}
                      isSaving={isSaving}
                      isExpanded={expandedStoryId === story.id}
                      isStampMenuOpen={stampMenuStoryId === story.id}
                      onExpandToggle={(storyId) => {
                        setExpandedStoryId((current) => current === storyId ? null : storyId);
                      }}
                      onStampMenuToggle={(storyId) => setStampMenuStoryId((current) => current === storyId ? null : storyId)}
                      onStamp={(storyId, stampId) => onStamp(storyId, stampId).then((saved) => {
                        if (saved) setStampMenuStoryId(null);
                        return saved;
                      })}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </> : null}
    </>
  );
}
