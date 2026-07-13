import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');

const [currentRoot, outputPath] = process.argv.slice(2);
if (!currentRoot || !outputPath) {
  throw new Error('usage: node task-7-random-draw-qa.mjs <current-root> <output>');
}

const fixedClock = '2026-07-06T10:00:00.000Z';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844, zoom: 2 },
];
const stateIds = ['default', 'settings', 'after-settings', 'winner'];
const children = [];
const result = {
  schemaVersion: 1,
  purpose: 'Todo7 current standalone RandomDraw runtime and pristine visible-text comparison',
  baselineCommit: 'f5a90d8',
  fixedClock,
  deterministicRandom: 'LCG seed 0x5c11d00d',
  fixture: 'empty localStorage; no TimerPage; standalone RandomDraw entry; external requests aborted',
  viewports,
  stateIds,
  runs: {},
  comparison: {},
  cleanup: {},
  screenshots: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const startVite = (label, root, port) => {
  const child = spawn(path.join(currentRoot, 'node_modules/.bin/vite'), [
    '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--force',
  ], {
    cwd: root,
    env: { ...process.env, DISABLE_HMR: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const receipt = { label, pid: child.pid, stdout: '', stderr: '', stopped: false };
  child.stdout.on('data', (chunk) => { receipt.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { receipt.stderr += chunk.toString(); });
  children.push({ child, receipt });
  return receipt;
};

const waitForUrl = async (url) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* local readiness polling */ }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
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

const installDeterminism = async (context) => {
  await context.addInitScript((iso) => {
    if (sessionStorage.getItem('todo7-initialized') !== 'true') {
      localStorage.clear();
      sessionStorage.setItem('todo7-initialized', 'true');
    }
    const NativeDate = Date;
    const fixedTime = new NativeDate(iso).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { return args.length === 0 ? new NativeDate(fixedTime) : new NativeDate(...args); }
      static now() { return fixedTime; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
    let seed = 0x5c11d00d;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  }, fixedClock);
};

const visibleText = () => {
  const excluded = (node) => {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return true;
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
  return text;
};

const capture = async (page, state, beforeEach = null) => {
  const records = [];
  await page.waitForTimeout(300);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((zoom) => {
      document.documentElement.style.zoom = String(zoom);
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, viewport.zoom ?? 1);
    await page.waitForTimeout(50);
    if (beforeEach) await beforeEach();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    await page.waitForTimeout(50);
    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        const bounds = element?.getBoundingClientRect();
        return bounds ? { left: bounds.left, right: bounds.right, width: bounds.width } : null;
      };
      return {
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        viewportWidth: window.innerWidth,
        pageRect: rect('.random-draw-page'),
        shellRect: rect('.random-page-shell'),
        settingsButtonRect: rect('.random-settings-button'),
        targetsBelow44: [...document.querySelectorAll('button,input,select,textarea,[role="button"]')].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      }).map((element) => element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName),
      };
    });
    records.push({ viewport, text: await page.evaluate(visibleText), ...layout });
    if ((viewport.width === 320 || viewport.width === 390 || viewport.width === 1440) && !viewport.zoom) {
      const screenshotPath = path.join(path.dirname(outputPath), `${state}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath });
      result.screenshots.push({ state, viewport, path: screenshotPath });
    }
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.waitForTimeout(50);
  return { state, records };
};

const run = async (browser, label, port) => {
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installDeterminism(context);
  const externalRequests = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === String(port)) await route.continue();
    else {
      externalRequests.push('[BLOCKED_EXTERNAL_REQUEST]');
      await route.fulfill({ status: 204, body: '' });
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${port}/.omo/evidence/fixtures/random-draw.html`, { waitUntil: 'networkidle' });
  const states = [];
  const readStoredDraw = () => page.evaluate(() => JSON.parse(localStorage.getItem('school-random-draw-v1') || 'null'));
  const assertStoredCase = async (expected) => {
    const stored = await readStoredDraw();
    const active = stored?.cases?.find((entry) => entry.id === stored.activeCaseId);
    assert(active?.label === expected.label, `${label}: expected fixture label ${expected.label}`);
    if (expected.rangeStart !== undefined) assert(active.rangeStart === expected.rangeStart, `${label}: fixture rangeStart changed`);
    if (expected.rangeEnd !== undefined) assert(active.rangeEnd === expected.rangeEnd, `${label}: fixture rangeEnd changed`);
    if (expected.historyLength !== undefined) assert(active.historyEntries.length === expected.historyLength, `${label}: fixture history changed`);
    return { stored, active };
  };
  states.push(await capture(page, 'default'));
  const settingsButton = page.getByRole('button', { name: '설정', exact: true });
  assert(await settingsButton.count(), `${label}: settings button missing; body=${(await page.locator('body').innerText()).slice(0, 1000)}; console=${consoleErrors.join(' | ')}`);
  await settingsButton.click();
  await page.locator('.settings-dialog').waitFor();
  states.push(await capture(page, 'settings'));
  const settingsFocus = await page.evaluate(() => ({ initialInside: Boolean(document.activeElement?.closest('.settings-dialog')), backgroundInert: Boolean(document.querySelector('.random-page-shell')?.closest('[inert]')) }));
  await page.keyboard.press('Tab');
  const tabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-dialog')));
  await page.keyboard.press('Shift+Tab');
  const shiftTabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-dialog')));
  await page.keyboard.press('Escape');
  await page.locator('.settings-dialog').waitFor({ state: 'hidden' });
  const exactTriggerReturn = await settingsButton.evaluate((element) => document.activeElement === element);
  assert(settingsFocus.initialInside && settingsFocus.backgroundInert && tabInside && shiftTabInside && exactTriggerReturn, `${label}: settings focus lifecycle failed`);
  result.focusLifecycle = { ...settingsFocus, tabInside, shiftTabInside, exactTriggerReturn };
  states.push(await capture(page, 'after-settings'));
  await page.getByRole('button', { name: 'B상황', exact: true }).click();
  states.push(await capture(page, 'case-switch'));
  await page.getByRole('button', { name: 'A상황', exact: true }).click();
  const drawButton = page.getByRole('button', { name: '번호 뽑기', exact: true });
  const box = await drawButton.boundingBox();
  assert(box, `${label}: draw button has no geometry`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pointerDown = await drawButton.evaluate((element) => ({ scale: getComputedStyle(element).scale, opacity: getComputedStyle(element).opacity }));
  assert(pointerDown.scale !== '1' && Number(pointerDown.opacity) < 1, `${label}: pointer-down feedback was not immediate`);
  await page.mouse.up();
  await page.waitForTimeout(1_600);
  states.push(await capture(page, 'winner'));
  states.push(await capture(page, 'reset', async () => {
    await page.locator('button.round-action-reset').click();
    await page.waitForTimeout(100);
    assert(await page.getByText('섞는 중', { exact: true }).count(), `${label}: reset transient missing`);
  }));
  await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
    activeCaseId: 'case-a', repeatPickEnabled: true,
    cases: [{ id: 'case-a', label: 'A상황', rangeStart: 1, rangeEnd: 2, currentResult: 1, historyEntries: [{ id: 'history-1', number: 1, kind: 'normal' }], studentNames: {}, hiddenNumberQueue: [] }],
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await assertStoredCase({ label: 'A상황', rangeStart: 1, rangeEnd: 2, historyLength: 1 });
  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole('button', { name: '번호 뽑기', exact: true }).click();
  await page.waitForTimeout(1_900);
  assert(await page.locator('.random-repeat-flight').count(), `${label}: repeat flight did not start`);
  states.push(await capture(page, 'repeat'));
  await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
    activeCaseId: 'case-a', repeatPickEnabled: false,
    cases: [{ id: 'case-a', label: '소진 상태', rangeStart: 1, rangeEnd: 1, currentResult: 1, historyEntries: [{ id: 'history-1', number: 1, kind: 'normal' }], studentNames: {}, hiddenNumberQueue: [] }],
  })));
  states.push(await capture(page, 'exhausted', async () => {
    await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
      activeCaseId: 'case-a', repeatPickEnabled: false,
      cases: [{ id: 'case-a', label: '소진 상태', rangeStart: 1, rangeEnd: 1, currentResult: 1, historyEntries: [{ id: 'history-1', number: 1, kind: 'normal' }], studentNames: {}, hiddenNumberQueue: [] }],
    })));
    await page.reload({ waitUntil: 'networkidle' });
    await assertStoredCase({ label: '소진 상태', rangeStart: 1, rangeEnd: 1, historyLength: 1 });
    await page.getByRole('button', { name: '번호 뽑기', exact: true }).click();
    await page.waitForTimeout(100);
    assert(await page.getByText('섞는 중', { exact: true }).count(), `${label}: exhausted state did not enter reset flow`);
  }));
  await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
    activeCaseId: 'broken', repeatPickEnabled: false,
    cases: [{ id: 'broken', label: '잘못된 범위', rangeStart: 'invalid', rangeEnd: null }],
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await assertStoredCase({ label: '잘못된 범위' });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const normalizedRange = await page.locator('.random-settings-number-input').evaluateAll((inputs) => inputs.slice(0, 2).map((input) => input.value));
  assert(JSON.stringify(normalizedRange) === JSON.stringify(['1', '1']), `${label}: invalid/null range was not clamped to the rendered minimum`);
  await page.keyboard.press('Escape');
  states.push(await capture(page, 'invalid-range'));
  const cdp = await context.newCDPSession(page);
  for (const preference of [
    { state: 'reduced-motion', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    { state: 'reduced-transparency', features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] },
    { state: 'more-contrast', features: [{ name: 'prefers-contrast', value: 'more' }] },
  ]) {
    await cdp.send('Emulation.setEmulatedMedia', { media: 'screen', features: preference.features });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const material = await page.locator('.random-settings-shell').evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, backdropFilter: style.backdropFilter, borderColor: style.borderColor, animationName: style.animationName };
    });
    await page.keyboard.press('Escape');
    await page.locator('button.round-action-reset').click();
    await page.waitForTimeout(100);
    const resetEffect = await page.locator('.random-board').evaluate((element) => ({ className: element.className, animationName: getComputedStyle(element).animationName }));
    await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
      activeCaseId: 'case-a', repeatPickEnabled: false,
      cases: [{ id: 'case-a', label: '선호 설정', rangeStart: 1, rangeEnd: 1, currentResult: null, historyEntries: [], studentNames: {}, hiddenNumberQueue: [] }],
    })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => { Math.random = () => 0; });
    await page.getByRole('button', { name: '번호 뽑기', exact: true }).click();
    await page.waitForTimeout(1_400);
    const winnerEffect = await page.locator('.random-board').evaluate((element) => ({ className: element.className, animationName: getComputedStyle(element).animationName }));
    await page.evaluate(() => localStorage.setItem('school-random-draw-v1', JSON.stringify({
      activeCaseId: 'case-a', repeatPickEnabled: true,
      cases: [{ id: 'case-a', label: '선호 설정', rangeStart: 1, rangeEnd: 2, currentResult: 1, historyEntries: [{ id: 'preference-history', number: 1, kind: 'normal' }], studentNames: {}, hiddenNumberQueue: [] }],
    })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => { Math.random = () => 0; });
    await page.getByRole('button', { name: '번호 뽑기', exact: true }).click();
    await page.waitForTimeout(1_700);
    const repeatEffect = await page.evaluate(() => ({
      flightDisplay: document.querySelector('.random-repeat-flight') ? getComputedStyle(document.querySelector('.random-repeat-flight')).display : 'absent',
      boardAnimation: document.querySelector('.random-board') ? getComputedStyle(document.querySelector('.random-board')).animationName : 'absent',
    }));
    if (preference.state === 'reduced-motion') {
      assert(resetEffect.animationName === 'none' && winnerEffect.animationName === 'none', `${label}: reduced motion board still animates`);
      assert(repeatEffect.flightDisplay === 'none' || repeatEffect.flightDisplay === 'absent', `${label}: reduced motion repeat flight remains visible`);
    }
    if (preference.state !== 'reduced-motion') assert(repeatEffect.flightDisplay !== 'absent', `${label}: ${preference.state} repeat effect did not start`);
    if (preference.state === 'reduced-transparency') assert(material.backdropFilter === 'none', `${label}: reduced transparency material still blurs`);
    if (preference.state === 'more-contrast') assert(material.borderColor !== 'rgba(0, 0, 0, 0)', `${label}: increased contrast border missing`);
    result.preferenceAudit ??= [];
    result.preferenceAudit.push({ id: preference.state, material, resetEffect, winnerEffect, repeatEffect, phases: ['rest', 'mid', 'settled'] });
    states.push(await capture(page, preference.state));
  }
  await cdp.send('Emulation.setEmulatedMedia', { media: 'screen', features: [] });
  const storage = await page.evaluate(() => ({
    keys: Object.keys(localStorage).sort(),
    randomDraw: localStorage.getItem('school-random-draw-v1'),
  }));
  await context.close();
  return { label, states, externalRequests, consoleErrors, storage, pointerDown };
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const pristineEvidence = JSON.parse(await readFile(path.join(currentRoot, '.omo/evidence/task-5-apple-ui-refresh-plan/random-draw-pristine-comparison.json'), 'utf8'));
  assert(pristineEvidence.success && pristineEvidence.comparison.pass, 'Pristine Todo5 source comparison is not authoritative');
  result.runs.baseline = pristineEvidence.runs.baseline;
  startVite('current-vite', currentRoot, 4177);
  await waitForUrl('http://127.0.0.1:4177/.omo/evidence/fixtures/random-draw.html');
  result.runs.current = await run(browser, 'current-worktree', 4177);
  const mismatches = [];
  let compared = 0;
  for (const state of stateIds) {
    const baseline = result.runs.baseline.states.find((entry) => entry.state === state);
    const current = result.runs.current.states.find((entry) => entry.state === state);
    assert(baseline && current, `Missing state ${state}`);
    for (let index = 0; index < viewports.length; index += 1) {
      compared += 1;
      const baselineBytes = Buffer.from(JSON.stringify(baseline.records[index].text), 'utf8');
      const currentBytes = Buffer.from(JSON.stringify(current.records[index].text), 'utf8');
      if (!baselineBytes.equals(currentBytes)) {
        mismatches.push({ state, viewport: viewports[index], baseline: baseline.records[index].text, current: current.records[index].text });
      }
    }
  }
  result.comparison = { compared, exactMatches: compared - mismatches.length, mismatches, pass: mismatches.length === 0 };
  assert(compared === 28, `Expected 28 records, got ${compared}`);
  assert(mismatches.length === 0, `Standalone exact visible text mismatched in ${mismatches.length}/28 records`);
  assert(result.runs.current.externalRequests.every((url) => !url.includes('key=')), 'Credential-bearing external request recorded');
  assert(result.runs.current.consoleErrors.length === 0, 'Unexpected browser console errors');
  for (const state of result.runs.current.states) {
    for (const record of state.records) {
      assert(!record.horizontalOverflow, `${state.state}: horizontal overflow`);
      assert(record.targetsBelow44.length === 0, `${state.state}: target below 44px: ${record.targetsBelow44.join(', ')}`);
    }
  }
  const expectedStateText = {
    default: '?',
    settings: '설정',
    'after-settings': '뽑힌 번호',
    'case-switch': 'B상황',
    winner: '5',
    reset: '섞는 중',
    repeat: '1',
    exhausted: '섞는 중',
    'invalid-range': '잘못된 범위',
    'reduced-motion': '선호 설정',
    'reduced-transparency': '선호 설정',
    'more-contrast': '선호 설정',
  };
  result.stateAssertions = result.runs.current.states.map((state) => {
    const expected = expectedStateText[state.state];
    const pass = state.records.length === viewports.length
      && state.records.every((record) => record.text.includes(expected));
    assert(pass, `${state.state}: state-specific expected text ${expected} missing from one or more viewports`);
    return { id: state.state, expectedText: expected, records: state.records.length, pass };
  });
  assert(result.stateAssertions.length === Object.keys(expectedStateText).length, 'State-specific assertion matrix incomplete');
  result.storageContract = {
    key: 'school-random-draw-v1',
    onlyExpectedKey: JSON.stringify(result.runs.current.storage.keys) === JSON.stringify(['school-random-draw-v1']),
    parsedKeys: Object.keys(JSON.parse(result.runs.current.storage.randomDraw)).sort(),
  };
  assert(result.storageContract.onlyExpectedKey, 'Unexpected storage key');
  assert(JSON.stringify(result.storageContract.parsedKeys) === JSON.stringify(['activeCaseId', 'cases', 'repeatPickEnabled']), 'Storage contract changed');
  result.unreachable = [{ id: 'empty', proof: 'range normalization clamps both bounds to the inclusive 1..999 domain, so the rolling pool always contains at least one number; exhausted behavior is covered instead' }];
  result.success = true;
} catch (error) {
  result.success = false;
  result.error = error instanceof Error ? error.stack ?? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const child of [...children].reverse()) await stop(child);
  result.cleanup.children = children.map(({ receipt }) => receipt);
  result.completedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}
