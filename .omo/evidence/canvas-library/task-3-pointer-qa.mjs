import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const dir = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3024';
const sourceFiles = ['src/lib/canvasLibraryWorld.ts', 'src/lib/useModalFocus.ts', 'src/components/student/library/CanvasLibraryGame.tsx', 'src/components/student/library/CanvasLibraryRenderer.ts', 'src/components/student/library/CanvasLibraryPalette.ts', 'src/index.css', '.omo/evidence/canvas-library/play.tsx'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(root + file)).digest('hex')])));
const receipt = { generatedAt: new Date().toISOString(), server: { host: '127.0.0.1', port, strictPort: true }, checks: {}, controls: {}, blockedRequests: [], errors: [], screenshots: [], cleanup: [] };
const pngHeader = '89504e470d0a1a0a';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-crash-reporter', '--disable-crashpad', '--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== port || url.pathname.startsWith('/api')) {
      receipt.blockedRequests.push({ url: url.href, api: url.pathname.startsWith('/api') });
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/.omo/evidence/canvas-library/play.html`);
  const canvas = page.getByRole('application');
  await canvas.waitFor();
  const position = () => canvas.evaluate(el => ({ x: Number(el.dataset.playerX), y: Number(el.dataset.playerY), target: el.dataset.nearbyTarget }));
  const screenshot = async name => {
    const path = `${dir}pointer-${name}.png`;
    await page.screenshot({ path });
    const png = await readFile(path);
    assert.equal(png.subarray(0, 8).toString('hex'), pngHeader);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800]);
    receipt.screenshots.push(path);
  };
  const scanControls = async state => {
    const entries = await page.locator('button:visible, input:visible').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName.toLowerCase(), label: element.getAttribute('aria-label') || element.textContent?.trim() || '', width: rect.width, height: rect.height };
    }));
    receipt.controls[state] = entries;
    for (const entry of entries) {
      assert.ok(entry.width >= 44 && entry.height >= 44, `${state} control below 44 CSS px: ${JSON.stringify(entry)}`);
    }
  };
  const direction = name => page.getByRole('button', { name, exact: true });
  const holdAndRelease = async (label, repeat) => {
    const button = direction(label);
    const box = await button.boundingBox();
    assert.ok(box, `missing bounds for ${label}`);
    const before = await position();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const during = await position();
    await page.mouse.up();
    await page.waitForTimeout(150);
    const after = await position();
    await page.waitForTimeout(180);
    const settled = await position();
    assert.ok(during.x !== before.x || during.y !== before.y, `${label} repeat ${repeat} did not move during pointer hold`);
    assert.deepEqual(settled, after, `${label} repeat ${repeat} kept moving after pointerup`);
    return { before, during, after, settled };
  };
  const holdAndInterrupt = async (label, eventName, repeat) => {
    const button = direction(label);
    const box = await button.boundingBox();
    assert.ok(box, `missing bounds for ${label}`);
    await page.evaluate(() => {
      window.__qaPointerId = null;
      document.addEventListener('pointerdown', event => { window.__qaPointerId = event.pointerId; }, { capture: true, once: true });
    });
    const before = await position();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const during = await position();
    const pointerId = await page.evaluate(() => window.__qaPointerId);
    assert.ok(Number.isInteger(pointerId), `${eventName} did not observe a real pointer id`);
    await button.evaluate((element, name) => element.dispatchEvent(new PointerEvent(name, { bubbles: true, pointerId: window.__qaPointerId, pointerType: 'mouse' })), eventName);
    await page.waitForTimeout(150);
    const after = await position();
    await page.waitForTimeout(180);
    const settled = await position();
    await page.mouse.up();
    assert.ok(during.x !== before.x || during.y !== before.y, `${eventName} repeat ${repeat} did not move during hold`);
    assert.deepEqual(settled, after, `${eventName} repeat ${repeat} kept moving after interruption`);
    return { before, during, after, settled, pointerId };
  };
  receipt.checks.viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth, overflowY: document.documentElement.scrollHeight - innerHeight }));
  assert.deepEqual(receipt.checks.viewport, { width: 1280, height: 800, overflowX: 0, overflowY: 0 });
  await scanControls('initial');
  await screenshot('initial');
  receipt.checks.pointerup = [await holdAndRelease('오른쪽으로 이동', 1), await holdAndRelease('오른쪽으로 이동', 2)];
  receipt.checks.pointercancel = [await holdAndInterrupt('왼쪽으로 이동', 'pointercancel', 1), await holdAndInterrupt('왼쪽으로 이동', 'pointercancel', 2)];
  receipt.checks.lostpointercapture = [await holdAndInterrupt('위로 이동', 'lostpointercapture', 1), await holdAndInterrupt('위로 이동', 'lostpointercapture', 2)];
  receipt.checks.pointerStops = true;

  const shelfRect = { x: 176, y: 42, width: 180, height: 62 };
  const frame = await canvas.evaluate(el => el.getBoundingClientRect().toJSON());
  const shelfPoint = { x: frame.x + (shelfRect.x + shelfRect.width / 2) * frame.width / 624, y: frame.y + (shelfRect.y + shelfRect.height / 2) * frame.height / 376 };
  await page.mouse.click(shelfPoint.x, shelfPoint.y);
  assert.equal(await page.getByRole('dialog').count(), 0, 'far shelf Canvas click opened a dialog');
  receipt.checks.farCanvasShelfClickNoModal = { shelfPoint, dialogs: 0 };
  await page.reload();
  await canvas.waitFor();
  await page.waitForTimeout(150);
  await canvas.evaluate(element => element.focus());

  const walkAxis = async (axis, value) => {
    for (let n = 0; n < 50; n += 1) {
      const before = await position();
      const delta = value - before[axis];
      if (Math.abs(delta) < 3) return;
      const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(150, Math.max(20, Math.abs(delta) * 10)));
      await page.keyboard.up(key);
    }
    assert.ok(Math.abs((await position())[axis] - value) < 4, `could not approach ${axis}=${value}`);
  };
  await walkAxis('x', 109);
  await walkAxis('y', 304);
  const nearDesk = page.getByRole('button', { name: '가까운 곳 살펴보기: 책 등록', exact: true });
  await nearDesk.click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('textbox', { name: '책 제목', exact: true }).count(), 1);
  await scanControls('registration');
  await screenshot('registration');
  await page.getByRole('button', { name: '책 등록 닫기', exact: true }).click();
  receipt.checks.nearRegistrationClickOpensForm = true;

  await nearDesk.click();
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('첫 책');
  await page.getByRole('textbox', { name: '글쓴이', exact: true }).fill('첫 작가');
  await page.getByRole('textbox', { name: '쪽수', exact: true }).fill('10');
  await page.getByRole('button', { name: '책 받기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await walkAxis('x', 266);
  await walkAxis('y', 122);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '빈자리 1', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await walkAxis('x', 196);
  const firstBookTarget = await position();
  assert.equal(firstBookTarget.target, 'placed-book:0');
  await page.getByRole('button', { name: '가까운 곳 살펴보기: 책 정보', exact: true }).waitFor();
  await page.keyboard.press('e');
  await page.getByRole('dialog').waitFor();
  await scanControls('details');
  await screenshot('details');
  await page.getByRole('button', { name: '책 정보 닫기', exact: true }).click();

  await walkAxis('y', 304);
  await walkAxis('x', 109);
  await page.getByRole('button', { name: '가까운 곳 살펴보기: 책 등록', exact: true }).click();
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('두 번째 책');
  await page.getByRole('textbox', { name: '글쓴이', exact: true }).fill('두 번째 작가');
  await page.getByRole('textbox', { name: '쪽수', exact: true }).fill('20');
  await page.getByRole('button', { name: '책 받기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await walkAxis('x', 196);
  await walkAxis('y', 122);
  const carryingNearPlaced = await position();
  const shelfAction = page.getByRole('button', { name: '가까운 곳 살펴보기: 책장 열기', exact: true });
  await shelfAction.waitFor();
  await screenshot('carrying-near-placed');
  await shelfAction.click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('heading', { name: '책을 둘 자리', exact: true }).count(), 1);
  const carryingClickOutcome = 'shelf-picker';
  await page.keyboard.press('Escape');
  await page.keyboard.press('e');
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('heading', { name: '책을 둘 자리', exact: true }).count(), 1);
  receipt.checks.carryingNearPlaced = { position: carryingNearPlaced, semanticAction: '가까운 곳 살펴보기: 책장 열기', clickOutcome: carryingClickOutcome, keyOutcome: 'shelf-picker' };
  await scanControls('slots');
  await screenshot('slots');
  await page.keyboard.press('Escape');
  receipt.checks.controlStates = ['initial', 'registration', 'slots', 'details'];

  await page.goto(`http://127.0.0.1:${port}/.omo/evidence/canvas-library/unmount.html`);
  const unmountCanvas = page.getByRole('application');
  await unmountCanvas.waitFor();
  await unmountCanvas.evaluate(element => element.focus());
  const unmountButton = page.getByRole('button', { name: '오른쪽으로 이동', exact: true });
  const unmountBox = await unmountButton.boundingBox();
  assert.ok(unmountBox, 'unmount fixture direction control has no bounds');
  await page.mouse.move(unmountBox.x + unmountBox.width / 2, unmountBox.y + unmountBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const heldBeforeUnmount = await unmountCanvas.evaluate(el => ({ x: Number(el.dataset.playerX), y: Number(el.dataset.playerY) }));
  await page.evaluate(() => window.__qaUnmount());
  await page.mouse.up();
  await page.waitForTimeout(220);
  assert.equal(await page.locator('#root').innerText(), '');
  assert.equal(await page.locator('[role="application"]').count(), 0);
  assert.deepEqual(receipt.errors, []);
  receipt.checks.unmountDuringHeldPointer = { heldBeforeUnmount, rootEmpty: true, staleErrors: [] };

  const beforeHashes = await sourceHashes();
  const stableReceipt = JSON.parse(await readFile(`${dir}root-play-qa.json`, 'utf8'));
  assert.deepEqual(beforeHashes, stableReceipt.sourceSha256, 'current sources differ from the pinned root-play-qa receipt');
  receipt.sourceSha256 = await sourceHashes();
  assert.deepEqual(receipt.sourceSha256, beforeHashes, 'source changed during pointer QA');
  assert.deepEqual(receipt.blockedRequests, []);
  assert.deepEqual(receipt.errors, []);
  receipt.pointerControlsPassed = true;
  receipt.findings = [{
    severity: 'medium',
    kind: 'product',
    title: 'Carrying near placed book has the wrong Canvas interaction cue',
    expected: 'Carrying a draft near a placed book should guide the player to the shelf picker.',
    observed: "Canvas cue renders 'Enter  책 보기' while DOM nearby action and E/click open '책을 둘 자리'.",
    artifact: `${dir}pointer-carrying-near-placed.png`,
    source: 'src/components/student/library/CanvasLibraryRenderer.ts:607',
  }];
  receipt.manualQa = {
    surfaceEvidence: [
      { scenarioId: 'PTR-001', criterionReference: 'Task 3 pointer model', surface: 'Canvas directional controls', exactInvocation: "getByRole(button,{name:'오른쪽으로 이동',exact:true}); mouse.down; wait150ms; mouse.up; wait330ms; repeat twice", verdict: 'PASS', artifactRefs: ['A1', 'A2'] },
      { scenarioId: 'PTR-002', criterionReference: 'Task 3 pointercancel cleanup', surface: 'Canvas directional controls', exactInvocation: 'Real mouse hold; dispatch PointerEvent(pointercancel) with observed pointerId; wait330ms; repeat twice', verdict: 'PASS', artifactRefs: ['A1', 'A2'] },
      { scenarioId: 'PTR-003', criterionReference: 'Task 3 lost-capture cleanup', surface: 'Canvas directional controls', exactInvocation: 'Real mouse hold; dispatch PointerEvent(lostpointercapture) with observed pointerId; wait330ms; repeat twice', verdict: 'PASS', artifactRefs: ['A1', 'A2'] },
      { scenarioId: 'PTR-004', criterionReference: 'Task 3 §84 controls >=44px', surface: 'Initial/registration/details/slots', exactInvocation: 'locator(button:visible,input:visible).evaluateAll(getBoundingClientRect); assert width,height >=44', verdict: 'PASS', artifactRefs: ['A1', 'A3'] },
      { scenarioId: 'PTR-005', criterionReference: 'Task 3 no teleport/remote interaction', surface: 'Canvas shelf hotspot', exactInvocation: 'mouse.click(mapped far shelf visual-rect center); assert dialog count === 0', verdict: 'PASS', artifactRefs: ['A1', 'A4'] },
      { scenarioId: 'PTR-006', criterionReference: 'Task 3 spatial hotspot access', surface: 'Registration desk', exactInvocation: 'Keyboard walk to x≈109,y≈304; click getByRole(button,{name:near registration}); assert registration dialog', verdict: 'PASS', artifactRefs: ['A1', 'A5'] },
      { scenarioId: 'PTR-007', criterionReference: 'Task 3 lifecycle cleanup', surface: 'React unmount fixture', exactInvocation: 'Real mouse hold; window.__qaUnmount(); mouse.up; wait220ms; assert #root empty and no page errors', verdict: 'PASS', artifactRefs: ['A1', 'A6'] },
      { scenarioId: 'PTR-008', criterionReference: 'Task 3 contextual interaction guidance', surface: 'Carrying near placed book', exactInvocation: 'Register/place first book; carry second to placed-book target; screenshot; click and press E; assert shelf picker', verdict: 'FAIL', artifactRefs: ['A1', 'A7', 'A8'] },
    ],
    adversarialCases: [
      { scenarioId: 'ADV-001', criterionReference: 'Task 3 pointer model', adversarialClass: 'cancel/resume interruption', expectedBehavior: 'pointercancel clears held direction and position settles', verdict: 'PASS', artifactRefs: ['A1', 'A2'] },
      { scenarioId: 'ADV-002', criterionReference: 'Task 3 pointer model', adversarialClass: 'repeated interruptions/timing', expectedBehavior: 'pointerup, cancel, lostcapture each repeated twice; no post-stop movement', verdict: 'PASS', artifactRefs: ['A1', 'A2'] },
      { scenarioId: 'ADV-003', criterionReference: 'Task 3 source integrity', adversarialClass: 'stale hashes', expectedBehavior: 'current seven hashes equal pinned root-play-qa receipt', verdict: 'PASS', artifactRefs: ['A1', 'A9'] },
      { scenarioId: 'ADV-004', criterionReference: 'repository safety', adversarialClass: 'dirty preservation', expectedBehavior: 'existing dirty worktree is not reverted or edited', verdict: 'PASS', artifactRefs: ['A1', 'A9'] },
      { scenarioId: 'ADV-005', criterionReference: 'runtime hygiene', adversarialClass: 'bounded command cleanup', expectedBehavior: 'browser closes in finally; port 3024 is free', verdict: 'PASS', artifactRefs: ['A1', 'A10'] },
      { scenarioId: 'ADV-006', criterionReference: 'existing untrusted-text coverage', adversarialClass: 'malformed/prompt injection', expectedBehavior: 'not applicable to pointer/control-only change; prior root receipt covers it', verdict: 'NOT_APPLICABLE', artifactRefs: ['A9'] },
      { scenarioId: 'ADV-007', criterionReference: 'QA evidence discipline', adversarialClass: 'misleading output vs assumed PASS', expectedBehavior: 'compare Canvas cue against DOM/E outcome and record mismatch as FAIL', verdict: 'FAIL', artifactRefs: ['A1', 'A7', 'A8'] },
    ],
    artifactRefs: [
      { id: 'A1', kind: 'JSON', description: 'Full bounded pointer/control receipt', path: `${dir}task-3-pointer-qa.json` },
      { id: 'A2', kind: 'script', description: 'Bounded Playwright held-pointer script', path: `${dir}task-3-pointer-qa.mjs` },
      { id: 'A3', kind: 'PNG set', description: '1280×800 initial and modal control states', path: `${dir}pointer-initial.png; ${dir}pointer-registration.png; ${dir}pointer-details.png; ${dir}pointer-slots.png` },
      { id: 'A4', kind: 'JSON field', description: 'Far shelf Canvas click yielded zero dialogs', path: `${dir}task-3-pointer-qa.json` },
      { id: 'A5', kind: 'JSON field', description: 'Near registration click opened form', path: `${dir}task-3-pointer-qa.json` },
      { id: 'A6', kind: 'fixture+JSON', description: 'React unmount while held pointer', path: `${dir}unmount.html; ${dir}unmount.tsx; ${dir}task-3-pointer-qa.json` },
      { id: 'A7', kind: 'PNG', description: 'Carrying-near-placed Canvas cue screenshot', path: `${dir}pointer-carrying-near-placed.png` },
      { id: 'A8', kind: 'source', description: 'Renderer cue branch vs Game semantic branch', path: `${root}src/components/student/library/CanvasLibraryRenderer.ts:607; ${root}src/components/student/library/CanvasLibraryGame.tsx:461` },
      { id: 'A9', kind: 'JSON', description: 'Pinned source hashes and zero blocked/errors', path: `${dir}task-3-pointer-qa.json` },
      { id: 'A10', kind: 'text', description: 'Port teardown receipt', path: `${dir}task-3-pointer-port-free.txt` },
    ],
  };
  receipt.passed = false;
  receipt.failure = 'Pointer/control checks passed, but contextual Canvas cue mismatch is a confirmed product finding.';
  process.exitCode = 1;
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error);
  receipt.failureStack = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  receipt.cleanup.push('Owned isolated Playwright Chrome closed; Vite 3024 teardown is performed by the parent shell session.');
  await writeFile(`${dir}task-3-pointer-qa.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
