import { PET_ANIMATIONS, getPetAnimationDurationMs, type PetAnimation, type PetPosture } from './petSprites.js';

export type PetMode = PetAnimation;
export type PetTouchZone = 'head' | 'back';

/** Stage-normalized point (0..1 of stage width/height) of the pet's paws. */
export interface PetPoint {
  x: number;
  y: number;
}

export interface PetArea {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** A spot the pet sometimes walks to and sits at, looking the given way. */
export interface PetInterest {
  point: PetPoint;
  facing: 1 | -1;
}

export interface PetBehaviorConfig {
  ground: PetArea;
  /** Areas where the pet should not settle, such as tappable scene objects. */
  avoid: readonly PetArea[];
  interests: readonly PetInterest[];
  /** Stage width divided by height. */
  aspectRatio: number;
  /** Top walking speed in stage widths per second. */
  walkSpeed: number;
  /** Stage widths covered by one full walk cycle. */
  strideLength: number;
  /** Fall acceleration after a drop, in stage heights per second squared. */
  gravity: number;
  /** Reduced motion: the pet stays in place and never wanders or sleeps. */
  calm: boolean;
}

export interface PetBehaviorState {
  mode: PetMode;
  /** Modes to play after the current one-shot animation, such as `sitDown` → `sit`. */
  queue: readonly PetMode[];
  position: PetPoint;
  facing: 1 | -1;
  /** Facing a queued or playing `turn` ends in. */
  turnTo: 1 | -1 | null;
  target: PetPoint | null;
  /** Interest to sit at when the current walk arrives. */
  arrival: PetInterest | null;
  modeElapsedMs: number;
  modeDurationMs: number;
  speed: number;
  /** Walk cycle progress; advances with distance so paws do not slide. */
  gaitPhase: number;
  /** Held by a long press: the current pose lasts until released. */
  held: boolean;
  /** Downward speed while falling after a drop, in stage heights per second. */
  fallSpeed: number | null;
}

export type PetRandom = () => number;

export const DEFAULT_PET_BEHAVIOR_CONFIG: PetBehaviorConfig = {
  ground: { minX: .06, maxX: .94, minY: .8, maxY: .95 },
  avoid: [
    { minX: .05, maxX: .25, minY: 0, maxY: .9 },
    { minX: .67, maxX: 1, minY: 0, maxY: .86 },
  ],
  interests: [],
  aspectRatio: 16 / 9,
  walkSpeed: .06,
  strideLength: .075,
  gravity: 4,
  calm: false,
};

const REST_DURATION_MS: Readonly<Partial<Record<PetMode, readonly [number, number]>>> = {
  idle: [2500, 5000],
  sit: [4000, 8000],
  sleep: [9000, 15000],
};
const LANDING_PAUSE_MS = 700;
const MIN_WALK_DISTANCE = .1;
const ARRIVE_DISTANCE = .004;
const MAX_STEP_MS = 100;
const INTEREST_CHANCE = .35;
const HOLDING_MODES: ReadonlySet<PetMode> = new Set(['pet', 'petBack', 'petSit', 'carried']);

const POSTURE_PATHS: Readonly<Record<PetPosture, Readonly<Partial<Record<PetPosture, readonly PetMode[]>>>>> = {
  stand: { sit: ['sitDown'], loaf: ['sitDown', 'lieDown'] },
  sit: { stand: ['standUp'], loaf: ['lieDown'] },
  loaf: { stand: ['wakeUp'], sit: ['wakeUp', 'sitDown'] },
  carried: {},
};

type Weighted = readonly (readonly [PetMode, number])[];
const NEXT_FROM: Readonly<Record<PetPosture, Weighted>> = {
  stand: [['walk', .42], ['sit', .2], ['idle', .06], ['yawn', .07], ['stretch', .07], ['twitch', .1], ['sleep', .08]],
  sit: [['walk', .3], ['idle', .2], ['groom', .2], ['sit', .12], ['sleep', .18]],
  loaf: [['idle', 1]],
  carried: [['idle', 1]],
};
const AFTER_WALK: Weighted = [['idle', .5], ['sit', .35], ['twitch', .15]];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const between = (random: PetRandom, min: number, max: number) => min + random() * (max - min);
const isInside = (point: PetPoint, area: PetArea) => (
  point.x >= area.minX && point.x <= area.maxX && point.y >= area.minY && point.y <= area.maxY
);
const pick = (choices: Weighted, random: PetRandom): PetMode => {
  const roll = random();
  let sum = 0;
  for (const [mode, weight] of choices) {
    sum += weight;
    if (roll < sum) return mode;
  }
  return choices[0]?.[0] ?? 'idle';
};

export const getPetPosture = (mode: PetMode): PetPosture => PET_ANIMATIONS[mode].posture;

export const clampToGround = (point: PetPoint, ground: PetArea): PetPoint => ({
  x: clamp(point.x, ground.minX, ground.maxX),
  y: clamp(point.y, ground.minY, ground.maxY),
});

export const isRestingSpot = (point: PetPoint, config: PetBehaviorConfig) => (
  isInside(point, config.ground) && !config.avoid.some((area) => isInside(point, area))
);

/** 0 at the back edge of the ground, 1 at the front edge. */
export const getPetDepth = (y: number, ground: PetArea) => (
  ground.maxY === ground.minY ? 1 : clamp((y - ground.minY) / (ground.maxY - ground.minY), 0, 1)
);

const visualDistance = (from: PetPoint, to: PetPoint, aspectRatio: number) => (
  Math.hypot(to.x - from.x, (to.y - from.y) / aspectRatio)
);

export const pickWalkTarget = (from: PetPoint, config: PetBehaviorConfig, random: PetRandom): PetPoint | null => {
  const { ground } = config;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = {
      x: between(random, ground.minX, ground.maxX),
      y: clamp(from.y + between(random, -.06, .06), ground.minY, ground.maxY),
    };
    if (!isRestingSpot(candidate, config)) continue;
    if (visualDistance(from, candidate, config.aspectRatio) < MIN_WALK_DISTANCE) continue;
    return candidate;
  }
  return null;
};

