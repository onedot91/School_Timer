import { normalizeBookReflection } from './studentLife.js';
import type { LibraryAmbientAction, LibraryAmbientState } from './canvasLibraryAmbient.js';
import type { LibraryCatState } from './canvasLibraryCat.js';

export type LibraryPoint = { readonly x: number; readonly y: number };
export type LibraryRect = LibraryPoint & { readonly width: number; readonly height: number };
export type LibrarySlot = {
  readonly id: number; readonly shelfId: string;
  readonly row: number; readonly column: number;
  readonly rect: LibraryRect; readonly interactionPoint: LibraryPoint;
};
export type LibraryShelf = {
  readonly id: string; readonly variant: 'wide-low' | 'narrow-tall' | 'compact' | 'endcap';
  readonly visualRect: LibraryRect; readonly footCollider: LibraryRect;
  readonly rows: number; readonly columns: number;
  readonly fitBooksToRow?: boolean;
  readonly visualGroupId?: string;
  readonly slots: readonly LibrarySlot[]; readonly interactionPoint: LibraryPoint;
};
type LibraryFixture = {
  readonly visualRect: LibraryRect; readonly footCollider: LibraryRect;
};

export type LibraryAmbientObject = {
  readonly id: string;
  readonly kind: 'lamp' | 'plant' | 'bench' | 'cat' | 'tea';
  readonly visualRect: LibraryRect;
  readonly interactionPoint: LibraryPoint;
  readonly actionPoint?: LibraryPoint;
};

export type LibraryRoom = {
  readonly width: 624; readonly height: 376;
  readonly bounds: LibraryRect; readonly walkableBounds: LibraryRect;
  readonly exit?: { readonly visualRect: LibraryRect; readonly triggerRect: LibraryRect };
  readonly spawn: LibraryPoint; readonly shelves: readonly LibraryShelf[];
  readonly desk: LibraryFixture & {
    readonly id: 'registration-desk';
    readonly interactionPoint: LibraryPoint;
    readonly clerk?: {
      readonly visualRect: LibraryRect;
      readonly handoffPoint: LibraryPoint;
      readonly counterPoint: LibraryPoint;
      readonly receivePoint: LibraryPoint;
    };
  };
  readonly readingArea: {
    readonly rug: LibraryRect; readonly tableVisualRect: LibraryRect;
    readonly tableFootCollider: LibraryRect; readonly benchVisualRect: LibraryRect;
    readonly benchFootCollider: LibraryRect; readonly lampRect: LibraryRect;
    readonly windowRect: LibraryRect;
    readonly decorativeBookRects: readonly (LibraryRect & { readonly tone?: 'coral' | 'blue' })[];
    readonly beanbagVisualRect?: LibraryRect; readonly beanbagFootCollider?: LibraryRect;
    readonly vaseRect?: LibraryRect;
    readonly interactionPoint?: LibraryPoint;
  };
  readonly failureBoard?: {
    readonly id: 'failure-board';
    readonly visualRect: LibraryRect;
    readonly footCollider: LibraryRect;
    readonly interactionPoint: LibraryPoint;
  };
  readonly competitionBoard?: LibraryFixture & {
    readonly id: 'competition-board';
    readonly interactionPoint: LibraryPoint;
  };
  readonly obstacles: readonly LibraryRect[];
  readonly ambientObjects?: readonly LibraryAmbientObject[];
};

export type LibraryPlayer = {
  readonly studentNumber: number; readonly position: LibraryPoint;
  readonly facing: 'up' | 'down' | 'left' | 'right'; readonly isWalking: boolean;
  readonly spriteWidth: 20; readonly spriteHeight: 28;
  readonly feetCollider: { readonly width: 12; readonly height: 6 };
};

export type LibraryBookDraft = {
  readonly bookId?: string;
  readonly studentNumber: number; readonly title: string;
  readonly author: string; readonly pageCount: number;
  readonly reflection?: string;
};

export type LibraryPlacedBook = LibraryBookDraft & { readonly slotId: number };

