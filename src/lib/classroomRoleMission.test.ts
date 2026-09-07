import { CURRENCY_BALANCE_MAX, normalizeCurrencyHistory } from './currency.js';
import { normalizeStudentLifeState } from './studentLife.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLASSROOM_ROLE_ASSIGNMENT_NAMES,
  applyClassroomRoleMissionResultInSettings,
  isClassroomRoleSchoolDay,
  getClassroomRoleAssignments,
  getClassroomRoleMissionBalanceDelta,
  getStudentClassroomRole,
  normalizeClassroomRoleMissionSettings,
  setClassroomRoleMissionResult,
  setClassroomRoleMissionStartForDate,
} from './classroomRoleMission.js';

test('1인 1역은 다섯 역할에 한 명씩, 우유 전문가에 두 명을 번호순으로 배정한다', () => {
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 1,
  });

  assert.deepEqual(
    getClassroomRoleAssignments(settings, '2026-08-26'),
    CLASSROOM_ROLE_ASSIGNMENT_NAMES.map((roleName, index) => ({
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
  assert.equal(getStudentClassroomRole(settings, 8, '2026-08-27')?.roleName, '우유 전문가');
});

test('23번 뒤에는 1번으로 이어서 배정한다', () => {
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: '2026-08-26',
    anchorStartStudentNumber: 21,
  });

  assert.deepEqual(
    getClassroomRoleAssignments(settings, '2026-08-26').map((assignment) => assignment.studentNumber),
    [21, 22, 23, 1, 2, 3, 4],
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
  assert.equal(getStudentClassroomRole(adjusted, 11, '2026-08-31')?.roleName, '칠판 전문가');
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


test('금요일 배정은 주말에 유지하고 월요일에 한 칸 이동하며 주말 학생 미션은 없다', () => {
  const settings = normalizeClassroomRoleMissionSettings({ anchorDateKey: '2026-09-04', anchorStartStudentNumber: 23 });
  for (const date of ['2026-09-04', '2026-09-05', '2026-09-06']) {
    assert.equal(getClassroomRoleAssignments(settings, date)[0]?.studentNumber, 23);
  }
  assert.equal(getClassroomRoleAssignments(settings, '2026-09-07')[0]?.studentNumber, 1);
  assert.equal(getStudentClassroomRole(settings, 23, '2026-09-05'), null);
  assert.equal(isClassroomRoleSchoolDay('2026-09-06'), false);
  const adjusted = setClassroomRoleMissionStartForDate(settings, 5, '2026-09-07');
  assert.equal(getClassroomRoleAssignments(adjusted, '2026-09-04')[0]?.studentNumber, 4);
  assert.equal(getClassroomRoleAssignments(adjusted, '2026-09-06')[0]?.studentNumber, 4);
  assert.equal(getClassroomRoleAssignments(adjusted, '2026-09-08')[0]?.studentNumber, 6);
});

test('역할 차감과 결과, 기록, 기존 양식 우편을 함께 만들고 재시도와 재선택에 중복하지 않는다', () => {
  const initial = {
    classroomRoleMission: { anchorDateKey: '2026-09-07', anchorStartStudentNumber: 1 },
    currencyBalances: { '1': 100, '2': 777 },
    currencyHistory: { '1': [], '2': [{ unrelated: true }] },
    studentLife: { letters: [] },
    otherDomain: { preserved: true },
  };
  const command = { studentNumber: 1, nextResult: 'penalized' as const, dateKey: '2026-09-07', requestId: 'first', createdAt: '2026-09-07T01:00:00.000Z' };
  const saved = applyClassroomRoleMissionResultInSettings(initial, command);
  assert.deepEqual(saved.currencyBalances, { '1': 80, '2': 777 });
  assert.deepEqual(saved.otherDomain, initial.otherDomain);
  assert.deepEqual(Reflect.get(Object(saved.currencyHistory), '2'), initial.currencyHistory['2']);
  assert.equal(normalizeClassroomRoleMissionSettings(saved.classroomRoleMission).results['2026-09-07']?.['1'], 'penalized');
  const letters = normalizeStudentLifeState(saved.studentLife).letters;
  assert.equal(letters.length, 1);
  assert.equal(letters[0].recipient, 1);
  assert.equal(letters[0].title, '고마 차감 안내');
  assert.equal(letters[0].content, '선생님이 20고마를 차감했어요.\n\n차감 사유\n: 1인1역 제대로 하지 않음');
  assert.deepEqual(applyClassroomRoleMissionResultInSettings(saved, command), saved);
  const cancelled = applyClassroomRoleMissionResultInSettings(saved, { ...command, nextResult: undefined, requestId: 'cancel' });
  assert.equal(Reflect.get(Object(cancelled.currencyBalances), '1'), 100);
  const penalizedAgain = applyClassroomRoleMissionResultInSettings(cancelled, { ...command, requestId: 'again' });
  assert.equal(Reflect.get(Object(penalizedAgain.currencyBalances), '1'), 80);
  assert.equal(normalizeStudentLifeState(penalizedAgain.studentLife).letters.length, 1);
  assert.deepEqual(applyClassroomRoleMissionResultInSettings(penalizedAgain, { ...command, dateKey: '2026-09-12', requestId: 'weekend' }), penalizedAgain);
});

test('지급 취소는 차감 우편을 보내지 않으며 지급에서 미수행으로 바꾸면 실제 차액을 안내한다', () => {
  const initial = { classroomRoleMission: { anchorDateKey: '2026-09-07', anchorStartStudentNumber: 1 }, currencyBalances: { '1': 100 } };
  const command = { studentNumber: 1, dateKey: '2026-09-07', requestId: 'reward', createdAt: '2026-09-07T01:00:00.000Z' };
  const rewarded = applyClassroomRoleMissionResultInSettings(initial, { ...command, nextResult: 'rewarded' });
  const cancelled = applyClassroomRoleMissionResultInSettings(rewarded, { ...command, requestId: 'cancel', nextResult: undefined });
  assert.equal(normalizeStudentLifeState(cancelled.studentLife).letters.length, 0);
  const penalized = applyClassroomRoleMissionResultInSettings(rewarded, { ...command, requestId: 'penalty', nextResult: 'penalized' });
  assert.equal(Reflect.get(Object(penalized.currencyBalances), '1'), 80);
  assert.match(normalizeStudentLifeState(penalized.studentLife).letters[0].content, /40고마/);
});


test('잔액 상하한에서도 역할 수행 결과의 멱등성 기록은 남는다', () => {
  for (const [balance, nextResult] of [[0, 'penalized'], [CURRENCY_BALANCE_MAX, 'rewarded']] as const) {
    const initial = {
      classroomRoleMission: { anchorDateKey: '2026-09-07', anchorStartStudentNumber: 1 },
      currencyBalances: { '1': balance },
      currencyHistory: { '1': [] },
    };
    const command = { studentNumber: 1, nextResult, dateKey: '2026-09-07', requestId: `limit-${nextResult}`, createdAt: '2026-09-07T01:00:00.000Z' };
    const saved = applyClassroomRoleMissionResultInSettings(initial, command);
    const entries = normalizeCurrencyHistory(saved.currencyHistory)['1'];
    assert.equal(Reflect.get(Object(saved.currencyBalances), '1'), balance);
    assert.equal(normalizeClassroomRoleMissionSettings(saved.classroomRoleMission).results['2026-09-07']?.['1'], nextResult);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].delta, 0);
    assert.equal(entries[0].reason, 'classroom_role');
    assert.equal(entries[0].id, `classroom-role-${command.requestId}`);
    assert.equal(normalizeStudentLifeState(saved.studentLife).letters.length, 0);
    assert.deepEqual(applyClassroomRoleMissionResultInSettings(saved, command), saved);
  }
});
