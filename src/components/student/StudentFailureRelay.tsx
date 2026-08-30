import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceFailureRelayOffsets,
  FAILURE_RELAY_VISIBLE_COUNT,
  getFailureRelayOffsetsForAnchors,
  getFailureRelayRows,
  type FailureStampId,
  type FailureProfileAssignments,
  type FailureRelayOffsets,
  type FailureStory,
} from '../../lib/failureExhibition';
import { createFailureStoryToneIndex, createFailureStoryWindowToneIndex, getFailureStoryTone } from '../../lib/failureStoryTone';
import StudentFailureMessage from './StudentFailureMessage';
import { getStudentFailureRelayButtonMove, STUDENT_FAILURE_PAPER_TRANSITION, STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE, STUDENT_FAILURE_RELAY_TRANSITION, studentFailurePaperMotionVariants, studentFailureRelayMotionVariants, type StudentFailureRelayDirection } from './studentFailureRelayMotion';
import { shouldPauseStudentFailureRelay } from './studentFailureRelayState';

interface StudentFailureRelayProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly stories: readonly FailureStory[];
  readonly isSaving: boolean;
  readonly isExternallyPaused: boolean;
  readonly latestRevealRequest: number;
  readonly onStamp: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
}

const RELAY_INTERVAL_MS = 5_500;
const RELAY_SWIPE_THRESHOLD = 36;

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
  const [relayOffsets, setRelayOffsets] = useState<FailureRelayOffsets>([0, 0]);
  const [relayDirection, setRelayDirection] = useState<StudentFailureRelayDirection>('older');
  const [isLayoutMotionEnabled, setIsLayoutMotionEnabled] = useState(true);
  const [isPointerPaused, setIsPointerPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [isNavigationPressed, setIsNavigationPressed] = useState(false);
  const [stampMenuStoryId, setStampMenuStoryId] = useState<string | null>(null);
  const [pendingStoryCount, setPendingStoryCount] = useState(0);
  const pointerStartRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const relayStories = stories;
  const relayOffsetsRef = useRef(relayOffsets);
  relayOffsetsRef.current = relayOffsets;
  const previousRelayStoriesRef = useRef(relayStories);
  const storyToneIndex = useMemo(() => createFailureStoryToneIndex(relayStories), [relayStories]);
  const latestStoryIdRef = useRef(relayStories[0]?.id ?? null);
  const previousStoryCountRef = useRef(relayStories.length);
  const hasRelayOverflow = relayStories.length > FAILURE_RELAY_VISIBLE_COUNT;
  const isPaused = shouldPauseStudentFailureRelay({
    isExternallyPaused,
    isPointerPaused,
    isFocusPaused,
    isStampMenuOpen: stampMenuStoryId !== null,
    isNavigationPressed,
  });
  const displayedStoryRows = useMemo(() => getFailureRelayRows(relayStories, relayOffsets), [relayOffsets, relayStories]);
  const displayedStories = useMemo(() => displayedStoryRows.flat(), [displayedStoryRows]);
  const displayedStoryToneIndex = useMemo(() => createFailureStoryWindowToneIndex(displayedStories, storyToneIndex), [displayedStories, storyToneIndex]);
  const canAnimateRelay = !shouldReduceMotion && isLayoutMotionEnabled;
  const move = useCallback((amount: number, animate = true) => {
    if (!hasRelayOverflow) return;
    setIsLayoutMotionEnabled(animate);
    if (!animate) window.requestAnimationFrame(() => setIsLayoutMotionEnabled(true));
    setRelayDirection(amount > 0 ? 'older' : 'newer');
    setRelayOffsets((current) => advanceFailureRelayOffsets(relayStories, current, amount));
  }, [hasRelayOverflow, relayStories]);

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
    const previousRelayStories = previousRelayStoriesRef.current;
    previousRelayStoriesRef.current = relayStories;
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
      const previousRows = getFailureRelayRows(previousRelayStories, relayOffsetsRef.current);
      const anchors = [previousRows[0][0]?.id ?? null, previousRows[1][0]?.id ?? null] as const;
      setRelayOffsets((current) => getFailureRelayOffsetsForAnchors(relayStories, anchors, current));
      setPendingStoryCount((current) => current + incomingCount);
    } else {
      setIsLayoutMotionEnabled(true);
      setRelayDirection('newer');
      setRelayOffsets([0, 0]);
      setPendingStoryCount(0);
    }
    latestStoryIdRef.current = latestStoryId;
  }, [isPaused, relayStories]);

  useEffect(() => {
    if (latestRevealRequest === 0) return;
    setIsLayoutMotionEnabled(true);
    setRelayDirection('newer');
    setRelayOffsets([0, 0]);
    setPendingStoryCount(0);
  }, [latestRevealRequest]);

  useEffect(() => {
    if (isPaused || !hasRelayOverflow) return;
    const timer = window.setInterval(() => {
      move(STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE);
    }, RELAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasRelayOverflow, isPaused, move]);

  const revealLatest = () => {
    setIsLayoutMotionEnabled(true);
    setRelayDirection('newer');
    setRelayOffsets([0, 0]);
    setPendingStoryCount(0);
  };

  return displayedStories.length > 0 ? (
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
              }
            }}
            onFocusCapture={() => setIsFocusPaused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusPaused(false); }}
            onKeyDown={(event) => {
              switch (event.key) {
                case 'ArrowLeft':
                  event.preventDefault();
                  move(-1, false);
                  break;
                case 'ArrowRight':
                  event.preventDefault();
                  move(1, false);
                  break;
                default:
                  break;
              }
            }}
          >
            {pendingStoryCount > 0 ? <button type="button" className="student-failure-new-stories" onClick={revealLatest}>새 이야기 {pendingStoryCount}개</button> : null}
            <div className="student-failure-feed-window" data-direction={relayDirection}>
              {displayedStoryRows.map((row, rowIndex) => (<div className="student-failure-feed-row" key={rowIndex}>
                <AnimatePresence key={canAnimateRelay ? 'animated' : 'static'} initial={false} mode="popLayout" custom={relayDirection}>
                  {row.map((story) => (
                  <motion.div
                    key={story.id}
                    className="student-failure-relay-item student-failure-relay-item-motion"
                    layout={canAnimateRelay ? 'position' : false}
                    custom={relayDirection}
                    variants={studentFailureRelayMotionVariants}
                    initial={canAnimateRelay ? 'enter' : false}
                    animate="center"
                    exit={canAnimateRelay ? 'exit' : undefined}
                    transition={canAnimateRelay ? STUDENT_FAILURE_RELAY_TRANSITION : { duration: 0 }}
                  >
                    <motion.div className="student-failure-paper-motion" custom={relayDirection} variants={studentFailurePaperMotionVariants} initial={canAnimateRelay ? 'enter' : false} animate="center" transition={canAnimateRelay ? STUDENT_FAILURE_PAPER_TRANSITION : { duration: 0 }}><StudentFailureMessage
                      story={story}
                      tone={displayedStoryToneIndex.get(story.id) ?? getFailureStoryTone(story.id)}
                      studentNumber={studentNumber}
                      profileAssignments={profileAssignments}
                      isSaving={isSaving}
                      isStampMenuOpen={stampMenuStoryId === story.id}
                      onStampMenuToggle={(storyId) => {
                        setStampMenuStoryId((current) => current === storyId ? null : storyId);
                      }}
                      onStamp={(storyId, stampId) => onStamp(storyId, stampId).then((saved) => {
                        if (saved) setStampMenuStoryId(null);
                        return saved;
                      })}
                    /></motion.div>
                  </motion.div>
                  ))}</AnimatePresence>
                </div>))}
            </div>
          </div>
          {hasRelayOverflow ? (
            <div className="student-failure-relay-toolbar" role="group" aria-label="실패 이야기 흐름 조작"
              onPointerDownCapture={() => setIsNavigationPressed(true)}
              onPointerUpCapture={() => setIsNavigationPressed(false)}
              onPointerCancelCapture={() => setIsNavigationPressed(false)}
              onKeyDownCapture={(event) => { if (event.key === 'Enter' || event.key === ' ') setIsNavigationPressed(true); }}
              onKeyUpCapture={(event) => { if (event.key === 'Enter' || event.key === ' ') setIsNavigationPressed(false); }}
              onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsNavigationPressed(false); }}
            >
              <button type="button" aria-label="이전 이야기 보기" title="더 오래된 이야기" onClick={() => move(getStudentFailureRelayButtonMove('left'))}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" aria-label="다음 이야기 보기" title="더 새로운 이야기" onClick={() => move(getStudentFailureRelayButtonMove('right'))}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
  ) : null;
}