export type LibraryTarget =
  | { readonly kind: 'ambient'; readonly id: string; readonly objectId: string; readonly interactionPoint: LibraryPoint }
  | { readonly kind: 'registration-desk'; readonly id: 'registration-desk'; readonly interactionPoint: LibraryPoint }
  | { readonly kind: 'failure-board'; readonly id: 'failure-board'; readonly interactionPoint: LibraryPoint }
  | { readonly kind: 'competition-board'; readonly id: 'competition-board'; readonly interactionPoint: LibraryPoint }
  | { readonly kind: 'reading-nook'; readonly id: 'reading-nook'; readonly interactionPoint: LibraryPoint }
  | { readonly kind: 'shelf'; readonly id: string; readonly shelfId: string; readonly interactionPoint: LibraryPoint }
  | {
    readonly kind: 'placed-book'; readonly id: string; readonly slotId: number;
    readonly shelfId: string; readonly interactionPoint: LibraryPoint; readonly book: LibraryPlacedBook;
  };

export type LibraryScene = {
  readonly player: LibraryPlayer; readonly placedBooks: readonly LibraryPlacedBook[];
  readonly carriedDraft: LibraryBookDraft | null; readonly nearbyTarget: LibraryTarget | null;
  readonly selectedSlotId: number | null; readonly timeMs: number; readonly reducedMotion: boolean;
  readonly walkTimeMs?: number;
  readonly action?: { readonly kind: 'receive' | 'place'; readonly startedAt: number; readonly slotId?: number };
  readonly seated?: boolean;
  readonly boardNoteCount?: number;
  readonly catState?: LibraryCatState;
  readonly clerkState?: { readonly timeMs: number; readonly greetingStartedAt?: number };
  readonly ambientState?: LibraryAmbientState;
  readonly ambientAction?: LibraryAmbientAction;
};

export type LibraryPlacementResult = {
  readonly placedBooks: readonly LibraryPlacedBook[]; readonly carriedDraft: LibraryBookDraft | null;
  readonly placedBook: LibraryPlacedBook | null;
};

const makeShelf = (
  id: string, variant: LibraryShelf['variant'],
  visualRect: LibraryRect, footCollider: LibraryRect,
  rows: number, columns: number,
  firstSlotId: number,
  fitBooksToRow = false,
  visualGroupId?: string,
): LibraryShelf => {
  const slots = Array.from({ length: rows * columns }, (_, index): LibrarySlot => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const horizontalInset = variant === 'wide-low' || variant === 'endcap' ? 8 : 9;
    const verticalInset = variant === 'wide-low' ? 9 : 13;
    const gap = 1;
    const slotWidth = Math.min(7, Math.floor((visualRect.width - horizontalInset * 2 - gap * (columns - 1)) / columns));
    const slotHeight = Math.floor((visualRect.height - verticalInset * 2 - 4 * (rows - 1)) / rows);
    return {
      id: firstSlotId + index,
      shelfId: id,
      row,
      column,
      rect: {
        x: visualRect.x + horizontalInset + column * (slotWidth + gap),
        y: visualRect.y + verticalInset + row * (slotHeight + 4),
        width: slotWidth,
        height: slotHeight,
      },
      interactionPoint: {
        x: visualRect.x + horizontalInset + column * (slotWidth + gap) + slotWidth / 2,
        y: footCollider.y + footCollider.height + 18,
      },
    };
  });
  return {
    id,
    variant,
    visualRect,
    footCollider,
    rows,
    columns,
    fitBooksToRow,
    visualGroupId,
    slots,
    interactionPoint: {
      x: footCollider.x + footCollider.width / 2,
      y: footCollider.y + footCollider.height + 18,
    },
  };
};

export const getLibraryBookSpineWidth = (pageCount: number): number => Math.min(7, Math.max(4, 4 + Math.round(pageCount / 150)));

const fitShelfRowWidths = (weights: readonly number[], available: number): number[] => {
  const budget = Math.min(weights.length * 7, Math.max(weights.length * 4, Math.floor(available)));
  const total = weights.reduce((sum, width) => sum + width, 0);
  const quotas = weights.map(width => width * budget / total);
  const widths = quotas.map(width => Math.min(7, Math.max(4, Math.round(width))));
  let remaining = budget - widths.reduce((sum, width) => sum + width, 0);
  while (remaining !== 0) {
    const direction = Math.sign(remaining);
    let best = -1;
    for (let index = 0; index < widths.length; index += 1) {
      if (widths[index] + direction < 4 || widths[index] + direction > 7) continue;
      if (best < 0 || direction * (quotas[index] - widths[index]) > direction * (quotas[best] - widths[best])) best = index;
    }
    if (best < 0) break;
    widths[best] += direction;
    remaining -= direction;
  }
  return widths;
};

