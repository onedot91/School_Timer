import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createFullLibraryRoom,
  createLibraryPlayer,
  createSmallLibraryRoom,
  getNearbyLibraryTarget,
  findLibraryPlayerPath,
  getLibraryBookSpineWidth,
  resolveLibraryBookRoom,
  isLibraryExitIntent,
  placeLibraryDraft,
  stepLibraryPlayer,
  type LibraryBookDraft,
  type LibraryAmbientObject,
  type LibraryPlayer,
  type LibraryPlacedBook,
  type LibraryPoint,
  type LibraryRect,
  type LibraryRoom,
} from './canvasLibraryWorld.js';
import { getLibraryPlacedBookRect } from './canvasLibraryPose.js';

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

test('등록대 직원은 상단 책장과 분리되고 책 받기와 양옆 통로는 접근 가능하다', () => {
  const room = createFullLibraryRoom();
  const clerk = room.desk.clerk;
  assert.ok(clerk);
  assert.equal(createSmallLibraryRoom().desk.clerk, undefined);
  assert.ok(room.obstacles.some(rect => rect.x === clerk.visualRect.x && rect.y === clerk.visualRect.y
    && rect.width === clerk.visualRect.width && rect.y + rect.height === room.desk.visualRect.y));
  const island = room.shelves.find(shelf => shelf.id === 'full-island-bookcase');
  assert.ok(island);
  assert.ok(clerk.visualRect.y >= island.visualRect.y + island.visualRect.height);
  assert.deepEqual(clerk.receivePoint, room.desk.interactionPoint);
  const receivePlayer = playerAt(clerk.receivePoint);
  assert.deepEqual(stepLibraryPlayer(room, receivePlayer, { x: 1, y: 0 }, 10).position, { x: clerk.receivePoint.x + 1, y: clerk.receivePoint.y });
  for (const x of [clerk.visualRect.x - 8, clerk.visualRect.x + clerk.visualRect.width + 8]) {
    const player = playerAt({ x, y: 261 });
    assert.ok(stepLibraryPlayer(room, player, { x: 0, y: 1 }, 50).position.y > player.position.y);
  }
  assert.deepEqual(room.shelves.flatMap(shelf => shelf.slots).map(slot => slot.id), Array.from({ length: 100 }, (_, id) => id));
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

test('전체 도서관은 기존 100개 슬롯을 두 연결 서가의 네 구획으로 제공한다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const slots = room.shelves.flatMap((shelf) => shelf.slots);
  const deskDistance = Math.hypot(room.spawn.x - room.desk.interactionPoint.x, room.spawn.y - room.desk.interactionPoint.y);

  // Then
  assert.equal(room.shelves.length, 4);
  assert.deepEqual(room.shelves.map((shelf) => shelf.slots.length), [30, 20, 20, 30]);
  assert.deepEqual(room.shelves.map((shelf) => [shelf.rows, shelf.columns]), [[2, 15], [2, 10], [2, 10], [2, 15]]);
  assert.deepEqual(room.shelves.map((shelf) => shelf.variant), ['wide-low', 'wide-low', 'wide-low', 'wide-low']);
  assert.equal(new Set(room.shelves.map((shelf) => `${shelf.visualRect.width}x${shelf.visualRect.height}`)).size, 2);
  assert.deepEqual(room.shelves.map(shelf => shelf.visualGroupId), ['wall-bookcase', 'wall-bookcase', 'central-bookcase', 'central-bookcase']);
  for (const [left, right] of [[room.shelves[0], room.shelves[1]], [room.shelves[2], room.shelves[3]]]) {
    assert.equal(left.visualRect.x + left.visualRect.width, right.visualRect.x);
    assert.equal(left.visualRect.y, right.visualRect.y);
    assert.equal(left.visualRect.width + right.visualRect.width, 205);
    assert.equal(left.visualRect.height, 66);
  }
  assert.deepEqual(slots.map((slot) => slot.id), Array.from({ length: 100 }, (_, index) => index));
  assert.equal(slots.length, 100);
  assert.equal(deskDistance <= 128, true);
  assert.ok(room.desk.visualRect.x + room.desk.visualRect.width < room.spawn.x);
});

test('빈백 앞에서는 독서 코너를 열 수 있고 빈백 안으로 걸어 들어가지는 않는다', () => {
  const room = createFullLibraryRoom();
  assert.ok(room.readingArea.interactionPoint);
  const player = playerAt(room.readingArea.interactionPoint);
  assert.equal(getNearbyLibraryTarget(room, player, [])?.kind, 'reading-nook');
  const moved = stepLibraryPlayer(room, player, { x: 0, y: -1 }, 250);
  const beanbag = room.readingArea.beanbagFootCollider;
  assert.ok(beanbag);
  assert.ok(moved.position.y >= beanbag.y + beanbag.height + player.feetCollider.height / 2);
});

test('전체 도서관의 인접 슬롯은 1px 간격의 최대 7px 책등 폭을 유지한다', () => {
  // Given
  const room = createFullLibraryRoom();

  // When
  const slotWidths = room.shelves.flatMap((shelf) => shelf.slots.map((slot) => slot.rect.width));
  const gaps = room.shelves.flatMap((shelf) => shelf.slots.flatMap((slot) => {
    const next = shelf.slots.find((candidate) => candidate.row === slot.row && candidate.column === slot.column + 1);
    return next ? [next.rect.x - slot.rect.x - slot.rect.width] : [];
  }));

  // Then
  assert.equal(slotWidths.every((width) => width >= 4 && width <= 7), true);
  assert.equal(gaps.every((gap) => gap === 1), true);
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
  assert.ok(room.failureBoard.visualRect.y + room.failureBoard.visualRect.height <= room.walkableBounds.y - 10);
  assert.equal(room.failureBoard.visualRect.width >= 120 && room.failureBoard.visualRect.height >= 70, true);
});

test('전체 도서관의 독서 코너는 러그·테이블·벤치·조명을 하나의 영역으로 묶고 발판을 추적한다', () => {
  const room = createFullLibraryRoom();
  const area = room.readingArea;

  assert.equal(area.tableVisualRect.x >= area.rug.x && area.tableVisualRect.y >= area.rug.y, true);
  assert.equal(area.benchVisualRect.x >= area.rug.x && area.benchVisualRect.y >= area.rug.y, true);
  assert.equal(area.lampRect.x >= area.rug.x && area.lampRect.x < area.rug.x + area.rug.width, true);
  assert.equal(room.obstacles.includes(area.tableVisualRect), true);
  assert.equal(room.obstacles.includes(area.benchVisualRect), true);
  assert.ok(area.beanbagVisualRect);
  assert.ok(area.beanbagFootCollider);
  assert.ok(area.vaseRect);
  assert.equal(area.beanbagVisualRect.x >= area.rug.x && area.beanbagVisualRect.y >= area.rug.y, true);
  assert.equal(area.beanbagVisualRect.x + area.beanbagVisualRect.width <= area.rug.x + area.rug.width, true);
  assert.equal(room.obstacles.includes(area.beanbagVisualRect), true);
  assert.equal(overlapsRect(area.beanbagFootCollider, area.tableFootCollider), false);
  assert.equal(overlapsRect(area.beanbagFootCollider, area.benchFootCollider), false);
});

test('렌더러는 전체 방에서도 독서 코너와 꽃병·빈백을 실제 레이어로 그린다', async () => {
  const source = await readFile(new URL('../components/student/library/CanvasLibraryRenderer.ts', import.meta.url), 'utf8');

  assert.match(source, /drawRug\(context, room\.readingArea\.rug\);/);
  assert.match(source, /drawLamp\(context, room\.readingArea\.lampRect\)/);
  assert.match(source, /drawLamp\(context, object\.visualRect, scene\.ambientState\?\.lampOn !== false, object\.actionPoint\)/);
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
  assert.match(source, /shelf\.variant === 'endcap'[\s\S]{0,300}palette\.timber/);
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

test('입구에서 중앙 서가 양옆으로 돌아 벽 서가까지 이동하며 34px 통로를 유지한다', () => {
  const room = createFullLibraryRoom();
  const wall = room.shelves.filter(shelf => shelf.visualGroupId === 'wall-bookcase');
  const central = room.shelves.filter(shelf => shelf.visualGroupId === 'central-bookcase');
  assert.equal(central[0].visualRect.y - wall[0].visualRect.y - wall[0].visualRect.height, 34);
  assert.equal(room.readingArea.rug.x - Math.max(...central.map(shelf => shelf.visualRect.x + shelf.visualRect.width)), 53);
  for (const sideX of [130, 400]) {
    let player = createLibraryPlayer(room);
    for (const destination of [{ x: room.spawn.x, y: 240 }, { x: sideX, y: 240 }, { x: sideX, y: 130 }]) {
      for (let step = 0; step < 30; step += 1) {
        const dx = destination.x - player.position.x;
        const dy = destination.y - player.position.y;
        if (Math.hypot(dx, dy) < 0.001) break;
        const next = stepLibraryPlayer(room, player, { x: Math.abs(dx) < 0.001 ? 0 : Math.sign(dx), y: Math.abs(dy) < 0.001 ? 0 : Math.sign(dy) }, Math.min(25, Math.hypot(dx, dy)) * 10);
        assert.notDeepEqual(next.position, player.position);
        player = next;
      }
      assert.ok(Math.hypot(player.position.x - destination.x, player.position.y - destination.y) < 1e-8);
    }
  }
});

test('빈 책방과 100권 책방에서 실제 이동으로 모든 책장과 시설을 선택할 수 있다', () => {
  const room = createFullLibraryRoom();
  const reached = collectReachablePlayers(room);
  const filledBooks = room.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, slotId: slot.id }));
  const expectedIds = [...room.shelves.map(shelf => shelf.id), 'registration-desk', 'competition-board', 'failure-board', 'reading-nook', ...(room.ambientObjects ?? []).map(object => object.id)];

  for (const object of room.ambientObjects ?? []) {
    assert.ok(reached.some(player => Math.hypot(player.position.x - object.interactionPoint.x, player.position.y - object.interactionPoint.y) <= 4), `${object.id} 접근 위치가 충돌로 막힘`);
  }

  for (const books of [[], filledBooks]) {
    const selectedIds = new Set<string>();
    for (const player of reached) {
      for (const facing of ['up', 'down', 'left', 'right'] as const) {
        const target = getNearbyLibraryTarget(room, { ...player, facing }, books);
        if (target) selectedIds.add(target.id);
      }
      if (expectedIds.every(id => selectedIds.has(id))) break;
    }
    for (const id of expectedIds) assert.ok(selectedIds.has(id), `${books.length}권: ${id}에 닿지 못함`);
  }
});

