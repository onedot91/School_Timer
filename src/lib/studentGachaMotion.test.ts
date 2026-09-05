import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StudentCharacterGacha from '../components/student/StudentCharacterGacha';
import { STUDENT_CHARACTER_PRIZES, createStudentEconomyState } from './studentEconomy.ts';

import { getStudentClawDropMotion, getStudentCapsuleTransfer, getCommittedStudentGachaPrizes } from './studentGachaMotion.ts';

test('집게는 선택한 캡슐 중심까지 내려가고 케이블을 같은 거리만큼 늘린다', () => {
  const motion = getStudentClawDropMotion({
    caughtCapsuleCenterY: 382.09,
    targetCapsuleCenterY: 675.1,
    cableHeight: 66.4,
  });

  assert.equal(motion.dropDistance, 293.01);
  assert.equal(motion.cableScale, 5.41);
});

test('캡슐이 집게보다 위에 있거나 케이블 높이가 없어도 음수·무한 배율을 만들지 않는다', () => {
  assert.deepEqual(getStudentClawDropMotion({ caughtCapsuleCenterY: 300, targetCapsuleCenterY: 250, cableHeight: 60 }), { dropDistance: 0, cableScale: 1 });
  assert.deepEqual(getStudentClawDropMotion({ caughtCapsuleCenterY: 300, targetCapsuleCenterY: 500, cableHeight: 0 }), { dropDistance: 200, cableScale: 1 });
});


test('다섯 위치의 캡슐이 중앙 무대에서도 원래 중심과 크기로 시작한다', () => {
  const target = { left: 464, top: 160, width: 352, height: 352 };
  for (const center of [164, 311, 458, 605, 752]) {
    const origin = { left: center - 62.4, top: 310, width: 124.8, height: 124.8 };
    const transfer = getStudentCapsuleTransfer(origin, target);
    assert.equal(target.left + target.width / 2 + transfer.x, center);
    assert.equal(target.top + target.height / 2 + transfer.y, origin.top + origin.height / 2);
    assert.ok(Math.abs(target.width * transfer.scale - origin.width) < .001);
  }
});

test('저장 확인과 새로운 소유 스킨이 모두 도착하기 전에는 결과를 공개하지 않는다', () => {
  const [oldPrize, newPrize] = STUDENT_CHARACTER_PRIZES;
  const before = [oldPrize.id];
  assert.deepEqual(getCommittedStudentGachaPrizes(false, before, [...before, newPrize.id], newPrize.id), []);
  assert.deepEqual(getCommittedStudentGachaPrizes(true, before, before, oldPrize.id), []);
  assert.deepEqual(getCommittedStudentGachaPrizes(true, before, [...before, newPrize.id], newPrize.id), [newPrize.id]);
});

test('소유 목록이 갱신될 때 확정된 활성 스킨을 우선하고 이미 가진 스킨은 결과로 삼지 않는다', () => {
  const [oldPrize, otherPrize, drawnPrize] = STUDENT_CHARACTER_PRIZES;
  assert.deepEqual(getCommittedStudentGachaPrizes(true, [oldPrize.id], [oldPrize.id, otherPrize.id, drawnPrize.id], drawnPrize.id), [drawnPrize.id, otherPrize.id]);
  assert.deepEqual(getCommittedStudentGachaPrizes(true, [oldPrize.id], [oldPrize.id, drawnPrize.id], oldPrize.id), [drawnPrize.id]);
});


test('스킨 뽑기는 사용 가능 잔액이 부족하면 구매 진입을 막고 이유를 표시한다', () => {
  const markup = renderToStaticMarkup(createElement(StudentCharacterGacha, {
    state: createStudentEconomyState(), availableBalance: 99, isSaving: false, onAction: async () => true,
  }));
  assert.match(markup, /class="student-character-draw-button" disabled=""/);
  assert.match(markup, /사용 가능한 고마가 100 고마보다 적어요/);
  assert.doesNotMatch(markup, /aria-modal="true"/);
});

test('전체 스킨을 모았거나 다른 저장이 진행 중이면 새 뽑기를 시작하지 않는다', () => {
  for (const complete of [true, false]) {
    const markup = renderToStaticMarkup(createElement(StudentCharacterGacha, {
      state: { ...createStudentEconomyState(), ownedCharacterIds: complete ? STUDENT_CHARACTER_PRIZES.map((prize) => prize.id) : [] },
      availableBalance: 1000, isSaving: !complete, onAction: async () => true,
    }));
    assert.match(markup, /class="student-character-draw-button" disabled=""/);
    if (complete) assert.match(markup, /모든 스킨을 모았어요/);
  }
});
