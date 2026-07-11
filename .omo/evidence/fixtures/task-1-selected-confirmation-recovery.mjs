import { createRequire } from 'node:module';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const evidenceDir = new URL('../task-1-apple-ui-refresh-plan/', import.meta.url);
const screenshotDir = new URL('../task-1-apple-ui-refresh-plan/recovery-screenshots/', import.meta.url);
const appUrl = 'http://127.0.0.1:4175/';
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const fixedMonday = '2026-07-06T10:00:00.000Z';
const baseValue = {
  currencyBalances: { '1': 500, '2': 250 },
  auctionItems: [
    { id: 'item-a', name: '월요일 연필', startPrice: 10, dayIndex: 0 },
    { id: 'item-b', name: '화요일 지우개', startPrice: 20, dayIndex: 1 },
  ],
  auctionBids: {}, auctionBidHistory: {}, auctionAwards: {},
  auctionMissions: [{ id: 'qa-mission', content: '합성 미션', rewardAmount: 15 }],
};
const results = {
  schemaVersion: 1,
  purpose: 'Todo 1 recovery: selected and confirmation states only',
  startedAt: new Date().toISOString(),
  cases: [],
  adversarial: {},
  requestAudit: {},
  console: [],
  errors: [],
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const control = async (body) => {
  const response = await fetch(controlUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`fixture control ${response.status}`);
  return response.json();
};
const fixtureState = async () => (await fetch(stateUrl)).json();
const withDeadline = async (work, timeoutMs) => {
  let timeout;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`scenario exceeded ${timeoutMs}ms deadline`)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

await mkdir(evidenceDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });
let browser;
let context;
try {
  await withDeadline(async () => {
    await control({ reset: true, value: baseValue, clearRequestLog: true });
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    const observedRequests = [];
    page.on('request', (request) => observedRequests.push({ method: request.method(), url: request.url() }));
    page.on('console', (message) => results.console.push({ level: message.type(), text: message.text() }));
    await page.clock.setFixedTime(new Date(fixedMonday));
    await page.addInitScript((iso) => {
      const NativeDate = Date;
      const fixed = new NativeDate(iso).valueOf();
      class FixedDate extends NativeDate {
        constructor(...args) { super(...(args.length === 0 ? [fixed] : args)); }
        static now() { return fixed; }
      }
      Object.setPrototypeOf(FixedDate, NativeDate);
      window.Date = FixedDate;
    }, fixedMonday);
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    const item = page.locator('button.auction-item-card').filter({ hasText: '연필' });
    await item.waitFor();
    assert(await item.count() === 1, 'synthetic Monday item was not uniquely rendered');
    await item.click();
    await page.getByRole('button', { name: '입찰' }).waitFor();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const filename = `auction-selected-recovery-${viewport.width}x${viewport.height}.png`;
      const path = fileURLToPath(new URL(filename, screenshotDir));
      await page.screenshot({ path, fullPage: false });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert(!overflow, `selected has horizontal overflow at ${viewport.width}`);
      results.cases.push({ id: 'auction-selected', viewport, screenshot: `recovery-screenshots/${filename}`, visible: await page.getByText('연필').count() > 0, overflow });
    }
    const writesBefore = (await fixtureState()).requestLog.filter(({ method }) => method === 'PATCH' || method === 'POST').length;
    await page.getByRole('button', { name: '입찰' }).click();
    await page.getByRole('dialog').waitFor();
    const writesAtConfirmation = (await fixtureState()).requestLog.filter(({ method }) => method === 'PATCH' || method === 'POST').length;
    assert(writesAtConfirmation === writesBefore, 'bid write occurred before confirmation');
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const filename = `auction-confirmation-recovery-${viewport.width}x${viewport.height}.png`;
      const path = fileURLToPath(new URL(filename, screenshotDir));
      await page.screenshot({ path, fullPage: false });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert(!overflow, `confirmation has horizontal overflow at ${viewport.width}`);
      results.cases.push({ id: 'auction-confirmation', viewport, screenshot: `recovery-screenshots/${filename}`, dialog: await page.getByRole('dialog').count() === 1, overflow });
    }
    const outputs = await Promise.all(results.cases.map(async ({ screenshot }) => ({ screenshot, bytes: (await stat(fileURLToPath(new URL(`../task-1-apple-ui-refresh-plan/${screenshot}`, import.meta.url)))).size })));
    assert(outputs.every(({ bytes }) => bytes > 0), 'a success signal had an empty screenshot artifact');
    const supabaseRequests = observedRequests.filter(({ url }) => url.includes('/rest/v1/'));
    assert(supabaseRequests.length > 0, 'no Supabase REST request was observed');
    assert(supabaseRequests.every(({ url }) => url.startsWith('http://127.0.0.1:54329/')), 'a Supabase REST request escaped the local fixture');
    results.adversarial = {
      stale_state: { verdict: 'PASS', evidence: 'new browser context plus fixture reset before state setup' },
      hung_commands: { verdict: 'PASS', evidence: 'entire scenario completed within a 15000ms deadline' },
      flaky_tests: { verdict: 'PASS', evidence: `clock fixed at ${fixedMonday}; no retry used` },
      misleading_success_output: { verdict: 'PASS', evidence: 'four PNG outputs were stat-checked and DOM/write assertions passed before success' },
    };
    results.requestAudit = {
      observedSupabaseRequests: supabaseRequests,
      fixtureHosts: [...new Set((await fixtureState()).requestLog.map(({ host }) => host))],
      allSupabaseRequestsLocal: true,
      writesBefore,
      writesAtConfirmation,
      outputs,
    };
  }, 15000);
} catch (error) {
  results.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await context?.close();
  await browser?.close();
  results.completedAt = new Date().toISOString();
  await writeFile(new URL('selected-confirmation-recovery-results.json', evidenceDir), `${JSON.stringify(results, null, 2)}\n`);
}
if (results.errors.length > 0) process.exitCode = 1;
