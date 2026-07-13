import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-3-apple-ui-refresh-plan');
const outputPath = path.join(outputDirectory, 'post-change-oracle.json');
const appUrl = 'http://127.0.0.1:4175/';
const drawUrl = `${appUrl}.omo/evidence/fixtures/random-draw.html`;
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const fixedWeekday = '2026-07-06T10:00:00.000Z';
const fixedWeekend = '2026-07-11T10:00:00.000Z';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];
const zoomViewport = { width: 390, height: 844, zoom: 2 };
const requiredStateIds = new Set([
  'entry/default',
  'root/runtime-fallback',
  'root/invalid-storage',
  'root/shortcut-alt-meta-enter',
  'root/shortcut-alt-ctrl-enter',
  'timer/default',
  'timer/empty-schedule',
  'timer/manual-timer',
  'timer/memo',
  'timer/currency-personal',
  'timer/currency-invalid-number',
  'timer/currency-all',
  'timer/question-submitted',
  'timer/question-loading',
  'timer/question-error',
  'timer/question-empty',
  'timer/youtube-playlist',
  'timer/youtube-search',
  'timer/library',
  'timer/announcement-default',
  'timer/announcement-history',
  'timer/settings-shell',
  'timer/settings-과목',
  'timer/settings-경매',
  'timer/settings-시간표',
  'timer/copy-confirmation',
  'timer/settings-추첨',
  'timer/auction-award-confirmation',
  'timer/auction-award-presentation',
  'timer/auction-reset-confirmation',
  'timer/embedded-draw-rolling',
  'timer/embedded-draw-winner',
  'timer/embedded-draw-repeat',
  'timer/embedded-draw-reset',
  'auction/loading',
  'auction/error',
  'auction/locked-or-default',
  'auction/selected',
  'auction/confirmation',
  'auction/submitting',
  'auction/success',
  'auction/insufficient',
  'auction/write-error',
  'auction/weekend-empty',
  'random-draw/default',
  'random-draw/settings',
  'random-draw/after-settings',
  'random-draw/winner',
  'random-draw/reset',
  'random-draw/exhausted',
  'random-draw/invalid-range',
]);
const entryRootStateIds = [
  'entry/default',
  'root/runtime-fallback',
  'root/invalid-storage',
  'root/shortcut-alt-meta-enter',
  'root/shortcut-alt-ctrl-enter',
];
const baseValue = {
  currencyBalances: { 1: 500, 2: 250 },
  auctionItems: [
    { id: 'item-a', name: '월요일 연필', startPrice: 10, dayIndex: 0 },
    { id: 'item-b', name: '화요일 지우개', startPrice: 20, dayIndex: 1 },
  ],
  auctionBids: {},
  auctionBidHistory: {},
  auctionAwards: {},
  auctionMissions: [{ id: 'qa-mission', content: '합성 미션', rewardAmount: 15 }],
};
const awardValue = {
  ...baseValue,
  auctionBids: { 'item-a': { amount: 25, bidder: 2 } },
  auctionBidHistory: {
    'item-a': [
      { itemId: 'item-a', bidder: 1, amount: 20, createdAt: '2026-07-06T09:00:00.000Z' },
      { itemId: 'item-a', bidder: 2, amount: 25, createdAt: '2026-07-06T09:01:00.000Z' },
    ],
  },
};
const result = {
  schemaVersion: 1,
  purpose: 'Todo 3 post-change Apple UI visible-text and interaction oracle',
  startedAt: new Date().toISOString(),
  fixedClocks: { weekday: fixedWeekday, weekend: fixedWeekend },
  viewports: [...viewports, zoomViewport],
  states: [],
  requestAudit: { browserRequests: [], fixtureRequests: [], liveSupabase: [], externalQuestion: [] },
  console: [],
  cleanup: {},
  focusLifecycle: [],
  unreachable: [],
  errors: [],
};
const children = [];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const start = (label, command, args, environment = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = { label, pid: child.pid, stdout: '', stderr: '', stopped: false };
  child.stdout.on('data', (chunk) => { receipt.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { receipt.stderr += chunk.toString(); });
  children.push({ child, receipt });
  return receipt;
};

const waitForUrl = async (url, label) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Readiness polling is intentionally local and bounded.
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const stop = async ({ child, receipt }) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(3_000)]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  receipt.stopped = true;
  receipt.exitCode = child.exitCode;
  receipt.signalCode = child.signalCode;
};