test('붉은 책을 없애고 차 세트를 독서 테이블 안에 배치한다', () => {
  const room = createFullLibraryRoom();
  const objects = room.ambientObjects ?? [];
  assert.equal(objects.length, 6);
  assert.equal(new Set(objects.map(object => object.id)).size, 6);
  assert.equal(objects.find(object => object.kind === 'bench')?.visualRect, room.readingArea.benchVisualRect);
  assert.equal(objects.find(object => object.kind === 'lamp')?.visualRect, room.readingArea.lampRect);
  assert.equal(objects.some(object => object.id === 'table-book'), false);
  assert.equal(room.readingArea.decorativeBookRects.length, 1);
  assert.equal(room.readingArea.decorativeBookRects[0].tone, 'blue');
  const tea = objects.find(object => object.kind === 'tea');
  const cat = objects.find(object => object.kind === 'cat');
  assert.ok(tea);
  assert.ok(cat);
  assert.equal(room.obstacles.length, 13);
  assert.ok(cat.visualRect.y + cat.visualRect.height < room.readingArea.rug.y);
  const table = room.readingArea.tableVisualRect;
  assert.ok(tea.visualRect.x >= table.x);
  assert.ok(tea.visualRect.x + tea.visualRect.width < room.readingArea.decorativeBookRects[0].x);
  assert.ok(tea.visualRect.y >= table.y);
  assert.ok(tea.visualRect.y + tea.visualRect.height <= table.y + table.height);
  const walkedPastCat = stepLibraryPlayer(room, playerAt(cat.interactionPoint), { x: -1, y: 0 }, 250);
  assert.ok(walkedPastCat.position.x >= cat.visualRect.x + cat.visualRect.width + walkedPastCat.feetCollider.width / 2);
  assert.equal(createSmallLibraryRoom().ambientObjects, undefined);
});

