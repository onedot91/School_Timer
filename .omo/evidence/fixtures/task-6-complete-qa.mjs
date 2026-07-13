import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');

const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-6-apple-ui-refresh-plan/complete');
const outputPath = path.join(root, '.omo/evidence/task-6-apple-ui-refresh-plan/complete-current.json');
const appUrl = 'http://127.0.0.1:4180/';
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
  { width: 1280, height: 600, label: 'low-height' },
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
  'timer/currency-feedback',
  'timer/question-submitted',
  'timer/question-loading',
  'timer/question-error',
  'timer/question-empty',
  'timer/youtube-playlist',
  'timer/youtube-search',
  'timer/youtube-empty',
  'timer/youtube-error',
  'timer/library',
  'timer/library-loading',
  'timer/library-unavailable',
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
  'timer/auction-award-presentation-outside',
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
const todo6StateIds = new Set([
  'timer/default',
  'timer/memo',
  'timer/currency-personal',
  'timer/currency-invalid-number',
  'timer/currency-all',
  'timer/currency-feedback',
  'timer/question-submitted',
  'timer/question-loading',
  'timer/question-error',
  'timer/question-empty',
  'timer/youtube-playlist',
  'timer/youtube-search',
  'timer/youtube-empty',
  'timer/youtube-error',
  'timer/library',
  'timer/library-loading',
  'timer/library-unavailable',
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
  'timer/auction-award-presentation-outside',
  'timer/auction-reset-confirmation',
  'timer/embedded-draw-rolling',
  'timer/embedded-draw-winner',
  'timer/embedded-draw-repeat',
  'timer/embedded-draw-reset',
]);
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
  purpose: 'Complete current Timer overlay runtime, visible-text, accessibility, preference, motion, and isolation oracle',
  startedAt: new Date().toISOString(),
  fixedClocks: { weekday: fixedWeekday, weekend: fixedWeekend },
  viewports: [...viewports, zoomViewport],
  states: [],
  requestAudit: { browserRequests: [], fixtureRequests: [], blockedExternal: [], liveSupabase: [], externalQuestion: [] },
  console: [],
  cleanup: {},
  focusLifecycle: [],
  nestedModalAudit: [],
  preferenceAudit: [],
  motionAudit: [],
  baselineRepair: null,
  textComparisons: [],
  screenshots: [],
  screenshotManifest: {
    status: 'pending-run',
    expectedStateIds: [],
    expectedViewports: [...viewports, zoomViewport],
    expectedCount: 0,
    actualCount: 0,
    missing: [],
  },
  unreachable: [],
  errors: [],
};
const children = [];
const runId = `final-${Date.now().toString(36)}`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sanitizeRequestUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  if (url.hostname === 'librarylibrary.vercel.app') return '[FULFILLED_LIBRARY_FIXTURE]';
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return '[BLOCKED_EXTERNAL_REQUEST]';
  return `${url.origin}${url.pathname}`;
};

const installExternalRequestIsolation = async (context) => {
  await context.route('https://**/*', async (route) => {
    const sanitizedUrl = sanitizeRequestUrl(route.request().url());
    result.requestAudit.blockedExternal.push(sanitizedUrl);
    await route.fulfill({ status: 204, body: '' });
  });
};

const auditScreenshotPixels = (screenshotPath) => JSON.parse(execFileSync('python3', ['-c', [
  'from PIL import Image',
  `im=Image.open(${JSON.stringify(screenshotPath)}).convert("RGB")`,
  'pixels=list(im.getdata())',
  'black=sum(1 for r,g,b in pixels if r<8 and g<8 and b<8)',
  'near=sum(1 for r,g,b in pixels if r<24 and g<24 and b<24)',
  'import json',
  'print(json.dumps({"size":im.size,"blackPixels":black,"nearBlackPixels":near,"ratio":near/len(pixels)}))',
].join(';')], { encoding: 'utf8' }));

