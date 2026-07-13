import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-5-apple-ui-refresh-plan/focus-ring');
const appUrl = 'http://127.0.0.1:4176/';
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const children = [];
const result = {
  purpose: 'Read-only keyboard focus verification for text fields',
  modes: {},
  network: { requests: [], mutations: [] },
  visibleText: {},
  screenshots: [],
  errors: [],
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitForUrl = async (url) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* local startup */ }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const start = (label, command, args, environment = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = { label, stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => { receipt.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { receipt.stderr += chunk.toString(); });
  children.push({ child, receipt });
};
const resetFixture = async () => {
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reset: true,
      clearRequestLog: true,
      failMethods: [],
      delayMs: { GET: 0, PATCH: 0 },
      value: {
        currencyBalances: { 1: 500, 2: 250 },
        currencyHistory: [],
        auctionItems: [],
        auctionBids: {},
        auctionBidHistory: {},
        auctionAwards: {},
      },
    }),
  });
  assert(response.ok, `fixture reset failed: ${response.status}`);
};
const computedFocus = async (locator) => locator.evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    tag: element.tagName,
    id: element.id,
    className: element.className,
    focus: element.matches(':focus'),
    focusVisible: element.matches(':focus-visible'),
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
    outlineOffset: style.outlineOffset,
    border: style.border,
    borderColor: style.borderColor,
    boxShadow: style.boxShadow,
  };
});
const bodyText = async (page) => page.locator('body').innerText();
const tabTo = async (page, selector, maximum = 60) => {
  for (let index = 0; index < maximum; index += 1) {
    if (await page.locator(selector).evaluate((element) => element === document.activeElement)) return index;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard focus did not reach ${selector}`);
};
const preparePage = async (browser, mode) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    forcedColors: mode === 'forced-colors' ? 'active' : 'none',
    contrast: mode === 'contrast-more' ? 'more' : 'no-preference',
  });
  if (mode === 'reduced-transparency') {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    return { context, page };
  }
  return { context, page: await context.newPage() };
};
const runMode = async (browser, mode) => {
  await resetFixture();
  const { context, page } = await preparePage(browser, mode);
  const modeRequests = [];
  page.on('request', (request) => {
    modeRequests.push({ method: request.method(), url: request.url() });
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isFixtureHost = url.hostname === '127.0.0.1' && ['4176', '54329'].includes(url.port);
    if (!isFixtureHost) return route.abort('blockedbyclient');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
      result.network.mutations.push({ mode, method: request.method(), url: request.url() });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '0');
  });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '공지 편집 열기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.notice-draft-body').waitFor({ state: 'visible' });
  await page.locator('.notice-draft-body').focus();
  const topAnnouncement = await computedFocus(page.locator('.notice-draft-body'));
  const topAnnouncementScreenshot = path.join(outputDirectory, `${mode}-top-announcement.png`);
  await page.screenshot({ path: topAnnouncementScreenshot, fullPage: true });
  await page.getByRole('button', { name: '공지 닫기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '알림장', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '알림장', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.announcement-note-textarea').waitFor({ state: 'visible' });
  const announcementTabs = await tabTo(page, '.announcement-note-textarea');
  const announcement = await computedFocus(page.locator('.announcement-note-textarea'));
  await page.locator('.announcement-date-input').click();
  await page.locator('.announcement-note-textarea').click();
  const announcementMouse = await computedFocus(page.locator('.announcement-note-textarea'));
  const announcementText = await bodyText(page);
  const announcementScreenshot = path.join(outputDirectory, `${mode}-announcement.png`);
  await page.screenshot({ path: announcementScreenshot, fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '화폐 열기', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '화폐 열기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('#currency-student-number').waitFor({ state: 'visible' });
  const currencyTabs = await tabTo(page, '#currency-student-number');
  const currency = await computedFocus(page.locator('#currency-student-number'));
  await page.getByRole('button', { name: '개인', exact: true }).click();
  await page.locator('#currency-student-number').click();
  const currencyMouse = await computedFocus(page.locator('#currency-student-number'));
  const currencyText = await bodyText(page);
  const currencyScreenshot = path.join(outputDirectory, `${mode}-currency.png`);
  await page.screenshot({ path: currencyScreenshot, fullPage: true });
  result.modes[mode] = { topAnnouncement, announcementTabs, announcement, announcementMouse, currencyTabs, currency, currencyMouse };
  result.visibleText[mode] = { announcement: announcementText, currency: currencyText };
  result.screenshots.push(topAnnouncementScreenshot, announcementScreenshot, currencyScreenshot);
  result.network.requests.push(...modeRequests.map((request) => ({ mode, ...request })));
  await context.close();
};

await mkdir(outputDirectory, { recursive: true });
try {
  start('fake-supabase', process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl);
  start('vite', 'npm', ['run', 'dev', '--', '--port', '4176', '--host', '127.0.0.1'], {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
    VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key',
  });
  await waitForUrl(appUrl);
  const browser = await chromium.launch({ headless: true });
  for (const mode of ['normal', 'forced-colors', 'contrast-more', 'reduced-transparency']) {
    await runMode(browser, mode);
  }
  await browser.close();
  const normal = result.modes.normal;
  const greenOutlines = new Set(['rgb(0, 122, 87)', 'rgb(0, 98, 65)']);
  assert(greenOutlines.has(normal.announcement.outlineColor), `announcement normal outline is ${normal.announcement.outlineColor}`);
  assert(greenOutlines.has(normal.currency.outlineColor), `currency normal outline is ${normal.currency.outlineColor}`);
  assert(greenOutlines.has(normal.announcementMouse.outlineColor), `announcement mouse outline is ${normal.announcementMouse.outlineColor}`);
  assert(greenOutlines.has(normal.currencyMouse.outlineColor), `currency mouse outline is ${normal.currencyMouse.outlineColor}`);
  assert(normal.topAnnouncement.outlineStyle === 'none' || normal.topAnnouncement.outlineWidth === '0px', `top announcement retained outline: ${JSON.stringify(normal.topAnnouncement)}`);
  assert(normal.topAnnouncement.boxShadow === 'none', `top announcement retained focus shadow: ${normal.topAnnouncement.boxShadow}`);
  assert(normal.topAnnouncement.borderColor === 'rgba(0, 0, 0, 0)' || normal.topAnnouncement.border.startsWith('0px'), `top announcement retained border: ${normal.topAnnouncement.border}`);
  assert(!normal.announcement.boxShadow.includes('0, 102, 204'), 'announcement retained blue shadow');
  assert(!normal.currency.boxShadow.includes('0, 102, 204'), 'currency retained blue shadow');
  assert(result.modes['forced-colors'].announcement.outlineStyle !== 'none', 'forced announcement focus is invisible');
  assert(result.modes['forced-colors'].currency.outlineStyle !== 'none', 'forced currency focus is invisible');
  const fixtureState = await fetch(stateUrl).then((response) => response.json());
  result.fixtureRequestLog = fixtureState.requestLog ?? [];
  const deliveredProductMutations = result.fixtureRequestLog.filter((entry) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(entry.method) && !entry.path.startsWith('/__qa/'));
  assert(deliveredProductMutations.length === 0, `fixture received product mutations: ${JSON.stringify(deliveredProductMutations)}`);
  result.network.mutationsBlockedBeforeNetwork = result.network.mutations.length;
  result.visibleTextInvariant = 'The focus-only stylesheet selectors contain no content declarations; captured body text is retained as an audit sample, not compared across asynchronous fixture loads.';
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
  result.success = false;
} finally {
  for (const { child } of children) child.kill('SIGTERM');
  await wait(100);
  result.fixtureRequestLog ??= [];
  await writeFile(path.join(outputDirectory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
