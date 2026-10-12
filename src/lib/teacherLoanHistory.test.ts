import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalTeacherLoanReport, getTeacherLoanStatusLabel, parseTeacherLoanReport } from './teacherLoanHistory.js';
import { normalizeStudentEconomyStates } from './studentEconomy.js';

test('학생별 대출은 원금과 이자 포함 상환액을 구분하고 테스트 학생을 제외한다', () => {
  const report = createLocalTeacherLoanReport(normalizeStudentEconomyStates({ '3': { loan: 44, loanPrincipal: 40, loanDueDate: '2026-10-15' }, '24': { loan: 22, loanPrincipal: 20 } }));
  assert.equal(report.students.length, 23);
  assert.deepEqual(report.students[2], { studentNumber: 3, principal: 40, repaymentAmount: 44, dueDate: '2026-10-15' });
  assert.equal(report.students.some(row => row.studentNumber === 24), false);
  assert.equal(report.source, 'local');
  assert.deepEqual(report.entries, []);
});

test('상환 기한 당일은 상환 중이고 다음 날부터 연체로 표시한다', () => {
  const status = { studentNumber: 3, principal: 40, repaymentAmount: 44, dueDate: '2026-10-15' };
  assert.equal(getTeacherLoanStatusLabel(status, '2026-10-15'), '상환 중');
  assert.equal(getTeacherLoanStatusLabel(status, '2026-10-16'), '연체');
  assert.equal(getTeacherLoanStatusLabel({ ...status, repaymentAmount: 0 }, '2026-10-16'), '대출 없음');
});

test('조회 응답은 학생 중복·잘못된 금액·잘못된 날짜를 거부한다', () => {
  const report = createLocalTeacherLoanReport({});
  assert.equal(parseTeacherLoanReport(report).students.length, 23);
  assert.throws(() => parseTeacherLoanReport({ ...report, students: [...report.students.slice(1), report.students[1]] }));
  assert.throws(() => parseTeacherLoanReport({ ...report, students: report.students.map(row => row.studentNumber === 3 ? { ...row, principal: 20, repaymentAmount: 10 } : row) }));
  assert.throws(() => parseTeacherLoanReport({ ...report, checkedAt: '잘못된 날짜' }));
  assert.throws(() => parseTeacherLoanReport({ ...report, students: report.students.map(row => row.studentNumber === 3 ? { ...row, dueDate: '2026-02-30' } : row) }));
  assert.throws(() => parseTeacherLoanReport({ ...report, entries: [{ id: 'bad', studentNumber: 3, type: 'borrow', amount: 0, principalAfter: 0, repaymentAfter: 0, dueDate: null, createdAt: report.checkedAt }] }));
});
