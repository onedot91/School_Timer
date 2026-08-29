import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const studentPage = readFileSync(
  new URL('../components/student/StudentClasswordPage.tsx', import.meta.url),
  'utf8',
);
const studentBoard = readFileSync(
  new URL('../components/student/ClasswordBoard.tsx', import.meta.url),
  'utf8',
);
const teacherPanel = readFileSync(
  new URL('../components/teacher/TeacherClasswordPanel.tsx', import.meta.url),
  'utf8',
);
const teacherCalendar = readFileSync(
  new URL('../components/teacher/ClasswordCalendar.tsx', import.meta.url),
  'utf8',
);
const auctionPage = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('./classwordClient.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../classword.css', import.meta.url), 'utf8');

test('낱말판은 3초 갱신과 화면 복귀 즉시 갱신을 유지한다', () => {
  assert.match(studentPage, /window\.setInterval\([\s\S]*?}, 3000\)/);
  assert.match(studentPage, /window\.addEventListener\('focus', refreshOnReturn\)/);
  assert.match(studentPage, /document\.addEventListener\('visibilitychange', refreshOnReturn\)/);
});

test('14칸 완성은 배너를 표시하고 동작 줄이기에서는 입자 모션을 제거한다', () => {
  assert.match(studentPage, /board\.entries\.length === 14/);
  assert.match(studentPage, /className="classword-complete-banner"/);
  assert.match(studentPage, /reducedMotion \? null : <span className="classword-particles"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.classword-particles/);
});

test('완료된 낱말은 학생 번호 대신 배정된 프로필로 식별한다', () => {
  assert.match(studentPage, /profileAssignments=\{profileAssignments\}/);
  assert.match(studentBoard, /getFailureProfileImage\(entry\.studentNumber, profileAssignments\)/);
  assert.match(studentBoard, /className="classword-student-profile"/);
  assert.doesNotMatch(studentBoard, /친구의 낱말/);
  assert.doesNotMatch(studentBoard, /<small>내 낱말<\/small>/);
  assert.doesNotMatch(studentBoard, /classword-own-edit/);
  assert.doesNotMatch(studentBoard, /<small>\{isOwn \? '내 낱말' : `\$\{entry\.studentNumber\}번`\}<\/small>/);
});

test('학생 낱말판은 자동 갱신만 사용하고 고마 잔액을 헤더에 표시하지 않는다', () => {
  assert.doesNotMatch(studentPage, /낱말판 새로고침/);
  assert.doesNotMatch(studentPage, /StudentBalanceSummary/);
});

test('학생 낱말판 해시로 직접 열면 개요로 되돌리지 않는다', () => {
  // Given
  const directClasswordHash = /useState<StudentView>\(\(\) => getStudentViewFromHash\(\)\)/;

  // When
  const initializesFromHash = directClasswordHash.test(auctionPage);

  // Then
  assert.equal(initializesFromHash, true);
  assert.doesNotMatch(auctionPage, /replaceState\(null, '', STUDENT_VIEW_HASHES\.overview\)/);
});

test('입력칸 Enter는 브라우저 기본 제출에 의존하지 않고 확인 단계로 이동한다', () => {
  assert.match(studentBoard, /onKeyDown=\{\(event\) => \{[\s\S]*?event\.key === 'Enter'[\s\S]*?event\.nativeEvent\.isComposing[\s\S]*?prepareSave\(\)/);
});

test('낱말 확인 단계는 안내 문구 없이 접근 가능한 체크와 X 기호만 사용한다', () => {
  assert.doesNotMatch(studentBoard, /이 낱말이 맞나요\?/);
  assert.match(studentBoard, /className="classword-confirm-accept"[\s\S]*?aria-label="낱말 확인"[\s\S]*?<Check aria-hidden="true" \/>/);
  assert.match(studentBoard, /className="classword-confirm-revise"[\s\S]*?aria-label="낱말 고치기"[\s\S]*?<X aria-hidden="true" \/>/);
  assert.match(css, /\.classword-confirm button \{[\s\S]*?inline-size: 3rem;[\s\S]*?min-block-size: 3rem;[\s\S]*?border-radius: var\(--apple-radius-pill\)/);
});

test('오늘의 주제는 학생 헤더에 한 번만 표시하고 남은 높이를 낱말판에 사용한다', () => {
  assert.match(studentPage, /title=\{\([\s\S]*?className="classword-header-topic"/);
  assert.doesNotMatch(studentPage, /className="classword-topic"/);
  assert.match(css, /\.classword-paper \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
});

test('기본 낱말판은 7×2로 배치하고 모든 정답 낱말 글자 크기를 일관되게 유지한다', () => {
  assert.match(css, /@container \(min-width: 70rem\)[\s\S]*?grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)[\s\S]*?grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(studentBoard, /data-word-length/);
  assert.match(css, /\.classword-entry-copy strong \{[\s\S]*?font-size: clamp\(1\.55rem, 2\.2vw, 1\.9rem\)/);
  assert.doesNotMatch(css, /classword-entry-copy\[data-word-length/);
});

test('빈 칸의 기본 자음과 된소리 표시는 한 줄로 나란히 배치한다', () => {
  assert.match(css, /\.classword-initial \{[\s\S]*?display: flex;[\s\S]*?align-items: baseline;[\s\S]*?justify-content: center;/);
  assert.doesNotMatch(css, /\.classword-initial \{[^}]*display: grid;/);
});

test('보조 캐릭터 전용 레일을 제거하고 일곱 칸이 종이 전체 폭을 사용한다', () => {
  assert.doesNotMatch(studentPage, /ClasswordGomaHelper|classword-goma-helper/);
  assert.doesNotMatch(css, /\.classword-goma-helper|padding-inline-end/);
  assert.match(css, /\.classword-grid \{[\s\S]*?padding: \.875rem;/);
});

test('교사의 날짜 전체 삭제는 두 번의 명시적 확인 뒤에만 실행된다', () => {
  assert.match(teacherPanel, /setClearStep\(1\)/);
  assert.match(teacherPanel, /clearStep === 1 \? setClearStep\(2\) : void clearEntries\(\)/);
  assert.match(client, /confirmation: 'DELETE'/, 'API boundary should keep a destructive confirmation token');
});

test('교사 낱말판은 선택 날짜와 무관하게 오늘 입력 낱말을 함께 보여 준다', () => {
  assert.match(teacherPanel, /const \[todayBoard, setTodayBoard\]/);
  assert.match(teacherPanel, /loadClasswordBoard\(today\)/);
  assert.match(teacherPanel, /오늘 입력 낱말/);
  assert.match(teacherPanel, /날짜별 주제 설정/);
});

test('주제가 있는 날짜는 달력의 면과 점, 범례로 함께 구분한다', () => {
  assert.match(teacherCalendar, /has-topic/);
  assert.match(teacherCalendar, /className="teacher-classword-topic-dot"/);
  assert.match(teacherCalendar, /className="teacher-classword-calendar-legend"/);
  assert.match(teacherCalendar, /주제 있음/);
  assert.match(css, /\.teacher-classword-days button\.has-topic/);
});
