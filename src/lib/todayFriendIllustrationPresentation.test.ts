import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../components/student/StudentTodayFriendPage.tsx', import.meta.url),
  'utf8',
);
const stylesheetSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('오늘의 친구 다섯 섹션은 각각 전용 일러스트를 표시한다', () => {
  const illustrationPaths = [
    '/today-friend/interview.png',
    '/today-friend/commonality.png',
    '/today-friend/recommendation.png',
    '/today-friend/compliment.png',
    '/today-friend/emotion.png',
  ];

  for (const illustrationPath of illustrationPaths) {
    assert.match(pageSource, new RegExp(illustrationPath.replaceAll('/', '\\/')));
  }

  assert.match(pageSource, /<img/);
  assert.doesNotMatch(pageSource, /today-friend-illustration-placeholder/);
});

test('활성 장르는 페이지 전체의 일러스트 테마를 선택한다', () => {
  assert.match(pageSource, /className="student-view student-today-friend-view" data-genre=\{displayedGenre\}/);

  for (const genre of ['interview', 'commonality', 'recommendation', 'compliment', 'emotion']) {
    assert.match(stylesheetSource, new RegExp(`student-today-friend-view\\[data-genre='${genre}'\\]`));
  }

  assert.match(stylesheetSource, /--today-friend-theme-accent/);
  assert.match(stylesheetSource, /--today-friend-theme-panel-shadow/);
  assert.match(stylesheetSource, /--today-friend-theme-art-shadow/);
  assert.match(stylesheetSource, /today-friend-preview-tabs[\s\S]*--today-friend-theme-accent/);
  assert.match(stylesheetSource, /today-friend-form-actions[\s\S]*--today-friend-theme-accent/);
  assert.match(stylesheetSource, /today-friend-form-actions button\[type='submit'\]:disabled[\s\S]*--today-friend-theme-ink/);
  assert.match(stylesheetSource, /student-today-friend-guide::before/);
});
