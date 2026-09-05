import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createFullLibraryRoom,
  createLibraryPlayer,
  createSmallLibraryRoom,
  getNearbyLibraryTarget,
  placeLibraryDraft,
  stepLibraryPlayer,
  type LibraryBookDraft,
  type LibraryPlayer,
  type LibraryPlacedBook,
  type LibraryPoint,
  type LibraryRect,
  type LibraryRoom,
} from './canvasLibraryWorld.js';

const draft: LibraryBookDraft = {
  studentNumber: 7,
  title: '달빛 우체국',
  author: '이지은',
  pageCount: 128,
};

const playerAt = (point: LibraryPoint): LibraryPlayer => ({
  studentNumber: 1,
  position: point,
  facing: 'down',
  isWalking: false,
  spriteWidth: 20,
  spriteHeight: 28,
  feetCollider: { width: 12, height: 6 },
});

test('작은 도서관은 두 종류 선반과 20개 이하의 고유 슬롯을 제공한다', () => {
  // Given
  // When
  const room = createSmallLibraryRoom();
  const slots = room.shelves.flatMap((shelf) => shelf.slots);

  // Then
  assert.deepEqual(room.shelves.map((shelf) => shelf.variant), ['wide-low', 'narrow-tall']);
  assert.equal(slots.length > 0 && slots.length <= 20, true);
  assert.equal(new Set(slots.map((slot) => slot.id)).size, slots.length);
  assert.equal(slots.every((slot) => room.shelves.some((shelf) => shelf.id === slot.shelfId)), true);
});

test('플레이어는 벽을 넘지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = playerAt({ x: room.walkableBounds.x + 7, y: room.spawn.y });

  // When
  const moved = stepLibraryPlayer(room, player, { x: -1, y: 0 }, 1_000);

  // Then
  assert.equal(moved.position.x >= room.walkableBounds.x + moved.feetCollider.width / 2, true);
});

test('플레이어의 발은 후면 벽과 창문 평면에 진입하지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const shelfBack = room.shelves.find((shelf) => shelf.variant === 'wide-low');
  assert.ok(shelfBack);
  const floorStartY = shelfBack.visualRect.y + shelfBack.visualRect.height;
  const player = playerAt({ x: room.walkableBounds.x + 30, y: floorStartY + 20 });

  // When
  const moved = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 1_000);

  // Then
  assert.equal(moved.position.y - moved.feetCollider.height / 2 >= floorStartY, true);
  assert.equal(moved.position.y > room.readingArea.windowRect.y + room.readingArea.windowRect.height, true);
});

test('플레이어는 가구 발판을 통과하지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const obstacle = room.desk.footCollider;
  const player = playerAt({ x: obstacle.x + obstacle.width / 2, y: obstacle.y + obstacle.height + 20 });

  // When
  const moved = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 400);

  // Then
  assert.equal(moved.position.y >= obstacle.y + obstacle.height + moved.feetCollider.height / 2, true);
});

test('대각선 이동 속도는 축 이동 속도와 같다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = createLibraryPlayer(room);

  // When
  const axis = stepLibraryPlayer(room, player, { x: 1, y: 0 }, 100);
  const diagonal = stepLibraryPlayer(room, player, { x: 1, y: -1 }, 100);
  const axisDistance = Math.hypot(axis.position.x - player.position.x, axis.position.y - player.position.y);
  const diagonalDistance = Math.hypot(diagonal.position.x - player.position.x, diagonal.position.y - player.position.y);

  // Then
  assert.ok(Math.abs(axisDistance - diagonalDistance) < 0.000_001);
});

test('같은 경과 시간은 프레임 분할과 관계없이 같은 위치에 도달한다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = createLibraryPlayer(room);

  // When
  const once = stepLibraryPlayer(room, player, { x: -1, y: 0 }, 120);
  const partitioned = Array.from({ length: 12 }).reduce<LibraryPlayer>(
    (current) => stepLibraryPlayer(room, current, { x: -1, y: 0 }, 10),
    player,
  );

  // Then
  assert.ok(Math.abs(once.position.x - partitioned.position.x) < 0.000_001);
  assert.ok(Math.abs(once.position.y - partitioned.position.y) < 0.000_001);
});

