import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-4-apple-ui-refresh-plan');
const screenshotDirectory = path.join(outputDirectory, 'screenshots');
const appUrl = 'http://127.0.0.1:4175/';
const controlUrl = 'http://127.0.0.1:54329/__qa/control';
const stateUrl = 'http://127.0.0.1:54329/__qa/state';
const weekday = '2026-07-06T10:00:00.000Z';
const weekend = '2026-07-11T10:00:00.000Z';
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
const result = {
  purpose: 'Todo 4 deterministic auction interaction, motion, request, and visual QA',
  statusLifecycle: {},
  submittingLock: {},
  motion: {},
  polling: {},
  requests: {},
  screenshots: [],
  console: [],
  cleanup: [],
  errors: [],
};
const children = [];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const control = async (body) => {
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(response.ok, `fixture control failed: ${response.status}`);
};
const state = async () => (await (await fetch(stateUrl)).json());
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
const waitForUrl = async (url) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* local startup */ }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const installClock = async (context, iso) => {
  await context.addInitScript((fixedIso) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedIso])); }
      static now() { return new NativeDate(fixedIso).valueOf(); }
    }
    window.Date = FixedDate;
  }, iso);
};
const newAuctionPage = async (browser, viewport = { width: 390, height: 844 }, iso = weekday, reducedMotion = 'no-preference') => {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion });
  await installClock(context, iso);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') result.console.push(message.text());
  });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '1'));
  await page.reload({ waitUntil: 'networkidle' });
  return { context, page };
};
const screenshot = async (page, name) => {
  await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`), fullPage: true });
  result.screenshots.push(name);
};
const readMaterialPresentation = (element) => {
  const style = getComputedStyle(element);
  return {
    connected: element.isConnected,
    opacity: Number(style.opacity),
    transform: style.transform,
    filter: style.filter,
  };
};
const openConfirmation = async (page) => {
  const item = page.locator('button.auction-item-card').first();
  await item.click();
  const trigger = page.getByRole('button', { name: '입찰', exact: true });
  await trigger.click();
  await page.getByRole('dialog').waitFor();
  return trigger;
};
const statusLifecycle = async (browser, id, mutateBeforeConfirm) => {
  await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0, PATCH: 0 }, clearRequestLog: true });
  const { context, page } = await newAuctionPage(browser);
  const trigger = await openConfirmation(page);
  if (mutateBeforeConfirm) await mutateBeforeConfirm();
  await page.getByRole('dialog').getByRole('button', { name: '입찰하기', exact: true }).click();
  const statusDialog = page.locator('.auction-status-dialog');
  await statusDialog.waitFor();
  await page.waitForTimeout(320);
  const initial = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  const backgroundInert = await page.locator('main').evaluate((element) => element.inert);
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  await page.keyboard.press('Shift+Tab');
  const afterShiftTab = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  await screenshot(page, id);
  await page.keyboard.press('Escape');
  await statusDialog.waitFor({ state: 'detached' });
  const closed = await statusDialog.count() === 0;
  const triggerState = await trigger.evaluate((element) => ({ connected: element.isConnected, disabled: element.disabled }));
  const expectedReturnId = triggerState.disabled ? 'auction-bid-amount-input' : 'auction-bid-trigger';
  await page.waitForFunction((id) => document.activeElement?.id === id, expectedReturnId, { timeout: 500 });
  const returnedToIntendedParent = await page.evaluate((id) => document.activeElement?.id === id, expectedReturnId);
  const returnedActive = await page.evaluate(() => ({
    text: document.activeElement?.textContent?.trim() ?? '',
    tag: document.activeElement?.tagName ?? '',
  }));
  result.statusLifecycle[id] = { initial, afterTab, afterShiftTab, backgroundInert, closed, expectedReturnId, returnedToIntendedParent, returnedActive, triggerState };
  assert(initial === '확인' && afterTab === '확인' && afterShiftTab === '확인', `${id}: focus containment failed`);
  assert(backgroundInert && closed && returnedToIntendedParent, `${id}: lifecycle/return failed`);
  await context.close();
};

await mkdir(screenshotDirectory, { recursive: true });
let browser;
try {
  start('fake-supabase', process.execPath, ['.omo/evidence/fixtures/fake-supabase.mjs']);
  await waitForUrl(stateUrl);
  start('vite', 'npm', ['run', 'dev', '--', '--port', '4175', '--host', '127.0.0.1'], {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
    VITE_SUPABASE_ANON_KEY: 'qa-only-fake-key',
  });
  await waitForUrl(appUrl);
  browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 1200 }, clearRequestLog: true });
    const loading = await newAuctionPage(browser, viewport);
    await screenshot(loading.page, `loading-${viewport.width}x${viewport.height}`);
    await loading.context.close();

    await control({ reset: true, value: baseValue, failMethods: ['GET'], delayMs: { GET: 0 }, clearRequestLog: true });
    const error = await newAuctionPage(browser, viewport);
    await error.page.getByText('경매 정보를 불러오지 못했습니다.').waitFor();
    await error.page.waitForTimeout(320);
    await screenshot(error.page, `error-${viewport.width}x${viewport.height}`);
    await error.context.close();

    await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
    const empty = await newAuctionPage(browser, viewport, weekend);
    await empty.page.getByText('오늘은 공개된 물품이 없습니다.').waitFor();
    await screenshot(empty.page, `empty-${viewport.width}x${viewport.height}`);
    await empty.context.close();

    const confirmation = await newAuctionPage(browser, viewport);
    await openConfirmation(confirmation.page);
    await confirmation.page.waitForTimeout(320);
    await screenshot(confirmation.page, `confirmation-settled-${viewport.width}x${viewport.height}`);
    await confirmation.context.close();
  }

  await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0, PATCH: 0 }, clearRequestLog: true });
  const continuity = await newAuctionPage(browser);
  const continuityTrigger = await openConfirmation(continuity.page);
  const continuityDialog = continuity.page.locator('.auction-confirm-dialog');
  await continuity.page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.auction-confirm-dialog')).opacity) >= 0.999);
  const continuityNode = await continuityDialog.elementHandle();
  const continuityTriggerNode = await continuityTrigger.elementHandle();
  const continuityCloseNode = await continuity.page.getByRole('button', { name: '다시 확인하기', exact: true }).elementHandle();
  assert(continuityNode && continuityTriggerNode && continuityCloseNode, 'confirmation continuity nodes missing');
  const reversal = await continuity.page.evaluate(([material, opener, closer]) => new Promise((resolve, reject) => {
    const read = (element) => {
      const style = getComputedStyle(element);
      return { connected: element.isConnected, opacity: Number(style.opacity), transform: style.transform, filter: style.filter };
    };
    let closeImmediate;
    const observer = new MutationObserver(() => {
      const closeMid = read(material);
      if (closeMid.opacity <= 0.01 || closeMid.opacity >= 0.92) return;
      observer.disconnect();
      opener.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      queueMicrotask(() => resolve({ closeImmediate, closeMid, reverseImmediate: read(material), sameNode: material.isConnected }));
    });
    observer.observe(material, { attributes: true, attributeFilter: ['style'] });
    closer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    closeImmediate = read(material);
    setTimeout(() => reject(new Error(`confirmation continuity window missing; opacity=${read(material).opacity}`)), 1000);
  }), [continuityNode, continuityTriggerNode, continuityCloseNode]);
  let reverseMid = await continuityNode.evaluate(readMaterialPresentation);
  for (let attempt = 0; attempt < 20 && reverseMid.opacity <= reversal.reverseImmediate.opacity + 0.05; attempt += 1) {
    await continuity.page.waitForTimeout(20);
    reverseMid = await continuityNode.evaluate(readMaterialPresentation);
  }
  result.motion.materialContinuity = { ...reversal, reverseMid, protocol: 'synthetic renderer-local MutationObserver retarget; trusted opener actionability covered by openConfirmation' };
  assert(reversal.sameNode, 'confirmation material node was replaced during reversal');
  assert(Math.abs(reversal.closeMid.opacity - reversal.reverseImmediate.opacity) < 0.02, 'confirmation opacity continuity failed');
  assert(reversal.closeMid.transform === reversal.reverseImmediate.transform, 'confirmation scale continuity failed');
  assert(reversal.closeMid.filter === reversal.reverseImmediate.filter, 'confirmation filter continuity failed');
  assert(reverseMid.opacity > reversal.reverseImmediate.opacity, 'confirmation did not reverse direction');
  await continuity.context.close();

  await statusLifecycle(browser, 'success-390x844');
  await statusLifecycle(browser, 'insufficient-390x844', async () => {
    await control({ value: { ...baseValue, currencyBalances: { 1: 0, 2: 250 } } });
  });
  await statusLifecycle(browser, 'write-error-390x844', async () => {
    await control({ failMethods: ['PATCH'] });
  });

  await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0, PATCH: 1200 }, clearRequestLog: true });
  const submitting = await newAuctionPage(browser);
  await openConfirmation(submitting.page);
  await submitting.page.getByRole('dialog').getByRole('button', { name: '입찰하기', exact: true }).click();
  await submitting.page.getByRole('button', { name: '입찰 처리 중...', exact: true }).waitFor();
  await screenshot(submitting.page, 'submitting-390x844');
  await submitting.page.keyboard.press('Escape');
  const afterEscape = await submitting.page.getByRole('dialog').count();
  await submitting.page.locator('.auction-modal-backdrop').click({ position: { x: 4, y: 4 } });
  const afterBackdrop = await submitting.page.getByRole('dialog').count();
  await submitting.page.getByText('입찰이 완료되었습니다.').waitFor();
  result.submittingLock = { afterEscape, afterBackdrop, completed: true };
  assert(afterEscape === 1 && afterBackdrop === 1, 'submitting dialog dismissed while PATCH in flight');
  await submitting.context.close();

  await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0, PATCH: 0 }, clearRequestLog: true });
  const motion = await newAuctionPage(browser);
  const card = motion.page.locator('button.auction-item-card').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await motion.page.mouse.down();
  await motion.page.evaluate(() => new Promise(requestAnimationFrame));
  const pointerDown = await card.evaluate((element) => ({
    active: element.matches(':active'),
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
  }));
  await motion.page.mouse.up();
  await motion.page.evaluate(() => new Promise(requestAnimationFrame));
  const pointerUp = await card.evaluate((element) => ({
    active: element.matches(':active'),
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
  }));
  await motion.page.mouse.down();
  await motion.page.evaluate(() => new Promise(requestAnimationFrame));
  const repress = await card.evaluate((element) => ({
    active: element.matches(':active'),
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
  }));
  await motion.page.mouse.up();
  await card.click();
  const selectionAfterRepress = await card.getAttribute('aria-pressed');
  result.motion.default = { pointerDown, pointerUp, repress, selectionAfterRepress };
  assert(
    pointerDown.active
      && pointerDown.transform !== pointerUp.transform
      && Number(pointerDown.opacity) < Number(pointerUp.opacity)
      && !pointerUp.active
      && repress.active
      && repress.transform !== pointerUp.transform
      && Number(repress.opacity) < Number(pointerUp.opacity)
      && selectionAfterRepress === 'true',
    'pointer retarget/repress presentation failed',
  );
  await motion.context.close();

  const reduced = await newAuctionPage(browser, { width: 390, height: 844 }, weekday, 'reduce');
  const reducedCard = reduced.page.locator('button.auction-item-card').first();
  await reducedCard.scrollIntoViewIfNeeded();
  await reducedCard.hover();
  await reduced.page.mouse.down();
  await reduced.page.evaluate(() => new Promise(requestAnimationFrame));
  const reducedDown = await reducedCard.evaluate((element) => ({ active: element.matches(':active'), transform: getComputedStyle(element).transform }));
  await reduced.page.mouse.up();
  const reducedUp = await reducedCard.evaluate((element) => ({ active: element.matches(':active'), transform: getComputedStyle(element).transform }));
  result.motion.reduced = { reducedDown, reducedUp };
  assert(reducedDown.active && reducedDown.transform === 'none' && reducedUp.transform === 'none', 'reduced motion transform not removed');
  await reduced.context.close();

  await control({ reset: true, value: baseValue, failMethods: [], delayMs: { GET: 0 }, clearRequestLog: true });
  const polling = await newAuctionPage(browser);
  await polling.page.addInitScript(() => {
    window.__qaIntervalDelays = [];
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = (handler, timeout, ...args) => {
      window.__qaIntervalDelays.push(timeout);
      return nativeSetInterval(handler, timeout, ...args);
    };
  });
  await control({ clearRequestLog: true });
  await polling.page.reload({ waitUntil: 'networkidle' });
  await polling.page.waitForTimeout(6250);
  const pollingState = await state();
  const gets = pollingState.requestLog.filter((request) => request.method === 'GET' && request.path === '/rest/v1/app_settings');
  const intervals = gets.slice(1).map((request, index) => Date.parse(request.at) - Date.parse(gets[index].at));
  const configuredDelays = await polling.page.evaluate(() => window.__qaIntervalDelays);
  result.polling = { count: gets.length, requestArrivalIntervals: intervals, configuredDelays, expectedMs: 3000 };
  assert(gets.length >= 3 && configuredDelays.includes(3000), `poll cadence mismatch: ${configuredDelays}`);
  await polling.context.close();

  const finalState = await state();
  const restRequests = finalState.requestLog.filter((request) => request.path.startsWith('/rest/v1/'));
  result.requests.finalPollingRun = restRequests.map(({ method, host, path }) => ({ method, host, path }));
  result.requests.allLocal = restRequests.every((request) => request.host === '127.0.0.1:54329');
  assert(result.requests.allLocal, 'non-local REST request observed');
  await browser.close();
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? `${error.stack ?? error.message}` : String(error));
  result.success = false;
} finally {
  await browser?.close().catch(() => {});
  for (const { child, receipt } of children.reverse()) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(2000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(2000)]);
    }
    result.cleanup.push({ label: receipt.label, stopped: child.exitCode !== null || child.signalCode !== null, exitCode: child.exitCode, signalCode: child.signalCode, stderr: receipt.stderr });
  }
  await writeFile(path.join(outputDirectory, 'targeted-qa.json'), `${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
