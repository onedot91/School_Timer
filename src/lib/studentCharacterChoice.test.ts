import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStudentEconomyAction, createStudentEconomyState, getStudentCharacterInitials, hasStudentCharacterInitials, normalizeStudentEconomyState, STUDENT_CHARACTER_PRIZES } from './studentEconomy.js';

const draw = (state: unknown = { characterFreeDrawAvailable: false }, roll = 1) => applyStudentEconomyAction({
  state, action: { type: 'draw_character' }, wallet: 50, availableWallet: 50, requestId: 'initial-choice-draw', characterDrawRoll: roll,
});

test('고마 접미사는 유지하고 한글 이름만 초성으로 표시한다', () => {
  for (const [name, initials] of [
    ['여우 고마', 'ㅇㅇ 고마'], ['냉장고 고마', 'ㄴㅈㄱ 고마'], ['거꾸로 고마', 'ㄱㄲㄹ 고마'],
    ['나무 마법사 고마', 'ㄴㅁ ㅁㅂㅅ 고마'], ['3D 고마', '3D 고마'], ['나는 고마가 아니고마', 'ㄴㄴ ㄱㅁㄱ ㅇㄴㄱㅁ'],
  ]) assert.equal(getStudentCharacterInitials(name), initials);
});

test('초성이 없는 이름은 고마 접미사가 있어도 초성 후보가 될 수 없다', () => {
  for (const name of ['3D 고마', 'ABC 고마', '123 고마', '3D', '']) assert.equal(hasStudentCharacterInitials(name), false);
  for (const name of ['여우 고마', '거꾸로 고마', '나는 고마가 아니고마']) assert.equal(hasStudentCharacterInitials(name), true);
});

test('초성 이벤트는 미보유 스킨 중 초성이 있는 후보만 지급하며 3D 고마를 제외한다', () => {
  const allowed = ['character-6', 'character-19', 'character-20', 'character-21'];
  const state = { characterFreeDrawAvailable: false, ownedCharacterIds: STUDENT_CHARACTER_PRIZES.filter((prize) => !allowed.includes(prize.id)).map((prize) => prize.id) };
  for (let index = 0; index < 40; index += 1) {
    const result = applyStudentEconomyAction({ state, action: { type: 'draw_character' }, wallet: 100, availableWallet: 100,
      requestId: `exclude-no-initials-${index}`, characterDrawRoll: 1 });
    assert.deepEqual(new Set(result.state.pendingCharacterChoice?.characterIds), new Set(['character-6', 'character-19', 'character-20']));
    assert.equal(result.wallet, 50);
  }
});

test('초성 후보가 적으면 있는 후보만 표시하고 없으면 일반 캡슐로 남은 스킨을 지급한다', () => {
  const state = { characterFreeDrawAvailable: false, ownedCharacterIds: STUDENT_CHARACTER_PRIZES.filter((prize) => !['character-6', 'character-21'].includes(prize.id)).map((prize) => prize.id) };
  const result = draw(state);
  assert.deepEqual(result.state.pendingCharacterChoice?.characterIds, ['character-6']);
  const only3D = { ...state, ownedCharacterIds: [...state.ownedCharacterIds, 'character-6'] };
  const fallback = draw(only3D);
  assert.equal(fallback.state.pendingCharacterChoice, null);
  assert.equal(fallback.state.activeCharacterId, 'character-21');
  assert.equal(fallback.state.ownedCharacterIds.length, STUDENT_CHARACTER_PRIZES.length);
  assert.equal(fallback.wallet, 0);
  const double = draw(state, 0);
  assert.ok(double.state.ownedCharacterIds.includes('character-21'));
  assert.equal(double.state.pendingCharacterChoice, null);
});

test('이미 비용을 낸 이전 3D 선택권은 추가 차감 없이 완료할 수 있다', () => {
  const result = applyStudentEconomyAction({ state: { characterFreeDrawAvailable: false,
    pendingCharacterChoice: { drawRequestId: 'legacy-initials-draw', characterIds: ['character-21'] } },
    action: { type: 'choose_draw_character', drawRequestId: 'legacy-initials-draw', characterId: 'character-21' },
    wallet: 0, availableWallet: 0, requestId: 'legacy-claim-result' });
  assert.equal(result.wallet, 0);
  assert.equal(result.state.activeCharacterId, 'character-21');
  assert.equal(result.state.pendingCharacterChoice, null);
});