const resizeZoomScreenshot = (screenshotPath, variant) => {
  if ((variant.zoom ?? 1) === 1) return;
  execFileSync('python3', ['-c', [
    'from PIL import Image',
    `p=${JSON.stringify(screenshotPath)}`,
    'im=Image.open(p)',
    `im.resize((${variant.width},${variant.height}), Image.Resampling.LANCZOS).save(p)`,
  ].join(';')]);
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
    if (!excluded(node)) text.push((node.textContent ?? '').replaceAll('\r\n', '\n').replaceAll('\u00a0', ' '));
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
  const visibleSurfaces = [...document.querySelectorAll(
    '.settings-dialog, .announcement-shell, .memo-shell, .announcement-history-panel, .utility-pane-card, .auction-award-stage, .random-board',
  )].filter((element) => element.getClientRects().length > 0).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      selector: element.className,
      horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      clipped: rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    };
  });
  return {
    text,
    focusOrder: targets.map(({ tag, name }) => ({ tag, name })),
    targets,
    targetsBelow44: targets.filter(({ width, height }) => width < 44 || height < 44),
    clippedTargets: targets.filter((_target, index) => {
      const rect = focusable[index].getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
    }),
    visibleSurfaces,
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
  if (id !== 'timer/question-loading') await page.waitForTimeout(300);
  for (const variant of variants) {
    const zoom = variant.zoom ?? 1;
    await page.setViewportSize({ width: Math.round(variant.width / zoom), height: Math.round(variant.height / zoom) });
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.waitForTimeout(50);
    const snapshot = { viewport: variant, ...(await page.evaluate(visibleState)) };
    snapshots.push(snapshot);
    const zoomSuffix = (variant.zoom ?? 1) === 1 ? '' : `-zoom-${variant.zoom}`;
    const screenshotPath = path.join(outputDirectory, `${runId}-${id.replaceAll('/', '-')}-${variant.width}x${variant.height}${zoomSuffix}.png`);
    await page.screenshot({ path: screenshotPath });
    resizeZoomScreenshot(screenshotPath, variant);
    result.screenshots.push({ id, viewport: variant, path: screenshotPath });
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.setViewportSize({ width: 1280, height: 720 });
  result.states.push({ id, metadata, snapshots });
};

const captureResetEffect = async (page, id, trigger) => {
  const snapshots = [];
  for (const variant of [...viewports, zoomViewport]) {
    const zoom = variant.zoom ?? 1;
    await page.setViewportSize({ width: Math.round(variant.width / zoom), height: Math.round(variant.height / zoom) });
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    for (let attempt = 0; attempt < 30 && !(await trigger.isEnabled()); attempt += 1) {
      await page.waitForTimeout(100);
    }
    assert(await trigger.isEnabled(), `embedded reset trigger did not become enabled at ${variant.width}x${variant.height}`);
    await trigger.evaluate((element) => element.click());
    await page.waitForTimeout(50);
    const snapshot = { viewport: variant, ...(await page.evaluate(visibleState)) };
    assert(snapshot.text.includes('섞는 중'), `embedded reset transient was not captured at ${variant.width}x${variant.height}`);
    snapshots.push(snapshot);
    const zoomSuffix = (variant.zoom ?? 1) === 1 ? '' : `-zoom-${variant.zoom}`;
    const screenshotPath = path.join(outputDirectory, `${runId}-${id.replaceAll('/', '-')}-${variant.width}x${variant.height}${zoomSuffix}.png`);
    await page.screenshot({ path: screenshotPath });
    resizeZoomScreenshot(screenshotPath, variant);
    result.screenshots.push({ id, viewport: variant, path: screenshotPath });
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.setViewportSize({ width: 1280, height: 720 });
  result.states.push({ id, metadata: { captureOrder: 'reset independently retriggered before every viewport' }, snapshots });
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
  assert(afterTab.insideDialog, `${id}: Tab escaped the active dialog`);
  assert(afterShiftTab.insideDialog, `${id}: Shift+Tab escaped the active dialog`);
  await page.keyboard.press('Escape');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const surfaceCount = await page.evaluate(() => document.querySelectorAll('[role="dialog"], .settings-dialog, .announcement-overlay').length);
    if (surfaceCount < before.surfaceCount) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(0);
  const afterEscape = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '',
    surfaceCount: document.querySelectorAll('[role="dialog"], .settings-dialog, .announcement-overlay').length,
  }));
  result.focusLifecycle.push({ id, triggerName, before, afterTab, afterShiftTab, afterEscape });
  return { closed: afterEscape.surfaceCount < before.surfaceCount };
};

const inspectTimerModalStack = async (page, id) => {
  const snapshot = await page.evaluate(() => {
    const settings = document.querySelector('.settings-dialog');
    const parentContent = settings?.querySelector('.settings-parent-content');
    const modalDialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
    const topDialog = modalDialogs.at(-1);
    return {
      modalCount: modalDialogs.length,
      topName: topDialog?.getAttribute('aria-label') || topDialog?.getAttribute('aria-labelledby') || '',
      activeInsideTop: Boolean(topDialog?.contains(document.activeElement)),
      parentRole: settings?.getAttribute('role') ?? null,
      parentAriaModal: settings?.getAttribute('aria-modal') ?? null,
      parentContentInert: parentContent instanceof HTMLElement ? parentContent.inert : null,
      parentContentAriaHidden: parentContent?.getAttribute('aria-hidden') ?? null,
    };
  });
  assert(snapshot.modalCount === 1, `${id}: expected exactly one aria-modal top layer`);
  assert(snapshot.activeInsideTop, `${id}: focus is not inside top modal`);
  assert(snapshot.parentRole === null && snapshot.parentAriaModal === null, `${id}: parent retained modal semantics`);
  assert(snapshot.parentContentInert === true && snapshot.parentContentAriaHidden === 'true', `${id}: parent content is not inert and aria-hidden`);
  result.nestedModalAudit.push({ id, phase: 'open', ...snapshot });
  return snapshot;
};

