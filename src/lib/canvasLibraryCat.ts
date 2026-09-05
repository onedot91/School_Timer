import type { LibraryAmbientObject, LibraryPlayer, LibraryPoint, LibraryRect, LibraryRoom } from './canvasLibraryWorld.js';

export type LibraryCatRest = 'sit' | 'sleep' | 'groom' | 'stretch';
export type LibraryCatState = {
  readonly position: LibraryPoint;
  readonly facing: LibraryPlayer['facing'];
  readonly behavior: 'look' | 'walk' | LibraryCatRest | 'watch' | 'yield' | 'pet';
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly attentionCooldownMs: number;
  readonly yieldRetryMs: number;
  readonly path: readonly LibraryPoint[];
  readonly rngState: number;
  readonly lastRest: LibraryCatRest | null;
  readonly reaction: 'head-up' | 'stretch' | 'sleepy';
  readonly lockedApproach: LibraryPoint | null;
};
export type LibraryCatNavigation = {
  readonly nodes: readonly LibraryPoint[];
  readonly neighbors: readonly (readonly number[])[];
  readonly obstacles: readonly LibraryRect[];
  readonly bounds: LibraryRect;
  readonly spawnIndices: readonly number[];
};
const GRID = 8;
const distance = (a: LibraryPoint, b: LibraryPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const overlaps = (a: LibraryRect, b: LibraryRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const sameRect = (a: LibraryRect, b: LibraryRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const envelope = (position: LibraryPoint): LibraryRect => ({ x: position.x - 15, y: position.y - 20, width: 30, height: 21 });
const feet = (player: LibraryPlayer, position = player.position): LibraryRect => ({ x: position.x - player.feetCollider.width / 2, y: position.y - player.feetCollider.height / 2, ...player.feetCollider });
const inside = (rect: LibraryRect, bounds: LibraryRect) => rect.x >= bounds.x && rect.y >= bounds.y && rect.x + rect.width <= bounds.x + bounds.width && rect.y + rect.height <= bounds.y + bounds.height;
const originalCat = (room: LibraryRoom) => room.ambientObjects?.find(object => object.kind === 'cat');
const staticObstacles = (room: LibraryRoom) => {
  const cat = originalCat(room);
  return room.obstacles.filter(rect => !cat || !sameRect(rect, cat.visualRect));
};
const safe = (nav: Pick<LibraryCatNavigation, 'obstacles' | 'bounds'>, position: LibraryPoint) => inside(envelope(position), nav.bounds) && !nav.obstacles.some(rect => overlaps(envelope(position), rect));
const clearSegment = (nav: LibraryCatNavigation, from: LibraryPoint, to: LibraryPoint) => {
  const count = Math.max(1, Math.ceil(distance(from, to) / 2));
  for (let i = 1; i <= count; i += 1) if (!safe(nav, { x: from.x + (to.x - from.x) * i / count, y: from.y + (to.y - from.y) * i / count })) return false;
  return true;
};
const nearest = (nodes: readonly LibraryPoint[], point: LibraryPoint) => nodes.reduce((best, node, index) => best < 0 || distance(node, point) < distance(nodes[best], point) ? index : best, -1);
const random = (seed: number): readonly [number, number] => {
  let next = seed >>> 0;
  next ^= next << 13; next ^= next >>> 17; next ^= next << 5;
  return [next >>> 0, (next >>> 0) / 0x100000000];
};
const timed = (state: LibraryCatState, behavior: LibraryCatState['behavior'], min: number, max = min): LibraryCatState => {
  const [rngState, value] = random(state.rngState);
  return { ...state, behavior, elapsedMs: 0, remainingMs: min + value * (max - min), path: [], rngState };
};
const face = (from: LibraryPoint, to: LibraryPoint): LibraryPlayer['facing'] => Math.abs(to.x - from.x) > Math.abs(to.y - from.y) ? (to.x < from.x ? 'left' : 'right') : (to.y < from.y ? 'up' : 'down');

export const createLibraryCatNavigation = (room: LibraryRoom): LibraryCatNavigation => {
  const obstacles = [...staticObstacles(room), ...room.shelves.map(shelf => shelf.visualRect), ...(room.competitionBoard ? [room.competitionBoard.visualRect] : []), ...(room.ambientObjects ?? []).filter(object => object.kind === 'plant').map(object => object.visualRect)];
  const bounds = room.walkableBounds;
  const nodes: LibraryPoint[] = [];
  const coordinate = new Map<string, number>();
  for (let y = bounds.y; y <= bounds.y + bounds.height; y += GRID) {
    for (let x = bounds.x; x <= bounds.x + bounds.width; x += GRID) {
      if (!safe({ obstacles, bounds }, { x, y }) || safeApproaches(room, { x, y }, { width: 12, height: 6 }).length === 0) continue;
      coordinate.set(`${x},${y}`, nodes.length); nodes.push({ x, y });
    }
  }
  const neighbors = nodes.map(point => [{ x: GRID, y: 0 }, { x: -GRID, y: 0 }, { x: 0, y: GRID }, { x: 0, y: -GRID }].flatMap(delta => {
    const index = coordinate.get(`${point.x + delta.x},${point.y + delta.y}`);
    if (index === undefined) return [];
    for (let step = 1; step < GRID * 2; step += 1) {
      const t = step / (GRID * 2);
      if (!safeApproaches(room, { x: point.x + delta.x * t, y: point.y + delta.y * t }, { width: 12, height: 6 }).length) return [];
    }
    return [index];
  }));
  const connected = new Set<number>();
  const start = nearest(nodes, room.spawn);
  const queue = start < 0 ? [] : [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]; if (connected.has(index)) continue;
    connected.add(index); queue.push(...neighbors[index].filter(next => !connected.has(next)));
  }
  const interactionPoints = [room.desk.interactionPoint, ...room.shelves.flatMap(shelf => [shelf.interactionPoint, ...shelf.slots.map(slot => slot.interactionPoint)]), ...(room.ambientObjects ?? []).filter(object => object.kind !== 'cat').map(object => object.interactionPoint), ...[room.failureBoard?.interactionPoint, room.competitionBoard?.interactionPoint, room.readingArea.interactionPoint].filter((point): point is LibraryPoint => point !== undefined)];
  const spawnIndices = [...connected].filter(index => distance(nodes[index], room.spawn) >= 56 && interactionPoints.every(point => distance(nodes[index], point) >= 36));
  return { nodes, neighbors, obstacles, bounds, spawnIndices };
};

const safeApproaches = (room: LibraryRoom, p: LibraryPoint, collider: LibraryPlayer['feetCollider']): LibraryPoint[] => {
  const candidates = [{ x: p.x + 22, y: p.y }, { x: p.x - 22, y: p.y }];
  const obstacles = [...staticObstacles(room), envelope(p)];
  return candidates.filter(point => {
    const rect = { x: point.x - collider.width / 2 - 1, y: point.y - collider.height / 2 - 1, width: collider.width + 2, height: collider.height + 2 };
    return inside(rect, room.walkableBounds) && !obstacles.some(obstacle => overlaps(rect, obstacle));
  });
};
const approach = (room: LibraryRoom, state: LibraryCatState, player: LibraryPlayer): LibraryPoint | null => {
  if (state.lockedApproach) return state.lockedApproach;
  const p = state.position;
  return safeApproaches(room, p, player.feetCollider).sort((a, b) => Number(a.x === p.x) - Number(b.x === p.x) || distance(a, player.position) - distance(b, player.position))[0] ?? null;
};

export const createLibraryCatState = (room: LibraryRoom, nav: LibraryCatNavigation, seed: number, player: LibraryPlayer): LibraryCatState | undefined => {
  if (!originalCat(room)) return undefined;
  const [rngState, value] = random((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 0x9e3779b9);
  const candidates = nav.spawnIndices.filter(index => distance(nav.nodes[index], player.position) >= 48);
  if (!candidates.length) return undefined;
  const position = nav.nodes[candidates[Math.floor(value * candidates.length)]];
  return timed({ position, facing: 'down', behavior: 'look', elapsedMs: 0, remainingMs: 0, attentionCooldownMs: 0, yieldRetryMs: 0, path: [], rngState, lastRest: null, reaction: 'head-up', lockedApproach: null }, 'look', 2000, 4000);
};

export const resolveLibraryCatRoom = (room: LibraryRoom, state: LibraryCatState | undefined, player: LibraryPlayer): LibraryRoom => {
  const cat = originalCat(room);
  if (!state || !cat) return room;
  const object: LibraryAmbientObject = { ...cat, visualRect: envelope(state.position), actionPoint: { x: state.position.x, y: state.position.y - 10 }, interactionPoint: approach(room, state, player) ?? state.position };
  return { ...room, obstacles: [...staticObstacles(room), object.visualRect], ambientObjects: room.ambientObjects?.map(candidate => candidate.id === cat.id ? object : candidate) };
};

const choosePath = (nav: LibraryCatNavigation, state: LibraryCatState, player: LibraryPlayer, yielding: boolean): LibraryCatState => {
  const start = nearest(nav.nodes, state.position);
  if (start < 0 || !clearSegment(nav, state.position, nav.nodes[start])) return timed(state, 'look', 2000, 4000);
  const previous = new Map<number, number>([[start, -1]]);
  const lengths = new Map<number, number>([[start, distance(state.position, nav.nodes[start])]]);
  const queue = [start];
  const candidates: number[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]; const length = lengths.get(current) ?? 0;
    const min = yielding ? 24 : 40;
    if (length >= min && length <= (yielding ? 56 : 100) && distance(nav.nodes[current], player.position) > (yielding ? distance(state.position, player.position) + 12 : 24)) candidates.push(current);
    if (length + GRID > (yielding ? 56 : 100)) continue;
    for (const next of nav.neighbors[current]) {
      if (previous.has(next) || overlaps(envelope(nav.nodes[next]), feet(player))) continue;
      previous.set(next, current); lengths.set(next, length + GRID); queue.push(next);
    }
  }
  if (!candidates.length) return timed(state, 'look', 2000, 4000);
  const [rngState, value] = random(state.rngState);
  let selected = candidates[Math.floor(value * candidates.length)];
  if (yielding) selected = candidates.sort((a, b) => distance(nav.nodes[b], player.position) - distance(nav.nodes[a], player.position))[0];
  const path: LibraryPoint[] = [];
  for (let index = selected; index >= 0; index = previous.get(index) ?? -1) path.unshift(nav.nodes[index]);
  if (distance(path[0], state.position) < 0.01) path.shift();
  return { ...state, behavior: yielding ? 'yield' : 'walk', elapsedMs: 0, remainingMs: 0, path, rngState };
};
const rest = (state: LibraryCatState): LibraryCatState => {
  const choices: readonly LibraryCatRest[] = ['sit', 'sleep', 'groom', 'stretch'];
  const available = choices.filter(choice => choice !== state.lastRest);
  const [rngState, value] = random(state.rngState);
  const selected = available[Math.floor(value * available.length)];
  const duration: Record<LibraryCatRest, readonly [number, number]> = { sit: [4000, 7000], sleep: [8000, 14000], groom: [2000, 4000], stretch: [1000, 1000] };
  return timed({ ...state, rngState, lastRest: selected }, selected, ...duration[selected]);
};

export const stepLibraryCat = (room: LibraryRoom, nav: LibraryCatNavigation, state: LibraryCatState, player: LibraryPlayer, input: LibraryPoint, elapsedMs: number, options: { readonly paused?: boolean; readonly reducedMotion?: boolean; readonly petting?: boolean } = {}): LibraryCatState => {
  if (options.paused || options.reducedMotion || options.petting || state.behavior === 'pet' || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return state;
  const delta = Math.min(elapsedMs, 100);
  const gap = distance(player.position, state.position);
  const moving = input.x !== 0 || input.y !== 0;
  const approaching = moving && input.x * (state.position.x - player.position.x) + input.y * (state.position.y - player.position.y) > 0;
  let next = { ...state, attentionCooldownMs: Math.max(0, state.attentionCooldownMs - delta), yieldRetryMs: Math.max(0, state.yieldRetryMs - delta) };
  if (approaching && gap < 52 && state.behavior !== 'yield' && next.yieldRetryMs === 0) next = { ...choosePath(nav, next, player, true), yieldRetryMs: 500 };
  else if (!moving && gap < 40 && next.attentionCooldownMs === 0) return { ...next, behavior: 'watch', facing: face(state.position, player.position), elapsedMs: state.elapsedMs + delta, path: [], remainingMs: 0 };
  else if (state.behavior === 'watch') next = timed(next, 'look', 2000, 4000);
  if (next.behavior === 'walk' || next.behavior === 'yield') {
    let position = next.position; let path = [...next.path]; let budget = delta * 0.024; let facing = next.facing;
    while (path.length && budget > 0) {
      const target = path[0]; const length = distance(position, target);
      if (length < 0.001) { path.shift(); continue; }
      const amount = Math.min(length, budget, 2);
      const proposed = { x: position.x + (target.x - position.x) / length * amount, y: position.y + (target.y - position.y) / length * amount };
      if (!safe(nav, proposed) || overlaps(envelope(proposed), feet(player))) return timed({ ...next, position, facing }, 'look', 2000, 4000);
      facing = face(position, target); position = proposed; budget -= amount;
      if (amount >= length) path.shift();
    }
    next = { ...next, position, path, facing, elapsedMs: next.elapsedMs + delta };
    return path.length ? next : (next.behavior === 'yield' ? timed(next, 'look', 2000, 4000) : rest(next));
  }
  next = { ...next, elapsedMs: next.elapsedMs + delta, remainingMs: Math.max(0, next.remainingMs - delta) };
  if (next.remainingMs > 0) return next;
  return next.behavior === 'look' ? choosePath(nav, next, player, false) : timed(next, 'look', 2000, 4000);
};

export const startLibraryCatPet = (room: LibraryRoom, _nav: LibraryCatNavigation, state: LibraryCatState, player: LibraryPlayer): LibraryCatState => {
  const lockedApproach = approach(room, state, player);
  return { ...state, behavior: 'pet', elapsedMs: 0, remainingMs: 700, path: [], lockedApproach, facing: face(state.position, lockedApproach ?? player.position) };
};
export const finishLibraryCatPet = (state: LibraryCatState): LibraryCatState => {
  const [rngState, value] = random(state.rngState);
  const reaction = (['head-up', 'stretch', 'sleepy'] as const)[Math.floor(value * 3)];
  const behavior = reaction === 'head-up' ? 'sit' : reaction === 'stretch' ? 'stretch' : 'sleep';
  return timed({ ...state, rngState, reaction, lockedApproach: null, lastRest: behavior, attentionCooldownMs: 2500 }, behavior, 2500, 4000);
};
export const cancelLibraryCatPet = (state: LibraryCatState): LibraryCatState => timed({ ...state, lockedApproach: null }, 'look', 2000, 4000);