const pickInterest = (from: PetPoint, config: PetBehaviorConfig, random: PetRandom): PetInterest | null => {
  const reachable = config.interests.filter((interest) => (
    isRestingSpot(interest.point, config) && visualDistance(from, interest.point, config.aspectRatio) >= MIN_WALK_DISTANCE
  ));
  return reachable.length === 0 ? null : reachable[Math.min(reachable.length - 1, Math.floor(random() * reachable.length))];
};

const durationFor = (mode: PetMode, random: PetRandom) => {
  const rest = REST_DURATION_MS[mode];
  if (rest) return between(random, rest[0], rest[1]);
  if (mode === 'walk' || HOLDING_MODES.has(mode)) return Infinity;
  return getPetAnimationDurationMs(mode);
};

/** Plays `modes` in order; the last one is where the pet settles. */
const play = (state: PetBehaviorState, modes: readonly PetMode[], random: PetRandom): PetBehaviorState => {
  const [mode = 'idle', ...queue] = modes;
  return { ...state, mode, queue, modeElapsedMs: 0, modeDurationMs: durationFor(mode, random), speed: 0 };
};

const pathTo = (from: PetMode, to: PetMode, config: PetBehaviorConfig): readonly PetMode[] => (
  config.calm ? [] : POSTURE_PATHS[getPetPosture(from)][getPetPosture(to)] ?? []
);

/** Moves to `mode`, inserting the stand/sit/lie transitions between postures. */
const settleInto = (state: PetBehaviorState, mode: PetMode, config: PetBehaviorConfig, random: PetRandom) => (
  play({ ...state, target: null, arrival: null }, [...pathTo(state.mode, mode, config), mode], random)
);

const walkTo = (
  state: PetBehaviorState,
  target: PetPoint,
  arrival: PetInterest | null,
  config: PetBehaviorConfig,
  random: PetRandom,
): PetBehaviorState => {
  const direction: 1 | -1 = target.x >= state.position.x ? 1 : -1;
  const needsTurn = Math.abs(target.x - state.position.x) > .002 && direction !== state.facing;
  return play(
    { ...state, target, arrival, turnTo: needsTurn ? direction : null },
    [...pathTo(state.mode, 'walk', config), ...(needsTurn ? ['turn' as const] : []), 'walk'],
    random,
  );
};