test('독서 테이블 왼쪽에서 오른쪽을 보면 빈 책방과 100권 책방 모두 차 세트를 고른다', () => {
  const room = createFullLibraryRoom();
  const tea = room.ambientObjects?.find(object => object.kind === 'tea');
  assert.ok(tea);
  const books = room.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, slotId: slot.id }));
  for (const placedBooks of [[], books]) {
    const target = getNearbyLibraryTarget(room, { ...playerAt(tea.interactionPoint), facing: 'right' }, placedBooks);
    assert.equal(target?.kind, 'ambient');
    assert.equal(target?.id, tea.id);
  }
});

test('생활 대상 선택은 바라보는 방향, 거리, 고정 ID 순이며 28px 밖은 제외한다', () => {
  const base = createSmallLibraryRoom();
  const player = { ...createLibraryPlayer(base), facing: 'left' as const };
  const makeObject = (id: string, x: number, y = 340): LibraryAmbientObject => ({
    id, kind: 'cat', visualRect: { x, y, width: 8, height: 8 }, interactionPoint: { x, y }, actionPoint: { x, y },
  });
  const pick = (objects: readonly LibraryAmbientObject[]) => getNearbyLibraryTarget({ ...base, ambientObjects: objects }, player, []);
  assert.equal(pick([makeObject('closer-behind', 314), makeObject('ahead', 292)])?.id, 'ahead');
  assert.equal(pick([makeObject('far', 292), makeObject('near', 302)])?.id, 'near');
  assert.equal(pick([makeObject('z-cat', 302, 338), makeObject('a-cat', 302, 342)])?.id, 'a-cat');
  assert.equal(pick([makeObject('a-cat', 302, 342), makeObject('z-cat', 302, 338)])?.id, 'a-cat');
  assert.equal(pick([makeObject('boundary', 284)])?.id, 'boundary');
  assert.equal(pick([makeObject('outside', 283)]), null);
});