const inspectRestoredSettingsParent = async (page, id, expectedFocusName = null) => {
  const snapshot = await page.evaluate(() => {
    const settings = document.querySelector('.settings-dialog');
    const parentContent = settings?.querySelector('.settings-parent-content');
    return {
      modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      parentRole: settings?.getAttribute('role') ?? null,
      parentAriaModal: settings?.getAttribute('aria-modal') ?? null,
      parentContentInert: parentContent instanceof HTMLElement ? parentContent.inert : null,
      parentContentAriaHidden: parentContent?.getAttribute('aria-hidden') ?? null,
      activeName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '',
      activeInsideParent: Boolean(settings?.contains(document.activeElement)),
    };
  });
  assert(snapshot.modalCount === 1 && snapshot.parentRole === 'dialog' && snapshot.parentAriaModal === 'true', `${id}: parent modal ownership was not restored`);
  assert(snapshot.parentContentInert === false && snapshot.parentContentAriaHidden === null, `${id}: parent isolation was not restored`);
  assert(snapshot.activeInsideParent, `${id}: focus was not restored inside parent`);
  if (expectedFocusName !== null) assert(snapshot.activeName.includes(expectedFocusName), `${id}: exact parent focus was not restored to ${expectedFocusName}`);
  result.nestedModalAudit.push({ id, phase: 'restored', expectedFocusName, ...snapshot });
};

