import { PET_ANIMATIONS, getPetAnimationDurationMs, type PetAnimation, type PetPosture, type PetTrick } from './petSprites.js';

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
  /** Row holding this species' signature move; null for pets without one. */
  trick: PetTrick | null;
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
  /** Walking direction in visual space (radians); steering turns it gradually, so paths curve. */
  heading: number | null;
  /** Speed multiplier for the current walk or run. */
  pace: number;
  /** Remaining distance at which the current walk stops for a look around, or null. */
  pauseAt: number | null;
  /** Last action chosen on its own, so the same one is not picked twice in a row. */
  lastChoice: PetMode | null;
  /** Running away from a touch; on arrival the pet looks back around. */
  fleeing: boolean;
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
  trick: null,
};

const REST_DURATION_MS: Readonly<Partial<Record<PetMode, readonly [number, number]>>> = {
  idle: [1400, 3200],
  sit: [2500, 5000],
  sleep: [7000, 12000],
};
const WALK_PACE: readonly [number, number] = [.75, 1.2];
const RUN_PACE = 2.3;
const RUN_STRIDE = 1.7;
const RUN_CHANCE = .3;
const RUN_MIN_DISTANCE = .3;
const PAUSE_CHANCE = .45;
const PAUSE_MIN_DISTANCE = .25;
const MEANDER_RADIANS = .35;
const START_DEVIATION_RADIANS = .6;
const STRAIGHT_IN_DISTANCE = .03;
const FLEE_CHANCE = .25;
const FLEE_PACE = 4;
const FLEE_DISTANCE: readonly [number, number] = [.3, .45];
const LANDING_PAUSE_MS = 700;
const MIN_WALK_DISTANCE = .1;
const ARRIVE_DISTANCE = .004;
const MAX_STEP_MS = 100;
const INTEREST_CHANCE = .35;
const TAP_TRICK_CHANCE = .35;
const HOLDING_MODES: ReadonlySet<PetMode> = new Set(['pet', 'petBack', 'petSit', 'carried']);

const POSTURE_PATHS: Readonly<Record<PetPosture, Readonly<Partial<Record<PetPosture, readonly PetMode[]>>>>> = {
  stand: { sit: ['sitDown'], loaf: ['sitDown', 'lieDown'] },
  sit: { stand: ['standUp'], loaf: ['lieDown'] },
  loaf: { stand: ['wakeUp'], sit: ['wakeUp', 'sitDown'] },
  carried: {},
};

type Weighted = readonly (readonly [PetMode, number])[];
// `trick` stands for the species' own move (config.trick), standing or sitting.
const NEXT_FROM: Readonly<Record<PetPosture, Weighted>> = {
  stand: [
    ['walk', .32], ['sit', .14], ['idle', .03], ['yawn', .05], ['stretch', .05], ['twitch', .07],
    ['sleep', .06], ['trick', .1], ['lookAround', .09], ['tilt', .09],
  ],
  sit: [['walk', .24], ['idle', .14], ['groom', .14], ['sit', .06], ['sleep', .12], ['trick', .1], ['scratch', .12], ['sploot', .08]],
  loaf: [['idle', .7], ['sploot', .3]],
  carried: [['idle', 1]],
};
const AFTER_WALK: Weighted = [['idle', .3], ['sit', .25], ['twitch', .1], ['lookAround', .15], ['tilt', .2]];
const MOVING_MODES: ReadonlySet<PetMode> = new Set(['walk', 'run']);


const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const between = (random: PetRandom, min: number, max: number) => min + random() * (max - min);
const isInside = (point: PetPoint, area: PetArea) => (
  point.x >= area.minX && point.x <= area.maxX && point.y >= area.minY && point.y <= area.maxY
);
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const pick = (choices: Weighted, random: PetRandom): PetMode => {
  const roll = random();
  let sum = 0;
  for (const [mode, weight] of choices) {
    sum += weight;
    if (roll < sum) return mode;
  }
  return choices[0]?.[0] ?? 'idle';
};

