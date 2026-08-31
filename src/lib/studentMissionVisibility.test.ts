import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_STUDENT_MISSION_VISIBILITY,
  normalizeStudentMissionVisibility,
} from './studentMissionVisibility.js';

test('기존 저장값이 없으면 모든 기본 미션을 공개한다', () => {
  assert.deepEqual(
    normalizeStudentMissionVisibility(undefined),
    DEFAULT_STUDENT_MISSION_VISIBILITY,
  );
});

test('교사가 숨긴 기본 미션만 비공개로 정규화한다', () => {
  const visibility = normalizeStudentMissionVisibility({
    todayFriend: false,
    sudoku: false,
    teacherAddedMission: false,
  });

  assert.equal(visibility.todayFriend, false);
  assert.equal(visibility.sudoku, false);
  assert.equal(visibility.classroomRole, true);
  assert.equal('teacherAddedMission' in visibility, false);
});
