import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const evidenceDirectory = new URL('./', import.meta.url);
const baseUrl = 'http://127.0.0.1:3039/.omo/evidence/canvas-library/full-room.html';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const errors = [];
const blockedRequests = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
page.on('pageerror', (error) => errors.push(`page:${error.message}`));
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
  blockedRequests.push(route.request().url());
  return route.abort();
});

const canvasState = async () => page.locator('canvas').evaluate((canvas) => ({
  intrinsic: [canvas.width, canvas.height],
  css: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height],
  overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
}));

const palette = [[129, 76, 73], [61, 98, 112], [79, 105, 87]];
const shelfSpecs = [
  [28, 42, 156, 62, 2, 10, 'wide-low', 0],
  [198, 42, 164, 62, 2, 10, 'wide-low', 20],
  [378, 38, 100, 66, 4, 5, 'compact', 40],
  [210, 142, 84, 104, 5, 4, 'narrow-tall', 60],
  [350, 158, 72, 94, 5, 4, 'endcap', 80],
];
const slots = shelfSpecs.flatMap(([x, y, width, height, rows, columns, variant, firstSlotId]) => {
  const horizontalInset = variant === 'wide-low' ? 12 : 9;
  const verticalInset = variant === 'wide-low' ? 9 : 13;
  const slotWidth = Math.floor((width - horizontalInset * 2 - 3 * (columns - 1)) / columns);
  const slotHeight = rows <= 2 ? (variant === 'wide-low' ? 15 : 25) : Math.floor((height - verticalInset * 2 - 4 * (rows - 1)) / rows);
  return Array.from({ length: rows * columns }, (_, index) => ({
    slotId: firstSlotId + index,
    x: x + horizontalInset + (index % columns) * (slotWidth + 3),
    y: y + verticalInset + Math.floor(index / columns) * (slotHeight + 4),
    width: slotWidth,
    height: slotHeight,
  }));
});

const expectedSpines = slots.map((slot) => {
  const heightInset = slot.slotId % 3;
  const y = Math.round(slot.y + 1 + heightInset);
  const height = Math.max(2, Math.round(slot.height - 2 - heightInset));
  const requested = Math.min(7, Math.max(3, Math.round((80 + slot.slotId * 7) / 100)));
  const width = Math.max(2, Math.min(requested, Math.max(2, Math.floor(height * 0.45)), Math.max(2, Math.round(slot.width - 2))));
  return {
    ...slot,
    slotX: slot.x,
    slotY: slot.y,
    slotWidth: slot.width,
    slotHeight: slot.height,
    x: Math.round(slot.x + (slot.width - width) / 2),
    y,
    width,
    height,
  };
});

const inspectSpines = async () => page.locator('canvas').evaluate((canvas, expected) => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context missing');
  const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = (x, y) => {
    const offset = (y * canvas.width + x) * 4;
    return [image[offset], image[offset + 1], image[offset + 2]];
  };
  const same = (left, right) => left.every((value, index) => value === right[index]);
  const checks = expected.map((spine) => {
    const colors = [[129, 76, 73], [61, 98, 112], [79, 105, 87]][spine.slotId % 3];
    const bandColors = [[199, 122, 114], [127, 168, 176], [147, 174, 131]][spine.slotId % 3];
    const pixels = [];
    for (let y = spine.y; y < spine.y + spine.height; y += 1) {
      for (let x = spine.x; x < spine.x + spine.width; x += 1) {
        if (same(rgb(x, y), colors)) pixels.push([x, y]);
      }
    }
    return {
      slotId: spine.slotId,
      width: spine.width,
      height: spine.height,
      basePixels: pixels.length,
      withinSlot: spine.x >= spine.slotX
        && spine.y >= spine.slotY
        && spine.x + spine.width <= spine.slotX + spine.slotWidth
        && spine.y + spine.height <= spine.slotY + spine.slotHeight,
      hasTopBand: same(rgb(spine.x, spine.y), bandColors),
      hasBottomBand: same(rgb(spine.x, spine.y + spine.height - 1), bandColors),
    };
  });
  return {
    count: checks.length,
    allHaveBasePixels: checks.every((check) => check.basePixels >= 1),
    allVertical: checks.every((check) => check.height > check.width),
    allWithinSlots: checks.every((check) => check.withinSlot),
    allHaveBindingBands: checks.every((check) => check.hasTopBand && check.hasBottomBand),
    maxWidth: Math.max(...checks.map((check) => check.width)),
    minWidth: Math.min(...checks.map((check) => check.width)),
    checks,
  };
}, expectedSpines);

try {
  await page.goto(`${baseUrl}?mode=empty`, { waitUntil: 'networkidle' });
  const emptyState = await canvasState();
  await page.screenshot({ path: new URL('task-6-shelf-spines-empty.png', evidenceDirectory).pathname });

  await page.goto(`${baseUrl}?mode=full`, { waitUntil: 'networkidle' });
  const fullState = await canvasState();
  const spineInspection = await inspectSpines();
  await page.screenshot({ path: new URL('task-6-shelf-spines-full-100.png', evidenceDirectory).pathname });
  const screenshots = ['task-6-shelf-spines-empty.png', 'task-6-shelf-spines-full-100.png'];
  const screenshotSha256 = Object.fromEntries(await Promise.all(screenshots.map(async (name) => [
    name,
    crypto.createHash('sha256').update(await fs.readFile(new URL(name, evidenceDirectory))).digest('hex'),
  ])));
  const receipt = {
    invocation: 'npm run dev -- --host 127.0.0.1 --port 3039; node .omo/evidence/canvas-library/task-6-shelf-spines-qa.mjs',
    viewport: [1280, 800],
    emptyState,
    fullState,
    shelves: ['full-wide-left', 'full-wide-center', 'full-compact-back', 'full-tall-island', 'full-endcap-island'],
    shelfStyles: ['wide-low', 'compact', 'narrow-tall', 'endcap'],
    mixedPageCounts: true,
    spineInspection,
    screenshots,
    screenshotSha256,
    errors,
    blockedRequests,
  };
  await fs.writeFile(new URL('task-6-shelf-spines-qa.json', evidenceDirectory), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
}
