// Morning-activity slot rules shared by the teacher timer and its tests.
// Pure module: no window/localStorage access.

export const MORNING_ACTIVITY_LABEL = '아침활동';

type MorningSlotLike = { readonly name: string; readonly type: string };

export const isMorningSlot = (slot: MorningSlotLike) => (
  slot.type === 'morning' || slot.name === MORNING_ACTIVITY_LABEL
);

/** True only at the tick where the active slot leaves the morning activity. */
export const hasMorningActivityEnded = (
  previousSlot: MorningSlotLike | null,
  nextSlot: MorningSlotLike | null,
) => (
  previousSlot !== null &&
  isMorningSlot(previousSlot) &&
  (nextSlot === null || !isMorningSlot(nextSlot))
);