/** Picks the next action, re-rolling once rather than repeating the previous one. */
export const pickNextAction = (choices: Weighted, previous: PetMode | null, random: PetRandom): PetMode => {
  const first = pick(choices, random);
  return first === previous && choices.length > 1 ? pick(choices, random) : first;
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
  if (MOVING_MODES.has(mode) || HOLDING_MODES.has(mode)) return Infinity;
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
  play({ ...state, target: null, arrival: null, fleeing: false }, [...pathTo(state.mode, mode, config), mode], random)
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
  const distance = visualDistance(state.position, target, config.aspectRatio);
  // Long trips are sometimes a run; walks each get their own pace and may stop halfway.
  const running = !arrival && distance >= RUN_MIN_DISTANCE && random() < RUN_CHANCE;
  const pause = !running && distance >= PAUSE_MIN_DISTANCE && random() < PAUSE_CHANCE;
  const straight = Math.atan2((target.y - state.position.y) / config.aspectRatio, target.x - state.position.x);
  const moving = {
    ...state,
    target,
    arrival,
    turnTo: needsTurn ? direction : null,
    pace: running ? RUN_PACE : between(random, WALK_PACE[0], WALK_PACE[1]),
    pauseAt: pause ? distance * between(random, .35, .65) : null,
    // Start a little off the straight line; steering then bends the path toward the target.
    heading: straight + between(random, -START_DEVIATION_RADIANS, START_DEVIATION_RADIANS),
  };
  const mode: PetMode = running ? 'run' : 'walk';
  return play(moving, [...pathTo(state.mode, mode, config), ...(needsTurn ? ['turn' as const] : []), mode], random);
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
  const choices = MOVING_MODES.has(state.mode) ? AFTER_WALK : NEXT_FROM[getPetPosture(state.mode)];
  const next = pickNextAction(choices, state.lastChoice, random);
  const chosen = { ...state, lastChoice: next };
  if (next === 'walk') return wander(chosen, config, random);
  if (next === 'trick' || next === 'trickSit') return settleInto(chosen, config.trick ?? 'idle', config, random);
  return settleInto(chosen, next, config, random);
};

const arrive = (state: PetBehaviorState, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const arrived = { ...state, target: null, speed: 0, fleeing: false };
  if (state.fleeing) return play(arrived, ['lookAround'], random);
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
    heading: null,
    pace: 1,
    pauseAt: null,
    lastChoice: null,
    fleeing: false,
  };
  return play(initial, ['idle'], random);
};

const stepWalk = (state: PetBehaviorState, dtMs: number, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => {
  const { target } = state;
  if (!target) return chooseNextMode(state, config, random);
  const distance = visualDistance(state.position, target, config.aspectRatio);
  if (distance <= ARRIVE_DISTANCE) return arrive({ ...state, position: target, heading: null }, config, random);
  if (state.pauseAt !== null && distance <= state.pauseAt) {
    return play({ ...state, pauseAt: null }, [random() < .5 ? 'lookAround' : 'tilt', state.mode], random);
  }
  const running = state.mode === 'run';
  // Ease in from a standstill and slow down over the last few steps.
  const topSpeed = config.walkSpeed * state.pace;
  const desiredSpeed = topSpeed * Math.min(1, distance / (running ? .09 : .05));
  const speed = state.speed + (desiredSpeed - state.speed) * Math.min(1, dtMs / (running ? 400 : 300));
  const travel = Math.min(distance, Math.max(speed, topSpeed * .15) * (dtMs / 1000));
  // Steer toward the target with a gentle meander; close in, head straight so the pet always arrives.
  const toTarget = Math.atan2((target.y - state.position.y) / config.aspectRatio, target.x - state.position.x);
  const meander = Math.sin(state.modeElapsedMs / 700) * MEANDER_RADIANS * Math.min(1, distance / .15);
  const current = state.heading ?? toTarget;
  const turnLimit = (2.2 + 1.2 / Math.max(distance, .05)) * (dtMs / 1000);
  const steered = current + clamp(wrapAngle(toTarget + meander - current), -turnLimit, turnLimit);
  const heading = distance < STRAIGHT_IN_DISTANCE ? toTarget : steered;
  const position = clampToGround({
    x: state.position.x + Math.cos(heading) * travel,
    y: state.position.y + Math.sin(heading) * travel * config.aspectRatio,
  }, config.ground);
  const dx = target.x - position.x;
  return {
    ...state,
    position,
    heading,
    speed,
    // Facing follows the target side, not the curve, so the sprite never flips mid-stride.
    facing: Math.abs(dx) > .01 ? (dx > 0 ? 1 : -1) : state.facing,
    gaitPhase: (state.gaitPhase + travel / (config.strideLength * (running ? RUN_STRIDE : 1))) % 1,
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
  if (MOVING_MODES.has(next.mode)) return stepWalk(next, dt, config, random);
  if (next.modeElapsedMs < next.modeDurationMs) return next;
  if (next.queue.length > 0) return play(next, next.queue, random);
  if (REST_DURATION_MS[next.mode]) return chooseNextMode(next, config, random);
  // A finished one-shot settles into the resting pose of its posture.
  const posture = getPetPosture(next.mode);
  return play(next, [posture === 'sit' ? 'sit' : posture === 'loaf' ? 'sleep' : 'idle'], random);
};

/** A spot on the ground well away from the touch, or null when the pet is cornered. */
const pickFleeTarget = (state: PetBehaviorState, touch: PetPoint, config: PetBehaviorConfig, random: PetRandom) => {
  const away = touch.x <= state.position.x ? 1 : -1;
  for (const direction of [away, -away]) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = clampToGround({
        x: state.position.x + direction * between(random, FLEE_DISTANCE[0], FLEE_DISTANCE[1]),
        y: state.position.y + between(random, -.05, .05),
      }, config.ground);
      if (isRestingSpot(candidate, config) && Math.abs(candidate.x - state.position.x) >= FLEE_DISTANCE[0] * .8) {
        return candidate;
      }
    }
  }
  return null;
};

