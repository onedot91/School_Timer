import type { CSSProperties, RefObject } from 'react';
import { Coins, Sparkles } from 'lucide-react';
import { STUDENT_PET_EGG_HATCHED_STAGE } from '../../lib/studentPet';

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface StudentPetEggFeedProps {
  fedAmount: number;
  hatchAmount: number;
  feedAmount: number;
  stage: number;
  availableBalance: number;
  isSaving: boolean;
  /** Increases after each successful feed, replaying the feeding effects. */
  feedCount: number;
  /** The last feed moved the egg to a new crack stage. */
  cracked: boolean;
  feedButtonRef: RefObject<HTMLButtonElement | null>;
  onRequestFeed: () => void;
}

export function StudentPetEggFeed({
  fedAmount,
  hatchAmount,
  feedAmount,
  stage,
  availableBalance,
  isSaving,
  feedCount,
  cracked,
  feedButtonRef,
  onRequestFeed,
}: StudentPetEggFeedProps) {
  const progress = Math.min(1, Math.max(0, fedAmount / hatchAmount));
  const canFeed = availableBalance >= feedAmount;
  return (
    <>
      <h2 id="student-pet-dialog-title" className="sr-only">알 키우기</h2>
      <div className="student-egg" aria-hidden="true">
        <svg className="student-egg-ring" viewBox="0 0 120 120">
          <circle className="student-egg-ring-track" cx="60" cy="60" r={RING_RADIUS} />
          <circle
            className="student-egg-ring-fill"
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        </svg>
        <span
          key={`egg-${feedCount}`}
          className={`student-egg-art${feedCount > 0 ? (cracked ? ' is-cracking' : ' is-fed') : ''}`}
          style={{ '--student-pet-egg-stage': stage } as CSSProperties}
        />
        {feedCount > 0 ? (
          <span key={`effects-${feedCount}`} className="student-egg-effects">
            <span className="student-egg-coin"><Coins /></span>
            <span className="student-egg-plus">+{feedAmount}</span>
            <Sparkles className="student-egg-sparkle student-egg-sparkle-1" />
            <Sparkles className="student-egg-sparkle student-egg-sparkle-2" />
            <Sparkles className="student-egg-sparkle student-egg-sparkle-3" />
          </span>
        ) : null}
      </div>
      <p className="student-egg-count" aria-label={`알 성장 ${fedAmount} / ${hatchAmount} 고마`}>
        <strong>{fedAmount}</strong> / {hatchAmount}
      </p>
      <button
        ref={feedButtonRef}
        type="button"
        className="student-pet-dialog-primary"
        disabled={isSaving || !canFeed}
        onClick={onRequestFeed}
      >
        <Coins size={20} aria-hidden="true" />
        {isSaving ? '주는 중' : `${feedAmount} 고마 주기`}
      </button>
      {canFeed ? null : <p className="student-pet-dialog-error" role="status">고마가 부족해요.</p>}
    </>
  );
}

// Shell shards thrown out when the egg breaks: direction (rem) and spin.
const SHARDS: readonly { dx: number; dy: number; rot: number }[] = [
  { dx: -5.5, dy: -4, rot: -140 },
  { dx: 5, dy: -4.5, rot: 160 },
  { dx: -6, dy: 1, rot: -90 },
  { dx: 6.5, dy: .5, rot: 110 },
  { dx: -2.5, dy: -6.5, rot: -60 },
  { dx: 2.5, dy: -6.5, rot: 70 },
];

/** The egg shakes harder and harder, glows, and bursts; the parent then shows the hatched pet. */
export function StudentPetEggHatch() {
  return (
    <>
      <h2 id="student-pet-dialog-title" className="sr-only">알이 부화하고 있어요</h2>
      <div className="student-egg is-hatching" role="status" aria-label="알이 부화하고 있어요">
        <span className="student-egg-glow" aria-hidden="true" />
        <span
          className="student-egg-art"
          style={{ '--student-pet-egg-stage': STUDENT_PET_EGG_HATCHED_STAGE } as CSSProperties}
          aria-hidden="true"
        />
        {SHARDS.map(({ dx, dy, rot }, index) => (
          <svg
            key={index}
            className="student-egg-shard"
            viewBox="0 0 20 16"
            style={{ '--shard-dx': `${dx}rem`, '--shard-dy': `${dy}rem`, '--shard-rot': `${rot}deg` } as CSSProperties}
            aria-hidden="true"
          >
            <path d="M2 4 L7 1 L12 5 L18 2 L16 12 L5 14 Z" />
          </svg>
        ))}
        <span className="student-egg-flash" aria-hidden="true" />
      </div>
    </>
  );
}

/** How long the hatch scene plays before the naming step. */
export const EGG_HATCH_SCENE_MS = 2100;
export const EGG_HATCH_SCENE_REDUCED_MS = 600;
