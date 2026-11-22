import { motion, useReducedMotion } from 'motion/react';
import { Check, RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  CIRCLE_DRAWING_CANVAS_SIZE,
  CIRCLE_DRAWING_MAX_TRIES,
  decodeCircleDrawingPoints,
  encodeCircleDrawingPoints,
  getCircleDrawingReward,
  scoreCircleDrawing,
  thinCircleDrawingPoints,
  type CircleDrawingChallenge,
  type CircleDrawingEntry,
  type CircleDrawingPoint,
  type CircleDrawingTries,
} from '../../lib/circleDrawing';
import type { CircleDrawingSubmitOutcome } from '../../lib/useStudentCircleDrawingState';
import StudentHeader from './StudentHeader';

type StudentCircleDrawingPageProps = {
  readonly challenge: CircleDrawingChallenge;
  readonly entry: CircleDrawingEntry | null;
  readonly tries: CircleDrawingTries;
  readonly onTry: (points: string) => CircleDrawingTries;
  readonly onSubmit: (points: string) => Promise<CircleDrawingSubmitOutcome>;
  readonly onBack: () => void;
};

type Practice = {
  readonly points: readonly CircleDrawingPoint[];
  readonly score: number;
};
type SaveState = 'idle' | 'saving' | 'failed';
type ResultKind = 'practice' | 'pending' | 'today';

const RAW_POINT_LIMIT = 4000;
const GRID_STEP = 20;

const toPath = (points: readonly CircleDrawingPoint[]) => (
  points.length === 0 ? '' : `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`
);

const RESULT_KIND_LABELS: Record<ResultKind, string> = {
  practice: '연습',
  pending: '이번 원',
  today: '오늘 점수',
};