test('생활 대상이 옆에 있어도 책장 중심 10px 안에서는 피커를 우선한다', () => {
  const room = createFullLibraryRoom();
  const shelf = room.shelves[0];
  assert.ok(shelf);
  const object: LibraryAmbientObject = { id: 'near-cat', kind: 'cat', visualRect: { ...shelf.interactionPoint, width: 8, height: 8 }, interactionPoint: shelf.interactionPoint };
  const target = getNearbyLibraryTarget({ ...room, ambientObjects: [object] }, playerAt(shelf.interactionPoint), []);
  assert.equal(target?.kind, 'shelf');
  assert.equal(target?.id, shelf.id);
});

test('서가와 등록대는 앞뒤와 양옆에서 E 대상으로 선택할 수 있다', () => {
  const room = createFullLibraryRoom();
  const cases: readonly [LibraryPoint, string][] = [
    [{ x: 148, y: 178 }, 'full-island-bookcase'],
    [{ x: 190, y: 130 }, 'full-island-bookcase'],
    [{ x: 190, y: 226 }, 'full-island-bookcase'],
    [{ x: 369, y: 190 }, 'full-right-bookcase'],
    [{ x: 174, y: 300 }, 'registration-desk'],
    [{ x: 293, y: 300 }, 'registration-desk'],
    [{ x: 233, y: 238 }, 'registration-desk'],
    [{ x: 233, y: 327 }, 'registration-desk'],
  ];
  for (const [position, id] of cases) {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      const target = getNearbyLibraryTarget(room, { ...playerAt(position), facing }, []);
      assert.equal(target?.id, id, `${id} at ${JSON.stringify(position)} facing ${facing}`);
    }
  }
});

