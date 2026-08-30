import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('교사 하단 기능창은 도서관처럼 오른쪽 일정 영역 안에 렌더링한다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  // Then
  assert.doesNotMatch(source, /createPortal|renderUtilityPane/);
  assert.match(source, /<div id="timer-currency-panel" className="[^"]*docked-utility-panel[^"]*absolute inset-x-0 top-0/);
  assert.match(source, /<div id="timer-question-submission-panel" className="[^"]*docked-utility-panel[^"]*absolute inset-x-0 top-0/);
  assert.match(source, /<div id="timer-youtube-panel" className="[^"]*docked-utility-panel[^"]*absolute inset-x-0 top-0/);
});

test('내용이 짧은 교사 기능창은 일정 영역 전체 높이로 늘어나지 않는다', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../index.css', import.meta.url), 'utf8'),
  ]);

  assert.equal(source.match(/content-fit-utility-card/g)?.length, 3);
  assert.match(css, /\.content-fit-utility-card \{[^}]*flex: 0 1 auto !important;[^}]*max-height: 100%;[^}]*overflow: hidden;/);
  assert.match(css, /\.content-fit-utility-card > div \{[^}]*flex: 0 1 auto;[^}]*overflow-y: auto;/);
});

test('교사 감정 설정은 별도 현황 헤더 없이 학생 카드를 4행으로 표시한다', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../index.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /emotion-status-settings[^>]*aria-label="학생별 오늘 감정"/);
  assert.doesNotMatch(source, /emotion-status-title|오늘 \{todayEmotionStudentCount\}\/23명 기록/);
  assert.match(css, /\.emotion-status-student-grid \{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.emotion-status-student \{[^}]*min-height: 5\.25rem;/);
  assert.match(css, /\.student-emotion-calendar-cell > button \{[^}]*border-radius: var\(--apple-radius-control\) !important;/);
});
