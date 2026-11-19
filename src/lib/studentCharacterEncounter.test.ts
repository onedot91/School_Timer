import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartDoughChase, getDoughChasePlan, getDoughEncounter, shouldCharactersGreet } from './studentCharacterEncounter.js';
const a = { lane: '-1', direction: 'right', left: 800, right: 1000 };
const b = { lane: '-1', direction: 'left', left: 1010, right: 1210 };
test('반죽이와 노란 캐릭터의 조합만 먹는 연출 대상이다', () => {
  const expected = { eater: 'student-12-dough-eater', dough: 'student-12-clover' };
  assert.deepEqual(getDoughEncounter(expected.eater, expected.dough), expected);
  assert.deepEqual(getDoughEncounter(expected.dough, expected.eater), expected);
  assert.equal(getDoughEncounter(expected.eater, 'student-12-additional'), null);
  assert.equal(getDoughEncounter(expected.dough, undefined), null);
});
test('먹는 연출은 두 이미지가 충분히 겹칠 때 시작한다', () => {
  assert.equal(shouldCharactersGreet(a, { ...b, left: 980, right: 1180 }, 1920, .32), false);
  assert.equal(shouldCharactersGreet(a, { ...b, left: 925, right: 1125 }, 1920, .32), true);
  assert.equal(shouldCharactersGreet(a, { ...b, left: 925, right: 1125, direction: 'right' }, 1920, .32), false);
  assert.equal(shouldCharactersGreet(a, { ...b, left: 925, right: 1125, lane: '1' }, 1920, .32), false);
});
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
test('노란 자캐와 반죽이가 한 화면 안에 보이면 줄이 달라도 쫓아가기를 시작한다', () => {
  const eater = { left: 100, right: 300, bottom: 600 };
  const dough = { left: 1500, right: 1700, bottom: 420 };
  assert.equal(canStartDoughChase(eater, dough, 1920), true);
  assert.equal(canStartDoughChase({ ...eater, left: -150, right: 50 }, dough, 1920), false);
  assert.equal(canStartDoughChase(eater, { ...dough, left: 1800, right: 2000 }, 1920), false);
});
test('쫓아가기는 반죽이 옆 같은 높이에서 멈추고 거리에 맞춰 시간이 정해진다', () => {
  const dough = { left: 1000, right: 1200, bottom: 420 };
  const fromLeft = getDoughChasePlan({ left: 100, right: 300, bottom: 600 }, dough);
  assert.equal(fromLeft.dx, 1100 - 120 - 200);
  assert.equal(fromLeft.dy, -180);
  assert.ok(fromLeft.durationMs > 700 && fromLeft.durationMs <= 2600);
  const fromRight = getDoughChasePlan({ left: 1500, right: 1700, bottom: 420 }, dough);
  assert.equal(fromRight.dx, 1100 + 120 - 1600);
  assert.equal(fromRight.dy, 0);
  assert.equal(getDoughChasePlan({ left: 960, right: 1160, bottom: 420 }, dough).durationMs, 700);
});
