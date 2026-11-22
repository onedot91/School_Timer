import { motion, useReducedMotion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import {
  CIRCLE_DRAWING_CANVAS_SIZE,
  decodeCircleDrawingPoints,
  encodeCircleDrawingPoints,
  getCircleDrawingReward,
  scoreCircleDrawing,
  thinCircleDrawingPoints,
  type CircleDrawingChallenge,
  type CircleDrawingEntry,
  type CircleDrawingPoint,
} from '../../lib/circleDrawing';
import type { CircleDrawingSubmitOutcome } from '../../lib/useStudentCircleDrawingState';
import StudentHeader from './StudentHeader';

type StudentCircleDrawingPageProps = {
  readonly challenge: CircleDrawingChallenge;
  readonly entry: CircleDrawingEntry | null;
  readonly onSubmit: (points: string) => Promise<CircleDrawingSubmitOutcome>;
  readonly onBack: () => void;
};

type Attempt = {
  readonly points: readonly CircleDrawingPoint[];
  readonly score: number;
  readonly kind: 'today' | 'practice';
};
type SaveState = 'idle' | 'saving' | 'failed';

const RAW_POINT_LIMIT = 4000;
const GRID_STEP = 20;

const toPath = (points: readonly CircleDrawingPoint[]) => (
  points.length === 0 ? '' : `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`
);

const getFeedback = (score: number) => {
  if (score >= 90) return '거의 완벽한 원이에요!';
  if (score >= 75) return '아주 동그래요!';
  if (score >= 60) return '조금만 더 동그랗게!';
  return '중심에서 같은 거리로 그려 봐요.';
};

export default function StudentCircleDrawingPage({
  challenge,
  entry,
  onSubmit,
  onBack,
}: StudentCircleDrawingPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const boardRef = useRef<SVGSVGElement>(null);
  const strokeRef = useRef<CircleDrawingPoint[]>([]);
  const drawingPointerRef = useRef<number | null>(null);
  const [stroke, setStroke] = useState<readonly CircleDrawingPoint[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [failedPoints, setFailedPoints] = useState<string | null>(null);
  const isSaving = saveState === 'saving';
  const { centerX, centerY, radius } = challenge;
  const savedPoints = entry ? decodeCircleDrawingPoints(entry.points) ?? [] : [];
  const shownPoints = stroke.length > 0 ? stroke : attempt?.points ?? savedPoints;
  const isShowingResult = stroke.length === 0 && (attempt !== null || entry !== null);
  const todayScore = entry?.score ?? (attempt?.kind === 'today' ? attempt.score : null);

  const toBoardPoint = (event: PointerEvent<SVGSVGElement>): CircleDrawingPoint | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const scale = CIRCLE_DRAWING_CANVAS_SIZE / rect.width;
    const clamp = (value: number) => Math.max(0, Math.min(CIRCLE_DRAWING_CANVAS_SIZE, value));
    return [clamp((event.clientX - rect.left) * scale), clamp((event.clientY - rect.top) * (CIRCLE_DRAWING_CANVAS_SIZE / rect.height))];
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (isSaving || drawingPointerRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = toBoardPoint(event);
    if (!point) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The stroke still works without capture; it only ends if the finger leaves the board.
    }
    drawingPointerRef.current = event.pointerId;
    strokeRef.current = [point];
    setStroke([point]);
    setHint(null);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (drawingPointerRef.current !== event.pointerId) return;
    const events = typeof event.nativeEvent.getCoalescedEvents === 'function'
      ? event.nativeEvent.getCoalescedEvents()
      : [];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = [...strokeRef.current];
    for (const item of events.length > 0 ? events : [event.nativeEvent]) {
      if (next.length >= RAW_POINT_LIMIT) break;
      next.push([
        Math.max(0, Math.min(CIRCLE_DRAWING_CANVAS_SIZE, (item.clientX - rect.left) * (CIRCLE_DRAWING_CANVAS_SIZE / rect.width))),
        Math.max(0, Math.min(CIRCLE_DRAWING_CANVAS_SIZE, (item.clientY - rect.top) * (CIRCLE_DRAWING_CANVAS_SIZE / rect.height))),
      ]);
    }
    strokeRef.current = next;
    setStroke(next);
  };

  const submitToday = async (points: string) => {
    setSaveState('saving');
    setFailedPoints(null);
    const outcome = await onSubmit(points);
    if (outcome === 'failed') {
      setSaveState('failed');
      setFailedPoints(points);
      return;
    }
    setSaveState('idle');
    // Another device already saved today's circle: show that one instead of this drawing.
    if (outcome === 'alreadySubmitted') setAttempt(null);
  };

  const finishStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (drawingPointerRef.current !== event.pointerId) return;
    drawingPointerRef.current = null;
    const points = thinCircleDrawingPoints(strokeRef.current);
    strokeRef.current = [];
    setStroke([]);
    const encoded = encodeCircleDrawingPoints(points);
    // Score the rounded points, exactly as the server will.
    const scored = scoreCircleDrawing(decodeCircleDrawingPoints(encoded) ?? [], challenge);
    if (!scored) {
      setHint('중심을 한 바퀴 빙 돌아서 그려요.');
      return;
    }
    const isToday = entry === null && failedPoints === null && saveState === 'idle';
    setAttempt({ points, score: scored.score, kind: isToday ? 'today' : 'practice' });
    if (isToday) void submitToday(encoded);
  };

  const cancelStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (drawingPointerRef.current !== event.pointerId) return;
    drawingPointerRef.current = null;
    strokeRef.current = [];
    setStroke([]);
  };

  const shownScore = attempt && stroke.length === 0 ? attempt.score : entry?.score ?? null;
  const shownKind = attempt && stroke.length === 0 ? attempt.kind : entry ? 'today' : null;
  const reward = todayScore === null ? null : getCircleDrawingReward(todayScore);
  const radiusLabelX = centerX + radius / 2;

  return (
    <div className="student-view student-circle-view">
      <StudentHeader title="원 그리기" onBack={onBack} backLabel="미션으로 돌아가기" />
      <main className="student-circle-main">
        <section className="student-circle-board-wrap" aria-label="원 그리기 판">
          <svg
            ref={boardRef}
            className={`student-circle-board${isSaving ? ' is-saving' : ''}`}
            viewBox={`0 0 ${CIRCLE_DRAWING_CANVAS_SIZE} ${CIRCLE_DRAWING_CANVAS_SIZE}`}
            role="img"
            aria-label={`가운데 점이 원의 중심이고, 선의 길이가 반지름이에요. 손가락으로 원을 그려요.${shownScore === null ? '' : ` 점수 ${shownScore}점`}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={cancelStroke}
            onPointerLeave={finishStroke}
          >
            <defs>
              <pattern id="student-circle-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <path d={`M${GRID_STEP} 0H0V${GRID_STEP}`} className="student-circle-grid-line" />
              </pattern>
            </defs>
            <rect width={CIRCLE_DRAWING_CANVAS_SIZE} height={CIRCLE_DRAWING_CANVAS_SIZE} fill="url(#student-circle-grid)" />
            {isShowingResult ? (
              <circle cx={centerX} cy={centerY} r={radius} className="student-circle-answer" />
            ) : null}
            <line x1={centerX} y1={centerY} x2={centerX + radius} y2={centerY} className="student-circle-radius" />
            <text x={radiusLabelX} y={centerY - 12} className="student-circle-label" textAnchor="middle">반지름</text>
            <circle cx={centerX + radius} cy={centerY} r={4} className="student-circle-radius-end" />
            <circle cx={centerX} cy={centerY} r={6} className="student-circle-center" />
            <text x={centerX} y={centerY + 26} className="student-circle-label" textAnchor="middle">중심</text>
            {shownPoints.length > 0 ? <path d={toPath(shownPoints)} className="student-circle-stroke" /> : null}
          </svg>
        </section>

        <section className="student-circle-panel" aria-live="polite">
          {shownScore === null ? (
            <div className="student-circle-guide">
              <p className="student-circle-guide-title">중심에서 반지름만큼 떨어지게<br />한 번에 원을 그려요</p>
              <p className="student-circle-condition">오늘 처음 그린 원으로 고마를 받아요</p>
            </div>
          ) : (
            <motion.div
              key={`${shownKind}-${shownScore}-${attempt?.points.length ?? 0}`}
              className="student-circle-result"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.94)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="student-circle-result-kind">{shownKind === 'practice' ? '연습 점수' : '오늘 점수'}</span>
              <strong className="student-circle-score">{shownScore}<small>점</small></strong>
              <p className="student-circle-feedback">{getFeedback(shownScore)}</p>
            </motion.div>
          )}

          {hint ? <p className="student-circle-hint" role="alert">{hint}</p> : null}

          {todayScore !== null ? (
            <div className={`student-circle-reward is-${saveState}`}>
              {saveState === 'saving' ? <span>저장 중…</span> : null}
              {saveState === 'failed' ? (
                <>
                  <span>저장하지 못했어요. 다시 보내 주세요.</span>
                  <button
                    type="button"
                    className="student-primary-action"
                    onClick={() => { if (failedPoints) void submitToday(failedPoints); }}
                  >
                    다시 보내기
                  </button>
                </>
              ) : null}
              {saveState === 'idle' && entry ? (
                <span>오늘 {entry.score}점 · <strong>+{reward}고마</strong> 받았어요</span>
              ) : null}
            </div>
          ) : null}

          {entry && shownScore !== null ? (
            <p className="student-circle-practice-note">
              <RotateCcw aria-hidden="true" />
              다시 그리면 연습 점수만 나와요
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
