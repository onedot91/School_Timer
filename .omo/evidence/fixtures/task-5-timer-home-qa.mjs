import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-5-apple-ui-refresh-plan/timer-home');
const appUrl = 'http://127.0.0.1:4177/';
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const fixedWeekday = '2026-07-06T10:00:00.000Z';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844, zoom: 2 },
];
const children = [];
const result = {
  purpose: 'Timer home Apple hierarchy, reflow, keyboard, exact-copy, and read-only QA',
  failingFirst: {
    source: 'Todo1 timer/default 1440x900 baseline',
    targetsBelow44: ['이전 추첨 상황 40x40', '다음 추첨 상황 40x40', '설정 40x40'],
    timerHomeThemeRules: 0,
  },
  states: [],
  interactions: {},
  network: { browserMutations: [], externalRequests: [], fixtureMutations: [] },
  screenshots: [],
  errors: [],
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const start = (command, args, environment = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = { command: [command, ...args].join(' '), stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => { receipt.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { receipt.stderr += chunk.toString(); });
  children.push({ child, receipt });
};
const waitForUrl = async (url) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* bounded local readiness */ }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const controlFixture = async (payload) => {
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert(response.ok, `fixture control failed: ${response.status}`);
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
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const targets = [...document.querySelectorAll(selector)].filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      name: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '',
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    };
  });
  const documentElement = document.documentElement;
  const shell = document.querySelector('.timer-main-shell');
  const home = document.querySelector('.editorial-home-layout');
  return {
    text,
    targets,
    targetsBelow44: targets.filter(({ width, height }) => width < 44 || height < 44),
    viewportOverflow: documentElement.scrollWidth > documentElement.clientWidth,
    shellOverflow: shell ? shell.scrollWidth > shell.clientWidth : null,
    shellWidth: shell ? { scrollWidth: shell.scrollWidth, clientWidth: shell.clientWidth } : null,
    shellRectOverflow: shell ? [...shell.querySelectorAll('*')].map((element) => {
      const shellRect = shell.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return { className: element.className, left: rect.left, right: rect.right, shellLeft: shellRect.left, shellRight: shellRect.right };
    }).filter(({ left, right, shellLeft, shellRight }) => left < shellLeft - 1 || right > shellRight + 1).slice(0, 30) : [],
    homeOverflow: home ? home.scrollWidth > home.clientWidth : null,
    overflowingElements: [...document.querySelectorAll('.editorial-home-layout *')].filter((element) => element.scrollWidth > element.clientWidth + 1).slice(0, 20).map((element) => ({
      className: element.className,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    })),
    activeElement: document.activeElement?.getAttribute('aria-label') || document.activeElement?.getAttribute('title') || '',
  };
};