test('다른 방향에서 선택한 생활 동작과 책 받기는 가구를 돌아 정확한 접근점에 닿는다', () => {
  const room = createFullLibraryRoom();
  const lamp = room.ambientObjects!.find(object => object.kind === 'lamp')!;
  const bench = room.ambientObjects!.find(object => object.kind === 'bench')!;
  const tea = room.ambientObjects!.find(object => object.kind === 'tea')!;
  const journeys: readonly [LibraryPoint, LibraryPoint][] = [
    [{ x: 174, y: 290 }, room.desk.interactionPoint],
    [{ x: 293, y: 290 }, room.desk.interactionPoint],
    [{ x: 233, y: 238 }, room.desk.interactionPoint],
    [{ x: 588, y: 236 }, lamp.interactionPoint],
    [{ x: 573, y: 210 }, lamp.interactionPoint],
    [{ x: 434, y: 292 }, bench.interactionPoint],
    [{ x: 549, y: 300 }, bench.interactionPoint],
    [{ x: 465, y: 220 }, tea.interactionPoint],
  ];
  for (const [position, destination] of journeys) {
    let player = playerAt(position);
    const path = findLibraryPlayerPath(room, player, destination);
    assert.ok(path, `no route from ${JSON.stringify(position)}`);
    assert.deepEqual(path.at(-1), destination);
    for (const point of path) {
      for (let frame = 0; frame < 500 && Math.hypot(point.x - player.position.x, point.y - player.position.y) > 0.01; frame += 1) {
        const input = { x: point.x - player.position.x, y: point.y - player.position.y };
        const moved = stepLibraryPlayer(room, player, input, Math.min(16, Math.hypot(input.x, input.y) * 10));
        assert.notDeepEqual(moved.position, player.position, `stuck from ${JSON.stringify(position)}`);
        player = moved;
      }
      assert.ok(Math.hypot(point.x - player.position.x, point.y - player.position.y) < 0.01);
    }
  }
  assert.equal(findLibraryPlayerPath(room, playerAt(room.spawn), { x: 233, y: 290 }), null);
  assert.equal(findLibraryPlayerPath(room, playerAt(room.spawn), { x: -1, y: 200 }), null);
  const blockedRoom = { ...room, obstacles: [...room.obstacles, { x: 300, y: 104, width: 12, height: 254 }] };
  assert.equal(findLibraryPlayerPath(blockedRoom, playerAt(room.spawn), room.desk.interactionPoint), null);
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


test('책장 이외의 가구와 독립 소품은 표시 영역의 뒤쪽과 측면으로 진입할 수 없다', () => {
  for (const room of [createSmallLibraryRoom(), createFullLibraryRoom()]) {
    const solidRects = [room.desk.visualRect, room.readingArea.tableVisualRect, room.readingArea.benchVisualRect,
      room.readingArea.lampRect, room.readingArea.beanbagVisualRect,
      room.ambientObjects?.find(object => object.kind === 'cat')?.visualRect].filter((rect): rect is LibraryRect => Boolean(rect));
    for (const rect of solidRects) {
      const isolated = { ...room, obstacles: [rect] };
      const start = { x: rect.x - 20, y: rect.y + rect.height / 2 };
      const fromSide = stepLibraryPlayer(isolated, playerAt(start), { x: 1, y: 0 }, 2000);
      assert.ok(fromSide.position.x <= rect.x - 6, `측면 진입: ${JSON.stringify(rect)}`);
      const fromBehind = stepLibraryPlayer(isolated, playerAt({ x: rect.x + rect.width / 2, y: rect.y - 10 }), { x: 0, y: 1 }, 2000);
      assert.ok(fromBehind.position.y <= rect.y - 3, `후면 진입: ${JSON.stringify(rect)}`);
    }
  }
});

test('책장 뒤쪽은 진입 가능하고 앞쪽 발판 충돌은 유지한다', () => {
  const room = createFullLibraryRoom();
  const shelf = room.shelves.find(shelf => shelf.id === 'full-island-bookcase');
  assert.ok(shelf);
  const moved = stepLibraryPlayer(room, playerAt({ x: shelf.visualRect.x - 20, y: shelf.visualRect.y + 20 }), { x: 1, y: 0 }, 500);
  assert.ok(moved.position.x > shelf.visualRect.x);
  assert.ok(room.obstacles.includes(shelf.footCollider));
  assert.ok(!room.obstacles.includes(shelf.visualRect));
});


test('책등은 페이지 수에 따라 4~7px이며 실제 슬롯과 접근점이 1px 간격으로 함께 배치된다', () => {
  const base = createFullLibraryRoom();
  const books = base.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, slotId: slot.id, pageCount: [1, 150, 300, 5000][slot.id % 4] }));
  const packed = resolveLibraryBookRoom(base, books);
  assert.deepEqual(resolveLibraryBookRoom(packed, books), packed);
  assert.deepEqual(packed.shelves.flatMap(shelf => shelf.slots.map(slot => slot.id)), Array.from({ length: 100 }, (_, index) => index));
  assert.deepEqual(new Set(books.map(book => getLibraryBookSpineWidth(book.pageCount))), new Set([4, 5, 6, 7]));
  for (const shelf of packed.shelves) {
    for (const slot of shelf.slots) {
      assert.ok(slot.rect.width >= 4 && slot.rect.width <= 7);
      for (const other of shelf.slots.filter(other => other.row === slot.row)) {
        if (getLibraryBookSpineWidth(books[slot.id].pageCount) < getLibraryBookSpineWidth(books[other.id].pageCount)) {
          assert.ok(slot.rect.width <= other.rect.width);
        }
      }
      assert.equal(slot.interactionPoint.x, slot.rect.x + slot.rect.width / 2);
      const next = shelf.slots.find(other => other.row === slot.row && other.column === slot.column + 1);
      if (next) assert.equal(next.rect.x - slot.rect.x - slot.rect.width, 1);
    }
  }
  assert.ok(base.shelves.every(shelf => shelf.slots.every(slot => slot.rect.width === 6)));
});

