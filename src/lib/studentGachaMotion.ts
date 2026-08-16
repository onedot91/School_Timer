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
    cableScale: roundToHundredth((cableHeight + dropDistance) / cableHeight),
  };
}
