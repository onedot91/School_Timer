import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLASSROOM_ROLE_NAMES,
  getClassroomRoleAssignments,
  getClassroomRoleMissionBalanceDelta,
  getStudentClassroomRole,
  normalizeClassroomRoleMissionSettings,
  setClassroomRoleMissionResult,
  setClassroomRoleMissionStartForDate,
} from './classroomRoleMission.js';

test('1인 1역은 기준일에 1번부터 역할 6개를 번호순으로 배정한다', () => {
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 1,
  });

  assert.deepEqual(
    getClassroomRoleAssignments(settings, '2026-08-26'),
    CLASSROOM_ROLE_NAMES.map((roleName, index) => ({
      roleName,
      studentNumber: index + 1,
    })),
  );
});

test('보상과 차감 결과를 바꾸면 이미 반영된 금액과의 차이만 계산한다', () => {
  assert.equal(getClassroomRoleMissionBalanceDelta(undefined, 'rewarded'), 20);
  assert.equal(getClassroomRoleMissionBalanceDelta(undefined, 'penalized'), -20);
  assert.equal(getClassroomRoleMissionBalanceDelta('rewarded', 'penalized'), -40);
  assert.equal(getClassroomRoleMissionBalanceDelta('penalized', 'rewarded'), 40);
  assert.equal(getClassroomRoleMissionBalanceDelta('rewarded', 'rewarded'), 0);
  assert.equal(getClassroomRoleMissionBalanceDelta('rewarded', undefined), -20);
  assert.equal(getClassroomRoleMissionBalanceDelta('penalized', undefined), 20);
});

test('다음 날에는 모든 역할 담당 번호가 한 칸 앞으로 이동한다', () => {
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 1,
  });

  assert.equal(getStudentClassroomRole(settings, 1, '2026-08-27'), null);
  assert.equal(getStudentClassroomRole(settings, 2, '2026-08-27')?.roleName, '칠판 전문가');
  assert.equal(getStudentClassroomRole(settings, 7, '2026-08-27')?.roleName, '우유 전문가');
});

test('23번 뒤에는 1번으로 이어서 배정한다', () => {
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 21,
  });

  assert.deepEqual(
    getClassroomRoleAssignments(settings, '2026-08-26').map((assignment) => assignment.studentNumber),
    [21, 22, 23, 1, 2, 3],
  );
});

test('교사가 오늘 시작 번호를 바꾸면 그 날짜부터 새 순환이 시작된다', () => {
  const original = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 1,
  });
  const adjusted = setClassroomRoleMissionStartForDate(original, 10, '2026-08-28');

  assert.equal(getStudentClassroomRole(adjusted, 10, '2026-08-28')?.roleName, '칠판 전문가');
  assert.equal(getStudentClassroomRole(adjusted, 11, '2026-08-29')?.roleName, '칠판 전문가');
});

test('당일 보상과 차감 결과를 학생별로 한 번만 기록한다', () => {
  const settings = normalizeClassroomRoleMissionSettings(null);
  const rewarded = setClassroomRoleMissionResult(settings, 1, 'rewarded', '2026-08-26');
  const repeated = setClassroomRoleMissionResult(rewarded, 1, 'rewarded', '2026-08-26');
  const penalized = setClassroomRoleMissionResult(repeated, 1, 'penalized', '2026-08-26');

  assert.equal(rewarded.results['2026-08-26']?.['1'], 'rewarded');
  assert.deepEqual(repeated, rewarded);
  assert.equal(penalized.results['2026-08-26']?.['1'], 'penalized');
});

test('같은 결과 버튼을 다시 누르면 당일 기록을 취소한다', () => {
  const settings = normalizeClassroomRoleMissionSettings(null);
  const rewarded = setClassroomRoleMissionResult(settings, 1, 'rewarded', '2026-08-26');
  const cancelled = setClassroomRoleMissionResult(rewarded, 1, undefined, '2026-08-26');

  assert.equal(cancelled.results['2026-08-26'], undefined);
});