const wander = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const interest = random() < INTEREST_CHANCE ? pickInterest(state.position, config, random) : null;
  if (interest) return walkTo(state, interest.point, interest, config, random);
  const target = pickWalkTarget(state.position, config, random);
  return target ? walkTo(state, target, null, config, random) : settleInto(state, 'idle', config, random);
};

const chooseNextMode = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  if (config.calm) return settleInto(state, random() < .5 ? 'sit' : 'idle', config, random);
  if (!isRestingSpot(state.position, config)) return wander(state, config, random);
  const next = pick(state.mode === 'walk' ? AFTER_WALK : NEXT_FROM[getPetPosture(state.mode)], random);
  return next === 'walk' ? wander(state, config, random) : settleInto(state, next, config, random);
};

const arrive = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const arrived = { ...state, target: null, speed: 0 };
  const interest = state.arrival;
  if (!interest) return chooseNextMode(arrived, config, random);
  const needsTurn = interest.facing !== state.facing;
  return play(
    { ...arrived, arrival: null, turnTo: needsTurn ? interest.facing : null },
    [...(needsTurn ? ['turn' as const] : []), ...pathTo('idle', 'sit', config), 'sit'],
    random,
  );
};

export const createPetBehaviorState = (start: PetPoint, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const initial: PetBehaviorState = {
    mode: 'idle',
    queue: [],
    position: clampToGround(start, config.ground),
    facing: random() < .5 ? -1 : 1,
    turnTo: null,
    target: null,
    arrival: null,
    modeElapsedMs: 0,
    modeDurationMs: 0,
    speed: 0,
    gaitPhase: 0,
    held: false,
    fallSpeed: null,
  };
  return play(initial, ['idle'], random);
};

const stepWalk = (state: PetBehaviorState, dtMs: number, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  if (!state.target) return chooseNextMode(state, config, random);
  const distance = visualDistance(state.position, state.target, config.aspectRatio);
  if (distance <= ARRIVE_DISTANCE) return arrive({ ...state, position: state.target }, config, random);
  // Ease in from a standstill and slow down over the last few steps.
  const desiredSpeed = config.walkSpeed * Math.min(1, distance / .05);
  const speed = state.speed + (desiredSpeed - state.speed) * Math.min(1, dtMs / 300);
  const travel = Math.min(distance, Math.max(speed, config.walkSpeed * .15) * (dtMs / 1000));
  const ratio = travel / distance;
  const dx = state.target.x - state.position.x;
  return {
    ...state,
    position: {
      x: state.position.x + dx * ratio,
      y: state.position.y + (state.target.y - state.position.y) * ratio,
    },
    speed,
    facing: Math.abs(dx) > .002 ? (dx > 0 ? 1 : -1) : state.facing,
    gaitPhase: (state.gaitPhase + travel / config.strideLength) % 1,
  };
};

const stepFall = (state: PetBehaviorState, dtMs: number, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const landY = state.target?.y ?? config.ground.minY;
  const fallSpeed = (state.fallSpeed ?? 0) + config.gravity * (dtMs / 1000);
  const y = state.position.y + fallSpeed * (dtMs / 1000);
  if (y < landY) return { ...state, fallSpeed, position: { ...state.position, y }, modeElapsedMs: state.modeElapsedMs + dtMs };
  return land({ ...state, fallSpeed: null, target: null, position: { ...state.position, y: landY } }, random);
};

const land = (state: PetBehaviorState, random: PetRandom): PetBehaviorState => ({
  ...play(state, ['idle'], random),
  modeDurationMs: LANDING_PAUSE_MS,
});

