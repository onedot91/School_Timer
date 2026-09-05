import { chromium } from '/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';

const outputDirectory = new URL('./', import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let blockedRequestCount = 0;
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) {
    await route.continue();
    return;
  }
  blockedRequestCount += 1;
  await route.abort();
});

const states = {};
for (const mode of ['empty', 'carry', 'placed', 'reduced']) {
  const query = mode === 'empty' ? '' : `?mode=${mode}`;
  await page.goto(`http://127.0.0.1:3022/render-preview.html${query}`, { waitUntil: 'networkidle' });
  const canvas = page.locator('canvas');
  await canvas.screenshot({ path: new URL(`render-${mode}.png`, outputDirectory).pathname });
  states[mode] = await canvas.evaluate(async (element) => {
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas context missing');
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let opaquePixels = 0;
    let blackPixels = 0;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0) opaquePixels += 1;
      if (pixels[index] === 0 && pixels[index + 1] === 0 && pixels[index + 2] === 0 && pixels[index + 3] > 0) blackPixels += 1;
      if (pixels[index + 3] > 0) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
    }
    const box = element.getBoundingClientRect();
    const firstFrame = element.toDataURL();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const stableAfter250Ms = firstFrame === element.toDataURL();
    return {
      intrinsic: [element.width, element.height],
      css: [box.width, box.height],
      opaquePixels,
      blackPixels,
      distinctColors: colors.size,
      stableAfter250Ms,
      documentOverflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
    };
  });
}

const receipt = { viewport: [1280, 800], blockedRequestCount, states };
await fs.writeFile(new URL('render-preview.json', outputDirectory), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
await browser.close();
