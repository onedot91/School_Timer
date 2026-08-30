import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('고마 경제 설정 메뉴는 경매, 증권, 기부만 표시하고 기타는 별도 그룹으로 분리한다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const economyGroupStart = source.indexOf("label: '고마 경제'");
  const otherGroupStart = source.indexOf("label: '기타 설정'");
  const navigationEnd = source.indexOf('] as const;', otherGroupStart);

  // When
  const economyGroup = source.slice(economyGroupStart, otherGroupStart);
  const otherGroup = source.slice(otherGroupStart, navigationEnd);
  const navigationOrder = ['auction', 'stocks', 'donation'].map((panel) => economyGroup.indexOf(`panel: '${panel}'`));

  // Then
  assert.ok(economyGroupStart >= 0);
  assert.ok(otherGroupStart > economyGroupStart);
  assert.ok(navigationEnd > otherGroupStart);
  assert.deepEqual(navigationOrder, [...navigationOrder].sort((left, right) => left - right));
  assert.doesNotMatch(economyGroup, /panel: 'shop'/);
  assert.match(otherGroup, /showHeading: false/);
  assert.match(otherGroup, /panel: 'shop', label: '기타'/);
});

test('수업 운영, 학생 생활, 고마 경제는 구분된 헤더로 표시한다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const headingStylesStart = styles.indexOf('.settings-navigation-label {');
  const headingStylesEnd = styles.indexOf('}', headingStylesStart);
  const headingStyles = styles.slice(headingStylesStart, headingStylesEnd);

  assert.match(source, /group\.showHeading !== false/);
  assert.match(headingStyles, /border-bottom: 1px solid var\(--apple-separator\)/);
  assert.match(headingStyles, /background: color-mix/);
});

test('기타 설정은 프로필, 고마 스킨 뽑기, 집, 캐릭터 탭을 제공한다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const shopTabsStart = source.indexOf('<nav className="teacher-shop-tabs"');
  const shopTabsEnd = source.indexOf('</nav>', shopTabsStart);
  const shopTabs = source.slice(shopTabsStart, shopTabsEnd);

  assert.ok(shopTabsStart >= 0);
  assert.ok(shopTabsEnd > shopTabsStart);
  for (const label of ['프로필', '고마 스킨 뽑기', '집', '캐릭터']) {
    assert.match(shopTabs, new RegExp(`<span>${label}</span>`));
  }
});
