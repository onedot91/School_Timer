import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_PET_BEHAVIOR_CONFIG,
  createPetBehaviorState,
  dropPet,
  getPetDepth,
  getPetPosture,
  isRestingSpot,
  moveCarry,
  pickNextAction,
  pickWalkTarget,
  reactToPetTap,
  startCarry,
  startPetting,
  stepPetBehavior,
  stopPetting,
  type PetBehaviorConfig,
  type PetBehaviorState,
  type PetMode,
} from './petBehavior';
import {
  PET_ANIMATIONS,
  PET_ANIMATION_IDS,
  PET_SPRITE_FRAME,
  PET_SPRITE_KINDS,
  getPetFrameColumn,
  getPetFramePosition,
  getPetPortrait,
  getPetSpriteSheet,
} from './petSprites';
import { STUDENT_PET_KINDS } from './studentPet';

const seeded = (seed: number) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

const config = DEFAULT_PET_BEHAVIOR_CONFIG;
const run = (
  state: PetBehaviorState,
  ms: number,
  random: () => number,
  visit?: (next: PetBehaviorState, previous: PetBehaviorState) => void,
  activeConfig: PetBehaviorConfig = config,
) => {
  let current = state;
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    const previous = current;
    current = stepPetBehavior(current, 50, activeConfig, random);
    visit?.(current, previous);
  }
  return current;
};

test('sprite layout lists every animation once in its own row', () => {
  assert.equal(PET_SPRITE_FRAME.rows, PET_ANIMATION_IDS.length);
  const rows = PET_ANIMATION_IDS.map((id) => PET_ANIMATIONS[id].row);
  assert.deepEqual(rows, PET_ANIMATION_IDS.map((_, index) => index));
  for (const id of PET_ANIMATION_IDS) assert.ok(PET_ANIMATIONS[id].frames <= PET_SPRITE_FRAME.columns, id);
});

test('pet starts on the ground even when the saved spot is in the sky', () => {
  const state = createPetBehaviorState({ x: .5, y: .3 }, config, seeded(1));
  assert.equal(state.mode, 'idle');
  assert.equal(state.position.y, config.ground.minY);
});

test('wandering pet stays on the ground and uses transitions and fidgets', () => {
  const random = seeded(7);
  const seen = new Set<string>();
  run(createPetBehaviorState({ x: .5, y: .88 }, config, random), 1_800_000, random, (state, previous) => {
    seen.add(state.mode);
    assert.ok(state.position.x >= config.ground.minX && state.position.x <= config.ground.maxX);
    assert.ok(state.position.y >= config.ground.minY && state.position.y <= config.ground.maxY);
    if (state.mode === 'sit' || state.mode === 'sleep') assert.ok(isRestingSpot(state.position, config));
    // The body never jumps between postures without a transition.
    const from = getPetPosture(previous.mode);
    const to = getPetPosture(state.mode);
    if (from !== to) {
      assert.ok(
        ['sitDown', 'standUp', 'lieDown', 'wakeUp'].includes(state.mode) || ['sitDown', 'standUp', 'lieDown', 'wakeUp'].includes(previous.mode),
        `${previous.mode} -> ${state.mode}`,
      );
    }
  });
  for (const mode of [
    'idle', 'walk', 'run', 'turn', 'sit', 'sleep', 'sitDown', 'standUp', 'lieDown', 'wakeUp',
    'groom', 'yawn', 'stretch', 'twitch', 'lookAround', 'tilt', 'scratch', 'sploot',
  ]) {
    assert.ok(seen.has(mode), `expected ${mode}`);
  }
});

test('walk targets avoid tappable scene objects', () => {
  const random = seeded(3);
  for (let i = 0; i < 200; i += 1) {
    const target = pickWalkTarget({ x: .5, y: .88 }, config, random);
    assert.ok(target && isRestingSpot(target, config));
  }
});

