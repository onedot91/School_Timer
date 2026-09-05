import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin = 'http://127.0.0.1:3032';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

const seed = (full) => {
  localStorage.clear();
  localStorage.setItem('school-timer-entry-number-v1', '23');
  localStorage.setItem('school-timer-practice-failure-stories-reset-v1', '1');
  const books = full ? Array.from({ length: 100 }, (_, slot) => ({
    id: `full-${slot}`, studentNumber: slot % 23 + 1, title: `책 ${slot + 1}`,
    author: `글쓴이 ${slot + 1}`, pageCount: 80 + slot, createdAt: '2026-09-01T00:00:00.000Z',
    colorIndex: slot % 6, librarySlot: slot,
  })) : [];
  localStorage.setItem('school-timer-student-pets-v1', JSON.stringify({
    studentPets: {}, studentEconomy: {}, currencyBalances: { 23: 30 }, currencyHistory: { 23: [] },
    studentLife: { letters: [], failureStories: [], failureProfileAssignments: {}, books },
    auctionItems: [], auctionBids: {}, auctionBidHistory: [], auctionAwards: {},
  }));
};

const openRoute = async (full, textZoom) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
  await page.addInitScript(seed, full);
  await page.goto(`${origin}/#student-library-bookshelf`, { waitUntil: 'networkidle' });
  if (textZoom) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const canvas = page.getByRole('application', { name: /우리 반 도서관/ });
  await canvas.waitFor();
  await canvas.focus();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1980);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(360);
  await page.keyboard.up('ArrowUp');
  assert.equal(await canvas.getAttribute('data-nearby-target'), 'registration-desk');
  await page.keyboard.press('e');
  await page.getByRole('heading', { name: '읽은 책 등록' }).waitFor();
  return { context, page };
};

try {
  const full = await openRoute(true, false);
  const capacityCopy = full.page.getByText('100자리가 모두 찼어요. 꽂힌 책은 읽을 수 있어요.');
  await capacityCopy.waitFor();
  const capacityMetrics = await capacityCopy.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()].map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
    return { text: element.textContent, lines };
  });
  assert.equal(capacityMetrics.text?.endsWith('읽을 수 있어요.'), true);
  assert.equal(capacityMetrics.lines.some((line) => line.width < 24), false);
  await full.page.screenshot({ path: '.omo/evidence/canvas-library/task-6-client-visual-full.png' });
  await full.context.close();

  const zoom = await openRoute(false, true);
  const overlap = await zoom.page.evaluate(() => {
    const banner = document.querySelector('.data-mode-banner');
    const detail = document.querySelector('.data-mode-banner span');
    const close = document.querySelector('.student-canvas-library-dialog-close');
    if (!(banner instanceof HTMLElement) || !(detail instanceof HTMLElement) || !(close instanceof HTMLElement)) return null;
    const bannerRect = banner.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const intersects = bannerRect.left < closeRect.right && bannerRect.right > closeRect.left
      && bannerRect.top < closeRect.bottom && bannerRect.bottom > closeRect.top;
    return {
      banner: { left: bannerRect.left, top: bannerRect.top, right: bannerRect.right, bottom: bannerRect.bottom },
      close: { left: closeRect.left, top: closeRect.top, right: closeRect.right, bottom: closeRect.bottom },
      intersects,
      modeText: banner.querySelector('strong')?.textContent,
      detailClip: getComputedStyle(detail).clipPath,
      detailBox: [detail.getBoundingClientRect().width, detail.getBoundingClientRect().height],
    };
  });
  assert.ok(overlap);
  assert.equal(overlap.intersects, false);
  assert.equal(overlap.modeText, '연습 모드');
  assert.equal(overlap.detailClip, 'inset(50%)');
  assert.deepEqual(overlap.detailBox, [1, 1]);
  await zoom.page.screenshot({ path: '.omo/evidence/canvas-library/task-6-client-visual-200.png' });
  await zoom.context.close();

  await fs.writeFile('.omo/evidence/canvas-library/task-6-client-visual-fix.json', JSON.stringify({
    capacityMetrics,
    zoom200: overlap,
  }, null, 2));
} finally {
  await browser.close();
}
