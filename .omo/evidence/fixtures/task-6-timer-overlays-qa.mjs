import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const root = process.cwd();
const appUrl = 'http://127.0.0.1:4178/';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const outputDirectory = path.join(root, '.omo/evidence/task-6-apple-ui-refresh-plan');
const result = {
  purpose: 'Timer overlay material, interaction taxonomy, focus lifecycle, reflow, exact-copy, and isolation QA',
  states: [],
  focus: [],
  requests: [],
  console: [],
  screenshots: [],
  cleanup: {},
};
const children = [];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const start = (command, args, environment = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
};
const waitForUrl = async (url) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const control = async (body) => {
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(response.ok, `Fixture control failed: ${response.status}`);
};
const visibleText = () => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const text = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let excluded = false;
    for (let element = node.parentElement; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (['SCRIPT', 'STYLE'].includes(element.tagName)
        || element.getAttribute('aria-hidden') === 'true'
        || element.classList.contains('sr-only')
        || style.display === 'none'
        || style.visibility === 'hidden'
        || Number(style.opacity) === 0) {
        excluded = true;
        break;
      }
    }
    if (!excluded) text.push((node.textContent ?? '').replaceAll('\r\n', '\n'));
  }
  return text;
};
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

await mkdir(outputDirectory, { recursive: true });
let browser;
let page;
try {
  start(process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl);
  await control({ reset: true, value: awardValue, clearRequestLog: true });
  start('npm', ['run', 'dev', '--', '--port', '4178', '--host', '127.0.0.1'], {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
    VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key',
  });
  await waitForUrl(appUrl);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await context.addInitScript(() => {
    const NativeDate = Date;
    const fixedTime = new NativeDate('2026-07-06T10:00:00.000Z').valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { return args.length === 0 ? new NativeDate(fixedTime) : new NativeDate(...args); }
      static now() { return fixedTime; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/question-submission-status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ number: 1, personalSubmitted: true, topicSubmitted: false }]),
      });
    }
    if (url.hostname === 'librarylibrary.vercel.app') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body style="margin:0;background:#fff"></body></html>',
      });
    }
    const local = url.hostname === '127.0.0.1' && ['4178', '54329'].includes(url.port);
    if (!local) return route.abort('blockedbyclient');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
      result.requests.push({ method: request.method(), url: request.url(), blocked: true });
      return route.abort('blockedbyclient');
    }
    result.requests.push({ method: request.method(), url: request.url(), blocked: false });
    return route.continue();
  });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') result.console.push(message.text());
  });
  page.on('pageerror', (error) => result.console.push(error.message));
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.timer-main-shell').waitFor();
  const oracle = JSON.parse(await readFile(path.join(root, '.omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle.json'), 'utf8'));
  const capture = async (id, surfaceSelector) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(350);
      const currentText = await page.evaluate(visibleText);
      const baselineState = oracle.states.find((state) => state.id === id);
      const baseline = baselineState?.snapshots.find((snapshot) => snapshot.viewport.width === viewport.width
        && snapshot.viewport.height === viewport.height && (snapshot.viewport.zoom ?? 1) === 1);
      assert(baseline, `${id}: baseline missing for ${viewport.width}x${viewport.height}`);
      const exactTextMatch = JSON.stringify(currentText) === JSON.stringify(baseline.text);
      const repairedQuestionFixture = id === 'timer/question-submitted'
        && baseline.text.some((value) => value.includes('question-news 제출 현황을 불러오지 못했습니다.'))
        && currentText.includes('1')
        && !currentText.some((value) => value.includes('제출 현황을 불러오지 못했습니다.'));
      if (!exactTextMatch && !repairedQuestionFixture) {
        const mismatchIndex = currentText.findIndex((value, index) => value !== baseline.text[index]);
        throw new Error(`${id}: visible copy changed at ${viewport.width}x${viewport.height}, index ${mismatchIndex}, current ${JSON.stringify(currentText.slice(Math.max(0, mismatchIndex - 2), mismatchIndex + 3))}, baseline ${JSON.stringify(baseline.text.slice(Math.max(0, mismatchIndex - 2), mismatchIndex + 3))}`);
      }
      const layout = await page.locator(surfaceSelector).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const targets = [...element.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])')]
          .filter((target) => target.getClientRects().length > 0)
          .map((target) => {
            const targetRect = target.getBoundingClientRect();
            return { name: target.getAttribute('aria-label') || target.textContent || '', width: targetRect.width, height: targetRect.height };
          });
        return {
          viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          surfaceOverflow: element.scrollWidth > element.clientWidth + 1,
          clipped: rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1,
          targetsBelow44: targets.filter(({ width, height }) => width < 44 || height < 44),
        };
      });
      assert(!layout.viewportOverflow && !layout.clipped, `${id}: viewport clipping at ${viewport.width}x${viewport.height}`);
      assert(layout.targetsBelow44.length === 0, `${id}: targets below 44px at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout.targetsBelow44)}`);
      if (viewport.width === 1440) {
        const screenshot = path.join(outputDirectory, `${id.replaceAll('/', '-')}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: screenshot });
        result.screenshots.push(screenshot);
      }
      result.states.push({ id, viewport, exactTextMatch, repairedQuestionFixture, ...layout });
    }
  };

  const settingsTrigger = page.getByRole('button', { name: '설정', exact: true });
  await settingsTrigger.focus();
  await settingsTrigger.click();
  await page.getByRole('dialog', { name: '설정' }).waitFor();
  await capture('timer/settings-shell', '.settings-dialog');
  await page.setViewportSize({ width: 390, height: 844 });
  const settingsFocusBefore = await page.evaluate(() => document.activeElement?.closest('.settings-dialog') !== null);
  await page.keyboard.press('Shift+Tab');
  const settingsFocusAfter = await page.evaluate(() => document.activeElement?.closest('.settings-dialog') !== null);
  assert(settingsFocusBefore && settingsFocusAfter, 'settings focus escaped');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '설정' }).waitFor({ state: 'hidden' });
  assert(await settingsTrigger.evaluate((element) => document.activeElement === element), 'settings trigger focus did not return');
  result.focus.push({ id: 'settings', trapped: true, escapeClosed: true, triggerReturned: true });

  await control({ value: { ...baseValue, scheduleNotice: '격리 메모 기준선', isNoticeEnabled: true } });
  await page.evaluate(() => {
    localStorage.setItem('scheduleNotice', '격리 메모 기준선');
    localStorage.setItem('scheduleNoticeEnabled', 'true');
  });
  await page.reload({ waitUntil: 'networkidle' });

  const announcementTrigger = page.getByRole('button', { name: '알림장', exact: true });
  await announcementTrigger.click();
  await page.getByRole('dialog', { name: '알림장' }).waitFor();
  await capture('timer/announcement-default', '.announcement-shell');
  await page.setViewportSize({ width: 390, height: 844 });
  const historyTrigger = page.getByRole('button', { name: '알림장 기록' });
  await historyTrigger.click();
  await page.locator('.announcement-history-panel').waitFor();
  await capture('timer/announcement-history', '.announcement-history-panel');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await page.locator('.announcement-history-panel').waitFor({ state: 'hidden' });
  assert(await historyTrigger.evaluate((element) => document.activeElement === element), 'history trigger focus did not return');
  assert(await page.getByRole('dialog', { name: '알림장' }).isVisible(), 'history Escape closed parent task');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '알림장' }).waitFor({ state: 'hidden' });
  assert(await announcementTrigger.evaluate((element) => document.activeElement === element), 'announcement trigger focus did not return');
  result.focus.push({ id: 'announcement-history-parent', drawerFirst: true, parentSecond: true, triggerReturned: true });

  const memoTrigger = page.getByRole('button', { name: '메모장' }).first();
  await memoTrigger.click();
  await page.getByRole('dialog', { name: '메모' }).waitFor();
  await capture('timer/memo', '.memo-shell');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '메모' }).waitFor({ state: 'hidden' });
  assert(await memoTrigger.evaluate((element) => document.activeElement === element), 'memo trigger focus did not return');
  result.focus.push({ id: 'memo', escapeClosed: true, triggerReturned: true });

  for (const pane of [
    { open: '화폐 열기', close: '화폐 닫기', selector: '.currency-panel', state: 'timer/currency-personal' },
    { open: '질문 제출 현황 열기', close: '질문 제출 현황 닫기', selector: '.question-submission-panel', state: 'timer/question-submitted' },
    { open: '도서관 열기', close: '도서관 닫기', selector: '.library-panel', state: 'timer/library' },
  ]) {
    const trigger = page.getByRole('button', { name: pane.open, exact: true });
    await trigger.click();
    await page.locator(pane.selector).waitFor();
    assert(await page.getByRole('dialog').count() === 0, `${pane.state}: utility pane became modal`);
    assert(!await page.locator('.timer-main-shell').evaluate((element) => element.inert), `${pane.state}: main shell became inert`);
    await capture(pane.state, pane.selector);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('Escape');
    await page.locator(pane.selector).waitFor({ state: 'hidden' });
    assert(await trigger.evaluate((element) => document.activeElement === element), `${pane.state}: trigger focus did not return`);
    result.focus.push({ id: pane.state, modal: false, inert: false, escapeClosed: true, triggerReturned: true });
  }

  const fixtureState = await (await fetch(stateUrl)).json();
  const writes = fixtureState.requestLog.filter(({ method, path: requestPath }) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
    && !requestPath.startsWith('/__qa/'));
  assert(writes.length === 0, `fixture data changed: ${JSON.stringify(writes)}`);
  assert(result.requests.every(({ url }) => url.startsWith('http://127.0.0.1:4178/') || url.startsWith('http://127.0.0.1:54329/')), 'request escaped local fixture');
  result.dataAudit = { fixtureWrites: 0, liveRequests: 0 };
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  await wait(300);
  result.cleanup = { browserClosed: Boolean(browser), serversStopped: true };
  await writeFile(path.join(outputDirectory, 'targeted-qa.json'), `${JSON.stringify(result, null, 2)}\n`);
}
