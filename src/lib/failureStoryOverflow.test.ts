import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function getCssRule(css: string, selector: string) {
  const ruleStart = css.startsWith(`${selector} {`) ? 0 : css.indexOf(`\n${selector} {`);
  const ruleEnd = css.indexOf('\n}', ruleStart);

  assert.ok(ruleStart >= 0, `${selector} 규칙이 필요합니다.`);
  assert.ok(ruleEnd > ruleStart, `${selector} 규칙이 닫혀야 합니다.`);
  return css.slice(ruleStart, ruleEnd);
}

test('실패 카드의 공백 없는 긴 문장은 카드 폭 안에서 긴급 줄바꿈한다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const failureRule = getCssRule(css, '.student-failure-message-text');
  const lessonRule = getCssRule(css, '.student-failure-message-next span');

  assert.match(failureRule, /overflow-wrap:\s*anywhere/);
  assert.match(lessonRule, /overflow-wrap:\s*anywhere/);
  assert.match(failureRule, /word-break:\s*keep-all/);
  assert.match(lessonRule, /word-break:\s*keep-all/);
});

test('실패 문장과 다짐은 실제 두 줄 행간보다 작은 행에 겹치지 않는다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // When
  const contentRule = getCssRule(css, '.student-failure-message-content');

  // Then
  assert.match(contentRule, /grid-template-rows:\s*minmax\(4\.2rem,\s*auto\)\s+minmax\(3\.6rem,\s*auto\)/);
});

test('실패 카드를 눌러도 문장과 다짐의 줄바꿈 규칙은 바뀌지 않는다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // When
  const expandedTextOverrides = css.match(/\.student-failure-message\.is-expanded[^\n{]*\{/g) ?? [];

  // Then
  assert.deepEqual(expandedTextOverrides, []);
});

test('실패 전시 와이어는 위아래 행에서 같은 카드 기준 높이를 사용한다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // When
  const rowRule = getCssRule(css, '.student-failure-feed-row');
  const wireRule = getCssRule(css, '.student-failure-feed-row::before');

  // Then
  assert.match(rowRule, /position:\s*relative/);
  assert.match(wireRule, /top:\s*var\(--failure-wire-row-offset\)/);
  assert.doesNotMatch(css, /\.student-failure-feed::after\s*\{\s*top:/);
});

test('실패 릴레이 탐색은 글쓰기 버튼 위에 놓인 컴팩트 도구 묶음이다', async () => {
  // Given
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  // When
  const toolbarRule = getCssRule(css, '.student-failure-relay-toolbar');
  const buttonRule = getCssRule(css, '.student-failure-relay-toolbar button');

  // Then
  assert.match(toolbarRule, /width:\s*3rem/);
  assert.match(toolbarRule, /align-self:\s*end/);
  assert.match(toolbarRule, /justify-self:\s*center/);
  assert.match(toolbarRule, /margin-bottom:\s*5\.75rem/);
  assert.match(buttonRule, /width:\s*var\(--apple-control-min\)/);
  assert.match(buttonRule, /height:\s*var\(--apple-control-min\)/);
});
