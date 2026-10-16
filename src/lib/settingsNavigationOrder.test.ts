import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('설정 메뉴는 오늘 홈, 오늘 처리, 학급 설정, 기록 순서로 묶는다', async () => {
  // Given
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const navigationStart = source.indexOf('const SETTINGS_NAVIGATION_GROUPS');
  const navigationEnd = source.indexOf('] as const;', navigationStart);
  const navigation = source.slice(navigationStart, navigationEnd);
  const groupLabels = ['오늘', '오늘 처리', '학급 설정', '기록'];

  // When
  const groupStarts = groupLabels.map((label) => navigation.indexOf(`label: '${label}',\n`));
  const groupOf = (panel: string) => {
    const index = navigation.indexOf(`panel: '${panel}'`);
    return groupStarts.filter((start) => start >= 0 && start < index).length - 1;
  };

  // Then
  assert.ok(navigationStart >= 0);
  assert.ok(groupStarts.every((start) => start >= 0));
  assert.deepEqual(groupStarts, [...groupStarts].sort((left, right) => left - right));
  assert.equal(groupOf('today'), 0);
  for (const panel of ['auction', 'missions', 'mail', 'today-friend']) assert.equal(groupOf(panel), 1);
  for (const panel of ['subjects', 'schedule', 'stocks', 'donation', 'shop']) assert.equal(groupOf(panel), 2);
  for (const panel of ['currency-history', 'loan-history']) assert.equal(groupOf(panel), 3);
  assert.match(source, /useState<SettingsPanel>\('today'\)/);
});

test('오늘 홈은 처리할 일만 행동 카드로 모아 보여 준다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /isTodayAuctionUnregistered \? \[\{ panel: 'auction'/);
  assert.match(source, /unpaidClassroomRoleRewardCount > 0 \? \[\{ panel: 'missions'/);
  assert.match(source, /unreadTeacherLetterCount > 0 \? \[\{ panel: 'mail'/);
  assert.match(source, /todayFriendPendingReviewCount > 0 \? \[\{ panel: 'today-friend'/);
  assert.match(source, /onClick=\{\(\) => setSettingsPanel\(task\.panel\)\}/);
  assert.match(source, /처리할 일 없음/);
});

test('설정 메뉴 그룹은 구분된 헤더로 표시한다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const headingStylesStart = styles.indexOf('.settings-navigation-label {');
  const headingStylesEnd = styles.indexOf('}', headingStylesStart);
  const headingStyles = styles.slice(headingStylesStart, headingStylesEnd);

  assert.match(source, /group\.showHeading !== false/);
  assert.match(headingStyles, /border-bottom: 1px solid var\(--apple-separator\)/);
  assert.match(headingStyles, /background: color-mix/);
});

test('읽지 않은 학생 편지가 있으면 편지 메뉴에 붉은 New 배지를 표시한다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  assert.match(source, /item\.panel === 'mail' && unreadTeacherLetterCount > 0/);
  assert.match(source, /className="settings-navigation-new-badge"/);
  assert.match(source, /새로 받은 편지 \$\{unreadTeacherLetterCount\}개/);
  assert.match(styles, /\.settings-navigation-new-badge \{[^}]*background: var\(--teacher-urgent\);/s);
});

test('오늘의 친구 승인 대기 제출이 있으면 메뉴에 승인 배지를 표시한다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /item\.panel === 'today-friend' && todayFriendPendingReviewCount > 0/);
  assert.match(source, /오늘의 친구 승인 대기 \$\{todayFriendPendingReviewCount\}건/);
  assert.match(source, />\s*승인\s*<\/span>/);
});

test('교사 편지 설정은 여유 있는 최근 대화 목록과 구분된 메시지 제목을 제공한다', async () => {
  const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const panelStylesStart = styles.indexOf('.teacher-mail-settings {');
  const panelStylesEnd = styles.indexOf('}', panelStylesStart);
  const panelStyles = styles.slice(panelStylesStart, panelStylesEnd);
  const desktopMailStylesStart = styles.indexOf('@media (min-width: 768px) {\n  .teacher-mail-settings {');
  const desktopMailStylesEnd = styles.indexOf('\n  }', desktopMailStylesStart);
  const desktopMailStyles = styles.slice(desktopMailStylesStart, desktopMailStylesEnd);

  assert.match(panelStyles, /grid-template-columns: minmax\(16rem, 18rem\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.teacher-mail-chat \{ grid-template-rows: auto minmax\(0, 1fr\) auto; \}/);
  assert.match(styles, /\.teacher-mail-list \{[\s\S]*?gap: \.8rem;[\s\S]*?padding: \.9rem;/);
  assert.match(styles, /\.teacher-mail-list button \{[\s\S]*?min-height: 5rem;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.teacher-mail-chat-message h4 \{[\s\S]*?border-bottom: 1px solid #dce7e0;[\s\S]*?padding-bottom: \.48rem;/);
  assert.match(desktopMailStyles, /min-height: 100%/);
  assert.match(desktopMailStyles, /grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 767px\) \{[\s\S]*?\.teacher-mail-settings \{ grid-template-columns: minmax\(0, 1fr\); \}/);
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
