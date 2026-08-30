import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('고마 경제 설정 메뉴는 경매, 증권, 기부, 기타 순서로 표시한다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const economyGroupStart = source.indexOf("label: '고마 경제'");
  const economyGroupEnd = source.indexOf('] as const;', economyGroupStart);

  // When
  const economyGroup = source.slice(economyGroupStart, economyGroupEnd);
  const navigationOrder = ['auction', 'stocks', 'donation', 'shop'].map((panel) => economyGroup.indexOf(`panel: '${panel}'`));

  // Then
  assert.ok(economyGroupStart >= 0);
  assert.ok(economyGroupEnd > economyGroupStart);
  assert.deepEqual(navigationOrder, [...navigationOrder].sort((left, right) => left - right));
  assert.match(economyGroup, /panel: 'shop', label: '기타'/);
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