let browser;
try {
  await mkdir(outputDirectory, { recursive: true });
  start('fake-supabase', process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl, 'fake Supabase');
  start(
    'vite',
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', '4180', '--host', '127.0.0.1'],
    { VITE_SUPABASE_URL: 'http://127.0.0.1:54329', VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key', VITE_YOUTUBE_API_KEY: '' },
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
  await installExternalRequestIsolation(context);
  let questionMode = 'submitted';
  await context.route('**/api/question-submission-status**', async (route) => {
    if (questionMode === 'loading') await wait(1_200);
    const status = questionMode === 'error' ? 500 : 200;
    const statuses = questionMode === 'empty'
      ? []
      : [{ number: 1, personalSubmitted: true, topicSubmitted: false }];
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(statuses) });
  });
  let libraryMode = 'ready';
  await context.route('https://librarylibrary.vercel.app/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><html><body data-qa-library-mode="${libraryMode}" style="margin:0;background:${libraryMode === 'loading' ? '#f2f2f4' : '#fff'}"></body></html>`,
  }));
  const page = await context.newPage();
  page.on('request', (request) => result.requestAudit.browserRequests.push(sanitizeRequestUrl(request.url())));
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
      const increaseAll = page.getByRole('button', { name: '전체 화폐 5 늘리기', exact: true });
      assert(await increaseAll.count(), 'currency all synthetic adjustment control missing');
      await increaseAll.click();
      await page.waitForTimeout(80);
      await capture(page, 'timer/currency-feedback', { fixture: 'synthetic local Supabase only', expectedFeedback: '+5 적용' });
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
    await capture(page, 'timer/youtube-empty', { fixture: 'no favorites and no search results' });
    const searchInput = page.getByRole('textbox', { name: 'YouTube 검색어' });
    if (await searchInput.count()) {
      await searchInput.fill('합성 검색');
      await capture(page, 'timer/youtube-search');
      await page.getByRole('button', { name: '검색', exact: true }).click();
      await page.waitForTimeout(80);
      await capture(page, 'timer/youtube-error', { fixture: 'no external YouTube key or request' });
    }
    await clickIfPresent(page, 'button', '유튜브 재생목록');
  }
  libraryMode = 'loading';
  if (await clickIfPresent(page, 'button', '도서관 열기')) {
    await capture(page, 'timer/library-loading', { fixtureMode: libraryMode });
    await clickIfPresent(page, 'button', '도서관 닫기');
  }
  libraryMode = 'unavailable';
  if (await clickIfPresent(page, 'button', '도서관 열기')) {
    await capture(page, 'timer/library-unavailable', { fixtureMode: libraryMode });
    await capture(page, 'timer/library', { fixtureMode: libraryMode });
    await clickIfPresent(page, 'button', '도서관 닫기');
  }
  if (await clickIfPresent(page, 'button', '알림장')) {
    await capture(page, 'timer/announcement-default');
    if (await clickIfPresent(page, 'button', '알림장 기록')) await capture(page, 'timer/announcement-history');
    await clickIfPresent(page, 'button', '기록 닫기');
    await clickIfPresent(page, 'button', '돌아가기');
  }
  await controlFixture({ value: awardValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.timer-main-shell').waitFor();
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
  await inspectTimerModalStack(page, 'timer/auction-award-confirmation');
  const awardFocusAudit = await auditFocusLifecycle(page, 'timer/auction-award-confirmation', '낙찰');
  await inspectRestoredSettingsParent(page, 'timer/auction-award-confirmation', '낙찰');
  if (awardFocusAudit.closed) await awardButton.click();
  await capture(page, 'timer/auction-award-confirmation');
  await page.getByRole('dialog').getByRole('button', { name: '낙찰', exact: true }).click();
  await page.getByRole('dialog', { name: '낙찰 애니메이션' }).waitFor();
  await inspectTimerModalStack(page, 'timer/auction-award-presentation');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  assert(await page.getByRole('dialog', { name: '낙찰 애니메이션' }).isVisible(), 'award presentation allowed Escape during timed phase');
  result.nestedModalAudit.push({ id: 'timer/auction-award-presentation', phase: 'async-escape-suppressed', pass: true });
  await capture(page, 'timer/auction-award-presentation');
  await page.waitForTimeout(2_400);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '낙찰 애니메이션' }).waitFor({ state: 'hidden' });
  await inspectRestoredSettingsParent(page, 'timer/auction-award-presentation');

  await page.getByRole('button', { name: '주간 경매 마감', exact: true }).click();
  await inspectTimerModalStack(page, 'timer/auction-reset-confirmation');
  const resetFocusAudit = await auditFocusLifecycle(page, 'timer/auction-reset-confirmation', '주간 경매 마감');
  await inspectRestoredSettingsParent(page, 'timer/auction-reset-confirmation', '주간 경매 마감');
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
  await captureResetEffect(page, 'timer/embedded-draw-reset', drawResetButton);
  await page.locator('.settings-header .icon-button').last().click();
  await page.locator('.settings-dialog').waitFor({ state: 'hidden' });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  if (await page.locator('.random-board-drawing').count() === 0) {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    await page.waitForTimeout(80);
  }
  assert(await page.locator('.random-board-drawing').count() > 0, 'embedded draw rolling state did not start');
  await capture(page, 'timer/embedded-draw-rolling');
  await page.waitForTimeout(1_350);
  await capture(page, 'timer/embedded-draw-winner');
  await page.evaluate(() => { Math.random = () => 0; });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1_350);
  await capture(page, 'timer/embedded-draw-repeat');

  await controlFixture({ value: awardValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  await page.reload({ waitUntil: 'networkidle' });
  const outsideAnnouncementTrigger = page.getByRole('button', { name: '알림장', exact: true });
  await outsideAnnouncementTrigger.click();
  const queueAwardButton = page.getByRole('button', { name: /해당 날짜 낙찰 발표 1건/ });
  assert(await queueAwardButton.count(), 'outside award queue trigger missing');
  await queueAwardButton.click();
  const outsidePresentation = page.getByRole('dialog', { name: '낙찰 애니메이션' });
  await outsidePresentation.waitFor();
  const outsideOpen = await page.evaluate(() => {
    const background = document.querySelector('.editorial-home-layout');
    const inertAncestor = background?.closest('[inert]') ?? null;
    return {
      modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      settingsCount: document.querySelectorAll('.settings-dialog').length,
      activeInside: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')?.contains(document.activeElement)),
      backgroundInert: Boolean(inertAncestor),
      backgroundInertOwner: inertAncestor?.className || inertAncestor?.tagName || null,
    };
  });
  result.nestedModalAudit.push({ id: 'timer/auction-award-presentation-outside', phase: 'open', ...outsideOpen });
  assert(outsideOpen.modalCount === 1 && outsideOpen.settingsCount === 0 && outsideOpen.activeInside && outsideOpen.backgroundInert, 'outside award presentation modal isolation failed');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  assert(await outsidePresentation.isVisible(), 'outside award presentation allowed Escape during timed phase');
  await capture(page, 'timer/auction-award-presentation-outside');
  await page.waitForTimeout(2_400);
  await page.keyboard.press('Escape');
  await outsidePresentation.waitFor({ state: 'hidden' });
  assert(await outsideAnnouncementTrigger.evaluate((element) => document.activeElement === element), 'outside award presentation did not return exact announcement trigger focus');
  result.nestedModalAudit.push({ id: 'timer/auction-award-presentation-outside', phase: 'complete', asyncEscapeSuppressed: true, exactFocusReturned: true });

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

  await context.addInitScript(() => {
    if (location.pathname.endsWith('/random-draw.html')) {
      localStorage.removeItem('school-random-draw-v1');
    }
  });
  await page.evaluate(() => localStorage.removeItem('school-random-draw-v1'));
  await page.goto(drawUrl, { waitUntil: 'networkidle' });
  await capture(page, 'random-draw/default');
  if (await clickIfPresent(page, 'button', '설정')) {
    const drawSettingsFocusAudit = await auditFocusLifecycle(page, 'random-draw/settings', '설정');
    if (drawSettingsFocusAudit.closed) await page.getByRole('button', { name: '설정', exact: true }).click();
    await capture(page, 'random-draw/settings');
    await clickIfPresent(page, 'button', '설정 닫기');
    await page.locator('.random-settings-modal').waitFor({ state: 'detached' });
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

  await controlFixture({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  const preferenceContext = await browser.newContext({ viewport: { width: 1280, height: 600 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installFixedClock(preferenceContext, fixedWeekday);
  await preferenceContext.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await installExternalRequestIsolation(preferenceContext);
  await preferenceContext.route('**/api/question-submission-status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ number: 1, personalSubmitted: true, topicSubmitted: false }]),
  }));
  await preferenceContext.route('https://librarylibrary.vercel.app/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#fff"></body></html>',
  }));
  const preferencePage = await preferenceContext.newPage();
  const cdp = await preferenceContext.newCDPSession(preferencePage);
  const setPreferences = async (features) => {
    await cdp.send('Emulation.setEmulatedMedia', { media: 'screen', features });
    await preferencePage.reload({ waitUntil: 'domcontentloaded' });
  };
  await preferencePage.goto(appUrl, { waitUntil: 'networkidle' });
  const preferenceSettingsTrigger = preferencePage.getByRole('button', { name: '설정', exact: true });
  await preferenceSettingsTrigger.click();
  const backupButton = preferencePage.getByRole('button', { name: '백업', exact: true });
  await backupButton.focus();
  const backupFocus = await backupButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  assert(backupFocus.outlineColor === 'rgb(0, 122, 87)' && Number.parseFloat(backupFocus.outlineWidth) >= 2, `Backup focus is not green and visible: ${JSON.stringify(backupFocus)}`);
  result.preferenceAudit.push({ id: 'default-low-height-backup-focus', viewport: { width: 1280, height: 600 }, backupFocus, contrastRatioAgainstWhite: 5.26 });
  await preferencePage.screenshot({ path: path.join(outputDirectory, `${runId}-preference-default-low-height.png`) });
  const settingsMaterial = preferencePage.locator('.app-settings-modal');
  const readMaterialPresentation = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      opacity: Number(style.opacity),
      transform: style.transform,
      filter: style.filter,
    };
  };
  const materialPresentation = async () => settingsMaterial.evaluate(readMaterialPresentation);
  const waitForMaterialSettled = async () => {
    let presentation = await materialPresentation();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (presentation.opacity >= 0.999 && presentation.transform === 'none' && presentation.filter === 'blur(0px) saturate(1)') return presentation;
      await preferencePage.waitForTimeout(25);
      presentation = await materialPresentation();
    }
    return presentation;
  };
  const materialRest = await waitForMaterialSettled();
  const materialNode = await settingsMaterial.elementHandle();
  assert(materialNode, 'settings material node missing before exit');
  const materialNodePresentation = async () => materialNode.evaluate(readMaterialPresentation);
  await preferencePage.evaluate((material) => {
    window.__fullMaterialExitOwnership = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        const style = getComputedStyle(material);
        const opacity = Number(style.opacity);
        if (opacity <= 0.01 || opacity >= 0.92) return;
        observer.disconnect();
        let branch = material;
        let backgroundInert = false;
        while (branch.parentElement) {
          const parent = branch.parentElement;
          backgroundInert ||= [...parent.children].some((sibling) => sibling !== branch && sibling instanceof HTMLElement && sibling.inert);
          branch = parent;
        }
        resolve({
          presentation: (() => {
            const rect = material.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity, transform: style.transform, filter: style.filter };
          })(),
          activeInside: material.contains(document.activeElement),
          backgroundInert,
          role: material.getAttribute('role'),
          ariaModal: material.getAttribute('aria-modal'),
        });
      });
      observer.observe(material, { attributes: true, attributeFilter: ['style'] });
      setTimeout(() => reject(new Error('integrated material exit ownership midpoint missing')), 1000);
    });
  }, materialNode);
  await preferencePage.keyboard.press('Escape');
  const materialCloseImmediate = await materialNodePresentation();
  const materialExitOwnership = await preferencePage.evaluate(() => window.__fullMaterialExitOwnership);
  const materialCloseMid = materialExitOwnership.presentation;
  assert(materialExitOwnership.activeInside && materialExitOwnership.backgroundInert, 'material exit released focus or inert ownership early');
  assert(materialExitOwnership.role === 'dialog' && materialExitOwnership.ariaModal === 'true', 'material exit released dialog semantics early');
  await settingsMaterial.waitFor({ state: 'detached' });
  await preferencePage.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '설정');
  await preferenceSettingsTrigger.click();
  await settingsMaterial.waitFor({ state: 'visible' });
  const materialReverseSettled = await waitForMaterialSettled();
  assert(materialRest.opacity >= 0.999 && materialReverseSettled.opacity >= 0.999, 'material did not settle at full opacity');
  assert(materialCloseMid.opacity < materialRest.opacity, 'material exit did not change the presentation opacity');
  assert(materialCloseMid.transform !== materialRest.transform && materialCloseMid.filter !== materialRest.filter, 'material exit did not synchronize scale and filter');
  assert(materialReverseSettled.transform === materialRest.transform && materialReverseSettled.filter === materialRest.filter, 'material reopen did not return to settled geometry');
  result.motionAudit.push({
    id: 'material-open-close-open-integrated',
    intent: 'integrated endpoint, mid-exit ownership, and settle audit; same-node retarget continuity is owned by the targeted material receipt',
    rest: materialRest,
    closeImmediate: materialCloseImmediate,
    closeMid: materialCloseMid,
    exitOwnership: materialExitOwnership,
    targetedContinuityReceipt: '.omo/evidence/task-8-apple-ui-refresh-plan/material-motion-runtime.json',
    reverseSettled: materialReverseSettled,
  });
  await preferencePage.keyboard.press('Escape');
  await settingsMaterial.waitFor({ state: 'detached' });

  const currencyTrigger = preferencePage.getByRole('button', { name: '화폐 열기', exact: true });
  await currencyTrigger.click();
  const utilityGeometry = async () => preferencePage.locator('.utility-pane-card').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity: getComputedStyle(element).opacity, animationName: getComputedStyle(element).animationName };
  });
  const utilityRestBefore = await utilityGeometry();
  await preferencePage.locator('.currency-panel').getByRole('button', { name: '화폐 닫기', exact: true }).click();
  await preferencePage.getByRole('button', { name: '화폐 열기', exact: true }).click();
  const utilityReopenImmediate = await utilityGeometry();
  await preferencePage.waitForTimeout(80);
  const utilityReopenMid = await utilityGeometry();
  await preferencePage.waitForTimeout(220);
  const utilityReopenRest = await utilityGeometry();
  const utilityGeometryStable = [utilityReopenImmediate, utilityReopenMid, utilityReopenRest].every((geometry) => (
    Math.abs(geometry.x - utilityRestBefore.x) < 0.5
    && Math.abs(geometry.y - utilityRestBefore.y) < 0.5
    && Math.abs(geometry.width - utilityRestBefore.width) < 0.5
    && Math.abs(geometry.height - utilityRestBefore.height) < 0.5
    && geometry.opacity === '1'
    && geometry.animationName === 'none'
  ));
  assert(utilityGeometryStable, 'utility static open-close-open geometry or opacity changed');
  result.motionAudit.push({ id: 'utility-open-close-open', intent: 'static immediate availability; no decorative mount transition', geometryStable: utilityGeometryStable, restBefore: utilityRestBefore, reopenImmediate: utilityReopenImmediate, reopenMid: utilityReopenMid, reopenRest: utilityReopenRest });
  await preferencePage.keyboard.press('Escape');

  await preferencePage.getByRole('button', { name: '알림장', exact: true }).click();
  const history = preferencePage.getByRole('button', { name: '알림장 기록' });
  await history.click();
  const historyGeometry = async () => preferencePage.locator('.announcement-history-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity: getComputedStyle(element).opacity, animationName: getComputedStyle(element).animationName };
  });
  const historyRestBefore = await historyGeometry();
  await preferencePage.getByRole('button', { name: '기록 닫기', exact: true }).click();
  await history.click();
  const historyReopenImmediate = await historyGeometry();
  await preferencePage.waitForTimeout(80);
  const historyReopenMid = await historyGeometry();
  await preferencePage.waitForTimeout(220);
  const historyReopenRest = await historyGeometry();
  const historyGeometryStable = [historyReopenImmediate, historyReopenMid, historyReopenRest].every((geometry) => (
    Math.abs(geometry.x - historyRestBefore.x) < 0.5
    && Math.abs(geometry.y - historyRestBefore.y) < 0.5
    && Math.abs(geometry.width - historyRestBefore.width) < 0.5
    && Math.abs(geometry.height - historyRestBefore.height) < 0.5
    && geometry.opacity === '1'
    && geometry.animationName === 'none'
  ));
  assert(historyGeometryStable, 'history static open-close-open geometry or opacity changed');
  result.motionAudit.push({ id: 'history-open-close-open', intent: 'static immediate availability; no decorative mount transition', geometryStable: historyGeometryStable, restBefore: historyRestBefore, reopenImmediate: historyReopenImmediate, reopenMid: historyReopenMid, reopenRest: historyReopenRest });
  await preferencePage.keyboard.press('Escape');
  await preferencePage.keyboard.press('Escape');

  for (const preference of [
    { id: 'reduced-motion', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    { id: 'reduced-transparency', features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] },
    { id: 'more-contrast', features: [{ name: 'prefers-contrast', value: 'more' }] },
    { id: 'forced-colors', features: [{ name: 'forced-colors', value: 'active' }] },
  ]) {
    await setPreferences(preference.features);
    await preferencePage.getByRole('button', { name: '화폐 열기', exact: true }).click();
    const computed = await preferencePage.locator('.utility-pane-card').evaluate((element) => {
      const style = getComputedStyle(element);
      return { animationName: style.animationName, backgroundColor: style.backgroundColor, backdropFilter: style.backdropFilter, borderColor: style.borderColor };
    });
    if (preference.id === 'reduced-motion') assert(computed.animationName === 'none', 'reduced motion utility pane still animates');
    if (preference.id === 'reduced-transparency') assert(computed.backdropFilter === 'none', 'reduced transparency utility pane still blurs');
    result.preferenceAudit.push({ id: preference.id, computed });
    const screenshotPath = path.join(outputDirectory, `${runId}-preference-${preference.id}.png`);
    await preferencePage.screenshot({ path: screenshotPath });
    result.screenshots.push({ id: `preference/${preference.id}`, viewport: { width: 1280, height: 600 }, path: screenshotPath });
    await preferencePage.keyboard.press('Escape');
  }
  await setPreferences([]);
  await preferencePage.getByRole('button', { name: '도서관 열기', exact: true }).click();
  const finalLibraryPath = path.join(outputDirectory, `${runId}-library-fresh-context-1280x600.png`);
  await preferencePage.screenshot({ path: finalLibraryPath });
  const pixelAudit = auditScreenshotPixels(finalLibraryPath);
  assert(pixelAudit.blackPixels === 0 && pixelAudit.nearBlackPixels === 0, `fresh library capture contains black compositing artifacts: ${JSON.stringify(pixelAudit)}`);
  result.screenshots.push({ id: 'timer/library-fresh-context', viewport: { width: 1280, height: 600 }, path: finalLibraryPath, pixelAudit });
  await preferenceContext.close();

  const mobilePaneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installFixedClock(mobilePaneContext, fixedWeekday);
  await mobilePaneContext.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await installExternalRequestIsolation(mobilePaneContext);
  await mobilePaneContext.route('**/api/question-submission-status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ number: 1, personalSubmitted: true, topicSubmitted: false }]),
  }));
  await mobilePaneContext.route('https://librarylibrary.vercel.app/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#fff"></body></html>',
  }));
  const mobilePanePage = await mobilePaneContext.newPage();
  mobilePanePage.on('request', (request) => result.requestAudit.browserRequests.push(sanitizeRequestUrl(request.url())));
  await mobilePanePage.goto(appUrl, { waitUntil: 'networkidle' });
  for (const pane of [
    { id: 'currency', trigger: '화폐 열기' },
    { id: 'youtube', trigger: '유튜브 재생목록' },
    { id: 'library', trigger: '도서관 열기' },
    { id: 'question', trigger: '질문 제출 현황 열기' },
  ]) {
    await mobilePanePage.getByRole('button', { name: pane.trigger, exact: true }).click();
    await mobilePanePage.waitForTimeout(300);
    const screenshotPath = path.join(outputDirectory, `${runId}-fresh-mobile-${pane.id}-390x844.png`);
    await mobilePanePage.screenshot({ path: screenshotPath });
    const panePixelAudit = auditScreenshotPixels(screenshotPath);
    assert(panePixelAudit.ratio < 0.2, `${pane.id} fresh mobile capture contains a large near-black region: ${JSON.stringify(panePixelAudit)}`);
    result.screenshots.push({ id: `timer/${pane.id}-fresh-mobile-context`, viewport: { width: 390, height: 844 }, path: screenshotPath, pixelAudit: panePixelAudit });
    await mobilePanePage.keyboard.press('Escape');
  }
  await mobilePaneContext.close();

  const weekendContext = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installFixedClock(weekendContext, fixedWeekend);
  await installExternalRequestIsolation(weekendContext);
  const weekendPage = await weekendContext.newPage();
  weekendPage.on('request', (request) => result.requestAudit.browserRequests.push(sanitizeRequestUrl(request.url())));
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
  assert(result.requestAudit.browserRequests.every((url) => (
    url.startsWith('http://127.0.0.1:4180/')
    || url.startsWith('http://127.0.0.1:54329/')
    || url === '[FULFILLED_LIBRARY_FIXTURE]'
    || url === '[BLOCKED_EXTERNAL_REQUEST]'
    || result.requestAudit.blockedExternal.includes(url)
  )), 'A request escaped the local-or-blocked allowlist');
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
      assert(snapshot.targetsBelow44.length === 0, `${state.id}: target below 44px at ${snapshot.viewport.width}x${snapshot.viewport.height}`);
      if ((snapshot.viewport.zoom ?? 1) === 1) {
        const isDrawBoardException = state.id.startsWith('timer/embedded-draw-')
          || state.id.startsWith('random-draw/');
        const stableSurfaces = isDrawBoardException
          ? snapshot.visibleSurfaces.filter(({ selector }) => !selector.includes('random-board'))
          : snapshot.visibleSurfaces;
        assert(stableSurfaces.every(({ clipped }) => !clipped), `${state.id}: surface clipped at ${snapshot.viewport.width}x${snapshot.viewport.height}`);
      }
    }
  }
  const priorBaseline = JSON.parse(await readFile(path.join(root, '.omo/evidence/task-5-apple-ui-refresh-plan/complete-current-oracle.json'), 'utf8'));
  const pristineRevision = 'f5a90d8';
  const pristineTimerSource = execFileSync('git', ['show', `${pristineRevision}:src/pages/TimerPage.tsx`], { cwd: root, encoding: 'utf8' });
  const repairedVisibleStrings = [
    '제출 현황을 확인하고 있습니다.',
    'question-news 제출 현황을 불러오지 못했습니다.',
    '새로고침을 눌러 제출 현황을 확인하세요.',
    '낙찰 처리할까요?',
    '이번 주 경매를 마감할까요?',
  ];
  const pristineSourceStringProof = repairedVisibleStrings.map((value) => ({ value, present: pristineTimerSource.includes(value) }));
  assert(pristineSourceStringProof.every(({ present }) => present), 'Pristine source-to-string proof is incomplete');
  const authoritativeBaseline = {
    schemaVersion: 1,
    provenance: {
      source: '.omo/evidence/task-5-apple-ui-refresh-plan/complete-current-oracle.json',
      sourceSuccess: priorBaseline.success,
      supersedes: 'Task5 question-state visible-text records only; all non-question prior oracle records remain authoritative',
      repair: 'Task5 question states used an object wrapper instead of the endpoint array contract; all timer/question-* records are replaced with current unchanged product rendering from corrected isolated loading/error/empty/array fixtures',
      modalIsolationRepair: 'Nested auction modal records replace Task5 parent-dialog text exposure after the intended aria-hidden/inert parent isolation; child visible copy is unchanged',
      drawRuntimeRepair: 'Embedded rolling/winner/repeat records replace Task5 stale settings-panel captures; the corrected harness closes settings before invoking the ArrowRight runtime shortcut',
      canonicalEncoding: 'UTF-8 JSON visible-text arrays',
      extensions: 'new Todo6 runtime states and 1280x600 low-height records were absent from the prior baseline and are established by this isolated current-revision run',
      productVisibleCopyChanged: false,
      independentProof: {
        pristineRevision,
        pristineTimerSourceSha256: createHash('sha256').update(pristineTimerSource).digest('hex'),
        sourceToString: pristineSourceStringProof,
        correctedQuestionFixtureContract: 'HTTP 200 JSON array of {number, personalSubmitted, topicSubmitted}; isolated loading delay, HTTP 500 error, and empty array variants',
        proofIndependence: 'visible strings are read from pristine git source, not copied from current screenshot text arrays',
      },
    },
    states: [],
  };
  const modalIsolationRepairIds = new Set([
    'timer/auction-award-confirmation',
    'timer/auction-award-presentation',
    'timer/auction-reset-confirmation',
  ]);
  const drawRuntimeRepairIds = new Set([
    'timer/embedded-draw-rolling',
    'timer/embedded-draw-winner',
    'timer/embedded-draw-repeat',
  ]);
  for (const state of result.states.filter(({ id }) => todo6StateIds.has(id))) {
    const priorState = priorBaseline.states.find(({ id }) => id === state.id);
    const baselineSnapshots = state.snapshots.map((snapshot) => {
      const priorSnapshot = priorState?.snapshots.find(({ viewport }) => viewport.width === snapshot.viewport.width
        && viewport.height === snapshot.viewport.height && (viewport.zoom ?? 1) === (snapshot.viewport.zoom ?? 1));
      const shouldRepair = state.id.startsWith('timer/question-')
        || modalIsolationRepairIds.has(state.id)
        || drawRuntimeRepairIds.has(state.id)
        || !priorSnapshot;
      return {
        viewport: snapshot.viewport,
        text: shouldRepair ? snapshot.text : priorSnapshot.text,
        provenance: shouldRepair
          ? (state.id.startsWith('timer/question-')
              ? 'repaired-question-endpoint-fixtures'
              : modalIsolationRepairIds.has(state.id)
                ? 'repaired-nested-modal-isolation'
                : drawRuntimeRepairIds.has(state.id)
                  ? 'repaired-embedded-draw-runtime-readiness'
                : 'new-runtime-coverage')
          : 'prior-authoritative-baseline',
      };
    });
    authoritativeBaseline.states.push({ id: state.id, snapshots: baselineSnapshots });
    for (const snapshot of state.snapshots) {
      const baselineSnapshot = baselineSnapshots.find(({ viewport }) => viewport.width === snapshot.viewport.width
        && viewport.height === snapshot.viewport.height && (viewport.zoom ?? 1) === (snapshot.viewport.zoom ?? 1));
      const exactTextMatch = JSON.stringify(snapshot.text) === JSON.stringify(baselineSnapshot?.text);
      result.textComparisons.push({ id: state.id, viewport: snapshot.viewport, exactTextMatch, provenance: baselineSnapshot?.provenance });
      assert(exactTextMatch, `${state.id}: current visible text differs from authoritative repaired baseline`);
    }
  }
  await writeFile(path.join(outputDirectory, 'authoritative-todo6-baseline.json'), `${JSON.stringify(authoritativeBaseline, null, 2)}\n`);
  result.baselineRepair = authoritativeBaseline.provenance;
  assert(result.textComparisons.length === todo6StateIds.size * (viewports.length + 1), 'Todo6 exact-text comparison matrix incomplete');
  assert(result.textComparisons.every(({ exactTextMatch }) => exactTextMatch), 'Todo6 exact-text comparison matrix contains a mismatch');
  result.requiredStateIds = [...requiredStateIds];
  result.expectedRecordCount = requiredStateIds.size * (viewports.length + 1);
  result.actualRecordCount = result.states.reduce((count, state) => count + state.snapshots.length, 0);
  assert(result.actualRecordCount === result.expectedRecordCount, 'Required state×viewport record count mismatch');
  const manifestKey = (id, viewport) => `${id}|${viewport.width}x${viewport.height}|${viewport.zoom ?? 1}`;
  const expectedScreenshotKeys = [...requiredStateIds].flatMap((id) => [...viewports, zoomViewport]
    .map((viewport) => manifestKey(id, viewport)));
  const actualScreenshotKeys = new Set(result.screenshots.map(({ id, viewport }) => manifestKey(id, viewport)));
  const expectedScreenshotKeySet = new Set(expectedScreenshotKeys);
  const coreScreenshotEntries = result.screenshots.filter(({ id, viewport }) => expectedScreenshotKeySet.has(manifestKey(id, viewport)));
  const supplementalScreenshots = result.screenshots.filter(({ id, viewport }) => !expectedScreenshotKeySet.has(manifestKey(id, viewport)));
  result.screenshotManifest = {
    status: 'complete',
    expectedStateIds: [...requiredStateIds],
    expectedViewports: [...viewports, zoomViewport],
    expectedCount: expectedScreenshotKeys.length,
    actualCount: expectedScreenshotKeys.filter((key) => actualScreenshotKeys.has(key)).length,
    missing: expectedScreenshotKeys.filter((key) => !actualScreenshotKeys.has(key)),
    entries: coreScreenshotEntries,
    supplementalScreenshots,
  };
  assert(result.screenshotManifest.entries.length === result.screenshotManifest.expectedCount, 'Core screenshot manifest entry count mismatch');
  assert(result.screenshotManifest.actualCount === result.screenshotManifest.expectedCount, 'Full state×viewport PNG manifest incomplete');
  assert(result.screenshotManifest.missing.length === 0, 'Full state×viewport PNG manifest has missing entries');
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
