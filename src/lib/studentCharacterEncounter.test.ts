import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCharactersGreet } from './studentCharacterEncounter.js';
const a = { lane: '-1', direction: 'right', left: 800, right: 1000 };
const b = { lane: '-1', direction: 'left', left: 1010, right: 1210 };
test('1920px 화면에서 같은 경로의 마주 오는 캐릭터는 인사한다', () => {
  assert.equal(shouldCharactersGreet(a, b, 1920), true);
  assert.equal(shouldCharactersGreet(b, a, 1920), true);
});
test('다른 높이, 같은 방향, 멀리 떨어진 캐릭터는 인사하지 않는다', () => {
  assert.equal(shouldCharactersGreet(a, { ...b, lane: '1' }, 1920), false);
  assert.equal(shouldCharactersGreet(a, { ...b, direction: 'right' }, 1920), false);
  assert.equal(shouldCharactersGreet(a, { ...b, left: 1500, right: 1700 }, 1920), false);
});
test('화면 일부에 보이는 캐릭터도 인사하지만 완전히 밖이면 제외한다', () => {
  assert.equal(shouldCharactersGreet({ ...a, left: -10, right: 190 }, { ...b, left: 200, right: 400 }, 1920), true);
  assert.equal(shouldCharactersGreet({ ...a, left: -210, right: -10 }, b, 1920), false);
});
test('프레임 지연으로 교차 순간을 건너뛰어도 인사를 놓치지 않는다', () => {
  const rightward = { ...a, left: 1000, right: 1200, previousCenter: 900 };
  const leftward = { ...b, left: 850, right: 1050, previousCenter: 1100 };
  assert.equal(shouldCharactersGreet(rightward, leftward, 1920), true);
  assert.equal(shouldCharactersGreet({ ...rightward, previousCenter: 1100 }, { ...leftward, previousCenter: 950 }, 1920), false);
});
