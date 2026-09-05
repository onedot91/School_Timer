import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelLibraryCatPet, createLibraryCatNavigation, createLibraryCatState, finishLibraryCatPet, resolveLibraryCatRoom, startLibraryCatPet, stepLibraryCat, type LibraryCatState } from './canvasLibraryCat.js';
import { createFullLibraryRoom, createLibraryPlayer, createSmallLibraryRoom, getNearbyLibraryTarget, stepLibraryPlayer, type LibraryPoint, type LibraryRect } from './canvasLibraryWorld.js';

const room = createFullLibraryRoom();
const nav = createLibraryCatNavigation(room);
const player = createLibraryPlayer(room);
const distance = (a: LibraryPoint, b: LibraryPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const overlaps = (a: LibraryRect, b: LibraryRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const bounds = (cat: LibraryCatState): LibraryRect => ({ x: cat.position.x - 15, y: cat.position.y - 20, width: 30, height: 21 });
const catFor = (seed: number) => {
  const state = createLibraryCatState(room, nav, seed, player);
  assert.ok(state); return state;
};
const safeCat = (cat: LibraryCatState) => {
  const rect = bounds(cat);
  assert.ok(rect.x >= room.walkableBounds.x && rect.y >= room.walkableBounds.y);
  assert.ok(rect.x + rect.width <= room.walkableBounds.x + room.walkableBounds.width);
  assert.ok(rect.y + rect.height <= room.walkableBounds.y + room.walkableBounds.height);
  assert.ok(nav.obstacles.every(obstacle => !overlaps(rect, obstacle)), JSON.stringify(cat));
};

test('seeded visits spawn varied cats only on connected safe floor away from entry and interactions', () => {
  const positions = new Set<string>();
  const excluded = [room.spawn, room.desk.interactionPoint, ...room.shelves.flatMap(shelf => [shelf.interactionPoint, ...shelf.slots.map(slot => slot.interactionPoint)]), ...(room.ambientObjects ?? []).filter(object => object.kind !== 'cat').map(object => object.interactionPoint), room.failureBoard!.interactionPoint, room.competitionBoard!.interactionPoint, room.readingArea.interactionPoint!];
  for (let seed = 1; seed <= 120; seed += 1) {
    const cat = catFor(seed); safeCat(cat);
    positions.add(JSON.stringify(cat.position));
    assert.ok(distance(cat.position, room.spawn) >= 56);
    assert.ok(distance(cat.position, player.position) >= 48);
    assert.ok(excluded.every(point => distance(cat.position, point) >= 36));
    assert.deepEqual(cat, catFor(seed));
    assert.ok(nav.spawnIndices.some(index => distance(nav.nodes[index], cat.position) === 0));
  }
  assert.ok(positions.size > 50, `Only ${positions.size} distinct positions`);
});

test('all spawn approach points are reachable by the bear and select the dynamic cat', () => {
  // A player-sized flood fill proves the same connected component, including positions near furniture.
  const original = room.ambientObjects!.find(object => object.kind === 'cat')!;
  const staticRoom = { ...room, obstacles: room.obstacles.filter(rect => rect !== original.visualRect) };
  const reachable: LibraryPoint[] = [];
  const queued = new Set<string>();
  const queue = [room.spawn];
  queued.add(`${room.spawn.x},${room.spawn.y}`);
  for (let i = 0; i < queue.length; i += 1) {
    const point = queue[i]; reachable.push(point);
    for (const input of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const moved = stepLibraryPlayer(staticRoom, { ...player, position: point }, input, 40);
      const expected = { x: point.x + input.x * 4, y: point.y + input.y * 4 };
      if (distance(moved.position, expected) > 0.01) continue;
      const key = `${expected.x},${expected.y}`;
      if (!queued.has(key)) { queued.add(key); queue.push(expected); }
    }
  }
  for (const index of nav.spawnIndices) {
    const cat = { ...catFor(1), position: nav.nodes[index] };
    const dynamic = resolveLibraryCatRoom(room, cat, player);
    const object = dynamic.ambientObjects!.find(object => object.kind === 'cat')!;
    assert.ok(reachable.some(point => distance(point, object.interactionPoint) < 4), JSON.stringify(object));
    const dx = cat.position.x - object.interactionPoint.x; const dy = cat.position.y - 5 - object.interactionPoint.y;
    const facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    const standing = { ...player, position: object.interactionPoint, facing } as typeof player;
    assert.equal(getNearbyLibraryTarget(dynamic, standing, [])?.id, object.id);
    assert.equal(stepLibraryPlayer(dynamic, standing, { x: 0, y: 1 }, 1).position.y > standing.position.y, true);
  }
});

test('long simulations stay within furniture bounds, walk at 24px/s and visit every rest behavior', () => {
  const behaviors = new Set<string>();
  for (let seed = 1; seed <= 8; seed += 1) {
    let cat = catFor(seed);
    let lastRest: string | null = null;
    for (let frame = 0; frame < 7200; frame += 1) {
      const before = cat;
      cat = stepLibraryCat(room, nav, cat, player, { x: 0, y: 0 }, 50);
      safeCat(cat);
      assert.ok(distance(before.position, cat.position) <= 1.200001);
      behaviors.add(cat.behavior);
      if (cat.lastRest !== before.lastRest) { assert.notEqual(cat.lastRest, lastRest); lastRest = cat.lastRest; }
    }
  }
  for (const behavior of ['look', 'walk', 'sit', 'sleep', 'groom', 'stretch']) assert.ok(behaviors.has(behavior), behavior);
});

test('walking paths have 40–100 logical pixel lengths and nonrepeating rest selection', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const state = { ...catFor(seed), remainingMs: 1 };
    const distant = { ...player, position: { x: 18, y: 104 } };
    const next = stepLibraryCat(room, nav, state, distant, { x: 0, y: 0 }, 16);
    assert.equal(next.behavior, 'walk');
    const length = next.path.reduce((sum, point, index) => sum + distance(point, index ? next.path[index - 1] : next.position), 0);
    assert.ok(length >= 40 && length <= 100, `${length}`);
  }
});