export const resolveLibraryBookRoom = (room: LibraryRoom, books: readonly LibraryPlacedBook[]): LibraryRoom => {
  const bySlot = new Map(books.map(book => [book.slotId, book]));
  return {
    ...room,
    shelves: room.shelves.map(shelf => {
      const horizontalInset = shelf.variant === 'wide-low' || shelf.variant === 'endcap' ? 8 : 9;
      const nextX = new Map<number, number>();
      const fittedWidths = new Map<number, number>();
      if (shelf.fitBooksToRow) {
        for (let row = 0; row < shelf.rows; row += 1) {
          const slots = shelf.slots.filter(slot => slot.row === row).sort((a, b) => a.column - b.column);
          const widths = fitShelfRowWidths(slots.map(slot => {
            const book = bySlot.get(slot.id);
            return book ? getLibraryBookSpineWidth(book.pageCount) : 6;
          }), shelf.visualRect.width - horizontalInset * 2 - (slots.length - 1));
          slots.forEach((slot, index) => fittedWidths.set(slot.id, widths[index]));
        }
      }
      return {
        ...shelf,
        slots: shelf.slots.map(slot => {
          const book = bySlot.get(slot.id);
          const width = fittedWidths.get(slot.id) ?? (book ? getLibraryBookSpineWidth(book.pageCount) : 7);
          const x = nextX.get(slot.row) ?? shelf.visualRect.x + horizontalInset;
          nextX.set(slot.row, x + width + 1);
          return { ...slot, rect: { ...slot.rect, x, width }, interactionPoint: { ...slot.interactionPoint, x: x + width / 2 } };
        }),
      };
    }),
  };
};

export const createSmallLibraryRoom = (): LibraryRoom => {
  const wideShelf = makeShelf('wide-low-shelf', 'wide-low', { x: 176, y: 42, width: 180, height: 62 }, { x: 176, y: 86, width: 180, height: 18 }, 2, 6, 0);
  const tallShelf = makeShelf('narrow-tall-shelf', 'narrow-tall', { x: 398, y: 44, width: 84, height: 98 }, { x: 398, y: 124, width: 84, height: 18 }, 2, 3, 12);
  const desk = {
    id: 'registration-desk',
    visualRect: { x: 46, y: 218, width: 126, height: 66 },
    footCollider: { x: 46, y: 264, width: 126, height: 20 },
    interactionPoint: { x: 109, y: 304 },
  } satisfies LibraryRoom['desk'];
  const readingArea = {
    rug: { x: 466, y: 194, width: 130, height: 136 },
    tableVisualRect: { x: 500, y: 214, width: 68, height: 67 },
    tableFootCollider: { x: 503, y: 252, width: 62, height: 29 },
    benchVisualRect: { x: 484, y: 294, width: 96, height: 27 },
    benchFootCollider: { x: 484, y: 307, width: 96, height: 14 },
    lampRect: { x: 577, y: 173, width: 13, height: 22 },
    windowRect: { x: 510, y: 38, width: 72, height: 38 },
    decorativeBookRects: [{ x: 518, y: 224, width: 22, height: 12 }],
  } satisfies LibraryRoom['readingArea'];
  return {
    width: 624,
    height: 376,
    bounds: { x: 0, y: 0, width: 624, height: 376 },
    walkableBounds: { x: 18, y: 104, width: 588, height: 254 },
    spawn: { x: 312, y: 340 },
    shelves: [wideShelf, tallShelf],
    desk,
    readingArea,
    obstacles: [wideShelf.footCollider, tallShelf.footCollider, desk.visualRect, readingArea.tableVisualRect, readingArea.benchVisualRect, readingArea.lampRect],
  };
};

