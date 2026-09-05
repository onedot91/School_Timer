import assert from 'node:assert/strict';
import test from 'node:test';
import { drawLibraryInteractionHand } from '../components/student/library/CanvasLibraryCharacter';
import { CANVAS_LIBRARY_PALETTE as palette } from '../components/student/library/CanvasLibraryPalette';
import { createLibraryAmbientAction, createLibraryAmbientState } from './canvasLibraryAmbient';
import { getLibraryActionDuration, getLibraryClerkHand, getLibraryActionProgress, getLibraryBearPose, getLibraryBookMotion, getLibraryBookTone, getLibraryPlacedBookRect, getLibraryTeaPositions, LIBRARY_ACTION_MS, LIBRARY_WALK_FRAME_MS } from './canvasLibraryPose.js';
import { createFullLibraryRoom, createLibraryPlayer, type LibraryPoint, type LibraryScene } from './canvasLibraryWorld.js';

import { createLibraryCatNavigation, createLibraryCatState, resolveLibraryCatRoom } from './canvasLibraryCat.js';
import { drawLibraryCat } from '../components/student/library/CanvasLibraryCat.js';

const room = createFullLibraryRoom();
const legacyRoom = { ...room, desk: { ...room.desk, clerk: undefined } };
const draft = { studentNumber: 1, title: '달빛 우체국', author: '이지은', pageCount: 128 };
const baseScene: LibraryScene = {
  player: createLibraryPlayer(room), placedBooks: [], carriedDraft: draft,
  nearbyTarget: null, selectedSlotId: null, timeMs: 0, reducedMotion: false,
};
const directions = ['up', 'down', 'left', 'right'] as const;
const closePoint = (actual: LibraryPoint, expected: LibraryPoint) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-8, `x: ${actual.x} !== ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-8, `y: ${actual.y} !== ${expected.y}`);
};

test('상호작용 팔의 가로·세로·대각선과 팔꿈치 내부는 몸통 털색으로 이어진다', () => {
  for (const [elbow, hand] of [
    [{ x: 5, y: 0 }, { x: 10, y: 0 }], [{ x: -5, y: 0 }, { x: -10, y: 0 }],
    [{ x: 0, y: 5 }, { x: 0, y: 10 }], [{ x: 0, y: -5 }, { x: 0, y: -10 }],
    [{ x: 4, y: 4 }, { x: 8, y: 8 }], [{ x: -4, y: -4 }, { x: -8, y: -8 }],
  ]) {
    const pixels = new Map<string, string>();
    const recorder = { fillStyle: '', fillRect(x: number, y: number, width: number, height: number) {
      for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) pixels.set(`${px},${py}`, this.fillStyle);
    } };
    drawLibraryInteractionHand(recorder as unknown as CanvasRenderingContext2D, {
      ...getLibraryBearPose(baseScene, room), shoulder: { x: 0, y: 0 }, elbow, hand,
    });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = Math.round(elbow.x * t);
      const y = Math.round(elbow.y * t);
      assert.equal(pixels.get(`${x},${y}`), palette.bear[2], JSON.stringify({ elbow, hand, x, y }));
    }
    if (hand.x === 10 && hand.y === 0) {
      assert.equal(pixels.get('2,-1'), palette.bear[0]);
      assert.equal(pixels.get('2,0'), palette.bear[2]);
      assert.equal(pixels.get('2,1'), palette.bear[2]);
      assert.equal(pixels.get('2,2'), palette.bear[0]);
      assert.equal(pixels.has('2,-2'), false);
    }
  }
});

test('전등은 왼쪽에서 450ms 동안 기둥 스위치를 누르며 손이 머리로 올라가지 않는다', () => {
  const lamp = room.ambientObjects?.find(object => object.kind === 'lamp');
  assert.ok(lamp?.actionPoint);
  closePoint(lamp.interactionPoint, { x: 556, y: 243 });
  closePoint(lamp.actionPoint, { x: 572, y: 231 });
  assert.deepEqual(lamp.visualRect, { x: 566, y: 218, width: 14, height: 24 });
  const action = createLibraryAmbientAction(createLibraryAmbientState(), lamp, 0);
  assert.equal(action.durationMs, 450);
  const scene: LibraryScene = { ...baseScene, carriedDraft: null,
    player: { ...baseScene.player, position: lamp.interactionPoint, facing: 'right' }, ambientAction: action };
  for (let timeMs = 0; timeMs < 450; timeMs++) {
    const pose = getLibraryBearPose({ ...scene, timeMs }, room);
    assert.ok(pose.reachable);
    assert.ok(Math.hypot(pose.hand.x - pose.shoulder.x, pose.hand.y - pose.shoulder.y) <= 12);
    assert.ok(pose.hand.x >= pose.shoulder.x && pose.hand.y >= pose.shoulder.y);
  }
  closePoint(getLibraryBearPose({ ...scene, timeMs: 225 }, room).hand, lamp.actionPoint);
  const start = getLibraryBearPose({ ...scene, timeMs: 0 }, room).hand;
  const end = getLibraryBearPose({ ...scene, timeMs: 449.999 }, room).hand;
  assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 0.001);
});

test('직원 전달은 700ms이며 작은 방 받기와 책 꽂기는 500ms를 유지한다', () => {
  assert.equal(getLibraryActionDuration({ kind: 'receive', startedAt: 0 }, room), 700);
  assert.equal(getLibraryActionDuration({ kind: 'receive', startedAt: 0 }, legacyRoom), 500);
  assert.equal(getLibraryActionDuration({ kind: 'place', startedAt: 0 }, room), 500);
});

test('직원 손에서 책상 앞과 곰 손으로 이어지는 전달은 연속적이고 팔이 늘어나지 않는다', () => {
  const clerk = room.desk.clerk;
  assert.ok(clerk);
  const scene: LibraryScene = { ...baseScene, player: { ...baseScene.player, position: clerk.receivePoint, facing: 'up' },
    action: { kind: 'receive', startedAt: 0 } };
  let previous = getLibraryBookMotion(scene, room);
  assert.ok(previous);
  for (let timeMs = 0; timeMs < 700; timeMs += 1) {
    const frame = { ...scene, timeMs };
    const book = getLibraryBookMotion(frame, room);
    const hand = getLibraryClerkHand(frame, room);
    const pose = getLibraryBearPose(frame, room);
    assert.ok(book && hand);
    assert.equal(book.visible, true);
    assert.ok(Math.hypot(book.center.x - previous.center.x, book.center.y - previous.center.y) < 0.2);
    assert.ok(Math.hypot(pose.hand.x - pose.shoulder.x, pose.hand.y - pose.shoulder.y) <= 12);
    assert.ok(Math.hypot(hand.x - (clerk.handoffPoint.x + 5), hand.y - (clerk.handoffPoint.y - 7)) <= 12);
    if (timeMs < 140) closePoint(book.center, hand);
    if (timeMs >= 140 && timeMs <= 525) assert.ok(book.center.y >= clerk.handoffPoint.y && book.center.y <= clerk.counterPoint.y);
    previous = book;
  }
  const completed = getLibraryBookMotion({ ...scene, timeMs: 700 }, room);
  assert.ok(completed);
  assert.ok(Math.hypot(previous.center.x - completed.center.x, previous.center.y - completed.center.y) < 0.001);
  assert.equal(getLibraryActionProgress({ ...scene, timeMs: 699 }, room), 699 / 700);
  assert.equal(getLibraryActionProgress({ ...scene, timeMs: 700 }, room), null);
});

for (const facing of directions) {
  test(`${facing}: 받기 완료 순간의 책과 손이 정지 운반 위치로 이어진다`, () => {
    const player = { ...baseScene.player, facing };
    const scene = { ...baseScene, player, action: { kind: 'receive' as const, startedAt: 1000 }, timeMs: 1350 };
    const received = getLibraryBookMotion(scene, legacyRoom);
    const restingScene = { ...scene, timeMs: 1500 };
    const resting = getLibraryBookMotion(restingScene, legacyRoom);
    assert.ok(received);
    assert.ok(resting);
    closePoint(received.center, getLibraryBearPose(restingScene, legacyRoom).hand);
    closePoint(received.center, resting.center);
    assert.equal(received.inHands, true);
    assert.equal(received.visible, facing !== 'up');
    assert.equal(getLibraryActionProgress(restingScene), null);
  });

  test(`${facing}: 꽂기는 운반하던 손에서 출발해 400ms에 선택 슬롯으로 도착한다`, () => {
    const player = { ...baseScene.player, facing };
    const restingScene = { ...baseScene, player };
    const slot = room.shelves[2].slots[7];
    const scene: LibraryScene = {
      ...restingScene, carriedDraft: null, placedBooks: [{ ...draft, slotId: slot.id }],
      action: { kind: 'place', startedAt: 1000, slotId: slot.id }, timeMs: 1000,
    };
    const starting = getLibraryBookMotion(scene, room);
    assert.ok(starting);
    closePoint(starting.center, getLibraryBearPose(restingScene, room).hand);
    assert.equal(starting.inHands, true);
    assert.equal(starting.visible, facing !== 'up');

    const landing = getLibraryBookMotion({ ...scene, timeMs: 1400 }, room);
    assert.ok(landing);
    const placedRect = getLibraryPlacedBookRect(room, { ...draft, slotId: slot.id });
    assert.ok(placedRect);
    closePoint(landing.center, { x: placedRect.x + placedRect.width / 2, y: placedRect.y + placedRect.height / 2 });
    assert.equal(landing.landed, true);
    assert.equal(landing.inHands, false);
    assert.equal(landing.visible, false);
    assert.equal(getLibraryBookMotion({ ...scene, timeMs: 1500 }, room), null);
  });
}

test('후면 운반은 책을 몸 뒤에 숨기고 받는 중인 책만 손에 닿기 전까지 보인다', () => {
  const scene = { ...baseScene, player: { ...baseScene.player, facing: 'up' as const } };
  assert.equal(getLibraryBookMotion(scene, legacyRoom)?.visible, false);
  assert.equal(getLibraryBearPose(scene, legacyRoom).carrying, true);
  const receiving = { ...scene, action: { kind: 'receive' as const, startedAt: 0 } };
  assert.equal(getLibraryBookMotion({ ...receiving, timeMs: 200 }, legacyRoom)?.visible, true);
  assert.equal(getLibraryBookMotion({ ...receiving, timeMs: 350 }, legacyRoom)?.visible, false);
});

test('보행 시간은 네 디딤을 순환하고 정지 시 벽시계가 흘러도 발과 손이 들썩이지 않는다', () => {
  const player = { ...baseScene.player, isWalking: true };
  const poses = Array.from({ length: 5 }, (_, frame) => getLibraryBearPose({
    ...baseScene, player, timeMs: 99000, walkTimeMs: frame * LIBRARY_WALK_FRAME_MS,
  }, room));
  assert.deepEqual(poses.map(pose => pose.frame), [0, 1, 2, 3, 0]);
  assert.deepEqual(poses.map(pose => pose.stride), [1, 0, -1, 0, 1]);
  for (const pose of poses) closePoint(pose.feet, player.position);

  const stopped = { ...baseScene, player: { ...player, isWalking: false }, walkTimeMs: 140 };
  const first = getLibraryBearPose({ ...stopped, timeMs: 1000 }, room);
  const later = getLibraryBearPose({ ...stopped, timeMs: 99000 }, room);
  assert.equal(first.walking, false);
  assert.equal(first.stride, 0);
  assert.deepEqual(first, later);
  closePoint(first.feet, player.position);
});

test('모션 줄이기는 보행과 받기 연출 없이 안정된 운반 또는 배치 완료 상태를 보인다', () => {
  for (const facing of directions) {
    const scene: LibraryScene = {
      ...baseScene, player: { ...baseScene.player, facing, isWalking: true },
      reducedMotion: true, walkTimeMs: 280, timeMs: 200,
      action: { kind: 'receive', startedAt: 0 },
    };
    const pose = getLibraryBearPose(scene, room);
    const book = getLibraryBookMotion(scene, room);
    assert.equal(pose.walking, false);
    assert.equal(pose.stride, 0);
    assert.equal(pose.reach, 0);
    assert.equal(getLibraryActionProgress(scene), null);
    assert.ok(book);
    closePoint(book.center, pose.hand);
    assert.equal(book.visible, facing !== 'up');
    assert.equal(getLibraryBookMotion({ ...scene, carriedDraft: null, action: { kind: 'place', startedAt: 0, slotId: 0 } }, room), null);
  }
});

test('음수 또는 종료된 행동 시각은 진행 중 연출로 처리하지 않는다', () => {
  const action = { kind: 'receive' as const, startedAt: 1000 };
  assert.equal(getLibraryActionProgress({ ...baseScene, action, timeMs: 999 }), null);
  assert.equal(getLibraryActionProgress({ ...baseScene, action, timeMs: 1000 + LIBRARY_ACTION_MS }), null);
  assert.equal(getLibraryActionProgress({ ...baseScene, action, timeMs: Number.NaN }), null);
});


test('책 표지는 새 bookId와 선택 슬롯을 받아도 운반 중 색상을 유지한다', () => {
  const beforeSave = getLibraryBookTone(draft);
  const placed = { ...draft, bookId: 'new-server-id', slotId: 30 };
  assert.equal(getLibraryBookTone(placed), beforeSave);
  assert.equal(getLibraryBookTone({ ...draft, bookId: 'legacy-id' }), beforeSave);
  assert.equal(getLibraryBookTone({ ...draft, title: ` ${draft.title} ` }), beforeSave);
});

test('모든 슬롯의 삽입 직전 책 크기와 위치가 실제 책등으로 끊김 없이 이어진다', () => {
  for (const slot of room.shelves.flatMap(shelf => shelf.slots)) {
    for (const pageCount of [0, 128, 500]) {
      const book = { ...draft, pageCount, slotId: slot.id };
      const scene: LibraryScene = { ...baseScene, carriedDraft: null, placedBooks: [book], action: { kind: 'place', startedAt: 0, slotId: slot.id } };
      const rect = getLibraryPlacedBookRect(room,book);
      const turning = getLibraryBookMotion({ ...scene, timeMs: 300 },room);
      const inserting = getLibraryBookMotion({ ...scene, timeMs: 399 },room);
      const landed = getLibraryBookMotion({ ...scene, timeMs: 400 },room);
      assert.ok(rect && turning && inserting && landed);
      assert.equal(turning.turn, 1);
      assert.equal(turning.width, rect.width);
      assert.equal(turning.height, rect.height);
      assert.equal(inserting.width, rect.width);
      assert.equal(inserting.height, rect.height);
      assert.equal(Math.round(inserting.center.x - inserting.width / 2),rect.x);
      assert.equal(Math.round(inserting.center.y - inserting.height / 2),rect.y);
      assert.equal(inserting.visible,true);
      assert.equal(landed.landed,true);
      closePoint(landed.center,{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    }
  }
});

test('벤치는 소파 독서 위치와 구분되며 착석 중 발 위치가 최종 좌판 위치로 이어진다', () => {
  const bench = room.ambientObjects?.find(object => object.kind === 'bench');
  assert.ok(bench);
  const scene: LibraryScene = { ...baseScene, carriedDraft: null,
    player: { ...baseScene.player, position: bench.interactionPoint, isWalking: true },
    ambientAction: { objectId: bench.id, kind: 'sit', startedAt: 0, durationMs: 500 }, timeMs: 0 };
  closePoint(getLibraryBearPose(scene,room).feet,bench.interactionPoint);
  const seated: LibraryScene = { ...scene, timeMs: 500, ambientAction: null,
    ambientState: { lampOn: true, wateredPlantIds: [], catReactions: 0, teaFull: false, benchObjectId: bench.id } };
  const pose = getLibraryBearPose(seated,room);
  assert.equal(pose.benchSeated,true);
  assert.equal(pose.walking,false);
  assert.equal(pose.facing,'down');
  closePoint(pose.feet,{ x: bench.visualRect.x + bench.visualRect.width / 2, y: bench.visualRect.y + bench.visualRect.height + 2 });
  const ending = getLibraryBearPose({ ...scene, timeMs: 499.999 },room);
  assert.ok(Math.abs(ending.feet.y-pose.feet.y)<0.001);
  assert.notDeepEqual(pose.feet,getLibraryBearPose({ ...baseScene, seated: true },room).feet);
  assert.equal(getLibraryBookMotion(seated,room),null);
});

test('찻잔 들기와 내려놓기는 테이블의 같은 컵 중심에서 출발하고 끝난다', () => {
  const tea = room.ambientObjects?.find(object => object.kind === 'tea');
  assert.ok(tea);
  const scene: LibraryScene = { ...baseScene, carriedDraft: null,
    player: { ...baseScene.player, position: tea.interactionPoint, facing: 'right' },
    ambientAction: { objectId: tea.id, kind: 'drink', startedAt: 0, durationMs: 800 } };
  const { cup } = getLibraryTeaPositions(tea);
  closePoint(getLibraryBearPose(scene,room).hand,cup);
  const raised = getLibraryBearPose({ ...scene, timeMs: 400 },room);
  closePoint(raised.hand,{ x: tea.interactionPoint.x+10, y: tea.interactionPoint.y-19 });
  const ending = getLibraryBearPose({ ...scene, timeMs: 799.999 },room);
  assert.ok(Math.hypot(ending.hand.x-cup.x,ending.hand.y-cup.y)<0.001);
});

test('생활 동작 줄이기는 손 뻗기와 보행을 멈추고 종료된 시각은 동작으로 취급하지 않는다', () => {
  const plant = room.ambientObjects?.find(object => object.kind === 'plant');
  assert.ok(plant);
  const scene: LibraryScene = { ...baseScene, carriedDraft: null,
    ambientAction: { objectId: plant.id, kind: 'water', startedAt: 100, durationMs: 750 }, timeMs: 400 };
  const plain = getLibraryBearPose({ ...scene, ambientAction: null },room);
  const reduced = getLibraryBearPose({ ...scene, reducedMotion: true },room);
  assert.equal(reduced.ambientProgress,null);
  closePoint(reduced.hand,plain.hand);
  for (const timeMs of [99, 850, Number.NaN]) assert.equal(getLibraryBearPose({ ...scene, timeMs },room).ambientProgress,null);
});

test('생활 도구의 전체 경로가 어깨에서 12픽셀 안에 있으며 찻주전자와 잔 시작점에 닿는다', () => {
  for (const [objectKind, kinds, facing] of [
    ['lamp', ['lamp'], 'right'], ['plant', ['water', 'leaves'], 'up'], ['tea', ['pour', 'drink'], 'right'],
  ] as const) {
    const object = room.ambientObjects?.find(object => object.kind === objectKind);
    assert.ok(object);
    for (const kind of kinds) for (let elapsed = 0; elapsed < 800; elapsed += 10) {
      const scene: LibraryScene = { ...baseScene, carriedDraft: null,
        player: { ...baseScene.player, position: object.interactionPoint, facing },
        ambientAction: { objectId: object.id, kind, startedAt: 0, durationMs: 800 }, timeMs: elapsed };
      const pose = getLibraryBearPose(scene, room);
      assert.ok(pose.reachable, `${kind} at ${elapsed}ms cannot reach its target`);
      assert.ok(Math.hypot(pose.hand.x - pose.shoulder.x, pose.hand.y - pose.shoulder.y) <= 12.00001);
    }
  }
  const tea = room.ambientObjects!.find(object => object.kind === 'tea')!;
  const pose = getLibraryBearPose({ ...baseScene, carriedDraft: null,
    player: { ...baseScene.player, position: tea.interactionPoint, facing: 'right' },
    ambientAction: { objectId: tea.id, kind: 'pour', startedAt: 0, durationMs: 800 } }, room);
  const { pot } = getLibraryTeaPositions(tea);
  closePoint(pose.hand, { x: pot.x - 7, y: pot.y + 2 });
});

test('닿지 않는 상호작용은 불가능 상태를 반환하고 팔 자체는 늘리지 않는다', () => {
  const object = room.ambientObjects?.find(object => object.kind === 'tea');
  assert.ok(object);
  const pose = getLibraryBearPose({ ...baseScene, carriedDraft: null,
    ambientAction: { objectId: object.id, kind: 'pour', startedAt: 0, durationMs: 800 }, timeMs: 400 }, room);
  assert.equal(pose.reachable, false);
  assert.ok(Math.hypot(pose.hand.x - pose.shoulder.x, pose.hand.y - pose.shoulder.y) <= 12.00001);
});


test('고양이 양옆 접근에서 손이 실제 머리 옆에 닿고 팔이 늘어나지 않는다', () => {
  const nav = createLibraryCatNavigation(room);
  const cat = createLibraryCatState(room, nav, 42, baseScene.player);
  assert.ok(cat);
  for (const direction of [-1, 1]) {
    const player = { ...baseScene.player, position: { x: cat.position.x + direction * 22, y: cat.position.y },
      facing: direction < 0 ? 'right' as const : 'left' as const };
    const dynamicRoom = resolveLibraryCatRoom(room, cat, player);
    const object = dynamicRoom.ambientObjects?.find(candidate => candidate.kind === 'cat');
    assert.ok(object);
    for (let timeMs = 0; timeMs < 700; timeMs += 10) {
      const pose = getLibraryBearPose({ ...baseScene, carriedDraft: null, player, catState: cat, timeMs,
        ambientAction: { objectId: object.id, kind: 'pet', startedAt: 0, durationMs: 700 } }, dynamicRoom);
      assert.ok(pose.reachable);
      assert.ok(Math.hypot(pose.hand.x - pose.shoulder.x, pose.hand.y - pose.shoulder.y) <= 12);
      if (timeMs === 350) closePoint(pose.hand, { x: cat.position.x + direction * 6, y: cat.position.y - 10 });
    }
  }
});

test('고양이 세로 보행의 모든 디딤에서 다리 픽셀이 몸통과 연결된다', () => {
  const nav = createLibraryCatNavigation(room);
  const initial = createLibraryCatState(room, nav, 42, baseScene.player);
  assert.ok(initial);
  for (const facing of ['up', 'down'] as const) for (const elapsedMs of [0, 160, 320, 480]) {
    const pixels = new Set<string>();
    const recorder = { globalAlpha: 1, fillStyle: '', save() {}, restore() {}, translate() {}, scale() {},
      fillRect(x: number, y: number, width: number, height: number) {
        if (this.globalAlpha < 1) return;
        for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) pixels.add(`${px},${py}`);
      } };
    drawLibraryCat(recorder as unknown as CanvasRenderingContext2D,
      { ...initial, position: { x: 0, y: 0 }, facing, behavior: 'walk', elapsedMs }, false);
    const stride = [0, 1, 0, -1][elapsedMs / 160];
    for (const [x, pawTop] of [[-4, -3 - stride], [1, -3 + stride]]) for (let y = -5; y <= pawTop + 2; y++) {
      assert.ok(pixels.has(`${x},${y}`), `${facing} ${elapsedMs}ms: leg gap at ${x},${y}`);
    }
  }
});
