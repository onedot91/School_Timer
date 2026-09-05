import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const repoRoot = new URL('../../../', import.meta.url).pathname;
const evidenceDir = new URL('./', import.meta.url).pathname;
const url = 'http://127.0.0.1:3020/.omo/evidence/canvas-library/baseline.html';
const viewport = { width: 1280, height: 800 };
const sourcePaths = [
  'src/components/student/StudentLibraryPage.tsx',
  'src/lib/studentLife.ts',
  'src/index.css',
];

await mkdir(evidenceDir, { recursive: true });

const sha256 = (relativePath) => createHash('sha256')
  .update(readFileSync(`${repoRoot}${relativePath}`))
  .digest('hex');
const sourceSha256 = Object.fromEntries(sourcePaths.map((relativePath) => [relativePath, sha256(relativePath)]));
const BASELINE_BOOK = {
  id: 'qa-baseline',
  studentNumber: 1,
  title: '달빛 우체국',
  author: '김별',
  pageCount: 80,
  createdAt: '2026-09-05T00:00:00.000Z',
  colorIndex: 0,
};

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3020', '--strictPort'], {
  cwd: repoRoot,
  env: { ...process.env, VITE_DATA_MODE: 'mock', VITE_DISABLE_REACT_DEVTOOLS: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

const cleanup = async () => {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    wait(2000),
  ]);
};
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });

const pageReady = async (page) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await wait(250);
  }
  throw new Error(`Vite did not become ready: ${serverOutput}`);
};

let browser;
let context;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const blockedRequests = [];
  await context.route('**/*', async (route) => {
  const requestUrl = new URL(route.request().url());
  const isLocal = requestUrl.hostname === '127.0.0.1' && requestUrl.port === '3020';
  const isApi = requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/');
  if (!isLocal || isApi) {
    blockedRequests.push({ url: requestUrl.href, reason: isApi ? 'api' : 'non-local' });
    await route.abort();
    return;
  }
  await route.continue();
  });
  const page = await context.newPage();
  await pageReady(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-qa-fixture="canvas-library-baseline"]').waitFor();
  if (await page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`) !== '1280x800') {
    throw new Error('Viewport assertion failed: expected 1280x800');
  }

const initialBookshelfCount = await page.locator('.student-book-stack article').count();
const initialText = await page.locator('.student-library-view').innerText();
await page.screenshot({ path: `${evidenceDir}baseline.png`, fullPage: false });

const title = page.getByRole('textbox', { name: '책 제목' });
const author = page.getByRole('textbox', { name: '글쓴이' });
const pages = page.getByRole('spinbutton', { name: '쪽수' });
await title.fill('별빛 도서관');
await author.fill('김하늘');
await pages.fill('120');
await page.getByRole('button', { name: '책 쌓기' }).click();
const dialog = page.getByRole('dialog');
await dialog.waitFor();
const confirmationText = await dialog.innerText();
const countBeforeConfirm = await page.locator('.student-book-stack article').count();
await dialog.getByRole('button', { name: '취소' }).click();
const cancelDialogVisible = await dialog.count();
const countAfterCancel = await page.locator('.student-book-stack article').count();
await page.getByRole('button', { name: '책 쌓기' }).click();
await page.getByRole('dialog').getByRole('button', { name: '책 쌓기' }).click();
await page.locator('article[title^="별빛 도서관"]').waitFor();
const countAfterConfirm = await page.locator('.student-book-stack article').count();
const addedBookText = await page.locator('article[title^="별빛 도서관"]').innerText();

await pages.fill('0');
const invalidSubmit = page.getByRole('button', { name: '책 쌓기' });
const invalidSubmitDisabled = await invalidSubmit.isDisabled();
const invalidDialogCount = await page.getByRole('dialog').count();
const countAfterInvalid = await page.locator('.student-book-stack article').count();

const hasCanvas = await page.locator('canvas').count();
const hasWalkableRoomText = /walkable|canvas|게임|방/.test((await page.locator('.student-library-view').innerText()).toLowerCase());
const png = readFileSync(`${evidenceDir}baseline.png`);
const pngSignature = png.subarray(0, 8).toString('hex');
const pngDimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
if (initialBookshelfCount !== 1 || !initialText.includes('달빛 우체국')) throw new Error('Baseline book not rendered');
if (!confirmationText.includes('별빛 도서관') || !confirmationText.includes('김하늘') || !confirmationText.includes('120쪽')) throw new Error('Confirmation content mismatch');
if (cancelDialogVisible !== 0 || countBeforeConfirm !== 1 || countAfterCancel !== 1) throw new Error('Cancel changed bookshelf or left dialog open');
if (countAfterConfirm !== 2 || !addedBookText.includes('별빛 도서관') || !addedBookText.includes('120쪽')) throw new Error('Confirm did not add exactly one book');
if (!invalidSubmitDisabled || invalidDialogCount !== 0 || countAfterInvalid !== 2) throw new Error('Invalid page zero was accepted');
if (hasCanvas !== 0 || hasWalkableRoomText) throw new Error('Canvas room unexpectedly present in baseline');
if (pngSignature !== '89504e470d0a1a0a' || pngDimensions.width !== 1280 || pngDimensions.height !== 800 || statSync(`${evidenceDir}baseline.png`).size === 0) throw new Error('Invalid screenshot artifact');
if (blockedRequests.some(({ reason }) => reason !== 'api' && reason !== 'non-local')) throw new Error('Unexpected request block reason');
const result = {
  generatedAt: new Date().toISOString(),
  url,
  viewport,
  sourceSha256,
  fixture: {
    baselineBook: BASELINE_BOOK,
    initialBookshelfCount,
    initialHasBaselineTitle: initialText.includes('달빛 우체국'),
    confirmationText,
    countBeforeConfirm,
    cancelDialogVisible,
    countAfterCancel,
    countAfterConfirm,
    addedBookText,
    invalidPageZero: { dialogCount: invalidDialogCount, bookshelfCount: countAfterInvalid },
  },
  absentCanvasRed: { canvasCount: hasCanvas, walkableRoomTextPresent: hasWalkableRoomText },
  blockedRequests,
  server: { pid: server.pid, port: 3020, command: `${process.execPath} node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3020 --strictPort` },
  browser: { engine: 'Playwright Chromium API', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', context: 'isolated, closed in finally' },
  screenshot: {
    path: `${evidenceDir}baseline.png`,
    bytes: statSync(`${evidenceDir}baseline.png`).size,
    signature: pngSignature,
    dimensions: pngDimensions,
  },
};
await writeFile(`${evidenceDir}baseline.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  await cleanup();
}
