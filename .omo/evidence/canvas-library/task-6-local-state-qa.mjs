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

try {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('school-timer-entry-number-v1', '23');
    localStorage.setItem('school-timer-practice-failure-stories-reset-v1', '1');
    localStorage.setItem('studentMissionVisibility-v1', JSON.stringify({ bookStack: false }));
    localStorage.setItem('school-timer-student-stock-market-v1', JSON.stringify({
      sunny: [{ dateKey: '2026-09-04', stage: 'big_rise', comment: '보존 표식: 금요일 급등' }],
      settings: { minimumAmount: 17, maximumAmount: 123, rounding: 'floor' },
    }));
    localStorage.setItem('school-timer-student-pets-v1', JSON.stringify({
      studentPets: {}, studentEconomy: {}, currencyBalances: { 23: 30 }, currencyHistory: { 23: [] },
      studentLife: { letters: [], failureStories: [], failureProfileAssignments: {}, books: [] },
      auctionItems: [], auctionBids: {}, auctionBidHistory: [], auctionAwards: {},
    }));
  });

  await page.goto(`${origin}/#student-missions`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '미션', exact: true }).waitFor();
  const readAuctionState = () => page.evaluate(() => {
    const elements = [document.querySelector('#root'), ...document.querySelectorAll('#root *')].filter(Boolean);
    let auctionFiber = null;
    for (const element of elements) {
      const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
      let fiber = fiberKey ? element[fiberKey] : null;
      while (fiber) {
        if (typeof fiber.type === 'function' && fiber.type.name === 'AuctionPage') {
          auctionFiber = fiber;
          break;
        }
        fiber = fiber.return;
      }
      if (auctionFiber) break;
    }
    if (!auctionFiber) return null;
    const values = [];
    let hook = auctionFiber.memoizedState;
    while (hook) {
      values.push(hook.memoizedState);
      hook = hook.next;
    }
    const mission = values.find((value) => value && typeof value === 'object' && value.bookStack === false && 'classword' in value);
    const stock = values.find((value) => value && typeof value === 'object' && value.settings?.minimumAmount === 17 && Array.isArray(value.sunny));
    return {
      missionBookStack: mission?.bookStack ?? null,
      stockMinimum: stock?.settings?.minimumAmount ?? null,
      stockComment: stock?.sunny?.[0]?.comment ?? null,
    };
  });
  const beforeMissionCount = await page.getByText('읽은 책 쌓기', { exact: true }).count();
  assert.equal(beforeMissionCount, 0);
  const beforeState = await readAuctionState();
  assert.deepEqual(beforeState, {
    missionBookStack: false,
    stockMinimum: 17,
    stockComment: '보존 표식: 금요일 급등',
  });

  await page.evaluate(() => { location.hash = '#student-library-bookshelf'; });
  const canvas = page.getByRole('application', { name: /우리 반 도서관/ });
  await canvas.waitFor();
  const walk = async (key, ms) => {
    await canvas.focus();
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  await walk('ArrowLeft', 1980);
  await walk('ArrowUp', 360);
  assert.equal(await canvas.getAttribute('data-nearby-target'), 'registration-desk');
  await page.keyboard.press('e');
  await page.getByRole('textbox', { name: '책 제목' }).fill('상태 보존 책');
  await page.getByRole('textbox', { name: '글쓴이' }).fill('검증자');
  await page.getByRole('textbox', { name: '쪽수' }).fill('77');
  await page.getByRole('button', { name: '책 받기' }).click();
  await walk('ArrowRight', 820);
  await walk('ArrowUp', 1800);
  await walk('ArrowLeft', 830);
  assert.equal(await canvas.getAttribute('data-nearby-target'), 'full-wide-left');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '빈자리 1', exact: true }).press('Enter');
  await page.getByText('운반 중 · 상태 보존 책').waitFor({ state: 'hidden' });

  await page.evaluate(() => { location.hash = '#student-missions'; });
  await page.getByRole('heading', { name: '미션', exact: true }).waitFor();
  const afterMissionCount = await page.getByText('읽은 책 쌓기', { exact: true }).count();
  assert.equal(afterMissionCount, 0);
  const afterState = await readAuctionState();
  assert.deepEqual(afterState, beforeState);

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('school-timer-student-pets-v1') ?? 'null'));
  const savedBook = persisted.studentLife.books.find((book) => book.title === '상태 보존 책');
  assert.equal(savedBook.librarySlot, 0);
  assert.equal(persisted.currencyBalances['23'], 40);
  const receipt = {
    before: { hiddenBookMissionCount: beforeMissionCount, ...beforeState },
    after: { hiddenBookMissionCount: afterMissionCount, ...afterState },
    placement: { bookId: savedBook.id, slot: savedBook.librarySlot, balance: persisted.currencyBalances['23'] },
  };
  await fs.writeFile('.omo/evidence/canvas-library/task-6-local-state.json', JSON.stringify(receipt, null, 2));
  await page.screenshot({ path: '.omo/evidence/canvas-library/task-6-local-state-after.png' });
} finally {
  await context.close();
  await browser.close();
}