/** Startled jump, then a fast run away from the touch; the facing flips during the jump. */
const flee = (state: PetBehaviorState, target: PetPoint, config: PetBehaviorConfig, random: PetRandom): PetBehaviorState => (
  play({
    ...state,
    held: false,
    target,
    arrival: null,
    turnTo: null,
    facing: target.x >= state.position.x ? 1 : -1,
    pace: FLEE_PACE,
    pauseAt: null,
    heading: Math.atan2((target.y - state.position.y) / config.aspectRatio, target.x - state.position.x),
    fleeing: true,
  }, ['startle', 'run'], random)
);

/**
 * Reaction to a tap. With the touch point, the pet is sometimes startled and flees from it;
 * otherwise it hops, plays its signature move, or wakes with a stretch.
 */
export const reactToPetTap = (
  state: PetBehaviorState,
  config: PetBehaviorConfig,
  random: PetRandom,
  touch?: PetPoint,
): PetBehaviorState => {
  if (state.mode === 'carried' || state.fallSpeed !== null) return state;
  if (touch && !config.calm && random() < FLEE_CHANCE) {
    const target = pickFleeTarget(state, touch, config, random);
    if (target) return flee(state, target, config, random);
  }
  const base = { ...state, held: false, target: null, arrival: null, turnTo: null, fleeing: false };
  const posture = getPetPosture(state.mode);
  if (posture === 'loaf') return play(base, config.calm ? ['idle'] : ['wakeUp'], random);
  // Sometimes a tap gets the species' own move instead of a hop.
  const reaction: PetMode = !config.calm && config.trick && random() < TAP_TRICK_CHANCE ? config.trick : 'happy';
  return play(base, [...pathTo(state.mode, reaction, config), reaction], random);
};

export const startPetting = (state: PetBehaviorState, zone: PetTouchZone): PetBehaviorState => {
  if (state.mode === 'carried' || state.fallSpeed !== null) return state;
  const posture = getPetPosture(state.mode);
  const base = { ...state, held: true, queue: [], target: null, arrival: null, turnTo: null, speed: 0, fleeing: false };
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
  fleeing: false,
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
  const moved = { ...state, position, facing, target: null, arrival: null, turnTo: null, fleeing: false };
  return MOVING_MODES.has(state.mode) || state.mode === 'turn' ? play(moved, ['idle'], random) : moved;
};

export const getPetAnimation = (state: PetBehaviorState): PetAnimation => state.mode;
