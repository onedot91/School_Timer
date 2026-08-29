import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FAILURE_RELAY_VISIBLE_COUNT,
  getFailureRelayWindow,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureStory,
} from '../../lib/failureExhibition';
import { createFailureStoryToneIndex, getFailureStoryTone } from '../../lib/failureStoryTone';
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
  enter: (direction: RelayDirection) => ({ x: direction === 'older' ? '100%' : '-100%' }),
  center: { x: 0 },
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
  const pointerStartRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const transitionEndsAtRef = useRef(0);
  const relayStories = stories;
  const storyToneIndex = useMemo(() => createFailureStoryToneIndex(relayStories), [relayStories]);
  const latestStoryIdRef = useRef(relayStories[0]?.id ?? null);
  const previousStoryCountRef = useRef(relayStories.length);
  const maximumOffset = Math.max(0, relayStories.length - FAILURE_RELAY_VISIBLE_COUNT);
  const relayOffsetCount = maximumOffset + 1;
  const isPaused = isExternallyPaused
    || isPointerPaused
    || isFocusPaused
    || expandedStoryId !== null
    || stampMenuStoryId !== null;
  const displayedStories = getFailureRelayWindow(relayStories, relayOffset);
  const move = useCallback((amount: number) => {
    const now = Date.now();
    if (maximumOffset === 0 || now < transitionEndsAtRef.current) return;
    transitionEndsAtRef.current = now + RELAY_TRANSITION_SECONDS * 1_000;
    setExpandedStoryId(null);
    setRelayDirection(amount > 0 ? 'older' : 'newer');
    setRelayOffset((current) => (current + amount + relayOffsetCount) % relayOffsetCount);
  }, [maximumOffset, relayOffsetCount]);

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
    setRelayOffset((current) => current % relayOffsetCount);
  }, [relayOffsetCount]);

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
      setRelayOffset((current) => (current + incomingCount) % relayOffsetCount);
      setPendingStoryCount((current) => current + incomingCount);
    } else {
      setRelayDirection('newer');
      setRelayOffset(0);
      setPendingStoryCount(0);
    }
    latestStoryIdRef.current = latestStoryId;
  }, [isPaused, relayOffsetCount, relayStories]);

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
      {displayedStories.length > 0 ? <>
        <div className="student-failure-relay">
          <div
            className="student-failure-feed"
            tabIndex={0}
            aria-label="실패 이야기 릴레이. 좌우 방향키로 이전과 다음 이야기를 볼 수 있어요."
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsPointerPaused(true); }}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') setIsPointerPaused(false); }}
            onPointerDown={(event) => {
              pointerStartRef.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const start = pointerStartRef.current;
              pointerStartRef.current = null;
              if (start === null) return;
              const horizontalDistance = start.x - event.clientX;
              const verticalDistance = start.y - event.clientY;
              if (
                Math.abs(horizontalDistance) >= RELAY_SWIPE_THRESHOLD
                && Math.abs(horizontalDistance) >= Math.abs(verticalDistance)
              ) {
                move(horizontalDistance > 0 ? 1 : -1);
                return;
              }
              if (Math.abs(verticalDistance) >= RELAY_SWIPE_THRESHOLD) {
                move(verticalDistance > 0 ? 1 : -1);
              }
            }}
            onFocusCapture={() => setIsFocusPaused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusPaused(false); }}
            onKeyDown={(event) => {
              switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                  event.preventDefault();
                  move(-1);
                  break;
                case 'ArrowRight':
                case 'ArrowDown':
                  event.preventDefault();
                  move(1);
                  break;
                default:
                  break;
              }
            }}
            onWheel={(event) => {
              if (Math.abs(event.deltaY) < 20) return;
              event.preventDefault();
              move(event.deltaY > 0 ? 1 : -1);
            }}
          >
            {pendingStoryCount > 0 ? <button type="button" className="student-failure-new-stories" onClick={revealLatest}>새 이야기 {pendingStoryCount}개</button> : null}
            <div className="student-failure-feed-window" data-direction={relayDirection}>
              <AnimatePresence initial={false} mode="popLayout" custom={relayDirection}>
                {displayedStories.map((story) => (
                  <motion.div
                    key={story.id}
                    className="student-failure-relay-item student-failure-relay-item-motion"
                    layout={shouldReduceMotion ? false : 'position'}
                    custom={relayDirection}
                    variants={relayMotionVariants}
                    initial={shouldReduceMotion ? false : 'enter'}
                    animate="center"
                    exit={undefined}
                    transition={shouldReduceMotion ? { duration: 0 } : {
                      layout: RELAY_TRANSITION,
                      x: RELAY_TRANSITION,
                    }}
                  >
                    <StudentFailureMessage
                      story={story}
                      tone={storyToneIndex.get(story.id) ?? getFailureStoryTone(story.id)}
                      studentNumber={studentNumber}
                      profileAssignments={profileAssignments}
                      isSaving={isSaving}
                      isExpanded={expandedStoryId === story.id}
                      isStampMenuOpen={stampMenuStoryId === story.id}
                      onExpandToggle={(storyId) => {
                        setExpandedStoryId((current) => current === storyId ? null : storyId);
                      }}
                      onStampMenuToggle={(storyId) => {
                        setStampMenuStoryId((current) => current === storyId ? null : storyId);
                      }}
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
          {maximumOffset > 0 ? (
            <div className="student-failure-relay-toolbar" role="group" aria-label="실패 이야기 흐름 조작">
              <button type="button" aria-label="이전 이야기 보기" title="더 새로운 이야기" onClick={() => move(-1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" aria-label="다음 이야기 보기" title="더 오래된 이야기" onClick={() => move(1)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </> : null}
    </>
  );
}
