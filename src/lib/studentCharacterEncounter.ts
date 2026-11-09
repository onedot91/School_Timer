export interface CharacterEncounterPosition {
  lane: string | undefined;
  direction: string | undefined;
  left: number;
  right: number;
  previousCenter?: number;
}

export function getDoughEncounter(eitherId: string | undefined, otherId: string | undefined): { eater: string; dough: string } | null {
  const eater = 'student-12-dough-eater';
  const dough = 'student-12-clover';
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
