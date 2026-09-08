import { Sparkles, HeartHandshake } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

import { FAILURE_EMPTY_PROFILE_IMAGE, getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';
import { hasSeenTodayFriendReveal, markTodayFriendRevealSeen } from '../../lib/todayFriendReveal';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';

interface TodayFriendPartnerCardProps {
  readonly mission: Pick<TodayFriendStudentMission, 'dateKey' | 'studentNumber' | 'partnerNumber'>;
  readonly profileAssignments: FailureProfileAssignments;
}

type RevealStage = 'waiting' | 'preparing' | 'turning' | 'revealing' | 'settled';

const getStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export default function TodayFriendPartnerCard({ mission, profileAssignments }: TodayFriendPartnerCardProps) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<RevealStage>(() => {
    const storage = getStorage();
    return storage && hasSeenTodayFriendReveal(storage, mission) ? 'settled' : 'waiting';
  });
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const complete = stage === 'settled';
  const visible = stage === 'revealing' || complete;
  const running = started && !complete;

  useEffect(() => {
    if (!started) return;
    const timers: number[] = [];
    const finish = () => {
      setStage('settled');
      const storage = getStorage();
      if (storage) markTodayFriendRevealSeen(storage, mission);
    };
    if (reducedMotion) {
      setStage('revealing');
      timers.push(window.setTimeout(finish, 180));
    } else {
      timers.push(window.setTimeout(() => setStage('turning'), 1200));
      timers.push(window.setTimeout(() => setStage('revealing'), 1650));
      timers.push(window.setTimeout(finish, 3000));
    }
    return () => timers.forEach(window.clearTimeout);
  }, [started, reducedMotion, mission.dateKey, mission.studentNumber, mission.partnerNumber]);

  useEffect(() => {
    if (complete && started) resultRef.current?.focus({ preventScroll: true });
  }, [complete, started]);

  const reveal = () => {
    if (startedRef.current || stage !== 'waiting') return;
    startedRef.current = true;
    setStage('preparing');
    setStarted(true);
  };

  return (
    <section className="student-today-friend-assignment today-friend-draw" data-draw-stage={stage} data-reduced-motion={reducedMotion ? 'true' : undefined} aria-label="오늘의 친구 카드" aria-busy={running}>
      <p className="student-today-friend-assignment-prompt">나의 오늘의 친구는?</p>
      <div className="today-friend-draw-stage">
        <div className="today-friend-draw-halo" aria-hidden="true" />
        <div className="today-friend-draw-card">
          {!visible ? (
            <div className="today-friend-draw-back" aria-hidden="true">
              <div className="today-friend-draw-ornament"><Sparkles /></div>
              <div className="today-friend-draw-seal"><HeartHandshake /></div>
              <div className="today-friend-draw-ornament"><Sparkles /></div>
            </div>
          ) : (
            <div className="today-friend-draw-front">
              <span className="today-friend-draw-eyebrow" aria-hidden="true">오늘의 친구</span>
              <img src={imageFailed ? FAILURE_EMPTY_PROFILE_IMAGE : getFailureProfileImage(mission.partnerNumber, profileAssignments)} alt={complete ? `${mission.partnerNumber}번 친구의 동물 프로필` : ''} width="192" height="192" onError={() => setImageFailed(true)} />
              <h2 ref={resultRef} tabIndex={-1} className="today-friend-draw-result" aria-hidden={!complete || undefined}>{complete ? `${mission.partnerNumber}번 친구` : '\u00a0'}</h2>
            </div>
          )}
          <div className="today-friend-draw-sheen" aria-hidden="true" />
        </div>
        {running && !reducedMotion ? <div className="today-friend-draw-sparks" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ rotate: `${index * 45}deg` }}><Sparkles /></i>)}</div> : null}
      </div>
      <div className="today-friend-draw-footer">
        {!complete ? <button type="button" onClick={reveal} disabled={running}>{running ? '친구를 만나고 있어요' : '친구 확인'}</button> : null}
      </div>
    </section>
  );
}
