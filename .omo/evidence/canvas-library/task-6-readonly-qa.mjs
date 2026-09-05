import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';

const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3040';
const baseUrl = `http://127.0.0.1:${port}`;
const sourceFiles = [
  'src/lib/dataMode.ts',
  'src/lib/canvasLibraryClient.ts',
  'src/components/student/library/CanvasLibraryGame.tsx',
  'src/components/student/library/CanvasLibraryRenderer.ts',
  'src/index.css',
];
const hashFiles = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async (path) => [
  path,
  createHash('sha256').update(await readFile(root + path)).digest('hex'),
])));
const room = createFullLibraryRoom();
const receipt = {
  generatedAt: new Date().toISOString(),
  invocation: 'DISABLE_HMR=true VITE_DATA_MODE=readonly node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3040 --strictPort',
  browserInvocation: 'bundled Playwright chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" })',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
  screenshots: [],
  blockedRequests: [],
  syntheticApiRequests: [],
  placementPuts: [],
  pageErrors: [],
  checks: {},
  cleanup: [],
  sourceSha256Start: await hashFiles(),
};

const keyOf = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
function routeFrom(start, target) {
  const queue = [{ player: { ...createLibraryPlayer(room, 23), position: start }, parent: -1, key: null }];
  const seen = new Set([keyOf(start)]);
  for (let index = 0; index < queue.length && index < 30000; index += 1) {
    const node = queue[index];
    if (Math.hypot(node.player.position.x - target.x, node.player.position.y - target.y) <= 3.2) {
      const result = [];
      for (let cursor = index; queue[cursor].parent >= 0; cursor = queue[cursor].parent) result.unshift(queue[cursor]);
      return result;
    }
    for (const [key, x, y] of [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]]) {
      const next = stepLibraryPlayer(room, node.player, { x, y }, 40);
      if (Math.hypot(next.position.x - node.player.position.x, next.position.y - node.player.position.y) < 3.99) continue;
      const id = keyOf(next.position);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ player: next, parent: index, key });
    }
  }
  throw new Error('No safe walking path');
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      receipt.syntheticApiRequests.push({ path: url.pathname, method: request.method() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.hostname !== '127.0.0.1' || url.port !== port) {
      receipt.blockedRequests.push({ url: request.url(), path: url.pathname, method: request.method() });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await context.addInitScript(() => {
    localStorage.setItem('school-timer-entry-number-v1', '23');
    localStorage.setItem('school-timer-practice-failure-stories-reset-v1', '1');
    localStorage.setItem('school-timer-student-pets-v1', JSON.stringify({
      currencyBalances: { 23: 30 },
      currencyHistory: { 23: [] },
      studentLife: {
        letters: [],
        failureStories: [],
        failureProfileAssignments: {},
        books: [
          { id: 'readonly-own-unplaced', studentNumber: 23, title: '읽기 전용에 남은 책', author: '합성 작가', pageCount: 92, createdAt: '2025-01-01T00:00:00.000Z', colorIndex: 0 },
          { id: 'readonly-other-placed', studentNumber: 2, title: '친구의 합성 책', author: '공유 작가', pageCount: 115, createdAt: '2025-01-02T00:00:00.000Z', colorIndex: 1, librarySlot: 0 },
        ],
      },
    }));
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => receipt.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/api/shared-settings')) receipt.placementPuts.push(request.url());
  });
  const canvas = page.getByRole('application');
  const position = () => canvas.evaluate((element) => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY) }));
  const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])));
  const gameState = () => page.evaluate(() => ({
    hash: location.hash,
    mainLabel: document.querySelector('main')?.getAttribute('aria-label') ?? null,
    playerX: document.querySelector('canvas')?.dataset.playerX ?? null,
    playerY: document.querySelector('canvas')?.dataset.playerY ?? null,
    nearbyTarget: document.querySelector('canvas')?.dataset.nearbyTarget ?? null,
    status: document.querySelector('.student-canvas-library-status')?.textContent?.trim() ?? null,
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
    dialog: document.querySelector('[role="dialog"]')?.textContent?.trim() ?? null,
    dataMode: document.querySelector('.data-mode-banner')?.textContent?.trim() ?? null,
  }));
  const cssSignature = () => page.evaluate(() => {
    const pick = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        rect: [rect.x, rect.y, rect.width, rect.height].map((value) => Number(value.toFixed(2))),
        display: style.display,
        position: style.position,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        overflow: style.overflow,
      };
    };
    return {
      viewport: [innerWidth, innerHeight],
      banner: pick('.data-mode-banner'),
      stage: pick('.student-canvas-library-stage'),
      canvas: pick('.student-canvas-library-scene'),
      dialog: pick('[role="dialog"]'),
    };
  });
  const capture = async (name) => {
    const path = `${directory}task-6-readonly-${name}.png`;
    await page.screenshot({ path });
    const png = await readFile(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800]);
    assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]), [0, 0]);
    receipt.screenshots.push({ name, path, sha256: createHash('sha256').update(png).digest('hex'), signature: { magic: png.subarray(0, 8).toString('hex'), width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length } });
    return path;
  };
  const travel = async (target) => {
    await canvas.focus();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await position();
      if (Math.hypot(current.x - target.x, current.y - target.y) < 4) return;
      const path = routeFrom(current, target);
      assert.ok(path.length);
      const direction = path[0].key;
      let endpoint = path[0].player.position;
      for (const node of path) {
        if (node.key !== direction) break;
        endpoint = node.player.position;
      }
      const axis = direction === 'a' || direction === 'd' ? 'x' : 'y';
      for (let tick = 0; tick < 80; tick += 1) {
        const before = await position();
        const delta = endpoint[axis] - before[axis];
        if (Math.abs(delta) < 2.8) break;
        const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(100, Math.max(20, Math.abs(delta) * 8)));
        await page.keyboard.up(key);
      }
    }
    throw new Error('Walking target not reached');
  };

  await page.goto(`${baseUrl}/#student-library-bookshelf`);
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
  assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [1280, 800]);
  const modeText = await page.getByRole('status').first().innerText();
  assert.match(modeText, /실제 데이터 보기 전용/);
  receipt.checks.readonlyBanner = modeText;
  receipt.checks.persistentMovementPadRemoved = await page.locator('.student-canvas-library-pad').count() === 0;
  assert.equal(receipt.checks.persistentMovementPadRemoved, true);
  receipt.startGame = await gameState();
  receipt.startStorage = await storage();
  receipt.startCss = await cssSignature();
  await capture('entered');

  await travel(room.desk.interactionPoint);
  await page.keyboard.press('e');
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('읽기 전용 새 책');
  await page.getByRole('textbox', { name: '글쓴이', exact: true }).fill('보존 작가');
  await page.getByRole('textbox', { name: '쪽수', exact: true }).fill('180');
  receipt.registrationGame = await gameState();
  await capture('registration');
  await page.getByRole('button', { name: '책 받기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.match(await page.getByText('운반 중', { exact: false }).innerText(), /운반 중/);
  receipt.carriedGame = await gameState();
  receipt.carriedStorage = await storage();
  assert.deepEqual(receipt.carriedStorage, receipt.startStorage, 'carrying a draft must not persist local storage');
  await capture('carried');

  await travel(room.shelves.at(-1).interactionPoint);
  await page.keyboard.press('e');
  const emptySlot = page.getByRole('button', { name: '빈자리 100', exact: true });
  await emptySlot.waitFor();
  await capture('picker-before-block');
  await emptySlot.click();
  await page.getByRole('alert').waitFor();
  const blockedGame = await gameState();
  const blockedStorage = await storage();
  receipt.endGame = blockedGame;
  receipt.endStorage = blockedStorage;
  receipt.endCss = await cssSignature();
  receipt.checks.readonlyPlacementBlocked = blockedGame.alert === '읽기 전용 모드에서는 책을 꽂을 수 없어요.';
  receipt.checks.exactSnapshotUnchanged = JSON.stringify(blockedStorage) === JSON.stringify(receipt.startStorage);
  receipt.checks.carriedDraftRetained = blockedGame.status?.includes('운반 중 · 읽기 전용 새 책') === true;
  receipt.checks.noPlacementPut = receipt.placementPuts.length === 0;
  assert.equal(receipt.checks.readonlyPlacementBlocked, true);
  assert.equal(receipt.checks.exactSnapshotUnchanged, true);
  assert.equal(receipt.checks.carriedDraftRetained, true);
  assert.equal(receipt.checks.noPlacementPut, true);
  await capture('placement-blocked-carried-retained');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  receipt.checks.escapeClosesPicker = await page.getByRole('dialog').count() === 0;
  receipt.checks.carriedAfterEscape = (await gameState()).status?.includes('운반 중 · 읽기 전용 새 책') === true;
  assert.equal(receipt.checks.escapeClosesPicker, true);
  assert.equal(receipt.checks.carriedAfterEscape, true);
  await capture('escape-closed-carried');

  receipt.checks.syntheticApiOnly = receipt.syntheticApiRequests.every(({ path }) => path.startsWith('/api/'));
  receipt.checks.nonlocalRequestsBlocked = receipt.blockedRequests.every(({ url }) => !url.startsWith(baseUrl));
  assert.equal(receipt.checks.syntheticApiOnly, true);
  assert.equal(receipt.checks.nonlocalRequestsBlocked, true);
  assert.deepEqual(receipt.endStorage, receipt.startStorage);
  assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]), [0, 0]);
  receipt.endViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  receipt.endGameAfterEscape = await gameState();
  receipt.sourceSha256End = await hashFiles();
  assert.deepEqual(receipt.sourceSha256End, receipt.sourceSha256Start);
  receipt.pngSignature = receipt.screenshots.at(-2)?.signature ?? null;
  receipt.passed = receipt.pageErrors.length === 0;
  assert.equal(receipt.passed, true);
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error);
  receipt.stack = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  receipt.cleanup.push('Isolated bundled-Playwright Chrome context/browser closed; port3040 server is stopped by parent harness.');
  await writeFile(`${directory}task-6-readonly-qa.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