await mkdir(outputDirectory, { recursive: true });
let browser;
try {
  start(process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl);
  await controlFixture({ reset: true, clearRequestLog: true });
  start('npm', ['run', 'dev', '--', '--port', '4177', '--host', '127.0.0.1'], {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
    VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key',
  });
  await waitForUrl(appUrl);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await context.addInitScript((iso) => {
    const NativeDate = Date;
    const fixedTime = new NativeDate(iso).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { return args.length === 0 ? new NativeDate(fixedTime) : new NativeDate(...args); }
      static now() { return fixedTime; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
    HTMLMediaElement.prototype.load = function load() {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
    };
    HTMLMediaElement.prototype.play = function play() {
      return Promise.reject(new DOMException('QA audio unavailable', 'NotSupportedError'));
    };
  }, fixedWeekday);
  const page = await context.newPage();
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' && ['4177', '54329'].includes(url.port);
    if (!local) result.network.externalRequests.push({ method: request.method(), url: request.url() });
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' && ['4177', '54329'].includes(url.port);
    if (!local) return route.abort('blockedbyclient');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
      result.network.browserMutations.push({ method: request.method(), url: request.url() });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.timer-main-shell').waitFor({ state: 'visible' });

  const oracle = JSON.parse(await readFile(path.join(root, '.omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle.json'), 'utf8'));
  const baseline = oracle.states.find((state) => state.id === 'timer/default');
  assert(baseline, 'timer/default oracle missing');

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom ?? 1);
    await page.locator('.schedule-scroll').evaluate((element) => { element.scrollTop = 0; });
    await page.waitForTimeout(80);
    const state = await page.evaluate(visibleState);
    const expected = baseline.snapshots.find((snapshot) => snapshot.viewport.width === viewport.width
      && snapshot.viewport.height === viewport.height
      && (snapshot.viewport.zoom ?? 1) === (viewport.zoom ?? 1));
    assert(expected, `oracle viewport missing: ${JSON.stringify(viewport)}`);
    const record = {
      viewport,
      ...state,
      exactTextMatch: JSON.stringify(state.text) === JSON.stringify(expected.text),
    };
    result.states.push(record);
    assert(record.exactTextMatch, `visible text changed at ${JSON.stringify(viewport)}`);
    assert(!record.viewportOverflow && !record.shellOverflow, `page or shell horizontal overflow at ${JSON.stringify(viewport)}: ${JSON.stringify(record.shellWidth)}`);
    const scheduleScrollTop = await page.locator('.schedule-scroll').evaluate((element) => element.scrollTop);
    assert(scheduleScrollTop === 0, `schedule scrollTop changed at ${JSON.stringify(viewport)}: ${scheduleScrollTop}`);
    assert(record.targetsBelow44.length === 0, `targets below 44 at ${JSON.stringify(viewport)}: ${JSON.stringify(record.targetsBelow44)}`);
    const screenshot = path.join(outputDirectory, `default-${viewport.width}x${viewport.height}${viewport.zoom ? '-200pct' : ''}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshots.push(screenshot);
  }

  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.setViewportSize({ width: 390, height: 844 });
  const manualTrigger = page.getByRole('button', { name: /보조 타이머 열기/ });
  await manualTrigger.focus();
  const triggerFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await page.keyboard.press('Enter');
  await page.locator('.inline-manual-timer-shell-open').waitFor({ state: 'visible' });
  const minutesInput = page.getByRole('textbox', { name: '보조 타이머 분' });
  await minutesInput.focus();
  const inputFocus = await minutesInput.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  assert(inputFocus.outlineColor === 'rgb(0, 122, 87)', `manual text focus is not green: ${JSON.stringify(inputFocus)}`);
  assert(!inputFocus.boxShadow.includes('0, 102, 204'), `manual text focus retained blue shadow: ${inputFocus.boxShadow}`);
  await page.getByRole('button', { name: '보조 타이머 닫기' }).click();
  await page.locator('.inline-manual-timer-shell-open').waitFor({ state: 'hidden' });
  result.interactions.manualTimer = {
    triggerFocus,
    opened: true,
    inputFocus,
    closed: true,
  };

  await page.keyboard.press('Tab');
  const keyboardOrder = [];
  for (let index = 0; index < 14; index += 1) {
    keyboardOrder.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.getAttribute('title') || ''));
    await page.keyboard.press('Tab');
  }
  result.interactions.keyboardOrder = keyboardOrder;
  assert(keyboardOrder.some((name) => name === '설정'), 'keyboard traversal did not reach settings');
  assert(keyboardOrder.some((name) => name === '알림장'), 'keyboard traversal did not reach utility toolbar');

  const soundButton = page.getByRole('button', { name: /배경 음악/ });
  await soundButton.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '배경 음악 다시 시도', exact: true }).waitFor({ state: 'visible' });
  result.interactions.audioUnavailable = {
    label: await soundButton.getAttribute('aria-label'),
    title: await soundButton.getAttribute('title'),
    disabled: await soundButton.isDisabled(),
    failurePath: 'HTMLMediaElement.play rejected with local NotSupportedError',
  };
  assert(result.interactions.audioUnavailable.label === '배경 음악 다시 시도', 'audio failure did not expose retry state');

  const emptyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await emptyContext.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  const emptyPage = await emptyContext.newPage();
  await emptyPage.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' || !['4177', '54329'].includes(url.port)) return route.abort('blockedbyclient');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) return route.abort('blockedbyclient');
    return route.continue();
  });
  await controlFixture({ value: { currencyBalances: {}, auctionItems: [], auctionBids: {}, auctionBidHistory: {}, auctionAwards: {}, schedules: {} } });
  await emptyPage.goto(appUrl, { waitUntil: 'networkidle' });
  await emptyPage.getByText('일정이 없습니다.', { exact: true }).waitFor({ state: 'visible' });
  const emptyState = await emptyPage.evaluate(visibleState);
  assert(!emptyState.viewportOverflow && !emptyState.homeOverflow, 'empty schedule has horizontal overflow');
  const emptyScreenshot = path.join(outputDirectory, 'empty-schedule-390x844.png');
  await emptyPage.screenshot({ path: emptyScreenshot, fullPage: true });
  result.screenshots.push(emptyScreenshot);
  result.interactions.emptySchedule = { visible: true, targetsBelow44: emptyState.targetsBelow44 };
  await emptyContext.close();
  await context.close();
  await browser.close();
  browser = null;

  const fixtureState = await fetch(stateUrl).then((response) => response.json());
  result.network.fixtureMutations = fixtureState.requestLog.filter((entry) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(entry.method) && !entry.path.startsWith('/__qa/'));
  assert(result.network.fixtureMutations.length === 0, `fixture received product mutations: ${JSON.stringify(result.network.fixtureMutations)}`);
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
  result.success = false;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  for (const { child } of children) child.kill('SIGTERM');
  await wait(120);
  result.servers = children.map(({ receipt }) => receipt);
  await writeFile(path.join(outputDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