export const createFullLibraryRoom = (): LibraryRoom => {
  const baseRoom = createSmallLibraryRoom();
  const leftBookcase = makeShelf(
    'full-left-bookcase', 'wide-low',
    { x: 64, y: 44, width: 120, height: 66 },
    { x: 64, y: 98, width: 120, height: 12 },
    2, 15, 0, true, 'wall-bookcase',
  );
  const northBookcase = makeShelf(
    'full-north-bookcase', 'wide-low',
    { x: 184, y: 44, width: 85, height: 66 },
    { x: 184, y: 98, width: 85, height: 12 },
    2, 10, 30, true, 'wall-bookcase',
  );
  const islandBookcase = makeShelf(
    'full-island-bookcase', 'wide-low',
    { x: 156, y: 144, width: 85, height: 66 },
    { x: 156, y: 198, width: 85, height: 12 },
    2, 10, 50, true, 'central-bookcase',
  );
  const rightBookcase = makeShelf(
    'full-right-bookcase', 'wide-low',
    { x: 241, y: 144, width: 120, height: 66 },
    { x: 241, y: 198, width: 120, height: 12 },
    2, 15, 70, true, 'central-bookcase',
  );
  const desk = {
    id: 'registration-desk',
    visualRect: { x: 182, y: 275, width: 103, height: 45 },
    footCollider: { x: 182, y: 309, width: 103, height: 11 },
    interactionPoint: { x: 233, y: 327 },
    clerk: {
      visualRect: { x: 215, y: 244, width: 36, height: 36 },
      handoffPoint: { x: 233, y: 281 },
      counterPoint: { x: 233, y: 312 },
      receivePoint: { x: 233, y: 327 },
    },
  } satisfies LibraryRoom['desk'];
  const failureBoard = {
    id: 'failure-board',
    visualRect: { x: 353, y: 24, width: 128, height: 70 },
    footCollider: { x: 353, y: 88, width: 128, height: 6 },
    interactionPoint: { x: 417, y: 126 },
  } satisfies NonNullable<LibraryRoom['failureBoard']>;
  const competitionBoard = {
    id: 'competition-board',
    visualRect: { x: 38, y: 250, width: 108, height: 70 },
    footCollider: { x: 42, y: 306, width: 100, height: 14 },
    interactionPoint: { x: 92, y: 338 },
  } satisfies NonNullable<LibraryRoom['competitionBoard']>;
  const readingArea = {
    rug: { x: 414, y: 203, width: 185, height: 114 },
    tableVisualRect: { x: 455, y: 226, width: 70, height: 50 },
    tableFootCollider: { x: 459, y: 259, width: 62, height: 17 },
    benchVisualRect: { x: 443, y: 284, width: 96, height: 23 },
    benchFootCollider: { x: 443, y: 296, width: 96, height: 11 },
    lampRect: { x: 566, y: 218, width: 14, height: 24 },
    windowRect: { x: 524, y: 19, width: 61, height: 32 },
    decorativeBookRects: [{ x: 493, y: 238, width: 16, height: 8, tone: 'blue' }],
    beanbagVisualRect: { x: 542, y: 256, width: 43, height: 38 },
    beanbagFootCollider: { x: 546, y: 282, width: 35, height: 12 },
    vaseRect: { x: 508, y: 230, width: 10, height: 15 },
    interactionPoint: { x: 569, y: 312 },
  } satisfies LibraryRoom['readingArea'];
  const shelves: readonly LibraryShelf[] = [leftBookcase, northBookcase, islandBookcase, rightBookcase];
  const ambientObjects: readonly LibraryAmbientObject[] = [
    { id: 'wall-plant-west', kind: 'plant', visualRect: { x: 328, y: 72, width: 19, height: 29 }, interactionPoint: { x: 337, y: 118 }, actionPoint: { x: 337, y: 87 } },
    { id: 'wall-plant-east', kind: 'plant', visualRect: { x: 484, y: 72, width: 19, height: 29 }, interactionPoint: { x: 493, y: 118 }, actionPoint: { x: 493, y: 87 } },
    { id: 'reading-lamp', kind: 'lamp', visualRect: readingArea.lampRect, interactionPoint: { x: 556, y: 243 }, actionPoint: { x: 572, y: 231 } },
    { id: 'reading-bench', kind: 'bench', visualRect: readingArea.benchVisualRect, interactionPoint: { x: 491, y: 319 }, actionPoint: { x: 491, y: 297 } },
    { id: 'bookshop-cat', kind: 'cat', visualRect: { x: 365, y: 150, width: 22, height: 13 }, interactionPoint: { x: 397, y: 163 }, actionPoint: { x: 376, y: 158 } },
    { id: 'tea-set', kind: 'tea', visualRect: { x: 456, y: 230, width: 20, height: 22 }, interactionPoint: { x: 449, y: 251 }, actionPoint: { x: 462, y: 247 } },
  ];
  const exit = {
    visualRect: { x: 332, y: 322, width: 36, height: 44 },
    // Movement can stop up to one 2px substep before the south boundary.
    triggerRect: { x: 332, y: baseRoom.walkableBounds.y + baseRoom.walkableBounds.height - 2, width: 36, height: 2 },
  };
  return {
    ...baseRoom,
    desk,
    shelves,
    readingArea,
    failureBoard,
    competitionBoard,
    ambientObjects,
    spawn: { x: 350, y: 306 },
    exit,
    obstacles: [
      ...shelves.map((shelf) => shelf.footCollider),
      desk.visualRect,
      { ...desk.clerk.visualRect, height: desk.visualRect.y - desk.clerk.visualRect.y },
      failureBoard.visualRect,
      competitionBoard.footCollider,
      readingArea.tableVisualRect,
      readingArea.benchVisualRect,
      readingArea.beanbagVisualRect,
      ...ambientObjects.filter(object => object.kind === 'lamp' || object.kind === 'cat').map(object => object.visualRect),
    ],
  };
};

