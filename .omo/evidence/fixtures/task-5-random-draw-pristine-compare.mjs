import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [baselineRoot, currentRoot, outputPath] = process.argv.slice(2);
if (!baselineRoot || !currentRoot || !outputPath) {
  throw new Error('usage: node task-5-random-draw-pristine-compare.mjs <baseline-root> <current-root> <output>');
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
  purpose: 'Pristine f5a90d8 versus current standalone RandomDraw exact visible-text repair for Todo 5',
  baselineCommit: 'f5a90d8',
  fixedClock,
  deterministicRandom: 'LCG seed 0x5c11d00d',
  fixture: 'empty localStorage; no TimerPage; standalone RandomDraw entry; external requests aborted',
  viewports,
  stateIds,
  runs: {},
  comparison: {},
  cleanup: {},
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
    localStorage.clear();
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

const capture = async (page, state) => {
  const records = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom ?? 1);
    await page.waitForTimeout(50);
    records.push({ viewport, text: await page.evaluate(visibleText) });
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
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
      externalRequests.push(route.request().url());
      await route.abort('blockedbyclient');
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${port}/.omo/evidence/fixtures/random-draw.html`, { waitUntil: 'networkidle' });
  const states = [];
  states.push(await capture(page, 'default'));
  const settingsButton = page.getByRole('button', { name: '설정', exact: true });
  assert(await settingsButton.count(), `${label}: settings button missing; body=${(await page.locator('body').innerText()).slice(0, 1000)}; console=${consoleErrors.join(' | ')}`);
  await settingsButton.click();
  await page.locator('.settings-dialog').waitFor();
  states.push(await capture(page, 'settings'));
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  states.push(await capture(page, 'after-settings'));
  await page.getByRole('button', { name: '번호 뽑기', exact: true }).click();
  await page.waitForTimeout(1_600);
  states.push(await capture(page, 'winner'));
  const storage = await page.evaluate(() => ({
    keys: Object.keys(localStorage).sort(),
    randomDraw: localStorage.getItem('school-random-draw-v1'),
  }));
  await context.close();
  return { label, states, externalRequests, consoleErrors, storage };
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  startVite('baseline-vite', baselineRoot, 4176);
  await waitForUrl('http://127.0.0.1:4176/.omo/evidence/fixtures/random-draw.html');
  result.runs.baseline = await run(browser, 'pristine-f5a90d8', 4176);
  await stop(children.at(-1));
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
