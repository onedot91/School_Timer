import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import {
  createTodayFriendRevealSequence,
  hasSeenTodayFriendReveal,
  markTodayFriendRevealSeen,
  shouldAnimateTodayFriendReveal,
} from '../../lib/todayFriendReveal';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';

interface TodayFriendPartnerCardProps {
  readonly mission: Pick<TodayFriendStudentMission, 'dateKey' | 'studentNumber' | 'partnerNumber'>;
  readonly profileAssignments: FailureProfileAssignments;
}

type RevealStage = 'rolling' | 'revealed' | 'settled';

const REVEAL_STEP_DELAYS_MS = [90, 100, 115, 135, 165, 210, 290] as const;
const REVEAL_SETTLE_DURATION_MS = 520;

export default function TodayFriendPartnerCard({ mission, profileAssignments }: TodayFriendPartnerCardProps) {
  const [shouldReveal] = useState(() => (
    shouldAnimateTodayFriendReveal(
      hasSeenTodayFriendReveal(window.localStorage, mission),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
  ));
  const [sequence] = useState(() => (
    shouldReveal ? createTodayFriendRevealSequence(mission) : [mission.partnerNumber]
  ));
  const [displayedPartnerNumber, setDisplayedPartnerNumber] = useState(sequence[0] ?? mission.partnerNumber);
  const [stage, setStage] = useState<RevealStage>(shouldReveal ? 'rolling' : 'settled');

  useEffect(() => {
    if (!shouldReveal) {
      markTodayFriendRevealSeen(window.localStorage, mission);
      return;
    }

    const timerIds: number[] = [];
    let elapsedMs = 0;
    REVEAL_STEP_DELAYS_MS.forEach((delayMs, index) => {
      elapsedMs += delayMs;
      timerIds.push(window.setTimeout(() => {
        const nextPartnerNumber = sequence[index + 1];
        if (nextPartnerNumber === undefined) return;
        setDisplayedPartnerNumber(nextPartnerNumber);
        if (index === REVEAL_STEP_DELAYS_MS.length - 1) {
          setStage('revealed');
          markTodayFriendRevealSeen(window.localStorage, mission);
          timerIds.push(window.setTimeout(() => setStage('settled'), REVEAL_SETTLE_DURATION_MS));
        }
      }, elapsedMs));
    });
    return () => timerIds.forEach((timerId) => window.clearTimeout(timerId));
  }, [mission.dateKey, mission.partnerNumber, mission.studentNumber, sequence, shouldReveal]);

  const isRolling = stage === 'rolling';
  const displayedProfile = getFailureProfileImage(displayedPartnerNumber, profileAssignments);

  return (
    <section
      className="student-today-friend-assignment"
      data-reveal-state={stage}
      aria-labelledby="student-today-friend-assignment-title"
      aria-busy={isRolling}
    >
      <p className="student-today-friend-assignment-prompt">
        {isRolling ? '오늘의 친구를 찾고 있어요' : '나의 오늘의 친구는?'}
      </p>
      <h2 id="student-today-friend-assignment-title" className="sr-only">
        {mission.partnerNumber}번 친구
      </h2>
      <div
        className="student-today-friend-profile"
        aria-label={isRolling ? '오늘의 친구를 찾는 중' : `오늘의 친구 ${mission.partnerNumber}번`}
      >
        <figure
          key={`${stage}-${displayedPartnerNumber}`}
          className="student-today-friend-person"
          data-reveal-stage={stage}
          aria-hidden={isRolling || undefined}
        >
          <img
            src={displayedProfile}
            alt={isRolling ? '' : `${mission.partnerNumber}번 친구의 동물 프로필`}
            width="192"
            height="192"
          />
          <figcaption><strong>{displayedPartnerNumber}번 친구</strong></figcaption>
        </figure>
        {stage !== 'settled' ? (
          <p className="today-friend-partner-reveal-status" aria-hidden={isRolling || undefined}>
            <Sparkles aria-hidden="true" />
            {isRolling ? '두근두근, 누구일까요?' : '오늘의 친구를 찾았어요!'}
          </p>
        ) : null}
      </div>
    </section>
  );
}