test('큰 경과 시간에도 충돌 서브스텝이 가구 터널링을 막는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const obstacle = room.readingArea.tableFootCollider;
  const player = playerAt({ x: obstacle.x - 24, y: obstacle.y + obstacle.height / 2 });

  // When
  const moved = stepLibraryPlayer(room, player, { x: 1, y: 0 }, 2_000);

  // Then
  assert.equal(moved.position.x <= obstacle.x - moved.feetCollider.width / 2, true);
});

test('비정상 입력과 경과 시간은 플레이어를 오염시키지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = createLibraryPlayer(room);

  // When
  const invalidInput = stepLibraryPlayer(room, player, { x: Number.NaN, y: Infinity }, 16);
  const invalidTime = stepLibraryPlayer(room, player, { x: 1, y: 0 }, Number.NaN);
  const negativeTime = stepLibraryPlayer(room, player, { x: 1, y: 0 }, -1);

  // Then
  assert.deepEqual(invalidInput, player);
  assert.deepEqual(invalidTime, player);
  assert.deepEqual(negativeTime, player);
});

test('방향 입력을 놓으면 위치와 방향은 유지하고 걷기만 멈춘다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const moving = { ...createLibraryPlayer(room), isWalking: true };

  // When
  const stopped = stepLibraryPlayer(room, moving, { x: 0, y: 0 }, 16);

  // Then
  assert.deepEqual(stopped, { ...moving, isWalking: false });
});

test('비정상적으로 큰 경과 시간은 한 프레임 상한으로 제한된다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = createLibraryPlayer(room);

  // When
  const bounded = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 250);
  const huge = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 1_000_000);

  // Then
  assert.deepEqual(huge, bounded);
});

test('상호작용 지점 근처에서만 대상을 찾는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const nearDesk = playerAt(room.desk.interactionPoint);
  const farAway = createLibraryPlayer(room);

  // When
  const nearby = getNearbyLibraryTarget(room, nearDesk, []);
  const far = getNearbyLibraryTarget(room, farAway, []);

  // Then
  assert.equal(nearby?.kind, 'registration-desk');
  assert.equal(far, null);
});

test('유효한 초안은 빈 슬롯에 한 번만 배치된다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const slot = room.shelves[0]?.slots[0];
  assert.ok(slot);

  // When
  const first = placeLibraryDraft(room, [], draft, slot.id);
  const second = placeLibraryDraft(room, first.placedBooks, draft, slot.id);

  // Then
  assert.equal(first.placedBook?.title, draft.title);
  assert.equal(first.carriedDraft, null);
  assert.equal(first.placedBooks.length, 1);
  assert.equal(second.placedBook, null);
  assert.equal(second.carriedDraft, draft);
  assert.equal(second.placedBooks, first.placedBooks);
});

test('없거나 잘못된 초안과 슬롯은 배치 상태를 바꾸지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const slot = room.shelves[0]?.slots[0];
  assert.ok(slot);
  const invalidDrafts: readonly (LibraryBookDraft | null)[] = [
    null,
    { ...draft, title: '   ' },
    { ...draft, author: '' },
    { ...draft, pageCount: 0 },
    { ...draft, pageCount: 1.5 },
    { ...draft, studentNumber: 24 },
  ];

  // When
  // Then
  for (const invalidDraft of invalidDrafts) {
    const result = placeLibraryDraft(room, [], invalidDraft, slot.id);
    assert.equal(result.placedBook, null);
    assert.equal(result.carriedDraft, invalidDraft);
    assert.deepEqual(result.placedBooks, []);
  }
  for (const invalidSlotId of [Number.NaN, 100]) {
    const invalidSlot = placeLibraryDraft(room, [], draft, invalidSlotId);
    assert.equal(invalidSlot.placedBook, null);
    assert.equal(invalidSlot.carriedDraft, draft);
    assert.deepEqual(invalidSlot.placedBooks, []);
  }
});

test('월드 전환은 입력 객체와 배열을 변경하지 않는다', () => {
  // Given
  const room = createSmallLibraryRoom();
  const player = createLibraryPlayer(room);
  const slot = room.shelves[0]?.slots[0];
  assert.ok(slot);
  const placedBooks = [{ ...draft, slotId: slot.id }];
  const playerSnapshot = structuredClone(player);
  const booksSnapshot = structuredClone(placedBooks);

  // When
  stepLibraryPlayer(room, player, { x: 1, y: 0 }, 16);
  placeLibraryDraft(room, placedBooks, draft, room.shelves[0]?.slots[1]?.id ?? -1);

  // Then
  assert.deepEqual(player, playerSnapshot);
  assert.deepEqual(placedBooks, booksSnapshot);
});