const controlFixture = async (payload) => {
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert(response.ok, `Fixture control failed: ${response.status}`);
};

const installFixedClock = async (context, iso) => {
  await context.addInitScript((fixedIso) => {
    const NativeDate = Date;
    const fixedTime = new NativeDate(fixedIso).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) {
        return args.length === 0 ? new NativeDate(fixedTime) : new NativeDate(...args);
      }
      static now() { return fixedTime; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
  }, iso);
  await context.addInitScript(() => {
    let seed = 0x5c11d00d;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
};

const visibleState = () => {
  const excluded = (node) => {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (['SCRIPT', 'STYLE'].includes(element.tagName)) return true;
      if (element.getAttribute('aria-hidden') === 'true' || element.classList.contains('sr-only')) return true;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const text = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!excluded(node)) text.push((node.textContent ?? '').replaceAll('\r\n', '\n'));
  }
  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
  ].join(',');
  const focusable = [...document.querySelectorAll(focusableSelector)].filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
  const targets = focusable.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      name: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '',
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    };
  });
  return {
    text,
    focusOrder: targets.map(({ tag, name }) => ({ tag, name })),
    targets,
    targetsBelow44: targets.filter(({ width, height }) => width < 44 || height < 44),
    overflow: {
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
  };
};

const capture = async (page, id, metadata = {}) => {
  const variants = [...viewports, zoomViewport];
  const snapshots = [];
  for (const variant of variants) {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, variant.zoom ?? 1);
    await page.waitForTimeout(50);
    snapshots.push({ viewport: variant, ...(await page.evaluate(visibleState)) });
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  result.states.push({ id, metadata, snapshots });
};

const clickIfPresent = async (page, role, name) => {
  const locator = page.getByRole(role, { name, exact: true });
  if (await locator.count() === 0) return false;
  await locator.first().click();
  await page.waitForTimeout(80);
  return true;
};

const auditFocusLifecycle = async (page, id, triggerName) => {
  const semanticDialog = page.getByRole('dialog').last();
  const dialog = await semanticDialog.count()
    ? semanticDialog
    : page.locator('.settings-dialog, .announcement-overlay').last();
  assert(await dialog.count(), `${id}: dialog surface missing`);
  const before = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '',
    bodyInert: document.body.inert,
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    surfaceCount: document.querySelectorAll('[role="dialog"], .settings-dialog, .announcement-overlay').length,
    backgroundIsolation: [...document.body.children].map((element) => ({
      tag: element.tagName,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
      pointerEvents: getComputedStyle(element).pointerEvents,
    })),
  }));
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '',
    insideDialog: Boolean(document.activeElement?.closest('[role="dialog"], .settings-dialog, .announcement-overlay')),
  }));
  await page.keyboard.press('Shift+Tab');
  const afterShiftTab = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '',
    insideDialog: Boolean(document.activeElement?.closest('[role="dialog"], .settings-dialog, .announcement-overlay')),
  }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  const afterEscape = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '',
    surfaceCount: document.querySelectorAll('[role="dialog"], .settings-dialog, .announcement-overlay').length,
  }));
  result.focusLifecycle.push({ id, triggerName, before, afterTab, afterShiftTab, afterEscape });
  return { closed: afterEscape.surfaceCount < before.surfaceCount };
};

