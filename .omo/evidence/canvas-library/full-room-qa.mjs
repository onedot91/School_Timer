import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:3026/.omo/evidence/canvas-library/full-room.html';
const outputDirectory = new URL('./', import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const errors = [];
const blockedRequests = [];

const moveFor = async (page, key, durationMs) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
};

const canvasState = async (page) => page.locator('canvas').evaluate((canvas) => ({
  intrinsic: [canvas.width, canvas.height],
  css: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height],
  player: [Number(canvas.dataset.playerX), Number(canvas.dataset.playerY)],
  target: canvas.dataset.nearbyTarget,
  overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
}));

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console:${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page:${error.message}`));
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) {
    await route.continue();
    return;
  }
  blockedRequests.push(route.request().url());
  await route.abort();
});

try {
await page.goto(`${baseUrl}?mode=empty`, { waitUntil: 'networkidle' });
await page.locator('canvas').focus();
const emptyInitial = await canvasState(page);
await page.screenshot({ path: new URL('full-room-empty.png', outputDirectory).pathname });

await moveFor(page, 'a', 1_200);
await moveFor(page, 'w', 2_180);
await moveFor(page, 'a', 860);
const emptyFirstShelf = await canvasState(page);
await page.keyboard.press('e');
const emptyPickerButtons = await page.locator('.student-canvas-library-slot-grid button').count();
await page.screenshot({ path: new URL('full-room-empty-picker.png', outputDirectory).pathname });
await page.keyboard.press('Escape');

await page.goto(`${baseUrl}?mode=full`, { waitUntil: 'networkidle' });
await page.locator('canvas').focus();
const fullInitial = await canvasState(page);
await page.screenshot({ path: new URL('full-room-100.png', outputDirectory).pathname });

await moveFor(page, 'a', 1_200);
await moveFor(page, 'w', 2_180);
await moveFor(page, 'a', 860);
const fullFirstShelf = await canvasState(page);
await page.keyboard.press('e');
const firstBookButton = page.getByRole('button', { name: '첫 번째 별빛 도서관 탐험기' });
await firstBookButton.focus();
const fullFirstPickerCaption = await page.locator('.student-canvas-library-slot-caption strong').textContent();
await page.screenshot({ path: new URL('full-room-first-picker.png', outputDirectory).pathname });
await firstBookButton.click();
await page.getByRole('dialog', { name: '첫 번째 별빛 도서관 탐험기' }).waitFor();
const firstBookVisible = await page.getByRole('heading', { name: '첫 번째 별빛 도서관 탐험기' }).isVisible();
await page.getByRole('button', { name: '책 정보 닫기' }).click();

await page.locator('canvas').focus();
await moveFor(page, 'd', 3_440);
await moveFor(page, 's', 1_480);
await moveFor(page, 'a', 640);
const fullLastShelf = await canvasState(page);
await page.keyboard.press('e');
const lastBookButton = page.getByRole('button', { name: '백 번째 책장의 아주 긴 한글 제목 확인본' });
await lastBookButton.focus();
const fullLastPickerCaption = await page.locator('.student-canvas-library-slot-caption strong').textContent();
await page.screenshot({ path: new URL('full-room-last-picker.png', outputDirectory).pathname });
await lastBookButton.click();
await page.getByRole('dialog', { name: '백 번째 책장의 아주 긴 한글 제목 확인본' }).waitFor();
const lastBookVisible = await page.getByRole('heading', { name: '백 번째 책장의 아주 긴 한글 제목 확인본' }).isVisible();
await page.screenshot({ path: new URL('full-room-last-details.png', outputDirectory).pathname });

const screenshots = [
  'full-room-empty.png',
  'full-room-empty-picker.png',
  'full-room-100.png',
  'full-room-first-picker.png',
  'full-room-last-picker.png',
  'full-room-last-details.png',
];
const screenshotSha256 = {};
for (const screenshot of screenshots) {
  const bytes = await fs.readFile(new URL(screenshot, outputDirectory));
  screenshotSha256[screenshot] = crypto.createHash('sha256').update(bytes).digest('hex');
}
const receipt = {
  viewport: [1280, 800],
  emptyInitial,
  emptyFirstShelf,
  emptyPickerButtons,
  fullInitial,
  fullFirstShelf,
  fullFirstPickerCaption,
  fullLastShelf,
  fullLastPickerCaption,
  firstBookVisible,
  lastBookVisible,
  screenshots,
  screenshotSha256,
  errors,
  blockedRequests,
};
await fs.writeFile(new URL('full-room-qa.json', outputDirectory), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
} finally {
  await browser.close();
}