test('100권은 페이지 수 조합과 무관하게 책장 각 줄의 양 끝까지 1px 간격으로 채운다', () => {
  const base = createFullLibraryRoom();
  for (const pages of [[1], [5000], [1, 150, 300, 5000]]) {
    const allBooks = base.shelves.flatMap(shelf => shelf.slots).map(slot => ({ ...draft, slotId: slot.id, pageCount: pages[slot.id % pages.length] }));
    for (const count of [0, 1, 99, 100]) {
      const books = allBooks.slice(0, count);
      const resolved = resolveLibraryBookRoom(base, books);
      assert.deepEqual(resolveLibraryBookRoom(resolved, books), resolved);
      assert.deepEqual(resolveLibraryBookRoom(base, [...books].reverse()), resolved);
      for (const shelf of resolved.shelves) {
        const inset = shelf.variant === 'wide-low' || shelf.variant === 'endcap' ? 8 : 9;
        for (let row = 0; row < shelf.rows; row += 1) {
          const slots = shelf.slots.filter(slot => slot.row === row);
          assert.equal(slots[0].rect.x, shelf.visualRect.x + inset);
          const last = slots[slots.length - 1];
          assert.equal(last.rect.x + last.rect.width, shelf.visualRect.x + shelf.visualRect.width - inset);
          for (const [index, slot] of slots.entries()) {
            assert.ok(Number.isInteger(slot.rect.width) && slot.rect.width >= 4 && slot.rect.width <= 7);
            if (index > 0) assert.equal(slot.rect.x - slots[index - 1].rect.x - slots[index - 1].rect.width, 1);
            const book = books.find(book => book.slotId === slot.id);
            if (book) {
              const rendered = getLibraryPlacedBookRect(resolved, book);
              assert.equal(rendered?.x, slot.rect.x);
              assert.equal(rendered?.width, slot.rect.width);
            }
          }
        }
      }
    }
  }
});