let browser;
try {
  await mkdir(outputDirectory, { recursive: true });
  start('fake-supabase', process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl, 'fake Supabase');
  start(
    'vite',
    'npm',
    ['run', 'dev', '--', '--port', '4175', '--host', '127.0.0.1'],
    { VITE_SUPABASE_URL: 'http://127.0.0.1:54329', VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key' },
  );
  await waitForUrl(appUrl, 'isolated Vite');
  await controlFixture({ reset: true, value: baseValue, clearRequestLog: true });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installFixedClock(context, fixedWeekday);
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/^https:\/\/[^/]+\.supabase\.co\//.test(url)) {
        return Promise.resolve(new Response(JSON.stringify([]), {
          status: 503,
          headers: { 'content-type': 'application/json', 'x-qa-isolation': 'blocked' },
        }));
      }
      return nativeFetch(input, init);
    };
  });
  let questionMode = 'submitted';
  await context.route('**/api/question-submission-status**', async (route) => {
    if (questionMode === 'loading') await wait(1_200);
    const status = questionMode === 'error' ? 500 : 200;
    const statuses = questionMode === 'empty'
      ? []
      : [{ number: 1, personalSubmitted: true, topicSubmitted: false }];
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ statuses }) });
  });
  const page = await context.newPage();
  page.on('request', (request) => result.requestAudit.browserRequests.push(request.url()));
  page.on('console', (message) => {
    if (message.type() === 'error') result.console.push({ type: 'console', text: message.text() });
  });
  page.on('pageerror', (error) => result.console.push({ type: 'pageerror', text: error.message }));

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await capture(page, 'entry/default');

  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new Error('QA isolated fallback') })));
  await page.getByRole('heading', { name: '화면을 다시 불러와 주세요' }).waitFor();
  await capture(page, 'root/runtime-fallback');

  await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', 'invalid'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '번호 선택' }).waitFor();
  await capture(page, 'root/invalid-storage');

  for (const shortcut of [
    { id: 'root/shortcut-alt-meta-enter', key: 'Alt+Meta+Enter', platform: 'MacIntel' },
    { id: 'root/shortcut-alt-ctrl-enter', key: 'Alt+Control+Enter', platform: 'CrOS x86_64' },
  ]) {
    await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate((platform) => {
      Object.defineProperty(window.navigator, 'platform', { configurable: true, get: () => platform });
    }, shortcut.platform);
    await page.keyboard.press(shortcut.key);
    await page.getByRole('heading', { name: '번호 선택' }).waitFor();
    await capture(page, shortcut.id);
  }

  await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '0'));
  await page.reload({ waitUntil: 'networkidle' });
  await capture(page, 'timer/default');

  await page.evaluate(() => {
    localStorage.setItem('scheduleNotice', '격리 메모 기준선');
    localStorage.setItem('scheduleNoticeEnabled', 'true');
  });
  await controlFixture({ value: { ...baseValue, scheduleNotice: '격리 메모 기준선', isNoticeEnabled: true } });
  await page.reload({ waitUntil: 'networkidle' });
  const visibleMemoButton = page.locator('[aria-label="메모장"]').first();
  assert(await visibleMemoButton.count(), 'timer/memo: memo trigger missing');
  await visibleMemoButton.click();
  await page.getByText('메모 입력').waitFor({ state: 'attached' }).catch(() => {});
  const memoFocusAudit = await auditFocusLifecycle(page, 'timer/memo', '메모장');
  if (memoFocusAudit.closed) await visibleMemoButton.click();
  await capture(page, 'timer/memo');
  await clickIfPresent(page, 'button', '돌아가기');

  const manualTimerButton = page.getByRole('button', { name: /보조 타이머 열기/ }).first();
  if (await manualTimerButton.count()) {
    await manualTimerButton.click();
    await capture(page, 'timer/manual-timer');
  }
  await clickIfPresent(page, 'button', '보조 타이머 닫기');

  if (await clickIfPresent(page, 'button', '화폐 열기')) {
    await capture(page, 'timer/currency-personal');
    const studentNumber = page.getByRole('textbox', { name: '학생 번호 입력' });
    if (await studentNumber.count()) {
      await studentNumber.fill('99');
      await capture(page, 'timer/currency-invalid-number');
    }
    const all = page.getByRole('button', { name: '전체', exact: true });
    if (await all.count()) {
      await all.click();
      await capture(page, 'timer/currency-all');
    }
    await clickIfPresent(page, 'button', '화폐 닫기');
  }

  if (await clickIfPresent(page, 'button', '질문 제출 현황 열기')) {
    await capture(page, 'timer/question-submitted');
    await clickIfPresent(page, 'button', '질문 제출 현황 닫기');
  }
  for (const mode of ['loading', 'error', 'empty']) {
    questionMode = mode;
    const trigger = page.getByRole('button', { name: '질문 제출 현황 열기' });
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(mode === 'loading' ? 80 : 100);
      await capture(page, `timer/question-${mode}`);
      await clickIfPresent(page, 'button', '질문 제출 현황 닫기');
    }
  }
  if (await clickIfPresent(page, 'button', '유튜브 재생목록')) {
    await capture(page, 'timer/youtube-playlist');
    const searchInput = page.getByRole('textbox', { name: 'YouTube 검색어' });
    if (await searchInput.count()) {
      await searchInput.fill('합성 검색');
      await capture(page, 'timer/youtube-search');
    }
    await clickIfPresent(page, 'button', '유튜브 재생목록');
  }
  if (await clickIfPresent(page, 'button', '도서관 열기')) {
    await capture(page, 'timer/library');
    await clickIfPresent(page, 'button', '도서관 닫기');
  }
  if (await clickIfPresent(page, 'button', '알림장')) {
    await capture(page, 'timer/announcement-default');
    if (await clickIfPresent(page, 'button', '알림장 기록')) await capture(page, 'timer/announcement-history');
    await clickIfPresent(page, 'button', '기록 닫기');
    await clickIfPresent(page, 'button', '돌아가기');
  }
  await controlFixture({ value: awardValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  await page.reload({ waitUntil: 'networkidle' });
  const settingsTrigger = page.getByRole('button', { name: '설정', exact: true });
  assert(await settingsTrigger.count(), 'timer settings trigger missing');
  await settingsTrigger.click();
  const settingsFocusAudit = await auditFocusLifecycle(page, 'timer/settings-shell', '설정');
  if (settingsFocusAudit.closed) await settingsTrigger.click();
  await capture(page, 'timer/settings-shell');

  const subjectsTab = page.getByRole('button', { name: '과목', exact: true });
  await subjectsTab.click();
  await capture(page, 'timer/settings-과목');

  const auctionTab = page.getByRole('button', { name: '경매', exact: true });
  await auctionTab.click();
  await capture(page, 'timer/settings-경매');
  const awardButton = page.getByRole('button', { name: '낙찰', exact: true }).first();
  assert(await awardButton.count(), 'timer award action missing for synthetic bid');
  await awardButton.click();
  const awardFocusAudit = await auditFocusLifecycle(page, 'timer/auction-award-confirmation', '낙찰');
  if (awardFocusAudit.closed) await awardButton.click();
  await capture(page, 'timer/auction-award-confirmation');
  await page.getByRole('dialog').getByRole('button', { name: '낙찰', exact: true }).click();
  await page.getByRole('dialog', { name: '낙찰 애니메이션' }).waitFor();
  await capture(page, 'timer/auction-award-presentation');
  await page.waitForTimeout(2_400);
  const awardConfirmation = page.getByRole('dialog', { name: '낙찰 애니메이션' }).getByRole('button', { name: '확인', exact: true });
  if (await awardConfirmation.count()) await awardConfirmation.click();

  await page.getByRole('button', { name: '주간 경매 마감', exact: true }).click();
  const resetFocusAudit = await auditFocusLifecycle(page, 'timer/auction-reset-confirmation', '주간 경매 마감');
  if (resetFocusAudit.closed) await page.getByRole('button', { name: '주간 경매 마감', exact: true }).click();
  await capture(page, 'timer/auction-reset-confirmation');
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();

  const scheduleTab = page.getByRole('button', { name: '시간표', exact: true });
  await scheduleTab.click();
  await capture(page, 'timer/settings-시간표');
  await page.getByRole('button', { name: '선택한 요일 일정을 평일에 복사' }).click();
  await capture(page, 'timer/copy-confirmation');
  await page.locator('.confirm-box').getByRole('button', { name: '취소', exact: true }).click();

  const drawTab = page.getByRole('button', { name: '추첨', exact: true });
  await drawTab.click();
  await capture(page, 'timer/settings-추첨');
  const repeatToggle = page.getByRole('button', { name: '재등장 연출' });
  if (await repeatToggle.getAttribute('aria-pressed') !== 'true') await repeatToggle.click();
  const drawResetButton = page.getByRole('button', { name: /초기화$/ }).first();
  assert(await drawResetButton.count(), 'embedded draw reset action missing');
  await drawResetButton.click();
  await capture(page, 'timer/embedded-draw-reset');

  const settingsClose = page.locator('.settings-dialog > div').first().getByRole('button').last();
  await page.keyboard.press('Escape');
  if (await page.locator('.settings-dialog').count()) {
    const closeIcon = page.locator('.settings-dialog button').filter({ has: page.locator('svg') }).first();
    if (await closeIcon.count()) await closeIcon.click();
  }

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  await capture(page, 'timer/embedded-draw-rolling');
  await page.waitForTimeout(1_350);
  await capture(page, 'timer/embedded-draw-winner');
  await page.evaluate(() => { Math.random = () => 0; });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1_350);
  await capture(page, 'timer/embedded-draw-repeat');

  await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
  await controlFixture({ value: baseValue, failMethods: [], delayMs: { GET: 1_200 }, clearRequestLog: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(80);
  await capture(page, 'auction/loading');

  await controlFixture({ value: baseValue, failMethods: ['GET'], delayMs: { GET: 0 }, clearRequestLog: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('경매 정보를 불러오지 못했습니다.').waitFor();
  await capture(page, 'auction/error');

  await controlFixture({ value: baseValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  await page.reload({ waitUntil: 'networkidle' });
  await capture(page, 'auction/locked-or-default');
  const auctionItem = page.locator('button.auction-item-card').first();
  assert(await auctionItem.count(), 'auction synthetic item missing');
  await auctionItem.click();
  await capture(page, 'auction/selected');
  await page.getByRole('button', { name: '입찰', exact: true }).click();
  const auctionFocusAudit = await auditFocusLifecycle(page, 'auction/confirmation', '입찰');
  if (auctionFocusAudit.closed) await page.getByRole('button', { name: '입찰', exact: true }).click();
  await capture(page, 'auction/confirmation');

  await controlFixture({ delayMs: { PATCH: 1_200 }, failMethods: [] });
  await page.getByRole('dialog').getByRole('button', { name: '입찰하기', exact: true }).click();
  await page.waitForTimeout(80);
  await capture(page, 'auction/submitting');
  await page.waitForTimeout(1_350);
  await page.getByText('입찰이 완료되었습니다.').waitFor();
  await capture(page, 'auction/success');

  const openFreshConfirmation = async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const item = page.locator('button.auction-item-card').first();
    await item.click();
    await page.getByRole('button', { name: '입찰', exact: true }).click();
    await page.getByRole('dialog').waitFor();
  };

  await controlFixture({ reset: true, value: baseValue, failMethods: [], delayMs: { PATCH: 0 }, clearRequestLog: true });
  await openFreshConfirmation();
  await controlFixture({ value: { ...baseValue, currencyBalances: { 1: 0, 2: 250 } } });
  await page.getByRole('dialog').getByRole('button', { name: '입찰하기', exact: true }).click();
  await page.getByText('예약금을 제외한 사용 가능 고마가 부족합니다.').waitFor();
  await capture(page, 'auction/insufficient');

  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await controlFixture({ reset: true, value: baseValue, failMethods: [], delayMs: { PATCH: 0 }, clearRequestLog: true });
  await openFreshConfirmation();
  await controlFixture({ failMethods: ['PATCH'] });
  await page.getByRole('dialog').getByRole('button', { name: '입찰하기', exact: true }).click();
  await page.getByText('입찰을 처리하지 못했습니다. 다시 시도해 주세요.').waitFor();
  await capture(page, 'auction/write-error');

  await page.goto(drawUrl, { waitUntil: 'networkidle' });
  await capture(page, 'random-draw/default');
  if (await clickIfPresent(page, 'button', '설정')) {
    const drawSettingsFocusAudit = await auditFocusLifecycle(page, 'random-draw/settings', '설정');
    if (drawSettingsFocusAudit.closed) await page.getByRole('button', { name: '설정', exact: true }).click();
    await capture(page, 'random-draw/settings');
    await clickIfPresent(page, 'button', '설정 닫기');
  }
  await capture(page, 'random-draw/after-settings');
  const drawButton = page.getByRole('button', { name: '번호 뽑기' });
  if (await drawButton.count()) {
    await drawButton.click();
    await page.waitForTimeout(1_600);
    await capture(page, 'random-draw/winner');
  }
  const resetButton = page.locator('button.round-action-reset');
  assert(await resetButton.count(), 'standalone reset control missing');
  await resetButton.click();
  await page.waitForTimeout(100);
  await capture(page, 'random-draw/reset');

  await page.evaluate(() => {
    localStorage.setItem('school-random-draw-v1', JSON.stringify({
      activeCaseId: 'case-a',
      repeatPickEnabled: false,
      cases: [{
        id: 'case-a',
        label: '소진 상태',
        rangeStart: 1,
        rangeEnd: 1,
        currentResult: 1,
        historyEntries: [{ id: 'history-1', number: 1, kind: 'normal' }],
        studentNames: {},
        hiddenNumberQueue: [],
      }],
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '번호 뽑기' }).click();
  await page.waitForTimeout(100);
  await capture(page, 'random-draw/exhausted');

  await page.evaluate(() => {
    localStorage.setItem('school-random-draw-v1', JSON.stringify({
      activeCaseId: 'broken',
      repeatPickEnabled: false,
      cases: [{ id: 'broken', label: '잘못된 범위', rangeStart: 'invalid', rangeEnd: null }],
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await capture(page, 'random-draw/invalid-range');
  await context.close();

  const weekendContext = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installFixedClock(weekendContext, fixedWeekend);
  const weekendPage = await weekendContext.newPage();
  weekendPage.on('request', (request) => result.requestAudit.browserRequests.push(request.url()));
  await weekendPage.goto(appUrl, { waitUntil: 'networkidle' });
  await weekendPage.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '0'));
  await weekendPage.reload({ waitUntil: 'networkidle' });
  await weekendPage.getByText('일정이 없습니다.').waitFor();
  await capture(weekendPage, 'timer/empty-schedule');
  await weekendPage.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
  await weekendPage.reload({ waitUntil: 'networkidle' });
  await capture(weekendPage, 'auction/weekend-empty');
  await weekendContext.close();

  const fixtureState = await (await fetch(stateUrl)).json();
  result.requestAudit.fixtureRequests = fixtureState.requestLog;
  result.requestAudit.liveSupabase = result.requestAudit.browserRequests.filter(
    (url) => url.includes('/rest/v1/') && !url.startsWith('http://127.0.0.1:54329/'),
  );
  result.requestAudit.externalQuestion = result.requestAudit.browserRequests.filter(
    (url) => url.includes('question-submission-status') && !url.startsWith(appUrl),
  );
  result.consoleAudit = {
    expected: result.console.filter(({ text }) => (
      text.includes('status of 500')
      || text.includes('School Timer runtime failed.')
      || text.includes('Failed to load auction state from Supabase.')
      || text.includes('Failed to submit auction bid.')
    )),
    unexpected: result.console.filter(({ text }) => !(
      text.includes('status of 500')
      || text.includes('School Timer runtime failed.')
      || text.includes('Failed to load auction state from Supabase.')
      || text.includes('Failed to submit auction bid.')
    )),
  };
  result.unreachable = [{
    id: 'timer/embedded-draw-empty',
    proof: 'startStudentDraw constructs rollingPool from inclusive normalized min/max bounds; normalization clamps both bounds to 1..999, therefore rollingPool.length is always at least 1 in current HEAD',
    fixturePayload: {
      randomDraw: {
        activeCaseId: 'case-a',
        repeatPickEnabled: false,
        cases: [{ id: 'case-a', label: '빈 상태 검증', rangeStart: null, rangeEnd: null, historyEntries: [] }],
      },
    },
    replay: {
      selector: 'window keyboard ArrowRight on Timer home with no modal/pane/editable target open',
      fixedTimingMs: [0, 80, 1300, 2240],
      expectedCurrentBehavior: 'invalid bounds normalize to a non-empty inclusive range; empty overlay is unreachable',
    },
  }];
  assert(result.requestAudit.liveSupabase.length === 0, 'A Supabase request escaped the local fixture');
  assert(result.requestAudit.externalQuestion.length === 0, 'A question-status request escaped the local route');
  assert(result.consoleAudit.unexpected.length === 0, 'Unexpected browser console error');
  const actualIds = result.states.map(({ id }) => id);
  const duplicateIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const missingIds = [...requiredStateIds].filter((id) => !actualIds.includes(id));
  const unexpectedIds = actualIds.filter((id) => !requiredStateIds.has(id));
  assert(duplicateIds.length === 0, `Duplicate state IDs: ${duplicateIds.join(', ')}`);
  assert(missingIds.length === 0, `Missing required state IDs: ${missingIds.join(', ')}`);
  assert(unexpectedIds.length === 0, `Unexpected state IDs: ${unexpectedIds.join(', ')}`);
  for (const state of result.states) {
    assert(state.snapshots.length === viewports.length + 1, `${state.id}: expected seven viewport records`);
    for (const snapshot of state.snapshots) {
      assert(snapshot.text.length > 0, `${state.id}: empty visible-text array`);
      assert(snapshot.text.some((value) => value.length > 0), `${state.id}: visible text contains only empty nodes`);
      assert(!snapshot.overflow.horizontal, `${state.id}: horizontal overflow at ${snapshot.viewport.width}x${snapshot.viewport.height}`);
    }
  }
  result.requiredStateIds = [...requiredStateIds];
  result.expectedRecordCount = requiredStateIds.size * (viewports.length + 1);
  result.actualRecordCount = result.states.reduce((count, state) => count + state.snapshots.length, 0);
  assert(result.actualRecordCount === result.expectedRecordCount, 'Required state×viewport record count mismatch');
  const baseline = JSON.parse(await readFile(
    path.join(root, '.omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle-run-2.json'),
    'utf8',
  ));
  const comparisons = entryRootStateIds.flatMap((id) => {
    const baselineState = baseline.states.find((state) => state.id === id);
    const currentState = result.states.find((state) => state.id === id);
    assert(baselineState && currentState, `Missing baseline comparison state: ${id}`);
    return currentState.snapshots.map((snapshot, index) => {
      const baselineBytes = Buffer.from(JSON.stringify(baselineState.snapshots[index].text), 'utf8');
      const currentBytes = Buffer.from(JSON.stringify(snapshot.text), 'utf8');
      return {
        id,
        viewport: snapshot.viewport,
        equal: baselineBytes.equals(currentBytes),
        baselineBytes: baselineBytes.length,
        currentBytes: currentBytes.length,
      };
    });
  });
  result.baselineVisibleTextComparison = {
    source: '.omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle-run-2.json',
    expected: 35,
    compared: comparisons.length,
    matches: comparisons.filter(({ equal }) => equal).length,
    mismatches: comparisons.filter(({ equal }) => !equal),
    comparisons,
  };
  assert(comparisons.length === 35, 'Entry/root baseline comparison did not cover 35 records');
  assert(result.baselineVisibleTextComparison.mismatches.length === 0, 'Entry/root visible text differs from Todo 1 baseline');
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
  result.success = false;
} finally {
  if (browser) await browser.close();
  for (const child of [...children].reverse()) await stop(child);
  result.cleanup.children = children.map(({ receipt }) => receipt);
  result.completedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
