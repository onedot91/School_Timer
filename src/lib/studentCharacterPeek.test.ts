import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PEEK_MAX_UPSCALE,
  classifyPeekShape,
  computePeekLayout,
  findOpaqueBounds,
  getOppositeCorner,
  getPeekAngle,
  getPeekFacingTransform,
  pickPeekCorner,
  type PeekContentBox,
} from './studentCharacterPeek.js';
import { STUDENT_CHARACTERS } from './studentCharacters.js';

const viewport = { width: 1920, height: 1080 };
const box = (width: number, height: number, margin = 0): PeekContentBox => ({
  naturalWidth: width + margin * 2,
  naturalHeight: height + margin * 2,
  x: margin,
  y: margin,
  width,
  height,
});

test('실제 그림 영역 비율로 세로형·둥근형·가로형을 나눈다', () => {
  assert.equal(classifyPeekShape(436, 739), 'tall'); // 1번 호랑이
  assert.equal(classifyPeekShape(1090, 1024), 'round'); // 5번 별
  assert.equal(classifyPeekShape(1407, 555), 'wide'); // 7번 자동차
});

test('머리(그림 위쪽)가 항상 화면 안쪽을 향하도록 기울인다', () => {
  for (const shape of ['tall', 'round'] as const) {
    const cases = [
      ['bottom-left', 1, -1],
      ['bottom-right', -1, -1],
      ['top-left', 1, 1],
      ['top-right', -1, 1],
    ] as const;
    for (const [corner, expectX, expectY] of cases) {
      const radians = (getPeekAngle(corner, shape) * Math.PI) / 180;
      assert.equal(Math.sign(Math.sin(radians)), expectX, `${shape} ${corner} x`);
      assert.equal(Math.sign(-Math.cos(radians)), expectY, `${shape} ${corner} y`);
    }
  }
  assert.equal(getPeekAngle('bottom-left', 'wide'), 0);
});

test('가로형(자동차 등)은 거꾸로 매달리지 않도록 아래 모서리만 쓰고 직전 모서리는 피한다', () => {
  let seed = 0;
  const random = () => {
    seed = (seed + 0.137) % 1;
    return seed;
  };
  for (let index = 0; index < 50; index += 1) {
    assert.match(pickPeekCorner(random, 'wide', null), /^bottom-/);
    assert.notEqual(pickPeekCorner(random, 'tall', 'bottom-left'), 'bottom-left');
  }
});

test('투명 여백을 빼고 실제 그림 영역 기준으로 크기와 위치를 잡는다', () => {
  const withMargin = computePeekLayout(box(400, 800, 200), viewport, 'bottom-left');
  const withoutMargin = computePeekLayout(box(400, 800), viewport, 'bottom-left');
  assert.equal(withMargin.boxHeight, withoutMargin.boxHeight);
  assert.ok(withMargin.imageOffsetX < 0 && withMargin.imageOffsetY < 0);
  assert.ok(withMargin.imageWidth > withMargin.boxWidth);
});

test('원본보다 지나치게 키우지 않는다', () => {
  const tiny = computePeekLayout(box(80, 160), viewport, 'bottom-right');
  assert.ok(tiny.boxHeight <= 160 * PEEK_MAX_UPSCALE + 0.1);
});

test('빼꼼한 상태에서는 그림의 절반 정도만 보이고 숨은 상태에서는 화면 밖에 있다', () => {
  const tall = computePeekLayout(box(436, 739), viewport, 'bottom-left');
  assert.ok(tall.shownY > tall.boxHeight * 0.4 && tall.shownY < tall.boxHeight * 0.6);
  assert.ok(tall.hiddenY > tall.boxHeight);
  assert.ok(tall.overY < tall.shownY);

  const car = computePeekLayout(box(1407, 555), viewport, 'bottom-right');
  assert.equal(car.angle, 0);
  assert.ok(car.hiddenX > car.boxWidth / 2);
  assert.ok(car.shownX < 0 && car.overX < car.shownX);
});

test('말풍선은 화면 안쪽으로 붙고 화면 밖으로 나가지 않는다', () => {
  for (const corner of ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const) {
    const layout = computePeekLayout(box(500, 900), viewport, corner);
    assert.equal(layout.bubbleAlign, corner.endsWith('left') ? 'start' : 'end');
    assert.equal(layout.bubbleSide, corner.startsWith('top') ? 'below' : 'above');
    assert.ok(layout.bubbleX >= 12 && layout.bubbleX <= viewport.width - 12);
    assert.ok(layout.bubbleY >= 12 && layout.bubbleY <= viewport.height - 12);
  }
});

test('빼꼼 때는 좌우 반전만 이어받고 걷기용 회전은 쓰지 않는다', () => {
  assert.equal(getPeekFacingTransform('scaleX(-1)'), 'scaleX(-1)');
  assert.equal(getPeekFacingTransform('rotate(90deg)'), 'none');
  assert.equal(getPeekFacingTransform(undefined), 'none');
  assert.equal(getOppositeCorner('bottom-left'), 'bottom-right');
});

test('알파 채널에서 실제 그림 영역을 찾는다', () => {
  const width = 4;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  data[(1 * width + 2) * 4 + 3] = 255;
  data[(2 * width + 1) * 4 + 3] = 255;
  assert.deepEqual(findOpaqueBounds(data, width, height), { x: 1, y: 1, width: 2, height: 2 });
  assert.equal(findOpaqueBounds(new Uint8ClampedArray(16), 2, 2), null);
});

test('얼굴이 없는 자동차 캐릭터는 두리번 대신 흔들기 몸짓을 쓴다', () => {
  const car = STUDENT_CHARACTERS.find(({ id }) => id === 'student-7-orange-car');
  assert.equal(car?.peekGesture, 'wiggle');
});

test('6번 학생의 마법사 캐릭터가 다시 등록되어 있다', () => {
  const sixth = STUDENT_CHARACTERS.filter(({ creatorName }) => creatorName === '6번').map(({ id }) => id);
  assert.deepEqual(sixth.sort(), ['student-6-additional', 'student-6-wizard']);
});
