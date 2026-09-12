import assert from 'node:assert/strict';
import test from 'node:test';
import { getStudentHouseCelebration } from '../components/student/StudentHouseCelebration';
import { STUDENT_HOUSE_DESIGNS } from './studentEconomy';

test('집 수리는 기존 집의 복원 연출로, 집 구매는 실제 선택한 디자인으로 연결된다', () => {
  assert.deepEqual(getStudentHouseCelebration({ type: 'buy_item', itemId: 'house_repair' }), { kind: 'repair', name: '우리 집', imageSrc: '/student-house-after.webp' });
  for (const house of STUDENT_HOUSE_DESIGNS) {
    assert.deepEqual(getStudentHouseCelebration({ type: 'buy_house', houseId: house.id }), { kind: 'purchase', name: house.name, imageSrc: house.imageSrc });
    assert.equal(getStudentHouseCelebration({ type: 'select_house', houseId: house.id }), null);
  }
  assert.equal(getStudentHouseCelebration({ type: 'buy_item', itemId: 'pencil' }), null);
});
