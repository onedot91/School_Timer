import type { LibraryAmbientObject, LibraryBookDraft, LibraryPlacedBook, LibraryPoint, LibraryRoom, LibraryScene } from './canvasLibraryWorld';
import { getLibraryBookSpineWidth } from './canvasLibraryWorld';
import { resolveLibraryCatRoom } from './canvasLibraryCat';

export const LIBRARY_WALK_FRAME_MS = 140;
export const LIBRARY_ACTION_MS = 500;
export const LIBRARY_CLERK_RECEIVE_MS = 700;
export const LIBRARY_BEAR_BOUNDS = { left: -18, right: 18, top: -38, bottom: 0 } as const;
export const getLibraryBookThickness = (pageCount: number) => getLibraryBookSpineWidth(pageCount);

export function getLibraryBookTone(book: LibraryBookDraft) {
  const identity = `${book.studentNumber}:${book.title.trim()}:${book.author.trim()}`;
  let hash = 2166136261;
  for (const character of identity) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 8;
}

export function getLibraryPlacedBookRect(room: LibraryRoom, book: LibraryPlacedBook) {
  const shelf = room.shelves.find(shelf => shelf.slots.some(slot => slot.id === book.slotId));
  const slot = shelf?.slots.find(slot => slot.id === book.slotId);
  if (!slot) return null;
  const rect = slot.rect;
  const width = Math.max(2, shelf?.fitBooksToRow ? Math.round(rect.width) : Math.min(getLibraryBookThickness(book.pageCount), Math.round(rect.width)));
  const height = Math.max(4, Math.round(rect.height) - 2 - book.slotId % 3);
  return { x: Math.round(rect.x + (rect.width - width) / 2), y: Math.round(rect.y + rect.height - height), width, height };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a: LibraryPoint, b: LibraryPoint, t: number): LibraryPoint => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
});

export function getLibraryActionDuration(action: LibraryScene['action'], room?: LibraryRoom): number {
  return action?.kind === 'receive' && room?.desk.clerk ? LIBRARY_CLERK_RECEIVE_MS : LIBRARY_ACTION_MS;
}

export function getLibraryActionProgress(scene: LibraryScene, room?: LibraryRoom): number | null {
  if (!scene.action || scene.reducedMotion) return null;
  const elapsed = scene.timeMs - scene.action.startedAt;
  const duration = getLibraryActionDuration(scene.action, room);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < duration
    ? elapsed / duration : null;
}

export function getLibraryClerkHand(scene: LibraryScene, room: LibraryRoom): LibraryPoint | null {
  const clerk = room.desk.clerk;
  if (!clerk) return null;
  const resting = { x: clerk.handoffPoint.x + 5, y: clerk.handoffPoint.y - 5 };
  const progress = getLibraryActionProgress(scene, room);
  if (scene.action?.kind !== 'receive' || progress === null) return resting;
  if (progress < 0.2) return mix(resting, clerk.handoffPoint, ease(progress / 0.2));
  return mix(clerk.handoffPoint, resting, ease((progress - 0.2) / 0.2));
}

export function getLibraryTeaPositions(object: LibraryAmbientObject) {
  const fromLeft = object.interactionPoint.x < object.visualRect.x;
  const direction = fromLeft ? 1 : -1;
  const pot = { x: object.visualRect.x + (fromLeft ? 9 : 7), y: object.visualRect.y + 8 };
  const cup = { x: object.visualRect.x + (fromLeft ? 6 : 10), y: object.visualRect.y + 17 };
  return {
    pot, cup, direction,
    grip: { x: pot.x - direction * 7, y: pot.y + 2 },
    pourGrip: { x: cup.x - direction * 15, y: cup.y - 8 },
  };
}

export function getLibraryAmbientProgress(scene: LibraryScene): number | null {
  const action = scene.ambientAction;
  if (!action || scene.reducedMotion || action.durationMs <= 0) return null;
  const elapsed = scene.timeMs - action.startedAt;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < action.durationMs ? elapsed / action.durationMs : null;
}

