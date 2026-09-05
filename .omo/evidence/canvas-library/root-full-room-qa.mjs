import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';

const room = createFullLibraryRoom();
const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const port = '3027';
const files = ['src/lib/canvasLibraryWorld.ts', 'src/components/student/library/CanvasLibraryGame.tsx', 'src/components/student/library/CanvasLibraryRenderer.ts', 'src/components/student/library/CanvasLibraryPalette.ts', 'src/lib/useModalFocus.ts', 'src/index.css', '.omo/evidence/canvas-library/full-room.tsx'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(root + file)).digest('hex')])));
const beforeHashes = await hashes();
const receipt = { generatedAt: new Date().toISOString(), checks: {}, screenshots: [], errors: [], blockedRequests: [], cleanup: [] };

// Offline route planning calls the same pure collision model. It never sets browser player state.
function routeFrom(start, target) {
  const player = { ...createLibraryPlayer(room, 7), position: { x: start.x, y: start.y } };
  const keyOf = point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  const queue = [{ player, parent: -1, key: null }];
  const visited = new Set([keyOf(player.position)]);
  const directions = [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]];
  for (let index = 0; index < queue.length && index < 30000; index++) {
    const node = queue[index];
    if (Math.hypot(node.player.position.x - target.x, node.player.position.y - target.y) <= 3.2) {
      const path = [];
      for (let cursor = index; queue[cursor].parent >= 0; cursor = queue[cursor].parent) path.unshift(queue[cursor]);
      return path;
    }
    for (const [key, x, y] of directions) {
      const next = stepLibraryPlayer(room, node.player, { x, y }, 40);
      if (Math.hypot(next.position.x - node.player.position.x, next.position.y - node.player.position.y) < 3.99) continue;
      const id = keyOf(next.position);
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push({ player: next, parent: index, key });
    }
  }
  throw new Error(`No collision-safe route from ${JSON.stringify(start)} to ${JSON.stringify(target)}`);
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== port || url.pathname.startsWith('/api')) {
      receipt.blockedRequests.push({ origin: url.origin, api: url.pathname.startsWith('/api') });
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push(error.message));
  const canvas = page.getByRole('application');
  const position = () => canvas.evaluate(element => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY), target: element.dataset.nearbyTarget }));
  const capture = async name => {
    const path = `${directory}root-full-${name}.png`;
    await page.screenshot({ path });
    const png = await readFile(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 800]);
    const geometry = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      smallButtons: [...document.querySelectorAll('button')].filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 43.9 || rect.height < 43.9);
      }).map(button => button.getAttribute('aria-label') || button.textContent),
    }));
    assert.deepEqual(geometry, { overflowX: 0, overflowY: 0, smallButtons: [] });
    receipt.screenshots.push(path);
  };
  const enter = async mode => {
    await page.goto(`http://127.0.0.1:${port}/.omo/evidence/canvas-library/full-room.html?mode=${mode}`);
    await canvas.waitFor();
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.playerX);
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
    assert.deepEqual(viewport, { width: 1280, height: 800, x: 0, y: 0 });
    await canvas.focus();
    return viewport;
  };
  const travel = async target => {
    await canvas.focus();
    for (let attempt = 0; attempt < 50; attempt++) {
      const current = await position();
      if (Math.hypot(current.x - target.x, current.y - target.y) < 4) return current;
      const path = routeFrom(current, target);
      assert.ok(path.length);
      const direction = path[0].key;
      let endpoint = path[0].player.position;
      for (const node of path) {
        if (node.key !== direction) break;
        endpoint = node.player.position;
      }
      const axis = direction === 'a' || direction === 'd' ? 'x' : 'y';
      for (let tick = 0; tick < 80; tick++) {
        const observed = await position();
        const delta = endpoint[axis] - observed[axis];
        if (Math.abs(delta) < 2.8) break;
        const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(100, Math.max(20, Math.abs(delta) * 8)));
        await page.keyboard.up(key);
        const after = await position();
        if (Math.abs(after[axis] - observed[axis]) < 0.1) throw new Error(`Movement stalled ${key} at ${JSON.stringify(observed)}`);
      }
    }
    throw new Error(`Could not reach ${JSON.stringify(target)}`);
  };

  receipt.checks.emptyViewport = await enter('empty');
  await capture('empty');
  await travel(room.desk.interactionPoint);
  await page.keyboard.press('e');
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('숲 도서관의 마지막 자리');
  await page.getByRole('textbox', { name: '글쓴이', exact: true }).fill('연습 작가');
  await page.getByRole('textbox', { name: '쪽수', exact: true }).fill('123');
  await capture('registration');
  await page.getByRole('button', { name: '책 받기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await capture('carry');
  const lastShelf = room.shelves.at(-1);
  assert.ok(lastShelf);
  await travel(lastShelf.interactionPoint);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '빈자리 100', exact: true }).waitFor();
  await capture('last-slots');
  await page.getByRole('button', { name: '빈자리 100', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForTimeout(180);
  await capture('last-placed');
  await page.keyboard.press('e');
  const placed = page.getByRole('button', { name: '숲 도서관의 마지막 자리', exact: true });
  if (await placed.count()) await placed.click();
  await page.getByRole('heading', { name: '숲 도서관의 마지막 자리', exact: true }).waitFor();
  await capture('last-details');
  receipt.checks.registerCarryPlaceLastRead = true;

  receipt.checks.fullViewport = await enter('full');
  await capture('100-books');
  receipt.checks.shelfPickers = [];
  for (const shelf of room.shelves) {
    const approach = await travel(shelf.interactionPoint);
    receipt.checks.latestApproach = { shelf: shelf.id, ...approach };
    await page.keyboard.press('e');
    await page.getByRole('heading', { name: '책을 둘 자리', exact: true }).waitFor();
    const slots = page.locator('.student-canvas-library-slot-grid > button');
    assert.equal(await slots.count(), shelf.slots.length);
    assert.equal(await slots.filter({ hasText: /^빈자리/ }).count(), 0);
    await capture(`shelf-${shelf.id}`);
    const chosen = slots.last();
    const title = await chosen.getAttribute('aria-label');
    assert.ok(title);
    for (let column = 1; column < shelf.columns; column++) await page.keyboard.press('ArrowRight');
    for (let row = 1; row < shelf.rows; row++) await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.student-canvas-library-slot-caption strong').innerText(), title);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), title);
    await capture(`selected-last-${shelf.id}`);
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await capture(`read-${shelf.id}`);
    receipt.checks.shelfPickers.push({ shelf: shelf.id, slots: shelf.slots.length, inspectedTitle: title, approach });
    await page.keyboard.press('Escape');
  }
  assert.equal(receipt.checks.shelfPickers.reduce((sum, shelf) => sum + shelf.slots, 0), 100);
  assert.deepEqual(receipt.errors, []);
  assert.deepEqual(receipt.blockedRequests, []);
  receipt.sourceSha256 = await hashes();
  assert.deepEqual(receipt.sourceSha256, beforeHashes, 'Source changed during actual play; recapture required');
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error);
  receipt.failureStack = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  receipt.cleanup.push('Owned isolated Chrome closed; root owns stable Vite3027 teardown.');
  await writeFile(`${directory}root-full-room-qa.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
