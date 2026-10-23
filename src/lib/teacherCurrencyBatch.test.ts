import assert from 'node:assert/strict';
import test from 'node:test';
import { addTeacherCurrencyClick, pendingTeacherCurrencyDelta, type TeacherCurrencyClickBatch } from './teacherCurrencyBatch.js';
import { CURRENCY_BALANCE_MAX } from './currency.js';

const allStudents = Array.from({ length: 23 }, (_, index) => index + 1);
const all = (delta: number): TeacherCurrencyClickBatch => ({ target: 'all', key: 'all', studentNumbers: allStudents, delta });

test('같은 대상의 연속 클릭은 요청 하나로 합친다', () => {
  let batch: TeacherCurrencyClickBatch | null = null;
  let requests = 0;
  for (let click = 0; click < 20; click += 1) {
    const next = addTeacherCurrencyClick(batch, all(5));
    if (next.flush) requests += 1;
    batch = next.batch;
  }
  assert.equal(requests, 0);
  assert.equal(batch?.delta, 100);
  assert.equal(pendingTeacherCurrencyDelta(batch, [], 'all', 'all'), 100);
});

test('차감 클릭도 같은 방식으로 합치고 +/− 상쇄는 0이 된다', () => {
  let batch = addTeacherCurrencyClick(null, all(-5)).batch;
  batch = addTeacherCurrencyClick(batch, all(-5)).batch;
  assert.equal(batch.delta, -10);
  batch = addTeacherCurrencyClick(batch, all(10)).batch;
  assert.equal(batch.delta, 0);
});

test('대상이나 선택 학생이 바뀌면 이전 묶음을 먼저 보낸다', () => {
  const group = addTeacherCurrencyClick(null, { target: 'group', key: '1,2', studentNumbers: [1, 2], delta: 5 }).batch;
  const changed = addTeacherCurrencyClick(group, { target: 'group', key: '1,2,3', studentNumbers: [1, 2, 3], delta: 5 });
  assert.deepEqual(changed.flush, group);
  assert.equal(changed.batch.delta, 5);
  const switched = addTeacherCurrencyClick(changed.batch, all(-5));
  assert.equal(switched.flush?.key, '1,2,3');
  assert.equal(addTeacherCurrencyClick(addTeacherCurrencyClick(null, all(5)).batch, { ...all(5), delta: -5 }).flush, null);
});

test('상쇄되어 0인 묶음은 대상이 바뀌어도 보내지 않는다', () => {
  const zero = addTeacherCurrencyClick(addTeacherCurrencyClick(null, all(5)).batch, all(-5)).batch;
  assert.equal(addTeacherCurrencyClick(zero, { target: 'student', key: '3', studentNumbers: [3], delta: 5 }).flush, null);
});

test('저장 대기 표시는 같은 대상·선택의 미전송 묶음과 응답 대기 요청만 더한다', () => {
  const pending = [
    { requestId: 'a', target: 'all' as const, key: 'all', delta: 50 },
    { requestId: 'b', target: 'group' as const, key: '1,2', delta: 5 },
  ];
  assert.equal(pendingTeacherCurrencyDelta(all(15), pending, 'all', 'all'), 65);
  assert.equal(pendingTeacherCurrencyDelta(all(15), pending, 'group', '1,2'), 5);
  assert.equal(pendingTeacherCurrencyDelta(null, pending, 'group', '3'), 0);
});

test('합친 금액은 저장 가능한 최대치를 넘지 않는다', () => {
  const batch = addTeacherCurrencyClick(all(CURRENCY_BALANCE_MAX), all(5)).batch;
  assert.equal(batch.delta, CURRENCY_BALANCE_MAX);
});

test('묶인 클릭은 첫 클릭 시각을 유지하고 새 묶음은 새 클릭 시각으로 시작한다', () => {
  const first = addTeacherCurrencyClick(null, { ...all(5), clickedAt: 100 });
  const merged = addTeacherCurrencyClick(first.batch, { ...all(5), clickedAt: 400 });
  assert.equal(merged.batch.clickedAt, 100);
  const other = addTeacherCurrencyClick(merged.batch, { target: 'student', key: '3', studentNumbers: [3], delta: 1, clickedAt: 900 });
  assert.equal(other.flush?.clickedAt, 100);
  assert.equal(other.batch.clickedAt, 900);
});
