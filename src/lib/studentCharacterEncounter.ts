export interface CharacterEncounterPosition {
  lane: string | undefined;
  direction: string | undefined;
  left: number;
  right: number;
  previousCenter?: number;
}

export function shouldCharactersGreet(a: CharacterEncounterPosition, b: CharacterEncounterPosition, viewportWidth: number): boolean {
  if (a.lane === undefined || a.lane !== b.lane || a.direction === b.direction) return false;
  const [rightward, leftward] = a.direction === 'right' ? [a, b] : [b, a];
  if (rightward.direction !== 'right' || leftward.direction !== 'left') return false;
  if ([a, b].some(({ left, right }) => right <= 0 || left >= viewportWidth)) return false;
  const gap = (leftward.left + leftward.right - rightward.left - rightward.right) / 2;
  const reach = ((a.right - a.left) + (b.right - b.left)) * .6;
  const crossed = rightward.previousCenter !== undefined && leftward.previousCenter !== undefined
    && leftward.previousCenter > rightward.previousCenter && gap <= 0;
  return (gap >= 0 && gap <= reach) || crossed;
}
