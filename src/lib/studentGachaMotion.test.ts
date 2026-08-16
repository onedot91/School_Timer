import assert from 'node:assert/strict';
import test from 'node:test';

import { getStudentClawDropMotion } from './studentGachaMotion.ts';

test('집게는 선택한 캡슐 중심까지 내려가고 케이블을 같은 거리만큼 늘린다', () => {
  const motion = getStudentClawDropMotion({
    caughtCapsuleCenterY: 382.09,
    targetCapsuleCenterY: 675.1,
    cableHeight: 66.4,
  });

  assert.equal(motion.dropDistance, 293.01);
  assert.equal(motion.cableScale, 5.41);
});