export const createLibraryPlayer = (room: LibraryRoom, studentNumber = 1): LibraryPlayer => ({
  studentNumber: Number.isInteger(studentNumber) && studentNumber >= 1 && studentNumber <= 23 ? studentNumber : 1,
  position: room.spawn,
  facing: 'up',
  isWalking: false,
  spriteWidth: 20,
  spriteHeight: 28,
  feetCollider: { width: 12, height: 6 },
});

const overlaps = (first: LibraryRect, second: LibraryRect): boolean => (
  first.x < second.x + second.width
  && first.x + first.width > second.x
  && first.y < second.y + second.height
  && first.y + first.height > second.y
);

const canStandAt = (room: LibraryRoom, player: LibraryPlayer, position: LibraryPoint): boolean => {
  const feet = {
    x: position.x - player.feetCollider.width / 2,
    y: position.y - player.feetCollider.height / 2,
    width: player.feetCollider.width,
    height: player.feetCollider.height,
  };
  const bounds = room.walkableBounds;
  return feet.x >= bounds.x
    && feet.y >= bounds.y
    && feet.x + feet.width <= bounds.x + bounds.width
    && feet.y + feet.height <= bounds.y + bounds.height
    && !room.obstacles.some((obstacle) => overlaps(feet, obstacle));
};

export const findLibraryPlayerPath = (
  room: LibraryRoom, player: LibraryPlayer, destination: LibraryPoint,
): readonly LibraryPoint[] | null => {
  if (!canStandAt(room, player, player.position) || !canStandAt(room, player, destination)) return null;
  const halfWidth = player.feetCollider.width / 2;
  const halfHeight = player.feetCollider.height / 2;
  const clear = (from: LibraryPoint, to: LibraryPoint) => !room.obstacles.some(rect => {
    let enter = 0;
    let leave = 1;
    for (const [origin, delta, min, max] of [
      [from.x, to.x - from.x, rect.x - halfWidth, rect.x + rect.width + halfWidth],
      [from.y, to.y - from.y, rect.y - halfHeight, rect.y + rect.height + halfHeight],
    ]) {
      if (delta === 0) {
        if (origin <= min || origin >= max) return false;
      } else {
        const first = (min - origin) / delta;
        const second = (max - origin) / delta;
        enter = Math.max(enter, Math.min(first, second));
        leave = Math.min(leave, Math.max(first, second));
      }
    }
    return enter < leave && leave > 0 && enter < 1;
  });
  if (clear(player.position, destination)) return [destination];
  const corners = room.obstacles.flatMap(rect => [
    { x: rect.x - halfWidth - 1, y: rect.y - halfHeight - 1 },
    { x: rect.x + rect.width + halfWidth + 1, y: rect.y - halfHeight - 1 },
    { x: rect.x - halfWidth - 1, y: rect.y + rect.height + halfHeight + 1 },
    { x: rect.x + rect.width + halfWidth + 1, y: rect.y + rect.height + halfHeight + 1 },
  ]).filter(point => canStandAt(room, player, point));
  const nodes = [player.position, destination, ...corners];
  const costs = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      if (!visited.has(index) && Number.isFinite(costs[index]) && (current < 0 || costs[index] < costs[current])) current = index;
    }
    if (current < 0) return null;
    if (current === 1) {
      const path: LibraryPoint[] = [];
      for (let index = 1; index !== 0; index = previous[index]) path.unshift(nodes[index]);
      return path;
    }
    visited.add(current);
    for (let index = 1; index < nodes.length; index += 1) {
      if (visited.has(index)) continue;
      const cost = costs[current] + Math.hypot(nodes[index].x - nodes[current].x, nodes[index].y - nodes[current].y);
      if (cost >= costs[index] || !clear(nodes[current], nodes[index])) continue;
      costs[index] = cost;
      previous[index] = current;
    }
  }
  return null;
};

