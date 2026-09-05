import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin = 'http://127.0.0.1:3032';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const requests = [];

try {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      requests.push({ url: url.href, action: 'blocked-external' });
      await route.abort();
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      requests.push({ url: url.pathname, action: 'fake-api' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '23');
    localStorage.setItem('school-timer-practice-failure-stories-reset-v1', '1');
    localStorage.setItem('school-timer-student-pets-v1', JSON.stringify({
      studentPets: {},
      studentEconomy: {},
      currencyBalances: { 23: 30 },
      currencyHistory: { 23: [] },
      studentLife: {
        letters: [],
        failureStories: [],
        failureProfileAssignments: {},
        books: [{
          id: 'legacy-own-23', studentNumber: 23, title: '오래된 내 책', author: '옛 글쓴이',
          pageCount: 88, createdAt: '2026-09-01T00:00:00.000Z', colorIndex: 0,
        }],
      },
      auctionItems: [], auctionBids: {}, auctionBidHistory: [], auctionAwards: {},
    }));
  });
  await page.goto(`${origin}/#student-library-bookshelf`, { waitUntil: 'networkidle' });
  const canvas = page.getByRole('application', { name: /우리 반 도서관/ });
  await canvas.waitFor();
  const geometry = await page.evaluate(() => {
    const scene = document.querySelector('.student-canvas-library-scene');
    const stage = document.querySelector('.student-canvas-library-stage');
    if (!(scene instanceof HTMLElement) || !(stage instanceof HTMLElement)) return null;
    const canvasRect = scene.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      canvas: [canvasRect.width, canvasRect.height],
      stage: [stageRect.left, stageRect.top, stageRect.width, stageRect.height],
      documentOverflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
      studentHeaderCount: document.querySelectorAll('.student-header').length,
    };
  });
  assert.deepEqual(geometry, {
    viewport: [1280, 800], canvas: [1248, 752], stage: [12, 12, 1256, 776],
    documentOverflow: [0, 0], studentHeaderCount: 0,
  });

  const position = async () => canvas.evaluate((node) => ({
    x: Number(node.dataset.playerX),
    y: Number(node.dataset.playerY),
    target: node.dataset.nearbyTarget,
  }));
  const walk = async (key, ms) => {
    await canvas.focus();
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };

  await walk('ArrowLeft', 1980);
  await walk('ArrowUp', 360);
  assert.equal((await position()).target, 'registration-desk');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: /오래된 내 책/ }).waitFor();
  await page.keyboard.press('Escape');
  await canvas.focus();
  await page.keyboard.press('e');
  await page.getByRole('textbox', { name: '책 제목' }).fill('달빛 우체국');
  await page.getByRole('textbox', { name: '글쓴이' }).fill('고마');
  await page.getByRole('textbox', { name: '쪽수' }).fill('120');
  await page.getByRole('button', { name: '책 받기' }).click();
  await page.getByText('운반 중 · 달빛 우체국').waitFor();

  await walk('ArrowRight', 820);
  await walk('ArrowUp', 1800);
  await walk('ArrowLeft', 830);
  assert.equal((await position()).target, 'full-wide-left');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '빈자리 1', exact: true }).press('Enter');
  await page.getByText('운반 중 · 달빛 우체국').waitFor({ state: 'hidden' });

  await canvas.focus();
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '달빛 우체국' }).press('Enter');
  await page.getByRole('heading', { name: '달빛 우체국' }).waitFor();
  await page.screenshot({ path: '.omo/evidence/canvas-library/task-6-client-route.png' });

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('school-timer-student-pets-v1') ?? 'null'));
  const savedBook = persisted.studentLife.books.find((book) => book.title === '달빛 우체국');
  assert.equal(savedBook.librarySlot, 0);
  assert.equal(persisted.studentLife.books.some((book) => book.id === 'legacy-own-23'), true);
  assert.equal(persisted.currencyBalances['23'], 40);
  assert.equal(persisted.currencyHistory['23'].filter((entry) => entry.reason === 'weekly_mission').length, 1);
  assert.equal(requests.some((request) => request.url === '/api/shared-settings'), false);

  await fs.writeFile('.omo/evidence/canvas-library/task-6-client-route.json', JSON.stringify({
    geometry,
    position: await position(),
    persisted: {
      bookId: savedBook.id,
      slot: savedBook.librarySlot,
      bookCount: persisted.studentLife.books.length,
      legacyPreserved: persisted.studentLife.books.some((book) => book.id === 'legacy-own-23'),
      balance: persisted.currencyBalances['23'],
      rewardEntries: persisted.currencyHistory['23'].filter((entry) => entry.reason === 'weekly_mission').length,
    },
    requests,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
