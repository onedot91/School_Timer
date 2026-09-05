import assert from 'node:assert/strict';
import test from 'node:test';
import { completeLibraryAmbientAction, createLibraryAmbientAction, createLibraryAmbientState, getLibraryAmbientLabel } from './canvasLibraryAmbient.js';
import { createFullLibraryRoom, type LibraryAmbientObject } from './canvasLibraryWorld.js';

const objectOfKind = (kind: LibraryAmbientObject['kind']): LibraryAmbientObject => {
  const object = createFullLibraryRoom().ambientObjects?.find(candidate => candidate.kind === kind);
  assert.ok(object);
  return object;
};

test('생활 상태는 방문마다 초기화하며 서로의 화분 목록을 공유하지 않는다', () => {
  const first = createLibraryAmbientState();
  const second = createLibraryAmbientState();
  assert.deepEqual(first, { lampOn: true, wateredPlantIds: [], catReactions: 0, teaFull: false, benchObjectId: null });
  assert.notEqual(first.wateredPlantIds, second.wateredPlantIds);
  const result = completeLibraryAmbientAction(first, createLibraryAmbientAction(first, objectOfKind('plant'), 120));
  assert.equal(result.state.wateredPlantIds.length, 1);
  assert.deepEqual(first, second);
});

test('조명은 완료 시 왕복 전환되고 라벨은 다음 행동을 안내한다', () => {
  const object = objectOfKind('lamp');
  const initial = createLibraryAmbientState();
  const action = createLibraryAmbientAction(initial, object, 100);
  assert.deepEqual(action, { objectId: object.id, kind: 'lamp', startedAt: 100, durationMs: 450 });
  assert.equal(getLibraryAmbientLabel(object, initial), '조명 끄기');
  const off = completeLibraryAmbientAction(initial, action).state;
  assert.equal(off.lampOn, false);
  assert.equal(getLibraryAmbientLabel(object, off), '조명 켜기');
  assert.equal(completeLibraryAmbientAction(off, createLibraryAmbientAction(off, object, 800)).state.lampOn, true);
  assert.equal(initial.lampOn, true);
});

test('화분은 각각 한 번 자라고 이후에는 잎 반응만 실행한다', () => {
  const plants = createFullLibraryRoom().ambientObjects?.filter(object => object.kind === 'plant') ?? [];
  assert.equal(plants.length, 2);
  let state = createLibraryAmbientState();
  for (const plant of plants) {
    assert.equal(getLibraryAmbientLabel(plant, state), '물 주기');
    const water = createLibraryAmbientAction(state, plant, 0);
    assert.equal(water.kind, 'water');
    assert.equal(water.durationMs, 750);
    state = completeLibraryAmbientAction(state, water).state;
    const repeat = createLibraryAmbientAction(state, plant, 900);
    assert.equal(repeat.kind, 'leaves');
    assert.equal(repeat.durationMs, 400);
    assert.equal(completeLibraryAmbientAction(state, repeat).state, state);
    assert.equal(getLibraryAmbientLabel(plant, state), '잎 살펴보기');
  }
  assert.deepEqual(state.wateredPlantIds, plants.map(plant => plant.id));
});

test('붉은 책 대신 차 세트만 제공하며 책갈피 안내를 만들지 않는다', () => {
  const state = createLibraryAmbientState();
  const room = createFullLibraryRoom();
  assert.equal(room.ambientObjects?.some(object => object.id === 'table-book'), false);
  for (const object of room.ambientObjects ?? []) {
    const action = createLibraryAmbientAction(state, object, 0);
    assert.notEqual(completeLibraryAmbientAction(state, action).notice, '책갈피를 발견했어요');
    assert.notEqual(getLibraryAmbientLabel(object, state), '책 펼치기');
  }
});

test('고양이는 세 번째 반응 이후 같은 휴식 반응을 반복한다', () => {
  const object = objectOfKind('cat');
  let state = createLibraryAmbientState();
  for (let index = 0; index < 6; index += 1) {
    const action = createLibraryAmbientAction(state, object, index * 800);
    assert.equal(action.kind, 'pet');
    assert.equal(action.durationMs, 700);
    state = completeLibraryAmbientAction(state, action).state;
    assert.equal(state.catReactions, Math.min(3, index + 1));
  }
});

test('차는 따르기와 마시기를 반복하며 초기 상태를 변경하지 않는다', () => {
  const object = objectOfKind('tea');
  const initial = createLibraryAmbientState();
  let state = initial;
  for (let index = 0; index < 3; index += 1) {
    assert.equal(getLibraryAmbientLabel(object, state), '차 따르기');
    const pour = createLibraryAmbientAction(state, object, index * 2000);
    assert.equal(pour.kind, 'pour');
    assert.equal(pour.durationMs, 850);
    state = completeLibraryAmbientAction(state, pour).state;
    assert.equal(state.teaFull, true);
    assert.equal(getLibraryAmbientLabel(object, state), '차 마시기');
    const drink = createLibraryAmbientAction(state, object, index * 2000 + 900);
    assert.equal(drink.kind, 'drink');
    assert.equal(drink.durationMs, 800);
    state = completeLibraryAmbientAction(state, drink).state;
    assert.equal(state.teaFull, false);
  }
  assert.equal(initial.teaFull, false);
});

test('벤치 착석은 대상 ID를 기록하고 일어나기 라벨을 제공한다', () => {
  const object = objectOfKind('bench');
  const initial = createLibraryAmbientState();
  const action = createLibraryAmbientAction(initial, object, 0);
  assert.equal(action.kind, 'sit');
  assert.equal(action.durationMs, 500);
  const seated = completeLibraryAmbientAction(initial, action).state;
  assert.equal(seated.benchObjectId, object.id);
  assert.equal(getLibraryAmbientLabel(object, seated), '일어나기');
});