export const stepLibraryPlayer = (
  room: LibraryRoom, player: LibraryPlayer, input: LibraryPoint,
  elapsedMs: number,
): LibraryPlayer => {
  if (![input.x, input.y, elapsedMs].every(Number.isFinite) || elapsedMs <= 0) return player;
  if (input.x === 0 && input.y === 0) return player.isWalking ? { ...player, isWalking: false } : player;
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude === 0) return player;
  const effectiveElapsedMs = Math.min(elapsedMs, 250);
  const velocity = { x: input.x / magnitude * 0.1, y: input.y / magnitude * 0.1 };
  const stepCount = Math.max(1, Math.ceil(effectiveElapsedMs * 0.1 / 2));
  let position = player.position;
  for (let index = 0; index < stepCount; index += 1) {
    const delta = { x: velocity.x * effectiveElapsedMs / stepCount, y: velocity.y * effectiveElapsedMs / stepCount };
    const nextX = { x: position.x + delta.x, y: position.y };
    if (canStandAt(room, player, nextX)) position = nextX;
    const nextY = { x: position.x, y: position.y + delta.y };
    if (canStandAt(room, player, nextY)) position = nextY;
  }
  const facing = Math.abs(input.x) > Math.abs(input.y)
    ? (input.x < 0 ? 'left' : 'right')
    : (input.y < 0 ? 'up' : 'down');
  return { ...player, position, facing, isWalking: position.x !== player.position.x || position.y !== player.position.y };
};

export const isLibraryExitIntent = (room: LibraryRoom, player: LibraryPlayer, input: LibraryPoint): boolean => {
  const trigger = room.exit?.triggerRect;
  if (!trigger || ![input.x, input.y, player.position.x, player.position.y].every(Number.isFinite)
    || input.y <= 0 || input.y < Math.abs(input.x)) return false;
  const halfWidth = player.feetCollider.width / 2;
  const feetBottom = player.position.y + player.feetCollider.height / 2;
  return player.position.x - halfWidth >= trigger.x
    && player.position.x + halfWidth <= trigger.x + trigger.width
    && feetBottom >= trigger.y
    && feetBottom <= trigger.y + trigger.height;
};

const distance = (first: LibraryPoint, second: LibraryPoint): number => Math.hypot(first.x - second.x, first.y - second.y);