test('중앙 책장과 직원 사이에 몸 전체가 지나는 여유를 두고 각 대상을 따로 선택한다', () => {
  const room = createFullLibraryRoom();
  const shelf = room.shelves.find(shelf => shelf.id === 'full-island-bookcase');
  assert.ok(shelf && room.desk.clerk);
  assert.equal(room.desk.clerk.visualRect.y - shelf.visualRect.y - shelf.visualRect.height, 34);
  assert.equal(room.walkableBounds.y + room.walkableBounds.height - room.desk.visualRect.y - room.desk.visualRect.height, 38);
  let player = playerAt({ x: 150, y: 234 });
  for (let step = 0; step < 4; step += 1) player = stepLibraryPlayer(room, player, { x: 1, y: 0 }, 250);
  assert.ok(Math.abs(player.position.x - 250) < 1e-8);
  assert.equal(player.position.y, 234);
  assert.equal(getNearbyLibraryTarget(room, { ...playerAt(shelf.interactionPoint), facing: 'up' }, [])?.id, shelf.id);
  assert.equal(getNearbyLibraryTarget(room, { ...playerAt(room.desk.interactionPoint), facing: 'up' }, [])?.id, room.desk.id);
});

test('양쪽 화분은 받침까지 포함한 같은 높이와 물 주기 위치를 사용한다', () => {
  const plants = createFullLibraryRoom().ambientObjects?.filter(object => object.kind === 'plant') ?? [];
  assert.equal(plants.length, 2);
  assert.equal(plants[0].visualRect.y, plants[1].visualRect.y);
  assert.equal(plants[0].visualRect.height, plants[1].visualRect.height);
  assert.equal(plants[0].actionPoint?.y, plants[1].actionPoint?.y);
  assert.equal(plants[0].interactionPoint.y, plants[1].interactionPoint.y);
  assert.equal(plants[0].visualRect.y + plants[0].visualRect.height, 101);
});

test('트로피 뒤는 걸을 수 있으며 진열대 하단 받침은 통과하지 못한다', () => {
  const room = createFullLibraryRoom();
  const trophy = room.competitionBoard;
  assert.ok(trophy);
  assert.ok(room.obstacles.includes(trophy.footCollider));
  assert.ok(!room.obstacles.includes(trophy.visualRect));
  let player = playerAt({ x: Math.max(trophy.visualRect.x - 20, room.walkableBounds.x + 6), y: trophy.visualRect.y + 15 });
  for (let i = 0; i < 6; i += 1) player = stepLibraryPlayer(room, player, { x: 1, y: 0 }, 250);
  assert.ok(player.position.x > trophy.visualRect.x + trophy.visualRect.width);
  const blocked = stepLibraryPlayer(room, playerAt(trophy.interactionPoint), { x: 0, y: -1 }, 250);
  assert.ok(blocked.position.y >= trophy.footCollider.y + trophy.footCollider.height + 3);
});