test('pause, reduced motion and pet locks freeze position and timers without catch-up', () => {
  const state = catFor(42);
  for (const options of [{ paused: true }, { reducedMotion: true }, { petting: true }]) assert.equal(stepLibraryCat(room, nav, state, player, { x: 1, y: 0 }, 5000, options), state);
  const resumed = stepLibraryCat(room, nav, state, player, { x: 0, y: 0 }, 5000);
  assert.ok(resumed.elapsedMs - state.elapsedMs <= 100);
  const pet = startLibraryCatPet(room, nav, state, player);
  assert.equal(pet.behavior, 'pet'); assert.ok(pet.lockedApproach);
  assert.equal(stepLibraryCat(room, nav, pet, player, { x: 1, y: 0 }, 1000), pet);
  const movedPlayer = { ...player, position: { x: 600, y: 350 } };
  assert.deepEqual(resolveLibraryCatRoom(room, pet, player).ambientObjects, resolveLibraryCatRoom(room, pet, movedPlayer).ambientObjects);
  const done = finishLibraryCatPet(pet);
  assert.equal(done.lockedApproach, null); assert.ok(['sit', 'stretch', 'sleep'].includes(done.behavior));
  assert.equal(cancelLibraryCatPet(pet).behavior, 'look');
});

test('a still nearby bear is watched and an approaching bear receives space without overlap', () => {
  const cat = { ...catFor(1), position: { x: 378, y: 176 } };
  const near = { ...player, position: { x: 410, y: 176 } };
  const watching = stepLibraryCat(room, nav, cat, near, { x: 0, y: 0 }, 16);
  assert.equal(watching.behavior, 'watch'); assert.equal(watching.facing, 'right');
  let movingCat = cat; let bear = near;
  let yielded = false;
  for (let i = 0; i < 150; i += 1) {
    movingCat = stepLibraryCat(room, nav, movingCat, bear, { x: -1, y: 0 }, 16);
    yielded ||= movingCat.behavior === 'yield';
    bear = stepLibraryPlayer(resolveLibraryCatRoom(room, movingCat, bear), bear, { x: -1, y: 0 }, 16);
    assert.ok(!overlaps(bounds(movingCat), { x: bear.position.x - 6, y: bear.position.y - 3, width: 12, height: 6 }));
    safeCat(movingCat);
  }
  assert.ok(yielded);
});

test('dynamic cat replaces its original collider and live target follows movement without adding slots', () => {
  const cat = catFor(3);
  const moved = { ...cat, position: { x: cat.position.x + 1, y: cat.position.y } };
  const first = resolveLibraryCatRoom(room, cat, player);
  const second = resolveLibraryCatRoom(room, moved, player);
  assert.equal(first.obstacles.length, room.obstacles.length);
  assert.equal(first.shelves, room.shelves);
  assert.equal(first.shelves.flatMap(shelf => shelf.slots).length, 100);
  const a = first.ambientObjects!.find(object => object.kind === 'cat')!;
  const b = second.ambientObjects!.find(object => object.kind === 'cat')!;
  assert.equal(b.visualRect.x - a.visualRect.x, 1);
  assert.equal(b.actionPoint!.x - a.actionPoint!.x, 1);
  assert.equal(b.interactionPoint.x - a.interactionPoint.x, 1);
  assert.equal(resolveLibraryCatRoom(room, undefined, player), room);
  assert.equal(createLibraryCatState(createSmallLibraryRoom(), nav, 1, player), undefined);
});

test('empty navigation and blocked paths rest safely instead of teleporting or looping', () => {
  const cat = { ...catFor(1), remainingMs: 0 };
  const empty = { ...nav, nodes: [], neighbors: [], spawnIndices: [] };
  assert.equal(createLibraryCatState(room, empty, 1, player), undefined);
  const next = stepLibraryCat(room, empty, cat, { ...player, position: { x: 18, y: 104 } }, { x: 0, y: 0 }, 16);
  assert.deepEqual(next.position, cat.position); assert.equal(next.behavior, 'look'); assert.ok(next.remainingMs >= 2000);
});


