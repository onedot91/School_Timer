import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const helperPath = new URL('../../../src/lib/useModalFocus.ts', import.meta.url);
const sourceHash = async () => createHash('sha256').update(await readFile(helperPath)).digest('hex');
const beforeHash = await sourceHash();
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '3023' || url.pathname.startsWith('/api')) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3023/.omo/evidence/canvas-library/play.html');
  const canvas = page.getByRole('application');
  const position = () => canvas.evaluate(element => ({
    x: Number(element.dataset.playerX),
    y: Number(element.dataset.playerY),
  }));
  const walkAxis = async (axis, value) => {
    for (let index = 0; index < 50; index += 1) {
      const current = await position();
      const delta = value - current[axis];
      if (Math.abs(delta) < 3) return;
      const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(150, Math.max(20, Math.abs(delta) * 10)));
      await page.keyboard.up(key);
    }
    throw new Error(`Could not reach ${axis}=${value}`);
  };

  await canvas.focus();
  await walkAxis('x', 109);
  await walkAxis('y', 304);
  await page.keyboard.press('e');
  await page.getByLabel('책 제목').fill('초승달 도서관');
  await page.getByLabel('글쓴이').fill('박새벽');
  await page.getByLabel('쪽수').fill('144');
  await page.getByRole('button', { name: '책 받기', exact: true }).click();
  await walkAxis('x', 266);
  await walkAxis('y', 122);
  await page.keyboard.press('e');
  const slotOne = page.getByRole('button', { name: '빈자리 1', exact: true });
  await slotOne.waitFor();
  await page.keyboard.press('ArrowDown');
  const slotSeven = page.getByRole('button', { name: '빈자리 7', exact: true });
  assert.equal(await slotSeven.evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Shift+Tab');
  const closeButton = page.getByRole('button', { name: '책장 닫기', exact: true });
  assert.equal(await closeButton.evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await slotSeven.evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Escape');
  assert.equal(await canvas.evaluate(element => document.activeElement === element), true);
  const afterHash = await sourceHash();
  assert.equal(afterHash, beforeHash);
  console.log(JSON.stringify({
    arrowDown: '빈자리 7',
    shiftTab: '책장 닫기',
    shiftTabWrap: '빈자리 7',
    escapeReturn: 'canvas',
    sourceHash: afterHash,
    passed: true,
  }, null, 2));
} finally {
  await browser.close();
}
