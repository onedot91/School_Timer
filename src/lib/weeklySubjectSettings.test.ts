import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const timerPage = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('명시적으로 비운 주차별 과목은 레거시 시간표에서 다시 생성하지 않는다', () => {
  assert.match(timerPage, /const savedSubjects = localStorage\.getItem\(WEEKLY_SUBJECTS_STORAGE_KEY\);/);
  assert.match(timerPage, /if \(savedSubjects !== null\) \{\s*return normalizeWeeklySubjects\(JSON\.parse\(savedSubjects\)\);/);
  assert.match(timerPage, /const hasStoredWeeklySubjects = Object\.prototype\.hasOwnProperty\.call\(parsed, 'weeklySubjects'\)/);
  assert.match(
    timerPage,
    /weeklySubjects:\s*hasStoredWeeklySubjects\s*\? weeklySubjects\s*:\s*buildWeeklySubjectsFromSchedule/,
  );
});

test('저장 중인 과목 입력은 오래된 원격 스냅샷으로 덮어쓰지 않는다', () => {
  assert.match(timerPage, /const hasUnsavedWeeklySubjectsRef = useRef\(false\)/);
  assert.match(timerPage, /hasUnsavedWeeklySubjectsRef\.current = true;[\s\S]*?setWeeklySubjects/);
  assert.match(timerPage, /if \(!hasUnsavedWeeklySubjectsRef\.current\) \{[\s\S]*?setWeeklySubjects/);
  assert.match(timerPage, /isSharedSettingsSavePendingRef\.current \|\|\s*hasUnsavedWeeklySubjectsRef\.current/);
});

test('과목 목록 입력 중 설정창을 닫아도 공유 저장 예약이 복구된다', () => {
  assert.match(timerPage, /const hasUnsavedSubjectCatalogRef = useRef\(false\)/);
  assert.match(
    timerPage,
    /if \(!isSettingsOpen && isEditingSubjectCatalogRef\.current\) \{[\s\S]*?isEditingSubjectCatalogRef\.current = false;[\s\S]*?setSubjectCatalogEditCommitVersion/,
  );
  assert.match(
    timerPage,
    /if \(!hasUnsavedSubjectCatalogRef\.current && !isEditingSubjectCatalogRef\.current\) \{\s*setSubjectCatalog/,
  );
  assert.match(timerPage, /hasUnsavedSubjectCatalogRef\.current = true;[\s\S]*?setSubjectCatalog/);
});

test('영어와 체육 과목 입력은 하늘색 상태를 사용한다', () => {
  assert.match(timerPage, /data-subject-state=\{getSubjectInputState\(weeklySubjectValue\)\}/);
  assert.match(css, /slot-subject-input\[data-subject-state="sky"\]/);
});
