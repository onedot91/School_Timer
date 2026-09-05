import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createFullLibraryRoom, createLibraryPlayer, stepLibraryPlayer } from '../../../src/lib/canvasLibraryWorld.ts';

const directory = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const files = ['src/components/student/library/CanvasLibraryGame.tsx', 'src/index.css'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(root + file)).digest('hex')])));
const beforeHashes = await hashes();
const room = createFullLibraryRoom();
const receipt = { generatedAt: new Date().toISOString(), shelves: [], screenshots: [], blockedRequests: [], errors: [], cleanup: [] };

const routeFrom = (start, target) => {
  const player = { ...createLibraryPlayer(room, 7), position: start };
  const keyOf = point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  const queue = [{ player, parent: -1, key: null }];
  const visited = new Set([keyOf(player.position)]);
  const directions = [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]];
  for (let index = 0; index < queue.length && index < 30000; index += 1) {
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
  throw new Error(`No route to ${JSON.stringify(target)}`);
};

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '3028' || url.pathname.startsWith('/api')) {
      receipt.blockedRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push(error.message));
  await page.goto('http://127.0.0.1:3028/.omo/evidence/canvas-library/full-room.html?mode=full');
  const canvas = page.getByRole('application');
  const position = () => canvas.evaluate(element => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY) }));
  const travel = async target => {
    await canvas.focus();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await position();
      if (Math.hypot(current.x - target.x, current.y - target.y) < 4) return;
      const path = routeFrom(current, target);
      const direction = path[0]?.key;
      assert.ok(direction);
      let endpoint = path[0].player.position;
      for (const node of path) {
        if (node.key !== direction) break;
        endpoint = node.player.position;
      }
      const axis = direction === 'a' || direction === 'd' ? 'x' : 'y';
      for (let tick = 0; tick < 80; tick += 1) {
        const observed = await position();
        const delta = endpoint[axis] - observed[axis];
        if (Math.abs(delta) < 2.8) break;
        const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(100, Math.max(20, Math.abs(delta) * 8)));
        await page.keyboard.up(key);
      }
    }
    throw new Error(`Could not reach ${JSON.stringify(target)}`);
  };
  const capture = async name => {
    const path = `${directory}task-4-picker-${name}.png`;
    await page.screenshot({ path });
    receipt.screenshots.push(path);
  };
  const focusRingInset = async button => button.evaluate(element => {
    const grid = element.parentElement;
    if (!(grid instanceof HTMLElement)) return null;
    const gridBounds = grid.getBoundingClientRect();
    const buttonBounds = element.getBoundingClientRect();
    const inset = {
      top: buttonBounds.top - gridBounds.top,
      right: gridBounds.right - buttonBounds.right,
      bottom: gridBounds.bottom - buttonBounds.bottom,
      left: buttonBounds.left - gridBounds.left,
    };
    return { ...inset, outlineClear: Object.values(inset).every(value => value >= 5) };
  });
  const shelfIds = ['full-wide-left', 'full-compact-back', 'full-tall-island'];
  for (const shelfId of shelfIds) {
    const shelf = room.shelves.find(candidate => candidate.id === shelfId);
    assert.ok(shelf);
    await travel(shelf.interactionPoint);
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const buttons = page.locator('.student-canvas-library-slot-grid > button');
    assert.equal(await buttons.count(), 20);
    const labels = await buttons.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    assert.equal(labels.every(label => typeof label === 'string' && label.length > 0), true);
    assert.equal((await buttons.allTextContents()).every(text => /^\s*\d+\s*(책|빈자리)\s*$/.test(text)), true);
    const firstLabel = labels[0];
    assert.equal(await page.locator('.student-canvas-library-slot-caption strong').innerText(), firstLabel);
    const firstFocusInset = await focusRingInset(buttons.first());
    assert.equal(firstFocusInset?.outlineClear, true);
    await capture(`${shelfId}-first`);
    for (let row = 1; row < shelf.rows; row += 1) await page.keyboard.press('ArrowDown');
    for (let column = 1; column < shelf.columns; column += 1) await page.keyboard.press('ArrowRight');
    const lastLabel = labels.at(-1);
    assert.equal(await buttons.last().evaluate(element => document.activeElement === element), true);
    assert.equal(await page.locator('.student-canvas-library-slot-caption strong').innerText(), lastLabel);
    const lastFocusInset = await focusRingInset(buttons.last());
    assert.equal(lastFocusInset?.outlineClear, true);
    const frozen = await position();
    await page.keyboard.down('d');
    await page.waitForTimeout(160);
    await page.keyboard.up('d');
    assert.deepEqual(await position(), frozen);
    await capture(`${shelfId}-last`);
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('heading', { name: lastLabel, exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await canvas.evaluate(element => document.activeElement === element), true);
    receipt.shelves.push({ shelfId, columns: shelf.columns, rows: shelf.rows, labels: labels.length, firstLabel, lastLabel, firstFocusInset, lastFocusInset, modalFrozen: true, enterDetails: true, escapeReturn: true });
  }
  await travel(room.shelves.find(shelf => shelf.id === 'full-tall-island').interactionPoint);
  await page.keyboard.press('e');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const textStress = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
  assert.deepEqual(textStress, { x: 0, y: 0 });
  const captionInViewport = await page.locator('.student-canvas-library-slot-caption strong').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
  });
  assert.equal(captionInViewport, true);
  await capture('tall-200-last');
  const focusedSlotLayout = async () => page.evaluate(() => {
    const caption = document.querySelector('.student-canvas-library-slot-caption');
    const focused = document.activeElement;
    if (!(caption instanceof HTMLElement) || !(focused instanceof HTMLButtonElement)) return null;
    const captionBounds = caption.getBoundingClientRect();
    const focusBounds = focused.getBoundingClientRect();
    return {
      label: focused.getAttribute('aria-label'),
      inViewport: focusBounds.top >= 0 && focusBounds.bottom <= innerHeight,
      separated: captionBounds.bottom <= focusBounds.top || captionBounds.top >= focusBounds.bottom,
      caption: { top: captionBounds.top, bottom: captionBounds.bottom },
      focus: { top: focusBounds.top, bottom: focusBounds.bottom },
    };
  });
  const focusLayouts = [];
  focusLayouts.push(await focusedSlotLayout());
  for (let column = 1; column < 4; column += 1) {
    await page.keyboard.press('ArrowLeft');
    focusLayouts.push(await focusedSlotLayout());
  }
  for (let row = 1; row < 5; row += 1) {
    await page.keyboard.press('ArrowUp');
    focusLayouts.push(await focusedSlotLayout());
  }
  receipt.text200 = { documentOverflow: textStress, captionInViewport, focusLayouts, closeReachable: true };
  assert.equal(focusLayouts.every(layout => layout?.inViewport && layout.separated), true);
  const closeInViewport = await page.getByRole('button', { name: '책장 닫기', exact: true }).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
  });
  assert.equal(closeInViewport, true);
  receipt.text200.closeInViewport = closeInViewport;
  await capture('tall-200-first');
  receipt.sourceSha256 = await hashes();
  assert.deepEqual(receipt.sourceSha256, beforeHashes);
  assert.deepEqual(receipt.blockedRequests, []);
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error);
  receipt.failureStack = error instanceof Error ? error.stack : undefined;
  process.exitCode = 1;
} finally {
  await browser.close();
  receipt.cleanup.push('Owned isolated Chrome closed; owned Vite3028 teardown follows.');
  await writeFile(`${directory}task-4-picker-qa.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
