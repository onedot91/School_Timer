import { useEffect, useRef } from 'react';
import { formatClassPrepSecondsLabel, getClassPrepWrapUpRatio, type ClassPrepState } from '../../lib/classPrep';
import { useClassPrepState, type ClassPrepSource } from '../../lib/useClassPrepState';
import { useModalFocus } from '../../lib/useModalFocus';

type StudentClassPrepProps = {
  readonly source: ClassPrepSource | null;
  readonly onStageChange: (stage: ClassPrepState['stage']) => void;
};

const noop = () => undefined;
const RING_RADIUS = 52;

export default function StudentClassPrep({ source, onStageChange }: StudentClassPrepProps) {
  const state = useClassPrepState(source);
  const isLocked = state.stage === 'locked';
  const lockDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onStageChange(state.stage);
  }, [state.stage, onStageChange]);

  useModalFocus({ dialogRef: lockDialogRef, isOpen: isLocked, onDismiss: noop, isDismissible: false });

  if (state.stage === 'idle') return null;

  if (state.stage === 'locked') {
    return (
      <div
        ref={lockDialogRef}
        className="student-class-prep-lock"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-class-prep-lock-title"
        aria-describedby="student-class-prep-lock-class"
      >
        <img className="student-class-prep-lock-character" src="/character.png?v=20260301" alt="" />
        <h2 id="student-class-prep-lock-title" className="student-class-prep-lock-title">크롬북 닫기</h2>
        <p id="student-class-prep-lock-class" className="student-class-prep-lock-class">{state.target.label}</p>
      </div>
    );
  }

  const isWrapUp = state.stage === 'wrap-up';
  const ratio = isWrapUp ? getClassPrepWrapUpRatio(state.secondsUntilLock) : state.remainingRatio;
  const percent = Math.round(ratio * 100);
  const progressProps = {
    role: 'progressbar',
    'aria-label': '수업 준비까지 남은 시간',
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': percent,
    'aria-valuetext': `잠금까지 ${formatClassPrepSecondsLabel(state.secondsUntilLock)}`,
  } as const;

  if (isWrapUp) {
    return (
      // See-through and click-through so students can still save what they were doing.
      <div className="student-class-prep-wrap-up">
        <div className="student-class-prep-ring" {...progressProps}>
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle className="student-class-prep-ring-track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="student-class-prep-ring-fill"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              pathLength={1}
              style={{ strokeDashoffset: 1 - ratio }}
            />
          </svg>
          <img className="student-class-prep-ring-character" src="/character.png?v=20260301" alt="" />
        </div>
        <p className="student-class-prep-wrap-up-label" role="status">저장하고 끝내세요</p>
      </div>
    );
  }

  return (
    <>
      <div className="student-class-prep-spacer" aria-hidden="true" />
      <div className="student-class-prep-banner" data-stage={state.stage}>
        <p className="student-class-prep-banner-label" role="status">하던 것 마무리하세요</p>
        <div className="student-class-prep-track" {...progressProps}>
          <div className="student-class-prep-fill" style={{ transform: `scaleX(${ratio})` }} />
        </div>
      </div>
    </>
  );
}