test('post-pet response remains visible to a nearby still bear and failed yielding is throttled', () => {
  const initial = catFor(5);
  const near = { ...player, position: { x: initial.position.x + 24, y: initial.position.y } };
  let cat = finishLibraryCatPet(startLibraryCatPet(room, nav, initial, near));
  const response = cat.behavior;
  for (let i = 0; i < 20; i += 1) {
    cat = stepLibraryCat(room, nav, cat, near, { x: 0, y: 0 }, 100);
    assert.equal(cat.behavior, response);
  }
  const empty = { ...nav, nodes: [], neighbors: [], spawnIndices: [] };
  let blocked = { ...initial, attentionCooldownMs: 0 };
  blocked = stepLibraryCat(room, empty, blocked, near, { x: -1, y: 0 }, 16);
  const rng = blocked.rngState;
  for (let i = 0; i < 20; i += 1) blocked = stepLibraryCat(room, empty, blocked, near, { x: -1, y: 0 }, 16);
  assert.equal(blocked.rngState, rng);
  assert.deepEqual(blocked.position, initial.position);
});


test('pet approaches keep the bear head clear of the cat at every navigation node and edge', () => {
  const template = catFor(42);
  const positions = nav.nodes.flatMap((point, index) => [point, ...nav.neighbors[index].flatMap(neighbor => [0.25, 0.5, 0.75].map(t => ({ x: point.x + (nav.nodes[neighbor].x - point.x) * t, y: point.y + (nav.nodes[neighbor].y - point.y) * t })))]);
  for (const position of positions) {
    const cat = { ...template, position };
    const frontBear = { ...player, position: { x: position.x, y: position.y + 18 } };
    const object = resolveLibraryCatRoom(room, cat, frontBear).ambientObjects!.find(object => object.kind === 'cat')!;
    const point = object.interactionPoint;
    assert.ok(Math.abs(point.x - position.x) === 22 && point.y === position.y, JSON.stringify({ position, point }));
    assert.ok(!overlaps(bounds(cat), { x: point.x - 6, y: point.y - 3, width: 12, height: 6 }));
  }
  const cat = { ...template, position: { x: 346, y: 272 } };
  const frontBear = { ...player, position: { x: 346, y: 290 } };
  const pet = startLibraryCatPet(room, nav, cat, frontBear);
  assert.ok(pet.lockedApproach);
  assert.equal(Math.abs(pet.lockedApproach.x - cat.position.x), 22);
  assert.equal(pet.lockedApproach.y, cat.position.y);
});


test('cat navigation keeps the full trophy display solid when the bear can walk behind it', () => {
  const room = createFullLibraryRoom();
  const trophy = room.competitionBoard;
  assert.ok(trophy);
  assert.ok(room.obstacles.includes(trophy.footCollider));
  assert.ok(!room.obstacles.includes(trophy.visualRect));
  const nav = createLibraryCatNavigation(room);
  assert.ok(nav.obstacles.includes(trophy.visualRect));
  for (const point of nav.nodes) {
    const rect = { x: point.x - 15, y: point.y - 20, width: 30, height: 21 };
    assert.ok(!(rect.x < trophy.visualRect.x + trophy.visualRect.width && rect.x + rect.width > trophy.visualRect.x
      && rect.y < trophy.visualRect.y + trophy.visualRect.height && rect.y + rect.height > trophy.visualRect.y));
  }
});

test('cat paths cross the door foreground in both directions without an entrance blocker', () => {
  assert.ok(room.exit);
  assert.equal(nav.obstacles.some(rect => overlaps(rect, room.exit!.visualRect)), false);
  const points = Array.from({ length: 10 }, (_, index) => ({ x: 314 + index * 8, y: 344 }));
  for (let index = 0; index < points.length; index += 1) {
    const nodeIndex = nav.nodes.findIndex(point => distance(point, points[index]) === 0);
    assert.ok(nodeIndex >= 0);
    if (index > 0) assert.ok(nav.neighbors[nodeIndex].some(neighbor => distance(nav.nodes[neighbor], points[index - 1]) === 0));
  }
  const distantBear = { ...player, position: { x: 400, y: 120 } };
  for (const path of [points, [...points].reverse()]) {
    let cat: LibraryCatState = { ...catFor(1), position: path[0], behavior: 'walk', path: path.slice(1) };
    for (let frame = 0; frame < 31; frame += 1) {
      cat = stepLibraryCat(room, nav, cat, distantBear, { x: 0, y: 0 }, 100);
      safeCat(cat);
      assert.equal(cat.position.y, path[0].y);
    }
    assert.ok(distance(cat.position, path[path.length - 1]) < 1e-8);
  }
});
