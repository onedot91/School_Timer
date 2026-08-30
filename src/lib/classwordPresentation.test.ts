import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ClasswordQuiz from '../components/student/ClasswordQuiz';
import type { ClasswordQuizStudentState } from './classwordQuiz';

const studentPage = readFileSync(
  new URL('../components/student/StudentClasswordPage.tsx', import.meta.url),
  'utf8',
);
const studentBoard = readFileSync(
  new URL('../components/student/ClasswordBoard.tsx', import.meta.url),
  'utf8',
);
const studentQuiz = readFileSync(
  new URL('../components/student/ClasswordQuiz.tsx', import.meta.url),
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
const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

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

test('낱말 확인은 체크 버튼 클릭 뒤에만 저장하고 저장 중 진행 바를 보여 준다', () => {
  assert.doesNotMatch(studentBoard, /window\.addEventListener\('keydown'/);
  assert.match(studentPage, /saving=\{saving\}/);
  assert.match(studentPage, /disabled=\{loading \|\| !board\.topic\}/);
  assert.doesNotMatch(studentPage, /낱말판에 저장했어요\./);
  assert.match(studentPage, /setBoard\(\(currentBoard\) =>/);
  assert.match(studentBoard, /className="classword-save-progress"[\s\S]*?role="progressbar"[\s\S]*?aria-label="낱말 저장 중"/);
  assert.match(css, /\.classword-save-progress \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.classword-save-progress > span/);
});

test('오늘의 주제는 학생 헤더에 한 번만 표시하고 남은 높이를 낱말판에 사용한다', () => {
  assert.match(studentPage, /title=\{\([\s\S]*?className="classword-header-topic"/);
  assert.doesNotMatch(studentPage, /className="classword-topic"/);
  assert.match(css, /\.classword-paper \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
});

test('보너스 문제는 큰 본문과 하나의 예시 배지 아래 두 초성 예문을 사용한다', () => {
  assert.match(studentQuiz, /src="\/classword\/bonus-question\.png"/);
  assert.doesNotMatch(studentQuiz, />오늘의 낱말 퀴즈</);
  assert.match(studentQuiz, /state\.question\.examples\.map/);
  assert.equal(studentQuiz.match(/>예시<\/span>/g)?.length, 1);
  assert.doesNotMatch(studentQuiz, />글말<|>입말</);
  assert.match(studentQuiz, /className="classword-quiz-example-hint">\{state\.question\.initialHint\}/);
  assert.match(css, /\.classword-quiz-copy p \{[\s\S]*?font-size: var\(--classword-quiz-copy-size\);/);
  assert.match(css, /\.classword-quiz-examples > span \{[\s\S]*?font-size: var\(--classword-quiz-badge-size\);/);
  assert.match(indexCss, /--classword-quiz-copy-size: clamp\(1\.25rem, 1\.6vw, 1\.4rem\);/);
  assert.match(indexCss, /--classword-quiz-badge-size: 1\.125rem;/);
  assert.match(css, /\.classword-quiz-copy > p:first-child \{[\s\S]*?color: var\(--classword-ink\);/);
  assert.match(css, /\.classword-quiz-copy > p:first-child > span/);
  assert.doesNotMatch(css, /\.classword-quiz-copy p:first-child \{/);
  assert.doesNotMatch(css, /\.classword-quiz-copy p:first-child > span/);
  assert.match(css, /\.classword-quiz-copy \{[\s\S]*?overflow: hidden;[\s\S]*?padding: 0;/);
  assert.match(css, /\.classword-quiz-copy > p:first-child \{[\s\S]*?padding: \.45rem \.85rem;[\s\S]*?background: color-mix\(in srgb, var\(--classword-prompt-soft\) 76%, var\(--classword-paper\)\);/);
  assert.match(css, /\.classword-quiz-examples \{[\s\S]*?padding: \.45rem \.85rem;[\s\S]*?border-block-start: 1px solid var\(--classword-line\);[\s\S]*?background: color-mix\(in srgb, var\(--classword-accent-soft\) 56%, var\(--classword-paper\)\);/);
  assert.match(css, /\.classword-quiz-examples > span \{ background: var\(--classword-accent-soft\); \}/);
  assert.match(css, /\.classword-quiz-example-hint \{[\s\S]*?color: var\(--classword-accent\);[\s\S]*?font-weight: 950;/);
  assert.match(css, /@media \(min-width: 70rem\)[\s\S]*?grid-template-rows: minmax\(0, var\(--classword-board-height\)\) auto;/);
  assert.match(css, /\.classword-paper \{[\s\S]*?padding-block-end: clamp\(1\.5rem, 2\.5vh, 2rem\);/);
});

test('보너스 문제는 더 높은 섹션과 큰 이미지·본문, 좁은 정답 영역을 사용한다', () => {
  assert.match(css, /\.classword-quiz \{[\s\S]*?min-block-size: 9\.75rem;[\s\S]*?padding: \.75rem;/);
  assert.match(css, /\.classword-quiz-heading-art \{[\s\S]*?inline-size: 12rem;[\s\S]*?block-size: 100%;/);
  assert.match(css, /\.classword-quiz-heading-art img \{[\s\S]*?object-fit: contain;[\s\S]*?object-position: center;/);
  assert.match(studentQuiz, /className="classword-quiz-answer"[\s\S]*?className="classword-quiz-initial"[\s\S]*?<form/);
  assert.match(studentQuiz, /<span>초성 힌트:<\/span> \{state\.question\.initialHint\}/);
  assert.match(studentQuiz, /<label htmlFor="classword-quiz-answer" className="sr-only">정답 입력<\/label>/);
  assert.match(studentQuiz, /placeholder="정답 입력"/);
  assert.match(studentQuiz, /completed\s*\? '정답'\s*: submissionState === 'incorrect'\s*\? '오답'/);
  assert.match(css, /\.classword-quiz-body \{[\s\S]*?block-size: 8rem;[\s\S]*?grid-template-columns: 12rem minmax\(0, 1fr\) minmax\(16rem, \.48fr\);[\s\S]*?align-items: stretch;/);
  assert.match(css, /\.classword-quiz-answer \{[\s\S]*?block-size: 100%;[\s\S]*?align-content: center;[\s\S]*?background: color-mix\(in srgb, var\(--classword-accent-soft\) 72%, var\(--classword-sky\)\);/);
  assert.match(css, /\.classword-quiz-copy \{[\s\S]*?block-size: 100%;[\s\S]*?min-block-size: 0;/);
  assert.match(css, /\.classword-quiz-initial \{[\s\S]*?inline-size: 100%;[\s\S]*?block-size: 2\.75rem;[\s\S]*?border: 0;/);
  assert.match(css, /\.classword-quiz input \{[\s\S]*?border: 2px solid color-mix\(in srgb, var\(--classword-accent\) 58%, var\(--classword-line\)\);/);
  assert.doesNotMatch(studentQuiz, /classword-quiz-feedback/);
  assert.doesNotMatch(css, /\.classword-quiz-feedback/);
});

test('보너스 문제 확인 버튼은 정답 입력창 오른쪽 내부에 배치한다', () => {
  assert.match(css, /\.classword-quiz form > div \{[\s\S]*?position: relative;/);
  assert.match(css, /\.classword-quiz input \{[\s\S]*?inline-size: 100%;[\s\S]*?padding-inline: \.85rem 6\.5rem;/);
  assert.match(css, /\.classword-quiz form button \{[\s\S]*?position: absolute;[\s\S]*?inset: \.375rem \.375rem \.375rem auto;/);
});

test('완료한 보너스 문제는 입력 영역의 초록 정답 버튼으로만 상태를 표시한다', () => {
  const completedState: ClasswordQuizStudentState = {
    dateKey: '2026-08-30',
    question: {
      id: 'working-together',
      initialHint: 'ㅎㄷ',
      meaning: '여러 사람이 힘과 마음을 모아 함께 일함',
      examples: [
        { register: 'written', prefix: '구성원들은 서로 ', suffix: '하였다.' },
        { register: 'spoken', prefix: '친구들과 ', suffix: '했어.' },
      ],
    },
    completed: true,
    completedAt: '2026-08-30T00:00:00.000Z',
  };

  const markup = renderToStaticMarkup(createElement(
    ClasswordQuiz,
    {
      studentNumber: 22,
      state: completedState,
      loading: false,
      saving: false,
      loadError: '',
      onSubmit: async () => true,
    },
  ));

  assert.match(markup, /<button[^>]*class="is-correct"[^>]*disabled=""[^>]*>[\s\S]*?정답<\/button>/);
  assert.doesNotMatch(markup, />완료</);
  assert.doesNotMatch(markup, /정답이에요|오늘 퀴즈를 완료했어요|다시 제출할 수 없어요/);
  assert.doesNotMatch(markup, /<header><span/);
  assert.match(markup, /<form/);
  assert.match(markup, /<button type="submit"[^>]*disabled=""/);
});

test('보너스 문제 오답과 정답은 별도 안내문 없이 제출 버튼의 색·아이콘·문구로 구분한다', () => {
  assert.match(studentQuiz, /submissionState === 'incorrect'\s*\? 'is-incorrect'/);
  assert.match(studentQuiz, /submissionState === 'incorrect'\s*\? <XCircle aria-hidden="true" \/>/);
  assert.match(studentQuiz, /submissionState === 'incorrect'\s*\? '오답'/);
  assert.match(studentQuiz, /completed\s*\? <CheckCircle2 aria-hidden="true" \/>/);
  assert.match(studentQuiz, /completed\s*\? '정답'/);
  assert.match(css, /\.classword-quiz form button\.is-incorrect,[\s\S]*?\.classword-quiz form button\.is-error \{[\s\S]*?background: var\(--student-warning\);/);
  assert.match(css, /\.classword-quiz form button\.is-correct:disabled \{[\s\S]*?background: var\(--classword-accent\);/);
  assert.doesNotMatch(studentQuiz, /아직 정답이 아니에요|뜻과 예문을 다시 살펴보세요/);
});

test('보너스 문제 정답을 맞히면 입력값을 유지한 채 입력창을 비활성화한다', () => {
  assert.doesNotMatch(studentQuiz, /setAnswer\(''\)/);
  assert.match(studentQuiz, /saveClasswordQuizAnswer/);
  assert.match(studentQuiz, /loadSavedClasswordQuizAnswer/);
  assert.match(studentPage, /studentNumber=\{studentNumber\}/);
  assert.match(studentQuiz, /disabled=\{saving \|\| completed\}/);
  assert.match(studentQuiz, /disabled=\{saving \|\| completed \|\| !answer\.trim\(\)\}/);
});

test('기본 낱말판은 7×2로 배치하고 모든 정답 낱말 글자 크기를 일관되게 유지한다', () => {
  assert.match(css, /@container \(min-width: 70rem\)[\s\S]*?grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)[\s\S]*?grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(studentBoard, /data-word-length/);
  assert.match(css, /\.classword-entry-copy strong \{[\s\S]*?font-size: clamp\(1\.55rem, 2\.2vw, 1\.9rem\)/);
  assert.doesNotMatch(css, /classword-entry-copy\[data-word-length/);
});

test('채워진 낱말 카드는 큰 프로필을 하단 중앙에 두고 휴지 상태에 삭제 버튼을 표시하지 않는다', () => {
  assert.match(indexCss, /--classword-profile-size: clamp\(3\.75rem, 5\.3vw, 4\.5rem\);/);
  assert.match(css, /\.classword-student-profile \{[\s\S]*?justify-self: center;/);
  assert.match(css, /\.classword-student-profile img \{[\s\S]*?inline-size: var\(--classword-profile-size\);[\s\S]*?block-size: var\(--classword-profile-size\);[\s\S]*?border: 2px solid white;/);
  assert.doesNotMatch(studentBoard, /className="classword-delete-button"|classword-delete-confirm|deleteEntryId|confirmDelete/);
  assert.doesNotMatch(css, /\.classword-delete-button|\.classword-delete-confirm/);
});

test('채운 낱말은 민트 테두리를 쓰고 내 카드는 선명한 청록 배경과 단일선으로 구분한다', () => {
  assert.match(indexCss, /--classword-line-filled: color-mix\(in srgb, var\(--classword-line-strong\) 74%, var\(--classword-sky\)\);/);
  assert.match(indexCss, /--classword-own-border: color-mix\(in srgb, var\(--classword-accent\) 76%, var\(--classword-sky\)\);/);
  assert.match(indexCss, /--classword-own-border-width: 3px;/);
  assert.doesNotMatch(indexCss, /--classword-own-glow/);
  assert.match(css, /\.classword-cell\.is-filled \{[\s\S]*?border: 2px solid var\(--classword-line-filled\);/);
  assert.match(css, /\.classword-cell\.is-own \{[\s\S]*?border: var\(--classword-own-border-width\) solid var\(--classword-own-border\);[\s\S]*?color-mix\(in srgb, var\(--classword-accent-soft\) 82%, var\(--classword-accent\)\);/);
  assert.match(studentBoard, /className="classword-own-mark" aria-hidden="true"[\s\S]*?<UserRoundCheck/);
  assert.doesNotMatch(studentBoard, />\s*내 카드\s*</);
  assert.match(css, /\.classword-own-mark \{[\s\S]*?inline-size: 2rem;[\s\S]*?background: var\(--classword-own-border\);/);
  assert.doesNotMatch(css, /classword-own-(?:glow|float)|\.classword-cell\.is-own:not\(\.is-selected\)/);
  assert.doesNotMatch(css, /\.classword-cell\.is-own[^\n]*::after|classword-own-ring/);
  assert.doesNotMatch(css, /\.classword-cell\.is-filled \{[^}]*var\(--classword-celebrate\)/);
});

test('본인 낱말 수정 화면은 문구 없는 확정과 제거 아이콘 버튼을 사용한다', () => {
  assert.match(studentBoard, /import \{ Check, Trash2, UserRoundCheck, X \} from 'lucide-react';/);
  assert.match(studentBoard, /\{ownEntry && !movingFromInitial \? \([\s\S]*?className="classword-editor-actions"[\s\S]*?aria-label="수정한 낱말 확정"[\s\S]*?<Check[\s\S]*?aria-label="내 낱말 삭제"[\s\S]*?<Trash2/);
  assert.match(studentBoard, /readonly onDelete: \(entryId: string\) => Promise<boolean>;/);
  assert.match(studentPage, /removeClasswordEntry/);
  assert.match(studentPage, /onDelete=\{remove\}/);
  assert.match(css, /\.classword-editor-actions \{[\s\S]*?justify-content: center;/);
  assert.match(css, /\.classword-cell-editor \.classword-editor-actions button \{[\s\S]*?inline-size: 3rem;[\s\S]*?min-block-size: 3rem;/);
});

test('내 카드가 있을 때 빈 칸은 확인 모달을 거친 뒤에만 이동 편집을 연다', () => {
  assert.match(studentBoard, /const canSelect = selectedInitial === null && \(isOwn \|\| !entry\);/);
  assert.match(studentBoard, /if \(!entry && ownEntry\) \{[\s\S]*?setMoveTarget\(initial\);[\s\S]*?return;/);
  assert.match(studentBoard, /<StudentConfirmDialog[\s\S]*?isOpen=\{moveTarget !== null\}[\s\S]*?confirmLabel="옮기기"/);
  assert.match(studentBoard, /onCancel=\{\(\) => setMoveTarget\(null\)\}/);
  assert.match(studentBoard, /const confirmMove = \(\): void => \{[\s\S]*?setMoveTarget\(null\);[\s\S]*?openEditor\(target\);/);
  assert.match(studentBoard, /returnFocusRef=\{moveTriggerRef\}/);
  assert.match(studentBoard, /setMovingFromInitial\(ownEntry\.initial\);/);
  assert.match(studentBoard, /const entry = movingFromInitial === initial \? undefined : storedEntry;/);
  assert.match(studentBoard, /setMovingFromInitial\(null\);/);
  assert.match(studentBoard, /if \(ownEntry && !movingFromInitial\) void confirmEdit\(\);[\s\S]*?else prepareSave\(\);/);
  assert.match(studentBoard, /\{ownEntry && !movingFromInitial \? \(/);
});

test('칸 선점 충돌은 이동 편집을 닫아 기존 카드를 복원하고 일반 오류는 입력을 유지한다', () => {
  assert.match(studentBoard, /export type ClasswordSaveResult = 'saved' \| 'conflict' \| 'error';/);
  assert.match(studentBoard, /const result = await onSave\([\s\S]*?if \(result !== 'error'\) closeEditor\(\);/);
  assert.match(studentPage, /error\.code === 'CLASSWORD_ENTRY_CONFLICT' \|\| error\.code === 'CLASSWORD_INITIAL_OCCUPIED'/);
  assert.match(studentPage, /void refresh\(\);[\s\S]*?return conflict \? 'conflict' : 'error';/);
});

test('빈 칸의 기본 자음과 된소리 표시는 한 줄로 나란히 배치한다', () => {
  assert.match(css, /\.classword-initial \{[\s\S]*?display: flex;[\s\S]*?align-items: baseline;[\s\S]*?justify-content: center;/);
  assert.doesNotMatch(css, /\.classword-initial \{[^}]*display: grid;/);
});

test('보조 캐릭터 전용 레일을 제거하고 일곱 칸이 종이 전체 폭을 사용한다', () => {
  assert.doesNotMatch(studentPage, /ClasswordGomaHelper|classword-goma-helper/);
  assert.doesNotMatch(css, /\.classword-goma-helper/);
  assert.doesNotMatch(css, /\.classword-grid \{[^}]*padding-inline-end/);
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
  assert.match(teacherPanel, /className="classword-grid teacher-classword-board"/);
  assert.match(teacherPanel, /CLASSWORD_INITIALS\.map/);
  assert.match(teacherPanel, /getFailureProfileImage\(entry\.studentNumber, profileAssignments\)/);
  assert.match(css, /\.teacher-classword-board \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(teacherPanel, /날짜별 주제 설정/);
});

test('주제가 있는 날짜는 달력의 면과 점, 범례로 함께 구분한다', () => {
  assert.match(teacherCalendar, /has-topic/);
  assert.match(teacherCalendar, /className="teacher-classword-topic-dot"/);
  assert.match(teacherCalendar, /className="teacher-classword-calendar-legend"/);
  assert.match(teacherCalendar, /주제 있음/);
  assert.match(css, /\.teacher-classword-days button\.has-topic/);
});