test('turning flips the facing before walking off the other way', () => {
  const random = seeded(11);
  const lonely = { ...config, interests: [{ point: { x: .3, y: .88 }, facing: 1 as const }] };
  let state: PetBehaviorState = { ...createPetBehaviorState({ x: .6, y: .88 }, config, random), facing: 1 };
  let sawTurn = false;
  for (let i = 0; i < 4000 && !(state.mode === 'walk' && state.target?.x === .3); i += 1) {
    state = stepPetBehavior(state, 50, { ...lonely, ground: { ...config.ground, minX: .29, maxX: .61 } }, () => .01);
    if (state.mode === 'turn') sawTurn = true;
  }
  assert.ok(sawTurn);
  assert.equal(state.facing, -1);
});

test('pet walks to an interest and sits facing it', () => {
  const random = seeded(19);
  const interest = { point: { x: .45, y: .88 }, facing: -1 as const };
  const withInterest = { ...config, interests: [interest] };
  let state: PetBehaviorState = { ...createPetBehaviorState({ x: .6, y: .88 }, config, random), facing: 1 };
  for (let i = 0; i < 4000 && state.mode !== 'sit'; i += 1) state = stepPetBehavior(state, 50, withInterest, () => .01);
  assert.deepEqual(state.position, interest.point);
  assert.equal(state.facing, -1);
  assert.equal(getPetPosture(state.mode), 'sit');
});

test('tap hops when standing and stands up first when sitting', () => {
  const random = seeded(5);
  const standing = reactToPetTap(createPetBehaviorState({ x: .5, y: .88 }, config, random), config, random);
  assert.equal(standing.mode, 'happy');
  assert.notEqual(run(standing, 1000, random).mode, 'happy');

  const sat: PetBehaviorState = { ...createPetBehaviorState({ x: .5, y: .88 }, config, random), mode: 'sit' };
  const tapped = reactToPetTap(sat, config, random);
  assert.equal(tapped.mode, 'standUp');
  assert.deepEqual(tapped.queue, ['happy']);
});

test('tapping a sleeping pet wakes it with a stretch', () => {
  const random = seeded(23);
  const asleep = { ...createPetBehaviorState({ x: .5, y: .88 }, config, random), mode: 'sleep' as const, modeDurationMs: 10_000 };
  assert.equal(reactToPetTap(asleep, config, random).mode, 'wakeUp');
});

test('petting depends on posture and where the pet is touched, and holds until released', () => {
  const random = seeded(9);
  const standing = createPetBehaviorState({ x: .5, y: .88 }, config, random);
  assert.equal(startPetting(standing, 'head').mode, 'pet');
  assert.equal(startPetting(standing, 'back').mode, 'petBack');
  const sat = { ...standing, mode: 'sit' as const };
  assert.equal(startPetting(sat, 'back').mode, 'petSit');
  const asleep = { ...standing, mode: 'sleep' as const };
  assert.equal(startPetting(asleep, 'head').mode, 'sleep');

  let held = startPetting(standing, 'head');
  held = run(held, 20_000, random);
  assert.equal(held.mode, 'pet');
  assert.equal(stopPetting(held, random).mode, 'idle');
  assert.equal(stopPetting(startPetting(sat, 'head'), random).mode, 'sit');
});

test('carried pet can be lifted, then falls back to the ground', () => {
  const random = seeded(13);
  let state = startCarry(createPetBehaviorState({ x: .5, y: .88 }, config, random));
  state = moveCarry(state, { x: 1.2, y: .1 }, config);
  assert.equal(state.position.x, config.ground.maxX);
  assert.equal(state.position.y, .3);
  state = run(state, 2000, random);
  assert.equal(state.mode, 'carried');
  state = dropPet(state, config, random);
  assert.notEqual(state.fallSpeed, null);
  let landedAfterMs = 0;
  for (; state.fallSpeed !== null && landedAfterMs < 5000; landedAfterMs += 50) state = stepPetBehavior(state, 50, config, random);
  assert.ok(landedAfterMs > 100 && landedAfterMs < 1000, `fell for ${landedAfterMs}ms`);
  assert.equal(state.position.y, config.ground.minY);
  assert.equal(state.mode, 'idle');
});