test('초성 후보는 미보유 세 개이며 새로고침과 같은 요청 재전송으로 변하지 않는다', () => {
  const owned = STUDENT_CHARACTER_PRIZES.slice(0, 10).map((prize) => prize.id);
  const result = draw({ ownedCharacterIds: owned, characterFreeDrawAvailable: false });
  const choice = result.state.pendingCharacterChoice;
  assert.ok(choice);
  assert.equal(result.wallet, 0);
  assert.equal(choice.characterIds.length, 3);
  assert.equal(new Set(choice.characterIds).size, 3);
  assert.ok(choice.characterIds.every((id) => !owned.includes(id)));
  assert.deepEqual(result.state.ownedCharacterIds, owned);
  const reloaded = normalizeStudentEconomyState(JSON.parse(JSON.stringify(result.state)));
  assert.deepEqual(reloaded.pendingCharacterChoice, choice);
  const retry = applyStudentEconomyAction({ state: reloaded, action: { type: 'draw_character' }, wallet: 0, availableWallet: 0, requestId: choice.drawRequestId, characterDrawRoll: 9 });
  assert.equal(retry.applied, false);
  assert.equal(retry.wallet, 0);
  assert.deepEqual(retry.state.pendingCharacterChoice, choice);
  assert.throws(() => applyStudentEconomyAction({ state: reloaded, action: { type: 'draw_character' }, wallet: 50, availableWallet: 50, requestId: 'second-draw-before-choice' }), /CHARACTER_CHOICE_PENDING/);
});

test('각 후보를 선택할 수 있고 잔액 0에서도 추가 비용 없이 선택 스킨 하나만 지급한다', () => {
  const first = draw();
  const choice = first.state.pendingCharacterChoice;
  assert.ok(choice);
  for (const characterId of choice.characterIds) {
    const input = { state: first.state, wallet: first.wallet, availableWallet: 0, requestId: 'initial-choice-select', action: { type: 'choose_draw_character' as const, drawRequestId: choice.drawRequestId, characterId } };
    const chosen = applyStudentEconomyAction(input);
    assert.equal(chosen.wallet, 0);
    assert.deepEqual(chosen.state.ownedCharacterIds, [characterId]);
    assert.equal(chosen.state.activeCharacterId, characterId);
    assert.equal(chosen.state.pendingCharacterChoice, null);
    assert.equal(chosen.state.characterFreeDrawAvailable, false);
    const repeated = applyStudentEconomyAction({ ...input, state: chosen.state });
    assert.equal(repeated.applied, false);
    assert.deepEqual(repeated.state.ownedCharacterIds, [characterId]);
    assert.throws(() => applyStudentEconomyAction({ ...input, state: chosen.state, requestId: 'initial-choice-select-again' }), /INVALID_CHARACTER_CHOICE/);
  }
});

test('후보 밖의 스킨·다른 뽑기의 선택·선택권 없는 요청을 거절한다', () => {
  const first = draw();
  const choice = first.state.pendingCharacterChoice;
  assert.ok(choice);
  const outside = STUDENT_CHARACTER_PRIZES.find((prize) => !choice.characterIds.includes(prize.id));
  assert.ok(outside);
  for (const [state, drawRequestId, characterId] of [
    [first.state, choice.drawRequestId, outside.id],
    [first.state, 'another-draw-request', choice.characterIds[0]],
    [createStudentEconomyState(), choice.drawRequestId, choice.characterIds[0]],
  ] as const) assert.throws(() => applyStudentEconomyAction({ state, wallet: 50, availableWallet: 50, requestId: 'invalid-choice-select', action: { type: 'choose_draw_character', drawRequestId, characterId } }), /INVALID_CHARACTER_CHOICE/);
});

test('첫 무료 뽑기에도 초성 이벤트가 적용되고 남은 스킨이 적으면 있는 후보만 표시한다', () => {
  const free = draw(createStudentEconomyState());
  assert.equal(free.wallet, 50);
  assert.equal(free.state.characterFreeDrawAvailable, false);
  assert.ok(free.state.pendingCharacterChoice);
  for (const remaining of [1, 2]) {
    const result = draw({ characterFreeDrawAvailable: false, ownedCharacterIds: STUDENT_CHARACTER_PRIZES.slice(0, -remaining).map((prize) => prize.id) });
    assert.equal(result.state.pendingCharacterChoice?.characterIds.length, remaining);
    assert.equal(result.wallet, 0);
  }
});

test('기존 상태에는 선택권이 없고 손상된 후보·중복·보유 스킨을 정규화한다', () => {
  assert.equal(normalizeStudentEconomyState({}).pendingCharacterChoice, null);
  const [owned, candidate] = STUDENT_CHARACTER_PRIZES;
  const base = { ownedCharacterIds: [owned.id], pendingCharacterChoice: { drawRequestId: 'valid-draw-request', characterIds: [owned.id, candidate.id, candidate.id, 'invalid'] } };
  assert.deepEqual(normalizeStudentEconomyState(base).pendingCharacterChoice?.characterIds, [candidate.id]);
  for (const pendingCharacterChoice of [null, {}, { drawRequestId: 'invalid', characterIds: [candidate.id] }, { drawRequestId: 'valid-draw-request', characterIds: ['invalid'] }]) {
    assert.equal(normalizeStudentEconomyState({ pendingCharacterChoice }).pendingCharacterChoice, null);
  }
});