export const stepPetBehavior = (
  state: PetBehaviorState,
  dtMs: number,
  config: PetBehaviorConfig,
  random: PetRandom,
): PetBehaviorState => {
  const dt = clamp(dtMs, 0, MAX_STEP_MS);
  if (state.fallSpeed !== null) return stepFall(state, dt, config, random);
  const next = { ...state, modeElapsedMs: state.modeElapsedMs + dt };
  if (next.held || next.mode === 'carried') return next;
  if (next.mode === 'turn' && next.turnTo !== null && next.modeElapsedMs >= next.modeDurationMs * (2 / 3)) {
    return { ...next, facing: next.turnTo, turnTo: null };
  }
  if (next.mode === 'walk') return stepWalk(next, dt, config, random);
  if (next.modeElapsedMs < next.modeDurationMs) return next;
  if (next.queue.length > 0) return play(next, next.queue, random);
  if (REST_DURATION_MS[next.mode]) return chooseNextMode(next, config, random);
  // A finished one-shot settles into the resting pose of its posture.
  const posture = getPetPosture(next.mode);
  return play(next, [posture === 'sit' ? 'sit' : posture === 'loaf' ? 'sleep' : 'idle'], random);
};

export const reactToPetTap = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  if (state.mode === 'carried' || state.fallSpeed !== null) return state;
  const base = { ...state, held: false, target: null, arrival: null, turnTo: null };
  const posture = getPetPosture(state.mode);
  if (posture === 'loaf') return play(base, config.calm ? ['idle'] : ['wakeUp'], random);
  return play(base, [...pathTo(state.mode, 'happy', config), 'happy'], random);
};

export const startPetting = (state: PetBehaviorState, zone: PetTouchZone): PetBehaviorState => {
  if (state.mode === 'carried' || state.fallSpeed !== null) return state;
  const posture = getPetPosture(state.mode);
  const base = { ...state, held: true, queue: [], target: null, arrival: null, turnTo: null, speed: 0 };
  // A sleeping pet keeps sleeping and simply enjoys it.
  if (posture === 'loaf') return { ...base, mode: 'sleep' };
  const mode: PetMode = posture === 'sit' ? 'petSit' : zone === 'head' ? 'pet' : 'petBack';
  return { ...base, mode, modeElapsedMs: 0, modeDurationMs: Infinity };
};

export const stopPetting = (state: PetBehaviorState, random: PetRandom): PetBehaviorState => {
  if (!state.held) return state;
  const released = { ...state, held: false };
  if (state.mode === 'pet' || state.mode === 'petBack') return play(released, ['idle'], random);
  if (state.mode === 'petSit') return play(released, ['sit'], random);
  return released;
};

export const startCarry = (state: PetBehaviorState): PetBehaviorState => ({
  ...state,
  mode: 'carried',
  queue: [],
  held: false,
  target: null,
  arrival: null,
  turnTo: null,
  fallSpeed: null,
  speed: 0,
  modeElapsedMs: 0,
  modeDurationMs: Infinity,
});

/** While carried the pet may be lifted above the ground but stays inside the stage. */
export const moveCarry = (state: PetBehaviorState, point: PetPoint, config: PetBehaviorConfig): PetBehaviorState => ({
  ...state,
  position: {
    x: clamp(point.x, config.ground.minX, config.ground.maxX),
    y: clamp(point.y, .3, config.ground.maxY),
  },
});

/** Falls to the ground if lifted, then pauses and walks off if it landed on a tappable object. */
export const dropPet = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const landing = clampToGround(state.position, config.ground);
  if (state.position.y < landing.y - .005) {
    return { ...state, mode: 'carried', target: landing, fallSpeed: 0 };
  }
  return land({ ...state, position: landing }, random);
};

export const nudgePet = (state: PetBehaviorState, delta: PetPoint, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const position = clampToGround({ x: state.position.x + delta.x, y: state.position.y + delta.y }, config.ground);
  const facing: 1 | -1 = delta.x === 0 ? state.facing : delta.x > 0 ? 1 : -1;
  const moved = { ...state, position, facing, target: null, arrival: null, turnTo: null };
  return state.mode === 'walk' || state.mode === 'turn' ? play(moved, ['idle'], random) : moved;
};

export const getPetAnimation = (state: PetBehaviorState): PetAnimation => state.mode;
