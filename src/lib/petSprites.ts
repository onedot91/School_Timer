import type { StudentPetKind } from './studentPet.js';

export const PET_ANIMATION_IDS = [
  'idle',
  'walk',
  'sit',
  'sleep',
  'happy',
  'pet',
  'petBack',
  'petSit',
  'carried',
  'turn',
  'sitDown',
  'standUp',
  'lieDown',
  'wakeUp',
  'groom',
  'yawn',
  'stretch',
  'twitch',
  'trick',
  'trickSit',
] as const;

export type PetAnimation = (typeof PET_ANIMATION_IDS)[number];

/** Body position an animation ends in; transitions are planned between postures. */
export type PetPosture = 'stand' | 'sit' | 'loaf' | 'carried';

export interface PetAnimationSpec {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
  posture: PetPosture;
  /** Height of the paws above the ground per frame, in sprite units. */
  lift?: readonly number[];
}

export const PET_SPRITE_FRAME = {
  width: 160,
  height: 128,
  anchorX: 80,
  anchorY: 118,
  columns: 8,
  rows: PET_ANIMATION_IDS.length,
} as const;

const spec = (
  animation: PetAnimation,
  frames: number,
  fps: number,
  loop: boolean,
  posture: PetPosture,
  lift?: readonly number[],
): PetAnimationSpec => ({ row: PET_ANIMATION_IDS.indexOf(animation), frames, fps, loop, posture, ...(lift ? { lift } : {}) });

export const PET_ANIMATIONS: Readonly<Record<PetAnimation, PetAnimationSpec>> = {
  idle: spec('idle', 8, 4, true, 'stand'),
  walk: spec('walk', 8, 8, true, 'stand'),
  sit: spec('sit', 4, 3, true, 'sit'),
  sleep: spec('sleep', 4, 2, true, 'loaf'),
  happy: spec('happy', 6, 10, false, 'stand', [0, 8, 15, 9, 0, 0]),
  pet: spec('pet', 6, 6, true, 'stand'),
  petBack: spec('petBack', 6, 6, true, 'stand'),
  petSit: spec('petSit', 6, 6, true, 'sit'),
  carried: spec('carried', 6, 6, true, 'carried'),
  turn: spec('turn', 3, 12, false, 'stand'),
  sitDown: spec('sitDown', 5, 12, false, 'sit'),
  standUp: spec('standUp', 5, 14, false, 'stand'),
  lieDown: spec('lieDown', 5, 10, false, 'loaf'),
  wakeUp: spec('wakeUp', 8, 8, false, 'stand'),
  groom: spec('groom', 8, 6, false, 'sit'),
  yawn: spec('yawn', 6, 6, false, 'stand'),
  stretch: spec('stretch', 6, 6, false, 'stand'),
  twitch: spec('twitch', 4, 10, false, 'stand'),
  // Each species draws its signature move in one of these rows (see PET_TRICKS).
  trick: spec('trick', 8, 7, false, 'stand'),
  trickSit: spec('trickSit', 8, 7, false, 'sit'),
};

export type PetTrick = 'trick' | 'trickSit';

/** Which row holds each species' signature move, standing or sitting. */
export const PET_TRICKS: Readonly<Record<StudentPetKind, PetTrick>> = {
  cat: 'trick',
  dog: 'trick',
  rabbit: 'trick',
  chick: 'trick',
  fox: 'trick',
  hamster: 'trickSit',
  squirrel: 'trickSit',
  raccoon: 'trickSit',
  panda: 'trickSit',
  koala: 'trickSit',
  pig: 'trick',
  sheep: 'trick',
  tiger: 'trick',
  lion: 'trick',
};

/** Scruff point of the `carried` frames; printed by dev/generatePetSprites.mjs. */
export const PET_CARRY_GRIP = { x: 90, y: 53 } as const;

/** On-stage size relative to the cat; stride and walking speed scale with it. */
export const PET_SIZES: Readonly<Record<StudentPetKind, number>> = {
  hamster: .62,
  chick: .64,
  squirrel: .72,
  rabbit: .82,
  raccoon: .9,
  koala: .94,
  cat: 1,
  fox: 1.02,
  pig: 1.06,
  dog: 1.08,
  sheep: 1.12,
  panda: 1.22,
  tiger: 1.26,
  lion: 1.3,
};

/** Kinds drawn by dev/generatePetSprites.mjs; any other kind falls back to its emoji. */
export const PET_SPRITE_KINDS: ReadonlySet<StudentPetKind> = new Set<StudentPetKind>([
  'cat',
  'dog',
  'rabbit',
  'chick',
  'fox',
  'hamster',
  'squirrel',
  'raccoon',
  'panda',
  'koala',
  'pig',
  'sheep',
  'tiger',
  'lion',
]);

export const PET_SPRITE_BACKGROUND_SIZE = `${PET_SPRITE_FRAME.columns * 100}% ${PET_SPRITE_FRAME.rows * 100}%`;

export const getPetSpriteSheet = (kind: StudentPetKind | null) => (
  kind && PET_SPRITE_KINDS.has(kind) ? `/pets/${kind}-sprite.svg` : null
);

/** One idle frame, so pickers do not load and rasterize whole sprite sheets. */
export const getPetPortrait = (kind: StudentPetKind | null) => (
  kind && PET_SPRITE_KINDS.has(kind) ? `/pets/${kind}-portrait.svg` : null
);

export const getPetAnimationDurationMs = (animation: PetAnimation) => {
  const animationSpec = PET_ANIMATIONS[animation];
  return (animationSpec.frames / animationSpec.fps) * 1000;
};

export const getPetFrameColumn = (animation: PetAnimation, elapsedMs: number) => {
  const animationSpec = PET_ANIMATIONS[animation];
  const frame = Math.floor((Math.max(0, elapsedMs) / 1000) * animationSpec.fps);
  return animationSpec.loop ? frame % animationSpec.frames : Math.min(animationSpec.frames - 1, frame);
};

/** Background position for one frame, as percentages for `background-position`. */
export const getPetFramePosition = (animation: PetAnimation, column: number) => ({
  x: (column / (PET_SPRITE_FRAME.columns - 1)) * 100,
  y: (PET_ANIMATIONS[animation].row / (PET_SPRITE_FRAME.rows - 1)) * 100,
});
