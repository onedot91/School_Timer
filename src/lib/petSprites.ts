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
  'run',
  'lookAround',
  'tilt',
  'scratch',
  'sploot',
  'startle',
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
  // Shared variety: a bounding run (frames follow the gait like walk), looking around, a curious head
  // tilt, scratching with a hind paw, and lying stretched out flat.
  run: spec('run', 8, 12, true, 'stand'),
  lookAround: spec('lookAround', 8, 5, false, 'stand'),
  tilt: spec('tilt', 6, 6, false, 'stand'),
  scratch: spec('scratch', 8, 10, false, 'sit'),
  sploot: spec('sploot', 8, 3, false, 'loaf'),
  // Startled jump before fleeing from a touch.
  startle: spec('startle', 4, 12, false, 'stand'),
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
  penguin: 'trick',
  cow: 'trick',
  monkey: 'trickSit',
  hedgehog: 'trick',
  elephant: 'trick',
  turtle: 'trick',
  duck: 'trick',
  frog: 'trick',
  giraffe: 'trick',
  zebra: 'trick',
};

type PetGrip = { readonly x: number; readonly y: number };

/** Scruff point of each species' `carried` frames; printed by dev/generatePetSprites.mjs. */
export const PET_CARRY_GRIPS: Readonly<Record<StudentPetKind, PetGrip>> = {
  cat: { x: 89, y: 53 },
  dog: { x: 90, y: 52 },
  rabbit: { x: 87, y: 55 },
  chick: { x: 89, y: 53 },
  fox: { x: 92, y: 54 },
  hamster: { x: 86, y: 58 },
  squirrel: { x: 87, y: 57 },
  raccoon: { x: 89, y: 53 },
  panda: { x: 90, y: 51 },
  koala: { x: 87, y: 54 },
  pig: { x: 91, y: 54 },
  sheep: { x: 90, y: 48 },
  tiger: { x: 92, y: 51 },
  lion: { x: 90, y: 51 },
  penguin: { x: 89, y: 53 },
  cow: { x: 92, y: 48 },
  monkey: { x: 88, y: 54 },
  hedgehog: { x: 89, y: 60 },
  elephant: { x: 90, y: 48 },
  turtle: { x: 90, y: 58 },
  duck: { x: 89, y: 53 },
  frog: { x: 91, y: 62 },
  giraffe: { x: 89, y: 59 },
  zebra: { x: 91, y: 51 },
};

/** On-stage size relative to the cat; stride and walking speed scale with it. */
export const PET_SIZES: Readonly<Record<StudentPetKind, number>> = {
  hedgehog: .58,
  hamster: .62,
  chick: .64,
  turtle: .7,
  squirrel: .72,
  penguin: .8,
  rabbit: .82,
  monkey: .86,
  raccoon: .9,
  koala: .94,
  cat: 1,
  fox: 1.02,
  pig: 1.06,
  dog: 1.08,
  sheep: 1.12,
  cow: 1.18,
  panda: 1.22,
  tiger: 1.26,
  lion: 1.3,
  elephant: 1.4,
  frog: .6,
  duck: .76,
  zebra: 1.24,
  giraffe: 1.36,
};

export interface PetGait {
  /** Walking speed relative to other pets of the same size. */
  speed: number;
  /** Chance that a long trip becomes a run; 0 for animals that never run. */
  runChance: number;
  /** Startled pets dash off; the others get away at a brisk walk. */
  fleeRuns: boolean;
  /** Stride length relative to body size: hoppers cover more ground per cycle, scurriers less. */
  stride: number;
}

/** How each animal gets around, matched to the walk and run rows drawn for it. */
export const PET_GAITS: Readonly<Record<StudentPetKind, PetGait>> = {
  cat: { speed: 1, runChance: .3, fleeRuns: true, stride: 1 },
  dog: { speed: 1.1, runChance: .45, fleeRuns: true, stride: 1 },
  fox: { speed: 1.05, runChance: .35, fleeRuns: true, stride: 1 },
  rabbit: { speed: 1, runChance: .4, fleeRuns: true, stride: 1.4 },
  chick: { speed: 1.1, runChance: .2, fleeRuns: true, stride: .6 },
  hamster: { speed: 1.15, runChance: .35, fleeRuns: true, stride: .55 },
  squirrel: { speed: 1.2, runChance: .6, fleeRuns: true, stride: 1.1 },
  raccoon: { speed: .85, runChance: .2, fleeRuns: true, stride: .9 },
  panda: { speed: .7, runChance: .1, fleeRuns: true, stride: 1 },
  koala: { speed: .55, runChance: 0, fleeRuns: false, stride: .9 },
  pig: { speed: .95, runChance: .25, fleeRuns: true, stride: .8 },
  sheep: { speed: .95, runChance: .3, fleeRuns: true, stride: .9 },
  tiger: { speed: .9, runChance: .3, fleeRuns: true, stride: 1.15 },
  lion: { speed: .85, runChance: .25, fleeRuns: true, stride: 1.15 },
  penguin: { speed: .6, runChance: 0, fleeRuns: false, stride: .5 },
  cow: { speed: .6, runChance: 0, fleeRuns: true, stride: 1 },
  monkey: { speed: 1.15, runChance: .5, fleeRuns: true, stride: 1 },
  hedgehog: { speed: 1, runChance: .3, fleeRuns: true, stride: .5 },
  elephant: { speed: .55, runChance: 0, fleeRuns: false, stride: 1.2 },
  turtle: { speed: .4, runChance: 0, fleeRuns: false, stride: 1 },
  duck: { speed: .85, runChance: .2, fleeRuns: true, stride: .6 },
  frog: { speed: .95, runChance: .35, fleeRuns: true, stride: 1.5 },
  giraffe: { speed: .8, runChance: .15, fleeRuns: true, stride: 1.3 },
  zebra: { speed: 1.05, runChance: .4, fleeRuns: true, stride: 1.15 },
};

/** Top of the standing pet in its frame (y, of the 128-pixel frame height); the name tag sits just above. */
export const PET_HEAD_TOPS: Readonly<Record<StudentPetKind, number>> = {
  cat: 16,
  dog: 25,
  rabbit: 20,
  chick: 22,
  fox: 18,
  hamster: 36,
  squirrel: 21,
  raccoon: 16,
  panda: 20,
  koala: 26,
  pig: 33,
  sheep: 20,
  tiger: 22,
  lion: 18,
  penguin: 21,
  cow: 15,
  monkey: 23,
  hedgehog: 41,
  elephant: 23,
  turtle: 57,
  duck: 31,
  frog: 41,
  giraffe: 14,
  zebra: 14,
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
  'penguin',
  'cow',
  'monkey',
  'hedgehog',
  'elephant',
  'turtle',
  'duck',
  'frog',
  'giraffe',
  'zebra',
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