export const getNearbyLibraryTarget = (
  room: LibraryRoom, player: LibraryPlayer,
  placedBooks: readonly LibraryPlacedBook[],
): LibraryTarget | null => {
  const pickerShelf = room.shelves
    .filter((shelf) => shelf.slots.length >= 20)
    .map((shelf) => ({ shelf, distance: distance(player.position, shelf.interactionPoint) }))
    .filter((candidate) => candidate.distance <= 10)
    .sort((first, second) => first.distance - second.distance)[0]?.shelf;
  if (pickerShelf) {
    return { kind: 'shelf', id: pickerShelf.id, shelfId: pickerShelf.id, interactionPoint: pickerShelf.interactionPoint };
  }
  const placedTargets = placedBooks.flatMap((book): readonly LibraryTarget[] => {
    const slot = room.shelves.flatMap((shelf) => shelf.slots).find((candidate) => candidate.id === book.slotId);
    if (!slot) return [];
    return [{ kind: 'placed-book', id: `placed-book:${book.slotId}`, slotId: book.slotId, shelfId: slot.shelfId, interactionPoint: slot.interactionPoint, book }];
  });
  const targets: readonly LibraryTarget[] = [
    ...placedTargets,
    { kind: 'registration-desk', id: room.desk.id, interactionPoint: room.desk.interactionPoint },
    ...(room.failureBoard ? [{ kind: 'failure-board', id: room.failureBoard.id, interactionPoint: room.failureBoard.interactionPoint } as const] : []),
    ...(room.competitionBoard ? [{ kind: 'competition-board', id: room.competitionBoard.id, interactionPoint: room.competitionBoard.interactionPoint } as const] : []),
    ...(room.readingArea.interactionPoint ? [{ kind: 'reading-nook', id: 'reading-nook', interactionPoint: room.readingArea.interactionPoint } as const] : []),
    ...(room.ambientObjects ?? []).map((object): LibraryTarget => ({ kind: 'ambient', id: object.id, objectId: object.id, interactionPoint: object.interactionPoint })),
    ...room.shelves.map((shelf): LibraryTarget => ({ kind: 'shelf', id: shelf.id, shelfId: shelf.id, interactionPoint: shelf.interactionPoint })),
  ];
  const facingVector = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  }[player.facing];
  const nearby = targets
    .map((target) => {
      const object = target.kind === 'ambient' ? room.ambientObjects?.find(candidate => candidate.id === target.objectId) : undefined;
      const surface = target.kind === 'registration-desk'
        ? { ...room.desk.visualRect, y: room.desk.clerk?.visualRect.y ?? room.desk.visualRect.y,
          height: room.desk.visualRect.y + room.desk.visualRect.height - (room.desk.clerk?.visualRect.y ?? room.desk.visualRect.y) }
        : target.kind === 'shelf' ? room.shelves.find(shelf => shelf.id === target.shelfId)?.visualRect
          : target.kind === 'failure-board' ? room.failureBoard?.visualRect
            : target.kind === 'competition-board' ? room.competitionBoard?.visualRect
              : target.kind === 'reading-nook' ? room.readingArea.beanbagVisualRect
                : object?.visualRect;
      const closest = surface ? {
        x: Math.max(surface.x, Math.min(surface.x + surface.width, player.position.x)),
        y: Math.max(surface.y, Math.min(surface.y + surface.height, player.position.y)),
      } : target.interactionPoint;
      const aim = object?.actionPoint ?? closest;
      const dx = aim.x - player.position.x;
      const dy = aim.y - player.position.y;
      const magnitude = Math.hypot(dx, dy);
      const inFront = magnitude === 0 || (dx * facingVector.x + dy * facingVector.y) / magnitude >= Math.SQRT1_2;
      const reach = Math.min(distance(player.position, target.interactionPoint), distance(player.position, closest) + 10);
      return { target, distance: reach, facingRank: inFront ? 0 : 1 };
    })
    .filter((candidate) => candidate.distance <= 28)
    .sort((first, second) => first.facingRank - second.facingRank || first.distance - second.distance || first.target.id.localeCompare(second.target.id))[0];
  return nearby?.target ?? null;
};

const isValidDraft = (draft: LibraryBookDraft): boolean => (
  Number.isInteger(draft.studentNumber)
  && draft.studentNumber >= 1
  && draft.studentNumber <= 23
  && draft.title.trim().length >= 1
  && draft.title.trim().length <= 50
  && draft.author.trim().length >= 1
  && draft.author.trim().length <= 30
  && Number.isInteger(draft.pageCount)
  && (!('reflection' in draft) || normalizeBookReflection(draft.reflection) !== null)
  && draft.pageCount >= (normalizeBookReflection(draft.reflection) === null ? 1 : 0)
  && draft.pageCount <= 5_000
);

export const placeLibraryDraft = (
  room: LibraryRoom, placedBooks: readonly LibraryPlacedBook[], draft: LibraryBookDraft | null,
  slotId: number,
): LibraryPlacementResult => {
  const hasSlot = Number.isInteger(slotId) && room.shelves.some((shelf) => shelf.slots.some((slot) => slot.id === slotId));
  if (!draft || !isValidDraft(draft) || !hasSlot || placedBooks.some((book) => book.slotId === slotId)) {
    return { placedBooks, carriedDraft: draft, placedBook: null };
  }
  const reflection = normalizeBookReflection(draft.reflection);
  const placedBook = { ...draft, title: draft.title.trim(), author: draft.author.trim(), ...(reflection === null ? {} : { reflection }), slotId };
  return { placedBooks: [...placedBooks, placedBook], carriedDraft: null, placedBook };
};
