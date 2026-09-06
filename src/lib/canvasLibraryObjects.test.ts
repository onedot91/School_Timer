import assert from 'node:assert/strict';
import test from 'node:test';
import { createFullLibraryRoom, createLibraryPlayer, getNearbyLibraryTarget } from './canvasLibraryWorld.js';
import { canParkLibraryCart, resolveLibraryCartRoom, stepLibraryCart } from './canvasLibraryCart.js';
import { callLibraryCatToBed, createLibraryCatNavigation, createLibraryCatState, stepLibraryCat } from './canvasLibraryCat.js';
import { completeLibraryAmbientAction, createLibraryAmbientAction, createLibraryAmbientState, getLibraryAmbientLabel } from './canvasLibraryAmbient.js';
import { getLibraryClockHands } from '../components/student/library/CanvasLibraryDecorations';

test('벽시계는 실제 타임스탬프를 한국 시각의 시·분침으로 변환한다', () => {
  const nine = getLibraryClockHands(Date.parse('2026-09-07T00:00:00Z'));
  assert.equal(nine.label, '09:00');
  assert.equal(nine.hour, Math.PI);
  assert.equal(nine.minute, -Math.PI / 2);
  const half = getLibraryClockHands(Date.parse('2026-09-07T03:30:00Z'));
  assert.equal(half.label, '12:30');
  assert.ok(Math.abs(half.minute - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(half.hour - (Math.PI / 12 - Math.PI / 2)) < 1e-12);
  assert.equal(getLibraryClockHands(Date.parse('2026-09-07T15:00:00Z')).label, '00:00');
});

test('카트는 곰과 같은 거리만큼 움직이고 벽과 가구를 관통하지 않는다', () => {
  const room = createFullLibraryRoom();
  const player = { ...createLibraryPlayer(room), position: { x: 59, y: 172 } };
  const moved = stepLibraryCart(room, player, { x: 1, y: 0 }, 100);
  assert.ok(moved.position);
  assert.ok(moved.position.x > 67);
  assert.ok(Math.abs(moved.position.x - 67 - (moved.player.position.x - player.position.x)) < 0.001);
  let current = moved;
  for (let index = 0; index < 100; index += 1) current = stepLibraryCart(resolveLibraryCartRoom(room, current.position), current.player, { x: -1, y: 0 }, 100);
  assert.ok(current.position && current.position.x >= room.walkableBounds.x);
  assert.equal(room.decorations?.find(object => object.id === 'return-cart')?.visualRect.x, 67);
  const byPlant = resolveLibraryCartRoom(room, { x: 540, y: 125 });
  const stopped = stepLibraryCart(byPlant, { ...player, position: { x: 532, y: 149 } }, { x: 0, y: 1 }, 100);
  assert.ok(stopped.position && stopped.position.y + 48 <= 176);
  assert.equal(canParkLibraryCart(room, createLibraryPlayer(room)), true);
  assert.equal(canParkLibraryCart(resolveLibraryCartRoom(room, { x: 208, y: 294 }), createLibraryPlayer(room)), false);
});

test('큰 화분도 E 대상으로 선택되고 물을 준 뒤 새잎 상태와 잎 살펴보기로 바뀐다', () => {
  const room = createFullLibraryRoom();
  const plant = room.ambientObjects?.find(object => object.id === 'reading-tall-plant');
  assert.ok(plant);
  const player = { ...createLibraryPlayer(room), position: plant.interactionPoint, facing: 'right' as const };
  assert.equal(getNearbyLibraryTarget(room, player, [])?.id, plant.id);
  const state = createLibraryAmbientState();
  assert.equal(getLibraryAmbientLabel(plant, state), '물 주기');
  const action = createLibraryAmbientAction(state, plant, 100);
  assert.equal(action.kind, 'water');
  const completed = completeLibraryAmbientAction(state, action);
  assert.deepEqual(completed.state.wateredPlantIds, [plant.id]);
  assert.equal(getLibraryAmbientLabel(plant, completed.state), '잎 살펴보기');
  assert.equal(createLibraryAmbientAction(completed.state, plant, 1000).kind, 'leaves');
});

test('방석 호출은 고양이가 경로를 빠르게 달려 도착한 뒤 쉬게 하며 막힌 목적지는 거절한다', () => {
  const room = createFullLibraryRoom();
  const nav = createLibraryCatNavigation(room);
  const bed = room.decorations?.find(object => object.kind === 'cat-bed');
  assert.ok(bed?.interactionPoint);
  const player = { ...createLibraryPlayer(room), position: bed.interactionPoint };
  const initial = createLibraryCatState(room, nav, 42, player);
  assert.ok(initial);
  const called = callLibraryCatToBed(room, nav, initial, player);
  assert.ok(called?.bedTarget);
  assert.equal(stepLibraryCat(room, nav, called, player, { x: 0, y: 0 }, 100, { paused: true }), called);
  const running = stepLibraryCat(room, nav, called, player, { x: 0, y: 0 }, 100);
  const walking = stepLibraryCat(room, nav, { ...called, bedTarget: undefined }, player, { x: 0, y: 0 }, 100);
  const traveled = (point: typeof called.position) => Math.hypot(point.x - called.position.x, point.y - called.position.y);
  assert.ok(traveled(running.position) > traveled(walking.position) * 2);
  let state = called;
  for (let frame = 0; frame < 3000 && state.behavior !== 'sleep'; frame += 1) {
    const next = stepLibraryCat(room, nav, state, player, { x: 0, y: 0 }, 100);
    assert.ok(Math.hypot(next.position.x - state.position.x, next.position.y - state.position.y) <= 7.201);
    state = next;
  }
  assert.equal(state.behavior, 'sleep');
  assert.deepEqual(state.position, called.bedTarget);
  assert.equal(state.position.x, bed.visualRect.x + bed.visualRect.width / 2);
  assert.equal(state.position.y - 4, bed.visualRect.y + bed.visualRect.height / 2);
  assert.equal(callLibraryCatToBed(room, nav, initial, { ...player, position: called.bedTarget }), null);
  const reduced = callLibraryCatToBed(room, nav, initial, player, true);
  assert.equal(reduced?.behavior, 'sleep');
  assert.deepEqual(reduced?.position, called.bedTarget);
});