const overlapsRect = (first: LibraryRect, second: LibraryRect): boolean => (
  first.x < second.x + second.width && first.x + first.width > second.x
  && first.y < second.y + second.height && first.y + first.height > second.y
);

const collectReachablePlayers = (room: LibraryRoom): readonly LibraryPlayer[] => {
  const initial = createLibraryPlayer(room);
  const queue: LibraryPlayer[] = [initial];
  const reached: LibraryPlayer[] = [initial];
  const visited = new Set([`${initial.position.x},${initial.position.y}`]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (!current) continue;
    for (const input of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
      const next = stepLibraryPlayer(room, current, input, 40);
      const key = `${Math.round(next.position.x)},${Math.round(next.position.y)}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
      reached.push(next);
    }
  }
  return reached;
};

test('전체 도서관은 입구 근처 데스크와 네 가지 실루엣의 책장을 제공한다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const slots = room.shelves.flatMap((shelf) => shelf.slots);
  const deskDistance = Math.hypot(room.spawn.x - room.desk.interactionPoint.x, room.spawn.y - room.desk.interactionPoint.y);

  // Then
  assert.equal(room.shelves.length, 4);
  assert.deepEqual(room.shelves.map((shelf) => shelf.slots.length), [30, 20, 20, 30]);
  assert.deepEqual(room.shelves.map((shelf) => [shelf.rows, shelf.columns]), [[5, 6], [2, 10], [2, 10], [5, 6]]);
  assert.deepEqual(room.shelves.map((shelf) => shelf.variant), ['narrow-tall', 'wide-low', 'endcap', 'compact']);
  assert.equal(new Set(room.shelves.map((shelf) => `${shelf.visualRect.width}x${shelf.visualRect.height}`)).size, 4);
  assert.deepEqual(slots.map((slot) => slot.id), Array.from({ length: 100 }, (_, index) => index));
  assert.equal(slots.length, 100);
  assert.equal(deskDistance <= 28, true);
});

test('빈백 앞에서는 독서 코너를 열 수 있고 빈백 안으로 걸어 들어가지는 않는다', () => {
  const room = createFullLibraryRoom();
  const player = playerAt({ x: 548, y: 332 });
  assert.equal(getNearbyLibraryTarget(room, player, [])?.kind, 'reading-nook');
  const moved = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 250);
  const beanbag = room.readingArea.beanbagFootCollider;
  assert.ok(beanbag);
  assert.ok(moved.position.y >= beanbag.y + beanbag.height + player.feetCollider.height / 2);
});

test('전체 도서관의 인접 슬롯은 1~3px 간격의 6px 이상 조밀한 책등 폭을 유지한다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const slotWidths = room.shelves.flatMap((shelf) => shelf.slots.map((slot) => slot.rect.width));
  const gaps = room.shelves.flatMap((shelf) => shelf.slots.flatMap((slot) => {
    const next = shelf.slots.find((candidate) => candidate.row === slot.row && candidate.column === slot.column + 1);
    return next ? [next.rect.x - slot.rect.x - slot.rect.width] : [];
  }));

  // Then
  assert.equal(slotWidths.every((width) => width >= 6), true);
  assert.equal(gaps.every((gap) => gap >= 1 && gap <= 3), true);
});

test('전체 도서관의 실패 이야기 게시판은 상호작용 범위 안에서 독립 대상으로 선택된다', () => {
  // Given
  const room = createFullLibraryRoom();
  assert.ok(room.failureBoard);

  // When
  const nearby = getNearbyLibraryTarget(room, playerAt(room.failureBoard.interactionPoint), []);

  // Then
  assert.equal(nearby?.kind, 'failure-board');
  assert.equal(nearby?.id, 'failure-board');
  assert.equal(room.failureBoard.visualRect.y + room.failureBoard.visualRect.height, room.walkableBounds.y);
  assert.equal(room.failureBoard.visualRect.width >= 120 && room.failureBoard.visualRect.height >= 70, true);
});

test('전체 도서관의 독서 코너는 러그·테이블·벤치·조명을 하나의 영역으로 묶고 발판을 추적한다', () => {
  const room = createFullLibraryRoom();
  const area = room.readingArea;

  assert.equal(area.tableVisualRect.x >= area.rug.x && area.tableVisualRect.y >= area.rug.y, true);
  assert.equal(area.benchVisualRect.x >= area.rug.x && area.benchVisualRect.y >= area.rug.y, true);
  assert.equal(area.lampRect.x >= area.rug.x && area.lampRect.x < area.rug.x + area.rug.width, true);
  assert.equal(room.obstacles.includes(area.tableFootCollider), true);
  assert.equal(room.obstacles.includes(area.benchFootCollider), true);
  assert.ok(area.beanbagVisualRect);
  assert.ok(area.beanbagFootCollider);
  assert.ok(area.vaseRect);
  assert.equal(area.beanbagVisualRect.x >= area.rug.x && area.beanbagVisualRect.y >= area.rug.y, true);
  assert.equal(area.beanbagVisualRect.x + area.beanbagVisualRect.width <= area.rug.x + area.rug.width, true);
  assert.equal(room.obstacles.includes(area.beanbagFootCollider), true);
  assert.equal(overlapsRect(area.beanbagFootCollider, area.tableFootCollider), false);
  assert.equal(overlapsRect(area.beanbagFootCollider, area.benchFootCollider), false);
});

test('렌더러는 전체 방에서도 독서 코너와 꽃병·빈백을 실제 레이어로 그린다', async () => {
  const source = await readFile(new URL('../components/student/library/CanvasLibraryRenderer.ts', import.meta.url), 'utf8');

  assert.match(source, /drawRug\(context, room\.readingArea\.rug\);/);
  assert.match(source, /drawLamp\(context, room\.readingArea\.lampRect\);/);
  assert.match(source, /id: 'reading-beanbag'[\s\S]*drawBeanbag\(context, beanbagRect\)/);
  assert.match(source, /id: 'reading-vase'[\s\S]*drawVase\(context, vaseRect\)/);
  assert.doesNotMatch(source, /if \(!room\.failureBoard\) \{[\s\S]{0,500}reading-table/);
});

test('게시판 종이는 프레임 크기로 계산하고 선반별 키치 트림을 구분한다', async () => {
  const source = await readFile(new URL('../components/student/library/CanvasLibraryRenderer.ts', import.meta.url), 'utf8');

  assert.match(source, /const cellWidth = Math\.max\(7, Math\.floor\(\(rect\.width - horizontalPadding \* 2\) \/ columns\)\)/);
  assert.match(source, /const cellHeight = Math\.max\(9, Math\.floor\(\(rect\.height - topPadding - bottomPadding\) \/ rows\)\)/);
  assert.match(source, /drawFailureBoardNotes\(context, room\.failureBoard\.visualRect, scene\.boardNoteCount\)/);
  assert.doesNotMatch(source, /x \+ 122/);
  assert.match(source, /shelf\.variant === 'wide-low'[\s\S]{0,300}palette\.bookBlue/);
  assert.match(source, /shelf\.variant === 'compact'[\s\S]{0,300}palette\.lavender/);
  assert.match(source, /shelf\.variant === 'endcap'[\s\S]{0,300}palette\.green/);
});

test('전체 도서관의 모든 슬롯은 해당 선반 실루엣 안에 있다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const contained = room.shelves.every((shelf) => shelf.slots.every((slot) => (
    slot.shelfId === shelf.id && slot.rect.x >= shelf.visualRect.x && slot.rect.y >= shelf.visualRect.y
    && slot.rect.x + slot.rect.width <= shelf.visualRect.x + shelf.visualRect.width
    && slot.rect.y + slot.rect.height <= shelf.visualRect.y + shelf.visualRect.height
  )));

  // Then
  assert.equal(contained, true);
});

test('전체 도서관의 가구 발판은 서로 겹치지 않고 하나의 이동 그래프를 남긴다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const hasOverlap = room.obstacles.some((obstacle, index) => room.obstacles.slice(index + 1).some((other) => overlapsRect(obstacle, other)));
  const reached = collectReachablePlayers(room);
  const allTargetsReachable = room.shelves.flatMap((shelf) => shelf.slots).every((slot) => (
    reached.some((player) => Math.hypot(player.position.x - slot.interactionPoint.x, player.position.y - slot.interactionPoint.y) <= 28)
  ));

  // Then
  assert.equal(hasOverlap, false);
  assert.equal(allTargetsReachable, true);
});

test('아래쪽 순위판은 입구에서 걸어 닿으며 100칸 책장 동선을 유지한다', () => {
  // Given
  const room = createFullLibraryRoom();
  const books = room.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, slotId: slot.id }));
  const reached = collectReachablePlayers(room);

  // When
  const targets = reached.map(player => getNearbyLibraryTarget(room, player, books));

  // Then
  assert.ok(targets.some(target => target?.kind === 'competition-board'));
  assert.equal(books.length, 100);
  for (const shelf of room.shelves) assert.ok(targets.some(target => target?.id === shelf.id));
  assert.ok(targets.some(target => target?.id === 'registration-desk'));
  assert.ok(targets.some(target => target?.id === 'reading-nook'));
  assert.ok(targets.some(target => target?.id === 'failure-board'));
});

test('100권 배치 후 101번째 배치는 기존 상태와 초안을 보존한다', () => {
  // Given
  const room = createFullLibraryRoom();
  const slots = room.shelves.flatMap((shelf) => shelf.slots);

  // When
  const full = slots.reduce<readonly LibraryPlacedBook[]>(
    (books, slot) => placeLibraryDraft(room, books, { ...draft, title: `책 ${slot.id}` }, slot.id).placedBooks,
    [],
  );
  const rejectedDraft = { ...draft, title: '101번째 책' };
  const rejected = placeLibraryDraft(room, full, rejectedDraft, slots[0]?.id ?? Number.NaN);

  // Then
  assert.equal(full.length, 100);
  assert.equal(rejected.placedBook, null);
  assert.equal(rejected.placedBooks, full);
  assert.equal(rejected.carriedDraft, rejectedDraft);
});

test('모든 슬롯이 차도 네 책장·데스크·게시판은 이동으로 닿을 수 있다', () => {
  // Given
  const room = createFullLibraryRoom();
  const books = room.shelves.flatMap((shelf) => shelf.slots).map((slot) => ({ ...draft, title: `책 ${slot.id}`, slotId: slot.id }));
  const reached = collectReachablePlayers(room);

  // When
  const shelfTargets = room.shelves.flatMap((shelf) => [-4, 0, 4].flatMap((offsetX) => [-4, 0, 4].map((offsetY) => {
    const approach = { x: shelf.interactionPoint.x + offsetX, y: shelf.interactionPoint.y + offsetY };
    const nearest = reached.reduce((best, player) => (
      Math.hypot(player.position.x - approach.x, player.position.y - approach.y)
      < Math.hypot(best.position.x - approach.x, best.position.y - approach.y) ? player : best
    ));
    return getNearbyLibraryTarget(room, nearest, books);
  })));
  const board = room.failureBoard;
  assert.ok(board);
  const boardTarget = getNearbyLibraryTarget(room, reached.reduce((best, player) => (
    Math.hypot(player.position.x - board.interactionPoint.x, player.position.y - board.interactionPoint.y)
    < Math.hypot(best.position.x - board.interactionPoint.x, best.position.y - board.interactionPoint.y) ? player : best
  )), books);
  const deskTarget = getNearbyLibraryTarget(room, reached.reduce((best, player) => (
    Math.hypot(player.position.x - room.desk.interactionPoint.x, player.position.y - room.desk.interactionPoint.y)
    < Math.hypot(best.position.x - room.desk.interactionPoint.x, best.position.y - room.desk.interactionPoint.y) ? player : best
  )), books);

  // Then
  assert.equal(shelfTargets.every((target) => target?.kind === 'shelf'), true);
  assert.deepEqual(
    shelfTargets.filter((_, index) => index % 9 === 0).map((target) => target?.id),
    room.shelves.map((shelf) => shelf.id),
  );
  assert.equal(boardTarget?.kind, 'failure-board');
  assert.equal(deskTarget?.kind, 'registration-desk');
});

test('피커 중심 밖의 책과 소형방 책은 기존처럼 직접 조회한다', () => {
  // Given
  const fullRoom = createFullLibraryRoom();
  const smallRoom = createSmallLibraryRoom();
  const fullSlot = fullRoom.shelves[0]?.slots[0];
  const smallSlot = smallRoom.shelves[1]?.slots[1];
  assert.ok(fullSlot);
  assert.ok(smallSlot);

  // When
  const fullTarget = getNearbyLibraryTarget(fullRoom, playerAt(fullSlot.interactionPoint), [{ ...draft, slotId: fullSlot.id }]);
  const smallTarget = getNearbyLibraryTarget(smallRoom, playerAt(smallSlot.interactionPoint), [{ ...draft, slotId: smallSlot.id }]);

  // Then
  assert.equal(fullTarget?.kind, 'placed-book');
  assert.equal(smallTarget?.kind, 'placed-book');
});