export default function StudentCircleDrawingPage({
  challenge,
  entry,
  tries,
  onTry,
  onSubmit,
  onBack,
}: StudentCircleDrawingPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const boardRef = useRef<SVGSVGElement>(null);
  const strokeRef = useRef<CircleDrawingPoint[]>([]);
  const drawingPointerRef = useRef<number | null>(null);
  const [stroke, setStroke] = useState<readonly CircleDrawingPoint[]>([]);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const isSaving = saveState === 'saving';
  const { centerX, centerY, radius, radiusAngle } = challenge;
  const [isPendingHidden, setIsPendingHidden] = useState(false);
  const triesLeft = Math.max(0, CIRCLE_DRAWING_MAX_TRIES - tries.used);

  // The latest unconfirmed drawing survives leaving the screen, so it is read back from the stored tries.
  const pending = useMemo(() => {
    if (entry || !tries.points) return null;
    const points = decodeCircleDrawingPoints(tries.points);
    const scored = points ? scoreCircleDrawing(points, challenge) : null;
    return points && scored ? { encoded: tries.points, points, score: scored.score } : null;
  }, [challenge, entry, tries.points]);

  // With no tries left, the last drawing is the one that counts until it is saved.
  const canDraw = !isSaving && (entry !== null || triesLeft > 0);
  const savedPoints = useMemo(() => (entry ? decodeCircleDrawingPoints(entry.points) ?? [] : []), [entry]);
  const isDrawing = stroke.length > 0;
  const result: { kind: ResultKind; score: number; points: readonly CircleDrawingPoint[] } | null = isDrawing
    ? null
    : practice && entry ? { kind: 'practice', ...practice }
      : entry ? { kind: 'today', score: entry.score, points: savedPoints }
        : pending && !isPendingHidden ? { kind: 'pending', score: pending.score, points: pending.points }
          : null;
  const shownPoints = isDrawing ? stroke : result?.points ?? [];

  const toBoardPoint = (clientX: number, clientY: number): CircleDrawingPoint | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const clamp = (value: number) => Math.max(0, Math.min(CIRCLE_DRAWING_CANVAS_SIZE, value));
    return [
      clamp((clientX - rect.left) * (CIRCLE_DRAWING_CANVAS_SIZE / rect.width)),
      clamp((clientY - rect.top) * (CIRCLE_DRAWING_CANVAS_SIZE / rect.height)),
    ];
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!canDraw || drawingPointerRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = toBoardPoint(event.clientX, event.clientY);
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
    const next = [...strokeRef.current];
    for (const item of events.length > 0 ? events : [event.nativeEvent]) {
      if (next.length >= RAW_POINT_LIMIT) break;
      const point = toBoardPoint(item.clientX, item.clientY);
      if (point) next.push(point);
    }
    strokeRef.current = next;
    setStroke(next);
  };

  const submitToday = async (points: string) => {
    setSaveState('saving');
    const outcome = await onSubmit(points);
    setSaveState(outcome === 'failed' ? 'failed' : 'idle');
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
      setHint('원의 중심을 한 바퀴 빙 돌아서 그려요.');
      return;
    }
    if (entry) {
      setPractice({ points, score: scored.score });
      return;
    }
    // An unfinished stroke above doesn't use a try; only scored drawings do.
    const next = onTry(encoded);
    setIsPendingHidden(false);
    if (next.used >= CIRCLE_DRAWING_MAX_TRIES) void submitToday(encoded);
  };

  const cancelStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (drawingPointerRef.current !== event.pointerId) return;
    drawingPointerRef.current = null;
    strokeRef.current = [];
    setStroke([]);
  };

  const angle = (radiusAngle * Math.PI) / 180;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const radiusEndX = centerX + directionX * radius;
  const radiusEndY = centerY + directionY * radius;
  // The radius label sits beside the middle of the line; the centre label sits on the opposite side.
  const radiusLabelX = centerX + directionX * radius / 2 - directionY * 18;
  const radiusLabelY = centerY + directionY * radius / 2 + directionX * 18 + 5;
  const centerLabelX = centerX - directionX * 44;
  const centerLabelY = centerY - directionY * 26 + 5;
  const reward = entry ? getCircleDrawingReward(entry.score) : pending ? getCircleDrawingReward(pending.score) : null;

  return (
    <div className="student-view student-circle-view">
      <StudentHeader title="원 그리기" onBack={onBack} backLabel="미션으로 돌아가기" />
      <main className="student-circle-main">
        <section className="student-circle-board-wrap" aria-label="원 그리기 판">
          <svg
            ref={boardRef}
            className={`student-circle-board${canDraw ? '' : ' is-locked'}`}
            viewBox={`0 0 ${CIRCLE_DRAWING_CANVAS_SIZE} ${CIRCLE_DRAWING_CANVAS_SIZE}`}
            role="img"
            aria-label={`가운데 점이 원의 중심이고, 선의 길이가 반지름이에요. 손가락으로 원을 그려요.${result ? ` ${RESULT_KIND_LABELS[result.kind]} ${result.score}점` : ''}`}
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
            {result ? <circle cx={centerX} cy={centerY} r={radius} className="student-circle-answer" /> : null}
            <line x1={centerX} y1={centerY} x2={radiusEndX} y2={radiusEndY} className="student-circle-radius" />
            <text x={radiusLabelX} y={radiusLabelY} className="student-circle-label" textAnchor="middle">반지름</text>
            <circle cx={radiusEndX} cy={radiusEndY} r={4} className="student-circle-radius-end" />
            <circle cx={centerX} cy={centerY} r={6} className="student-circle-center" />
            <text x={centerLabelX} y={centerLabelY} className="student-circle-label" textAnchor="middle">원의 중심</text>
            {shownPoints.length > 0 ? <path d={toPath(shownPoints)} className="student-circle-stroke" /> : null}
          </svg>
        </section>

        <section className="student-circle-panel" aria-live="polite">
          {entry ? null : (
            <div className="student-circle-tries" role="img" aria-label={`남은 기회 ${triesLeft}번`}>
              <span className="student-circle-tries-label">남은 기회</span>
              {Array.from({ length: CIRCLE_DRAWING_MAX_TRIES }, (_, index) => (
                <span key={index} className={`student-circle-try${index < triesLeft ? ' is-left' : ''}`} />
              ))}
            </div>
          )}

          <div className="student-circle-panel-body">
            {result === null ? (
              <p className="student-circle-guide-title">반지름만큼 떨어지게<br />원을 그려요</p>
            ) : (
              <motion.div
                key={`${result.kind}-${result.score}-${result.points.length}`}
                className={`student-circle-result is-${result.kind}`}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.94)' }}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
              >
                <span className="student-circle-result-kind">{RESULT_KIND_LABELS[result.kind]}</span>
                <strong className="student-circle-score">{result.score}<small>점</small></strong>
                {result.kind === 'practice' ? null : (
                  <span className="student-circle-reward-chip">
                    +{reward}고마{result.kind === 'today' ? ' 받았어요' : ''}
                  </span>
                )}
              </motion.div>
            )}
            {hint ? <p className="student-circle-hint" role="alert">{hint}</p> : null}
          </div>

          {pending && !isDrawing && !isPendingHidden ? (
            <div className="student-circle-actions">
              {saveState === 'failed' ? <p className="student-circle-hint" role="alert">저장하지 못했어요</p> : null}
              <button
                type="button"
                className="student-primary-action student-circle-confirm"
                disabled={isSaving}
                aria-busy={isSaving}
                onClick={() => void submitToday(pending.encoded)}
              >
                <Check aria-hidden="true" />
                {isSaving ? '저장 중…' : saveState === 'failed' ? '다시 보내기' : '확정하기'}
              </button>
              {triesLeft > 0 && saveState === 'idle' ? (
                <button type="button" className="student-circle-redraw" onClick={() => setIsPendingHidden(true)}>
                  <RotateCcw aria-hidden="true" />
                  다시 그리기
                </button>
              ) : null}
            </div>
          ) : null}

          {entry && result?.kind === 'today' ? null : entry && result ? (
            <p className="student-circle-today">오늘 {entry.score}점 · +{getCircleDrawingReward(entry.score)}고마</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