test('출입문은 아래쪽 방 경계에 닿은 발과 아래 방향 입력만 퇴장 의도로 판정한다', () => {
  const room = createFullLibraryRoom();
  assert.ok(room.exit);
  const south = room.walkableBounds.y + room.walkableBounds.height;
  const atDoor = playerAt({ x: room.spawn.x, y: south - 3 });
  assert.equal(room.exit.triggerRect.y + room.exit.triggerRect.height, south);
  assert.equal(room.exit.triggerRect.x, room.exit.visualRect.x);
  assert.equal(room.exit.triggerRect.width, room.exit.visualRect.width);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 0, y: 1 }), true);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 1, y: 1 }), true);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 0, y: 0 }), false);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 1, y: 0 }), false);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: -1, y: 0 }), false);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 0, y: -1 }), false);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: 2, y: 1 }), false);
  assert.equal(isLibraryExitIntent(room, atDoor, { x: NaN, y: 1 }), false);
  assert.equal(isLibraryExitIntent(room, playerAt({ x: room.spawn.x, y: NaN }), { x: 0, y: 1 }), false);
  assert.equal(isLibraryExitIntent(room, createLibraryPlayer(room), { x: 0, y: 1 }), false);
  for (const x of [room.exit.triggerRect.x, room.exit.triggerRect.x + room.exit.triggerRect.width]) {
    assert.equal(isLibraryExitIntent(room, playerAt({ x, y: atDoor.position.y }), { x: 0, y: 1 }), false);
  }
  assert.equal(isLibraryExitIntent(room, playerAt({ x: room.spawn.x, y: south - 5.01 }), { x: 0, y: 1 }), false);
  assert.equal(isLibraryExitIntent(room, playerAt({ x: room.spawn.x, y: south - 2.99 }), { x: 0, y: 1 }), false);
  assert.equal(isLibraryExitIntent(createSmallLibraryRoom(), atDoor, { x: 0, y: 1 }), false);
  assert.equal(room.obstacles.includes(room.exit.visualRect), false);
  assert.ok(room.spawn.y < room.exit.triggerRect.y);
});

test('곰은 문 그림을 가로질러 이동하고 아래쪽 경계에서만 퇴장한다', () => {
  const room = createFullLibraryRoom();
  assert.ok(room.exit);
  const inputDown = { x: 0, y: 1 };
  const south = room.walkableBounds.y + room.walkableBounds.height;
  for (const elapsedMs of [16, 1000 / 60, 1000 / 30, 250]) {
    let player = createLibraryPlayer(room);
    for (let frame = 0; frame < 40; frame += 1) {
      player = stepLibraryPlayer(room, player, inputDown, elapsedMs);
      const feetBottom = player.position.y + player.feetCollider.height / 2;
      assert.ok(feetBottom <= south);
      if (feetBottom < room.exit.triggerRect.y) assert.equal(isLibraryExitIntent(room, player, inputDown), false);
    }
    assert.equal(isLibraryExitIntent(room, player, inputDown), true, `${elapsedMs}ms`);
    const blocked = stepLibraryPlayer(room, player, inputDown, elapsedMs);
    assert.deepEqual(blocked.position, player.position);
    assert.equal(isLibraryExitIntent(room, blocked, inputDown), true);
  }
  for (const y of [room.exit.visualRect.y + 10, south - 3]) {
    let player = playerAt({ x: room.exit.visualRect.x - 16, y });
    for (const direction of [1, -1]) {
      const input = { x: direction, y: 0 };
      const startX = player.position.x;
      for (let frame = 0; frame < 6; frame += 1) {
        player = stepLibraryPlayer(room, player, input, 125);
        assert.equal(isLibraryExitIntent(room, player, input), false);
        assert.equal(isLibraryExitIntent(room, player, { x: 0, y: 0 }), false);
      }
      assert.equal(player.position.y, y);
      assert.ok(Math.abs(player.position.x - startX - direction * 75) < 1e-8);
    }
  }
  const nearby = stepLibraryPlayer(room, createLibraryPlayer(room), inputDown, 250);
  assert.ok(nearby.position.y > room.exit.visualRect.y);
  assert.equal(isLibraryExitIntent(room, nearby, inputDown), false);
});
