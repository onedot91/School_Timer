import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = process.cwd();
const outputDirectory = path.join(root, '.omo/evidence/task-3-apple-ui-refresh-plan');
const appUrl = 'http://127.0.0.1:4176/';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];
const result = { success: false, assertions: {}, captures: [], requests: [], errors: [], cleanup: {} };
const vite = spawn('npm', ['run', 'dev', '--', '--port', '4176', '--host', '127.0.0.1'], {
  cwd: root,
  env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const waitForVite = async () => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(appUrl);
      if (response.ok) return;
    } catch {
      // Local readiness polling is bounded.
    }
    await wait(100);
  }
  throw new Error('Vite did not become ready');
};
const freshPage = async (options = {}) => {
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...options });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    result.requests.push(url.href);
    if (url.hostname === '127.0.0.1') await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  return { context, page };
};

try {
  await mkdir(path.join(outputDirectory, 'screenshots'), { recursive: true });
  await waitForVite();
  browser = await chromium.launch({ headless: true });

  const unlock = await freshPage({ viewport: viewports[1] });
  const reveal = unlock.page.getByRole('button', { name: '0번 표시 숨김 버튼' });
  for (let count = 1; count <= 4; count += 1) {
    await reveal.click();
    assert(await unlock.page.getByRole('button', { name: '0번 학급 시계 선택' }).count() === 0, `0 revealed on click ${count}`);
  }
  await reveal.click();
  assert(await unlock.page.getByRole('button', { name: '0번 학급 시계 선택' }).count() === 1, '0 did not reveal on click 5');
  result.assertions.hiddenAdminClicks = 'PASS: hidden on 1-4, visible on 5';
  await unlock.page.screenshot({ path: path.join(outputDirectory, 'screenshots', 'entry-unlocked-390x844.png'), fullPage: true });
  await unlock.context.close();

  const entries = [];
  for (let studentNumber = 1; studentNumber <= 23; studentNumber += 1) {
    const entry = await freshPage({ viewport: viewports[1] });
    await entry.page.getByRole('button', { name: `${studentNumber}번 경매장 선택`, exact: true }).click();
    const stored = await entry.page.evaluate(() => localStorage.getItem('school-timer-entry-number-v1'));
    assert(stored === String(studentNumber), `entry ${studentNumber} was not stored`);
    entries.push(studentNumber);
    await entry.context.close();
  }
  result.assertions.entries = entries;

  const invalid = await freshPage({ viewport: viewports[1] });
  await invalid.page.evaluate(() => localStorage.setItem('school-timer-entry-number-v1', '999'));
  await invalid.page.reload({ waitUntil: 'networkidle' });
  assert(await invalid.page.getByRole('heading', { name: '번호 선택' }).isVisible(), 'invalid storage did not return to entry');
  result.assertions.invalidStorage = 'PASS';
  await invalid.context.close();

  for (const shortcut of [
    { id: 'meta', platform: 'MacIntel', keys: ['Alt', 'Meta', 'Enter'] },
    { id: 'ctrl', platform: 'CrOS x86_64', keys: ['Alt', 'Control', 'Enter'] },
  ]) {
    const run = await freshPage({ viewport: viewports[1] });
    await run.page.evaluate(({ platform }) => Object.defineProperty(navigator, 'platform', { value: platform, configurable: true }), shortcut);
    await run.page.getByRole('button', { name: '1번 경매장 선택', exact: true }).click();
    for (const key of shortcut.keys) await run.page.keyboard.down(key);
    for (const key of [...shortcut.keys].reverse()) await run.page.keyboard.up(key);
    await run.page.getByRole('heading', { name: '번호 선택' }).waitFor();
    result.assertions[`shortcut-${shortcut.id}`] = 'PASS';
    await run.context.close();
  }

  for (const viewport of viewports) {
    const capture = await freshPage({ viewport });
    const firstButton = capture.page.getByRole('button', { name: '1번 경매장 선택', exact: true });
    const revealTarget = capture.page.getByRole('button', { name: '0번 표시 숨김 버튼' });
    const measurements = await capture.page.evaluate(() => {
      const button = document.querySelector('.entry-number-button');
      const revealButton = document.querySelector('.entry-admin-reveal');
      if (!(button instanceof HTMLElement) || !(revealButton instanceof HTMLElement)) throw new Error('entry controls missing');
      const rect = button.getBoundingClientRect();
      const revealRect = revealButton.getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        target: [rect.width, rect.height],
        revealTarget: [revealRect.width, revealRect.height],
      };
    });
    assert(!measurements.horizontalOverflow, `overflow at ${viewport.width}x${viewport.height}`);
    assert(measurements.target[0] >= 44 && measurements.target[1] >= 44, `number target below 44px at ${viewport.width}`);
    assert(measurements.revealTarget[0] >= 44 && measurements.revealTarget[1] >= 44, `reveal target below 44px at ${viewport.width}`);
    await capture.page.screenshot({ path: path.join(outputDirectory, 'screenshots', `entry-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await firstButton.focus();
    const focusOutline = await firstButton.evaluate((element) => getComputedStyle(element).outlineStyle);
    assert(focusOutline !== 'none', `focus ring missing at ${viewport.width}`);
    await firstButton.hover();
    await capture.page.mouse.down();
    await capture.page.waitForTimeout(100);
    const pressedState = await firstButton.evaluate((element) => ({
      active: element.matches(':active'),
      opacity: getComputedStyle(element).opacity,
      scale: getComputedStyle(element).scale,
    }));
    await capture.page.mouse.up();
    assert(pressedState.active && (Number(pressedState.opacity) < 1 || (pressedState.scale !== 'none' && pressedState.scale !== '1')), `press feedback missing at ${viewport.width}: ${JSON.stringify(pressedState)}`);
    result.captures.push({ viewport, measurements, focusOutline, pressedState });
    await capture.context.close();
  }

  const zoom = await freshPage({ viewport: viewports[1] });
  await zoom.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const zoomAudit = await zoom.page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    headingVisible: document.querySelector('.entry-select-title')?.getBoundingClientRect().height ?? 0,
  }));
  assert(!zoomAudit.horizontalOverflow && zoomAudit.headingVisible > 0, '200% reflow failed');
  result.assertions.zoom200 = zoomAudit;
  await zoom.page.screenshot({ path: path.join(outputDirectory, 'screenshots', 'entry-390x844-zoom200.png'), fullPage: true });
  await zoom.context.close();

  const reduced = await freshPage({ viewport: viewports[1], reducedMotion: 'reduce' });
  const reducedDuration = await reduced.page.getByRole('button', { name: '1번 경매장 선택', exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration);
  result.assertions.reducedMotion = reducedDuration;
  await reduced.context.close();

  const fallbackContext = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: viewports[1] });
  await fallbackContext.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    result.requests.push(url.href);
    if (url.hostname === '127.0.0.1') await route.continue();
    else await route.abort();
  });
  const fallbackPage = await fallbackContext.newPage();
  const runtimeErrors = [];
  fallbackPage.on('pageerror', (error) => runtimeErrors.push(error.message));
  const runtimeUrl = `${appUrl}.omo/evidence/fixtures/task-3-runtime.html`;
  await fallbackPage.goto(runtimeUrl, { waitUntil: 'networkidle' });
  await fallbackPage.getByRole('heading', { name: '화면을 다시 불러와 주세요' }).waitFor();
  assert(runtimeErrors.includes('Todo 3 evidence-only runtime throw'), 'real window error was not observed');
  await fallbackPage.screenshot({ path: path.join(outputDirectory, 'screenshots', 'runtime-fallback-390x844.png'), fullPage: true });
  await Promise.all([
    fallbackPage.waitForNavigation({ waitUntil: 'networkidle' }),
    fallbackPage.getByRole('button', { name: '새로고침' }).click(),
  ]);
  await fallbackPage.getByRole('heading', { name: '번호 선택' }).waitFor();
  assert(new URL(fallbackPage.url()).pathname.endsWith('/task-3-runtime.html'), 'reload did not navigate the evidence entry');
  result.assertions.runtimeFallback = {
    actualWindowThrow: runtimeErrors,
    fallbackRendered: true,
    reloadNavigationObserved: true,
    recoveredToEntry: true,
  };
  await fallbackContext.close();

  result.assertions.blockedExternalAssets = result.requests.filter((url) => url.startsWith('https://fonts.googleapis.com/')).length;
  result.assertions.liveDataRequests = result.requests.filter((url) => (
    !url.startsWith(appUrl) && !url.startsWith('https://fonts.googleapis.com/')
  )).length;
  assert(result.assertions.liveDataRequests === 0, 'external data request escaped isolation');
  const productPaths = ['src/RootApp.tsx', 'src/pages/EntrySelectPage.tsx', 'src/index.css'];
  const productSource = (await Promise.all(productPaths.map((file) => readFile(path.join(root, file), 'utf8')))).join('\n');
  const scopedDiff = execFileSync('git', ['diff', '--', ...productPaths], { cwd: root, encoding: 'utf8' });
  result.assertions.faultInjectionIsolation = {
    evidenceMarker: 'Todo 3 evidence-only runtime throw',
    productSourceMatches: productSource.includes('Todo 3 evidence-only runtime throw') ? 1 : 0,
    scopedDiffMatches: scopedDiff.includes('Todo 3 evidence-only runtime throw') ? 1 : 0,
    productSourceSha256: createHash('sha256').update(productSource).digest('hex'),
    scopedDiffSha256: createHash('sha256').update(scopedDiff).digest('hex'),
  };
  assert(result.assertions.faultInjectionIsolation.productSourceMatches === 0, 'fault marker leaked into product source');
  assert(result.assertions.faultInjectionIsolation.scopedDiffMatches === 0, 'fault marker leaked into product diff');
  result.success = true;
} catch (error) {
  result.errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (vite.exitCode === null) vite.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => vite.once('exit', resolve)), wait(3000)]);
  if (vite.exitCode === null) vite.kill('SIGKILL');
  result.cleanup = { viteExitCode: vite.exitCode, viteSignal: vite.signalCode };
  await writeFile(path.join(outputDirectory, 'manual-qa.json'), `${JSON.stringify(result, null, 2)}\n`);
}

if (!result.success) process.exitCode = 1;