test('a pet dropped on the mailbox walks away from it', () => {
  const random = seeded(17);
  const dropped = dropPet(startCarry(createPetBehaviorState({ x: .15, y: .85 }, config, random)), config, random);
  assert.equal(isRestingSpot(dropped.position, config), false);
  const next = run(dropped, 900, random);
  assert.ok(next.mode === 'walk' || next.mode === 'turn', next.mode);
});

test('calm mode never wanders, sleeps or plays transitions', () => {
  const random = seeded(21);
  const calm = { ...config, calm: true, trick: 'trick' as const };
  let state = createPetBehaviorState({ x: .5, y: .88 }, calm, random);
  const start = state.position;
  for (let elapsed = 0; elapsed < 120_000; elapsed += 50) {
    state = stepPetBehavior(state, 50, calm, random);
    assert.ok(state.mode === 'idle' || state.mode === 'sit', state.mode);
  }
  assert.deepEqual(state.position, start);
});

test('depth grows toward the front of the ground', () => {
  assert.equal(getPetDepth(config.ground.minY, config.ground), 0);
  assert.equal(getPetDepth(config.ground.maxY, config.ground), 1);
});

test('sprite frames loop or hold on the last frame', () => {
  assert.equal(getPetFrameColumn('walk', 1000), 8 % PET_ANIMATIONS.walk.frames);
  assert.equal(getPetFrameColumn('happy', 10_000), PET_ANIMATIONS.happy.frames - 1);
  assert.deepEqual(getPetFramePosition('idle', 0), { x: 0, y: 0 });
  assert.deepEqual(getPetFramePosition(PET_ANIMATION_IDS[PET_ANIMATION_IDS.length - 1], 7), { x: 100, y: 100 });
});

test('every pet kind is drawn, with a sheet and a portrait on disk', () => {
  assert.equal(PET_SPRITE_KINDS.size, STUDENT_PET_KINDS.length);
  for (const { id } of STUDENT_PET_KINDS) {
    assert.ok(PET_SPRITE_KINDS.has(id), id);
    for (const url of [getPetSpriteSheet(id), getPetPortrait(id)]) {
      assert.ok(url && existsSync(new URL(`../../public${url}`, import.meta.url)), `${id}: ${url}`);
    }
  }
});

test('a pet with a signature move plays it, reaching a sitting move through sitDown', () => {
  for (const trick of ['trick', 'trickSit'] as const) {
    const random = seeded(31);
    const withTrick = { ...config, trick };
    const seen: string[] = [];
    run(createPetBehaviorState({ x: .5, y: .88 }, withTrick, random), 600_000, random, (state, previous) => {
      if (state.mode === trick && previous.mode !== trick) seen.push(previous.mode);
    }, withTrick);
    assert.ok(seen.length > 0, `${trick} never played`);
    if (trick === 'trickSit') assert.ok(seen.every((mode) => getPetPosture(mode as PetMode) === 'sit'), seen.join());
  }
});

test('taps sometimes trigger the signature move, never in calm mode', () => {
  const standing = createPetBehaviorState({ x: .5, y: .88 }, config, seeded(41));
  const withTrick = { ...config, trick: 'trick' as const };
  assert.equal(reactToPetTap(standing, withTrick, () => .1).mode, 'trick');
  assert.equal(reactToPetTap(standing, withTrick, () => .9).mode, 'happy');
  assert.equal(reactToPetTap(standing, { ...withTrick, calm: true }, () => .1).mode, 'happy');
  const sitTrick = reactToPetTap(standing, { ...config, trick: 'trickSit' }, () => .1);
  assert.equal(sitTrick.mode, 'sitDown');
  assert.deepEqual(sitTrick.queue, ['trickSit']);
});

