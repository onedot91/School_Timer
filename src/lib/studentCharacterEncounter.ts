export interface CharacterEncounterPosition {
  lane: string | undefined;
  direction: string | undefined;
  left: number;
  right: number;
  previousCenter?: number;
}

export const DOUGH_EATER_ID = 'student-12-dough-eater';
export const DOUGH_ID = 'student-12-clover';

export function getDoughEncounter(eitherId: string | undefined, otherId: string | undefined): { eater: string; dough: string } | null {
  const eater = DOUGH_EATER_ID;
  const dough = DOUGH_ID;
  return (eitherId === eater && otherId === dough) || (eitherId === dough && otherId === eater)
    ? { eater, dough }
    : null;
}

export function shouldCharactersGreet(a: CharacterEncounterPosition, b: CharacterEncounterPosition, viewportWidth: number, reachFactor = .6): boolean {
  if (a.lane === undefined || a.lane !== b.lane || a.direction === b.direction) return false;
  const [rightward, leftward] = a.direction === 'right' ? [a, b] : [b, a];
  if (rightward.direction !== 'right' || leftward.direction !== 'left') return false;
  if ([a, b].some(({ left, right }) => right <= 0 || left >= viewportWidth)) return false;
  const gap = (leftward.left + leftward.right - rightward.left - rightward.right) / 2;
  const reach = ((a.right - a.left) + (b.right - b.left)) * reachFactor;
  const crossed = rightward.previousCenter !== undefined && leftward.previousCenter !== undefined
    && leftward.previousCenter > rightward.previousCenter && gap <= 0;
  return (gap >= 0 && gap <= reach) || crossed;
}

export interface CharacterBox {
  left: number;
  right: number;
  bottom: number;
}

const isWellOnScreen = ({ left, right }: CharacterBox, viewportWidth: number) => {
  const center = (left + right) / 2;
  return center >= viewportWidth * .08 && center <= viewportWidth * .92;
};

// 노란 자캐와 반죽이가 한 화면에 함께 보이면 줄이 달라도 노란 자캐가 반죽이에게 달려간다.
export function canStartDoughChase(eater: CharacterBox, dough: CharacterBox, viewportWidth: number): boolean {
  return isWellOnScreen(eater, viewportWidth) && isWellOnScreen(dough, viewportWidth);
}

// 노란 자캐가 지금 있는 쪽에서 반죽이 옆까지 가는 거리와 시간. 발끝을 반죽이와 맞춘다.
export function getDoughChasePlan(eater: CharacterBox, dough: CharacterBox, speedPxPerSecond = 360): { dx: number; dy: number; durationMs: number } {
  const eaterCenter = (eater.left + eater.right) / 2;
  const doughCenter = (dough.left + dough.right) / 2;
  const side = eaterCenter >= doughCenter ? 1 : -1;
  const reach = ((eater.right - eater.left) + (dough.right - dough.left)) * .3;
  const dx = Math.round(doughCenter + side * reach - eaterCenter);
  const dy = Math.round(dough.bottom - eater.bottom);
  const durationMs = Math.round(Math.min(2400, Math.max(600, Math.hypot(dx, dy) / speedPxPerSecond * 1000)));
  return { dx, dy, durationMs };
}