export function getLibraryBearPose(scene: LibraryScene, room?: LibraryRoom) {
  if (room && scene.catState) room = resolveLibraryCatRoom(room, scene.catState, scene.player);
  const beanbag = room?.readingArea.beanbagVisualRect;
  const ambientProgress = getLibraryAmbientProgress(scene);
  const bench = room?.ambientObjects?.find(object => object.id === scene.ambientState?.benchObjectId
    || (ambientProgress !== null && scene.ambientAction?.kind === 'sit' && object.id === scene.ambientAction.objectId));
  const benchSeated = Boolean(bench);
  const feet = bench
    ? mix(scene.player.position, { x: bench.visualRect.x + bench.visualRect.width / 2, y: bench.visualRect.y + bench.visualRect.height + 2 }, scene.ambientState?.benchObjectId ? 1 : ease(ambientProgress ?? 1))
    : scene.seated && beanbag
    ? { x: beanbag.x + beanbag.width / 2, y: beanbag.y + beanbag.height - 2 }
    : scene.player.position;
  const facing = scene.seated || benchSeated ? 'down' : scene.player.facing;
  const walking = scene.player.isWalking && !scene.reducedMotion && !scene.seated && !benchSeated && !scene.ambientAction;
  const time = scene.walkTimeMs ?? scene.timeMs;
  const frame = walking && Number.isFinite(time) ? Math.floor(Math.max(0, time) / LIBRARY_WALK_FRAME_MS) % 4 : 1;
  const stride = walking ? [1, 0, -1, 0][frame] : 0;
  const progress = getLibraryActionProgress(scene, room);
  const carrying = Boolean(scene.carriedDraft) || (scene.action?.kind === 'place' && progress !== null);
  const reach = progress === null ? 0 : scene.action?.kind === 'receive'
    ? Math.sin(Math.min(1, progress / 0.7) * Math.PI) * 2
    : progress < 0.2 ? ease(progress / 0.2) * 4 : (1 - ease((progress - 0.2) / 0.8)) * 4;
  const direction = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const shoulder = { x: feet.x + (direction || 1) * 5, y: feet.y - 12 };
  let hand = { x: feet.x + direction * (10 + Math.round(reach)), y: feet.y - 10 - Math.round(reach) };
  if (room?.desk.clerk && scene.action?.kind === 'receive' && progress !== null) {
    hand = { x: feet.x, y: feet.y - 10 };
  }
  const object = room?.ambientObjects?.find(object => object.id === scene.ambientAction?.objectId);
  if (object && ambientProgress !== null && scene.ambientAction?.kind !== 'sit') {
    const kind = scene.ambientAction?.kind;
    const target = object.actionPoint ?? object.interactionPoint;
    const amount = ambientProgress < 0.25 ? ease(ambientProgress / 0.25) : ambientProgress > 0.8 ? 1 - ease((ambientProgress - 0.8) / 0.2) : 1;
    if (kind === 'drink') {
      const { cup } = getLibraryTeaPositions(object);
      const mouth = { x: feet.x + direction * 10, y: feet.y - 19 };
      const lift = ambientProgress < 0.35 ? ease(ambientProgress / 0.35) : ambientProgress > 0.7 ? 1 - ease((ambientProgress - 0.7) / 0.3) : 1;
      hand = mix(cup, mouth, lift);
    } else if (kind === 'pour') {
      const tea = getLibraryTeaPositions(object);
      hand = mix(tea.grip, tea.pourGrip, amount);
    } else {
      const destination = kind === 'water'
        ? { x: shoulder.x + 7, y: shoulder.y - 9 }
        : kind === 'leaves' ? { x: shoulder.x + 5, y: shoulder.y - 5 }
        : kind === 'pet' ? { x: target.x + (feet.x < target.x ? -6 : 6), y: target.y }
        : target;
      hand = mix(hand, destination, amount);
    }
  }
  const distance = Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y);
  const reachable = distance <= 12;
  if (!reachable) hand = mix(shoulder, hand, 12 / distance);
  const elbow = { x: shoulder.x + (hand.x - shoulder.x) * 0.5,
    y: shoulder.y + (hand.y - shoulder.y) * 0.5 + Math.min(2, Math.abs(hand.x - shoulder.x) / 4) };
  return { feet, facing, walking, frame, stride, carrying, shoulder, elbow, hand, reachable, progress, ambientProgress, benchSeated, reach: Math.round(reach) };
}

export function getLibraryBookMotion(scene: LibraryScene, room: LibraryRoom) {
  const pose = getLibraryBearPose(scene, room);
  const progress = pose.progress;
  const resting = { center: pose.hand, inHands: true, visible: pose.facing !== 'up', landed: false, turn: 0, width: 10, height: 8 };
  if (progress === null || !scene.action) return scene.carriedDraft ? resting : null;
  if (scene.action.kind === 'receive') {
    const clerk = room.desk.clerk;
    if (clerk) {
      const staffHand = getLibraryClerkHand(scene, room) ?? clerk.handoffPoint;
      const center = progress < 0.2 ? staffHand
        : progress < 0.75 ? mix(clerk.handoffPoint, clerk.counterPoint, ease((progress - 0.2) / 0.55))
        : mix(clerk.counterPoint, pose.hand, ease((progress - 0.75) / 0.25));
      return { center, inHands: progress >= 0.95, visible: true, landed: false, turn: 0, width: 10, height: 8 };
    }
    const start = { x: room.desk.visualRect.x + room.desk.visualRect.width * 0.5, y: room.desk.visualRect.y + 18 };
    const t = ease(progress / 0.7);
    const center = mix(start, pose.hand, t);
    return { center: { x: center.x, y: center.y - Math.sin(t * Math.PI) * 5 },
      inHands: progress >= 0.7, visible: progress < 0.7 || pose.facing !== 'up', landed: false, turn: 0, width: 10, height: 8 };
  }
  const book = scene.placedBooks.find(book => book.slotId === scene.action?.slotId);
  const rect = book ? getLibraryPlacedBookRect(room, book) : null;
  if (!rect) return null;
  const target = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const transfer = ease((progress - 0.2) / 0.4);
  const insertion = ease((progress - 0.6) / 0.2);
  const shelfFront = { x: target.x, y: target.y + 7 };
  const center = progress < 0.6 ? mix(pose.hand, shelfFront, transfer) : mix(shelfFront, target, insertion);
  return { center, turn: transfer, width: 10 + Math.round((rect.width - 10) * transfer), height: 8 + Math.round((rect.height - 8) * transfer),
    inHands: progress < 0.2, visible: progress < 0.8 && (progress >= 0.2 || pose.facing !== 'up'), landed: progress >= 0.8 };
}