test('walks curve, vary in pace, and sometimes run or pause halfway', () => {
  const random = seeded(51);
  const paces = new Set<number>();
  let runs = 0;
  let pauses = 0;
  let maxDeviation = 0;
  let walk: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  run(createPetBehaviorState({ x: .5, y: .88 }, config, random), 900_000, random, (state, previous) => {
    const moving = state.mode === 'walk' || state.mode === 'run';
    if (moving && state.target && walk?.to !== state.target) {
      walk = { from: previous.position, to: state.target };
      paces.add(Math.round(state.pace * 100));
      if (state.mode === 'run') runs += 1;
    }
    if (moving && walk) {
      // Distance from the straight line between where the walk started and its target.
      const lx = walk.to.x - walk.from.x;
      const ly = (walk.to.y - walk.from.y) / config.aspectRatio;
      const length = Math.hypot(lx, ly);
      const px = state.position.x - walk.from.x;
      const py = (state.position.y - walk.from.y) / config.aspectRatio;
      if (length > .1) maxDeviation = Math.max(maxDeviation, Math.abs(px * ly - py * lx) / length);
    }
    if ((state.mode === 'lookAround' || state.mode === 'tilt') && previous.mode === 'walk' && state.queue[0] === 'walk') pauses += 1;
  });
  assert.ok(paces.size >= 5, `paces ${[...paces].join()}`);
  assert.ok(runs > 0, 'never ran');
  assert.ok(pauses > 0, 'never paused mid-walk');
  assert.ok(maxDeviation > .01, `paths stayed straight (${maxDeviation})`);
});

test('a curved walk reaches its target exactly', () => {
  const random = seeded(61);
  let state: PetBehaviorState = {
    ...createPetBehaviorState({ x: .2, y: .82 }, config, random),
    mode: 'walk', target: { x: .6, y: .93 }, modeDurationMs: Infinity, heading: 1.2, pace: 1, pauseAt: null,
  };
  for (let i = 0; i < 4000 && state.mode === 'walk'; i += 1) state = stepPetBehavior(state, 50, config, random);
  assert.notEqual(state.mode, 'walk');
  assert.deepEqual(state.position, { x: .6, y: .93 });
});

test('the next action re-rolls once instead of repeating the last one', () => {
  const choices = [['idle', .5], ['sit', .5]] as const;
  const rolls = (...values: number[]) => () => values.shift() ?? 0;
  assert.equal(pickNextAction(choices, 'idle', rolls(.1, .9)), 'sit');
  assert.equal(pickNextAction(choices, 'sit', rolls(.1)), 'idle');
  assert.equal(pickNextAction([['idle', 1]], 'idle', rolls(.1)), 'idle');
});

test('a touch sometimes startles the pet into fleeing away from it, then it looks around', () => {
  const random = seeded(81);
  const fleeRoll = (() => {
    let first = true;
    return () => {
      if (!first) return random();
      first = false;
      return .05;
    };
  })();
  const standing: PetBehaviorState = { ...createPetBehaviorState({ x: .35, y: .92 }, config, random), facing: -1 };
  // Touched on its left side: it jumps, turns, and runs off to the right.
  let state = reactToPetTap(standing, config, fleeRoll, { x: .3, y: .9 });
  assert.equal(state.mode, 'startle');
  assert.deepEqual(state.queue, ['run']);
  assert.equal(state.facing, 1);
  assert.ok(state.target && state.target.x - .35 >= .24, `target ${state.target?.x}`);
  assert.ok(state.pace > 2.5);
  const seen = new Set<string>();
  for (let i = 0; i < 400 && state.mode !== 'lookAround'; i += 1) {
    state = stepPetBehavior(state, 50, config, random);
    seen.add(state.mode);
  }
  assert.ok(seen.has('run'));
  assert.equal(state.mode, 'lookAround');
  assert.equal(state.fleeing, false);
});

test('a cornered pet flees the other way, and never flees without a touch or in calm mode', () => {
  const nearRightEdge = createPetBehaviorState({ x: .9, y: .9 }, config, seeded(83));
  const cornered = reactToPetTap(nearRightEdge, config, () => .05, { x: .85, y: .9 });
  assert.equal(cornered.mode, 'startle');
  assert.ok(cornered.target && cornered.target.x < .9);
  const standing = createPetBehaviorState({ x: .5, y: .88 }, config, seeded(85));
  assert.equal(reactToPetTap(standing, config, () => .05).mode, 'happy');
  assert.equal(reactToPetTap(standing, { ...config, calm: true }, () => .05, { x: .45, y: .86 }).mode, 'happy');
  assert.equal(reactToPetTap(standing, config, () => .9, { x: .45, y: .86 }).mode, 'happy');
});
