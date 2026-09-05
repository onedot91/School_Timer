import { normalizeBookReflection } from './studentLife.js';

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
  readonly slots: readonly LibrarySlot[]; readonly interactionPoint: LibraryPoint;
};
type LibraryFixture = {
  readonly visualRect: LibraryRect; readonly footCollider: LibraryRect;
};

export type LibraryRoom = {
  readonly width: 624; readonly height: 376;
  readonly bounds: LibraryRect; readonly walkableBounds: LibraryRect;
  readonly spawn: LibraryPoint; readonly shelves: readonly LibraryShelf[];
  readonly desk: LibraryFixture & {
    readonly id: 'registration-desk';
    readonly interactionPoint: LibraryPoint;
  };
  readonly readingArea: {
    readonly rug: LibraryRect; readonly tableVisualRect: LibraryRect;
    readonly tableFootCollider: LibraryRect; readonly benchVisualRect: LibraryRect;
    readonly benchFootCollider: LibraryRect; readonly lampRect: LibraryRect;
    readonly windowRect: LibraryRect;
    readonly decorativeBookRects: readonly LibraryRect[];
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
  readonly action?: { readonly kind: 'receive' | 'place'; readonly startedAt: number; readonly slotId?: number };
  readonly seated?: boolean;
  readonly boardNoteCount?: number;
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
): LibraryShelf => {
  const slots = Array.from({ length: rows * columns }, (_, index): LibrarySlot => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const horizontalInset = variant === 'wide-low' || variant === 'endcap' ? 8 : 9;
    const verticalInset = variant === 'wide-low' ? 9 : 13;
    const gap = columns >= 10 ? 2 : 3;
    const slotWidth = Math.floor((visualRect.width - horizontalInset * 2 - gap * (columns - 1)) / columns);
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
    slots,
    interactionPoint: {
      x: footCollider.x + footCollider.width / 2,
      y: footCollider.y + footCollider.height + 18,
    },
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
    obstacles: [wideShelf.footCollider, tallShelf.footCollider, desk.footCollider, readingArea.tableFootCollider, readingArea.benchFootCollider],
  };
};

export const createFullLibraryRoom = (): LibraryRoom => {
  const baseRoom = createSmallLibraryRoom();
  const leftBookcase = makeShelf(
    'full-left-bookcase', 'narrow-tall',
    { x: 30, y: 58, width: 102, height: 150 },
    { x: 30, y: 190, width: 102, height: 18 },
    5, 6, 0,
  );
  const northBookcase = makeShelf(
    'full-north-bookcase', 'wide-low',
    { x: 157, y: 47, width: 162, height: 82 },
    { x: 157, y: 111, width: 162, height: 18 },
    2, 10, 30,
  );
  const islandBookcase = makeShelf(
    'full-island-bookcase', 'endcap',
    { x: 195, y: 186, width: 150, height: 74 },
    { x: 195, y: 244, width: 150, height: 16 },
    2, 10, 50,
  );
  const rightBookcase = makeShelf(
    'full-right-bookcase', 'compact',
    { x: 506, y: 64, width: 88, height: 150 },
    { x: 506, y: 196, width: 88, height: 18 },
    5, 6, 70,
  );
  const desk = {
    id: 'registration-desk',
    visualRect: { x: 221, y: 281, width: 103, height: 45 },
    footCollider: { x: 221, y: 315, width: 103, height: 11 },
    interactionPoint: { x: 272, y: 346 },
  } satisfies LibraryRoom['desk'];
  const failureBoard = {
    id: 'failure-board',
    visualRect: { x: 353, y: 30, width: 128, height: 74 },
    footCollider: { x: 353, y: 98, width: 128, height: 6 },
    interactionPoint: { x: 417, y: 126 },
  } satisfies NonNullable<LibraryRoom['failureBoard']>;
  const competitionBoard = {
    id: 'competition-board',
    visualRect: { x: 52, y: 244, width: 108, height: 70 },
    footCollider: { x: 56, y: 300, width: 100, height: 14 },
    interactionPoint: { x: 106, y: 332 },
  } satisfies NonNullable<LibraryRoom['competitionBoard']>;
  const readingArea = {
    rug: { x: 393, y: 223, width: 185, height: 114 },
    tableVisualRect: { x: 434, y: 246, width: 70, height: 50 },
    tableFootCollider: { x: 438, y: 279, width: 62, height: 17 },
    benchVisualRect: { x: 422, y: 304, width: 96, height: 23 },
    benchFootCollider: { x: 422, y: 316, width: 96, height: 11 },
    lampRect: { x: 545, y: 238, width: 14, height: 24 },
    windowRect: { x: 524, y: 19, width: 61, height: 32 },
    decorativeBookRects: [{ x: 449, y: 255, width: 20, height: 10 }, { x: 472, y: 258, width: 16, height: 8 }],
    beanbagVisualRect: { x: 521, y: 276, width: 43, height: 38 },
    beanbagFootCollider: { x: 525, y: 302, width: 35, height: 12 },
    vaseRect: { x: 487, y: 250, width: 10, height: 15 },
    interactionPoint: { x: 548, y: 332 },
  } satisfies LibraryRoom['readingArea'];
  const shelves: readonly LibraryShelf[] = [leftBookcase, northBookcase, islandBookcase, rightBookcase];
  return {
    ...baseRoom,
    desk,
    shelves,
    readingArea,
    failureBoard,
    competitionBoard,
    spawn: { x: 298, y: 340 },
    obstacles: [
      ...shelves.map((shelf) => shelf.footCollider),
      desk.footCollider,
      failureBoard.footCollider,
      competitionBoard.footCollider,
      readingArea.tableFootCollider,
      readingArea.benchFootCollider,
      readingArea.beanbagFootCollider,
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
    ...room.shelves.map((shelf): LibraryTarget => ({ kind: 'shelf', id: shelf.id, shelfId: shelf.id, interactionPoint: shelf.interactionPoint })),
  ];
  const nearby = targets
    .map((target) => ({ target, distance: distance(player.position, target.interactionPoint) }))
    .filter((candidate) => candidate.distance <= 28)
    .sort((first, second) => first.distance - second.distance)[0];
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
