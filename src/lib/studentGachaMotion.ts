import type { StudentCharacterPrizeId } from './studentEconomy';

export const STUDENT_GACHA_MOTION = Object.freeze({
  prepareMs: 160,
  dropMs: 840,
  gripMs: 280,
  liftMs: 920,
  transferMs: 650,
  revealMs: 1200,
  doubleRevealMs: 1600,
  reducedMs: 180,
  ease: [0.22, 1, 0.36, 1] as const,
  mechanicalEase: [0.45, 0, 0.25, 1] as const,
});

export interface StudentGachaRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function getStudentCapsuleTransfer(from: StudentGachaRect, to: StudentGachaRect) {
  return {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    scale: to.width > 0 ? from.width / to.width : 1,
  };
}

export function getCommittedStudentGachaPrizes(
  saved: boolean,
  before: readonly StudentCharacterPrizeId[],
  owned: readonly StudentCharacterPrizeId[],
  active: StudentCharacterPrizeId | null,
): readonly StudentCharacterPrizeId[] {
  if (!saved) return [];
  const newIds = owned.filter((id) => !before.includes(id));
  return (active && newIds.includes(active)
    ? [active, ...newIds.filter((id) => id !== active)]
    : newIds).slice(0, 2);
}

interface StudentClawDropGeometry {
  readonly caughtCapsuleCenterY: number;
  readonly targetCapsuleCenterY: number;
  readonly cableHeight: number;
}

interface StudentClawDropMotion {
  readonly dropDistance: number;
  readonly cableScale: number;
}

const roundToHundredth = (value: number) => Math.round(value * 100) / 100;

export function getStudentClawDropMotion({
  caughtCapsuleCenterY,
  targetCapsuleCenterY,
  cableHeight,
}: StudentClawDropGeometry): StudentClawDropMotion {
  const dropDistance = Math.max(0, targetCapsuleCenterY - caughtCapsuleCenterY);

  return {
    dropDistance: roundToHundredth(dropDistance),
    cableScale: cableHeight > 0 ? roundToHundredth((cableHeight + dropDistance) / cableHeight) : 1,
  };
}
