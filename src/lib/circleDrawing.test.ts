import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CIRCLE_DRAWING_CANVAS_SIZE,
  decodeCircleDrawingPoints,
  encodeCircleDrawingPoints,
  getCircleDrawingChallenge,
  getCircleDrawingReward,
  normalizeStudentCircleDrawingProgress,
  scoreCircleDrawing,
  thinCircleDrawingPoints,
  type CircleDrawingChallenge,
  type CircleDrawingPoint,
} from './circleDrawing';

const challenge: CircleDrawingChallenge = { centerX: 200, centerY: 200, radius: 120 };

const arc = (radius: (angle: number) => number, turns = 1, steps = 240, start = 0): CircleDrawingPoint[] => (
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = start + (index / steps) * turns * Math.PI * 2;
    return [200 + Math.cos(angle) * radius(angle), 200 + Math.sin(angle) * radius(angle)];
  })
);

test('a true circle scores close to 100', () => {
  const result = scoreCircleDrawing(decodeCircleDrawingPoints(encodeCircleDrawingPoints(arc(() => 120))) ?? [], challenge);
  assert.ok(result);
  assert.ok(result.score >= 98, `score ${result.score}`);
});

test('a wobbly circle scores lower than a smooth one', () => {
  const smooth = scoreCircleDrawing(arc(() => 120), challenge);
  const wobbly = scoreCircleDrawing(arc((angle) => 120 + Math.sin(angle * 6) * 14), challenge);
  assert.ok(smooth && wobbly);
  assert.ok(wobbly.score < smooth.score);
  assert.ok(wobbly.score > 40 && wobbly.score < 90, `score ${wobbly.score}`);
});

test('a circle of the wrong size scores low even if it is round', () => {
  const tooSmall = scoreCircleDrawing(arc(() => 60), challenge);
  assert.ok(tooSmall === null || tooSmall.score < 10, `score ${tooSmall?.score}`);
  const slightlyBig = scoreCircleDrawing(arc(() => 132), challenge);
  assert.ok(slightlyBig);
  assert.ok(slightlyBig.score >= 60 && slightlyBig.score <= 70, `score ${slightlyBig.score}`);
});

test('a circle around the wrong centre loses points', () => {
  const shifted = arc(() => 120).map(([x, y]): CircleDrawingPoint => [x + 20, y]);
  const result = scoreCircleDrawing(shifted, challenge);
  assert.ok(result);
  assert.ok(result.score < 90, `score ${result.score}`);
});

test('half a circle is penalised and a short line is not scored', () => {
  const threeQuarters = scoreCircleDrawing(arc(() => 120, 0.75), challenge);
  assert.ok(threeQuarters);
  assert.ok(threeQuarters.score < 70, `score ${threeQuarters.score}`);
  assert.equal(scoreCircleDrawing(arc(() => 120, 0.3), challenge), null);
  assert.equal(scoreCircleDrawing([[200, 80], [201, 80]], challenge), null);
});

test('drawing speed does not change the score', () => {
  const even = arc(() => 120 + 6, 1, 120);
  // Same shape, but the first half was drawn slowly (many more samples).
  const uneven = [...arc(() => 126, 0.5, 600), ...arc(() => 126, 0.5, 60, Math.PI).slice(1)];
  const left = scoreCircleDrawing(even, challenge);
  const right = scoreCircleDrawing(uneven, challenge);
  assert.ok(left && right);
  assert.ok(Math.abs(left.score - right.score) <= 1, `${left.score} vs ${right.score}`);
});

test('daily challenges are fixed per student and fit inside the canvas', () => {
  assert.deepEqual(getCircleDrawingChallenge(3, '2026-11-23'), getCircleDrawingChallenge(3, '2026-11-23'));
  const seen = new Set<string>();
  for (let student = 1; student <= 23; student += 1) {
    for (const date of ['2026-11-23', '2026-11-24', '2026-12-01']) {
      const { centerX, centerY, radius } = getCircleDrawingChallenge(student, date);
      seen.add(`${centerX}:${centerY}:${radius}`);
      assert.ok(radius >= 90 && radius <= 150);
      assert.ok(centerX - radius >= 20 && centerX + radius <= CIRCLE_DRAWING_CANVAS_SIZE - 20);
      assert.ok(centerY - radius >= 20 && centerY + radius <= CIRCLE_DRAWING_CANVAS_SIZE - 20);
    }
  }
  assert.ok(seen.size > 40);
});

test('rewards follow the score tiers', () => {
  assert.equal(getCircleDrawingReward(100), 20);
  assert.equal(getCircleDrawingReward(90), 20);
  assert.equal(getCircleDrawingReward(89), 15);
  assert.equal(getCircleDrawingReward(75), 15);
  assert.equal(getCircleDrawingReward(74), 10);
  assert.equal(getCircleDrawingReward(60), 10);
  assert.equal(getCircleDrawingReward(59), 5);
  assert.equal(getCircleDrawingReward(0), 5);
});

test('point encoding rejects malformed or oversized input', () => {
  assert.deepEqual(decodeCircleDrawingPoints('1,2;300,400'), [[1, 2], [300, 400]]);
  assert.equal(decodeCircleDrawingPoints('1,2;401,0'), null);
  assert.equal(decodeCircleDrawingPoints('1,2;-1,0'), null);
  assert.equal(decodeCircleDrawingPoints('1.5,2'), null);
  assert.equal(decodeCircleDrawingPoints(''), null);
  assert.equal(decodeCircleDrawingPoints(Array.from({ length: 601 }, () => '1,1').join(';')), null);
  const thinned = thinCircleDrawingPoints(arc(() => 120, 1, 2000));
  assert.equal(thinned.length, 600);
  assert.notEqual(decodeCircleDrawingPoints(encodeCircleDrawingPoints(thinned)), null);
});

test('stored progress keeps only valid entries', () => {
  const entry = { score: 82, points: '1,2;3,4', submittedAt: '2026-11-23T01:00:00.000Z' };
  assert.deepEqual(normalizeStudentCircleDrawingProgress({
    '3:2026-11-23': entry,
    '4:2026-11-23': { ...entry, score: 101 },
    '5:2026-11-23': { ...entry, points: 'nope' },
    bad: entry,
  }), { '3:2026-11-23': entry });
  assert.deepEqual(normalizeStudentCircleDrawingProgress(null), {});
});
