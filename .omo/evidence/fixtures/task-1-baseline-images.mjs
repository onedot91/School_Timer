import { readFile, stat, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const parsePng = (buffer, assert) => {
  assert(buffer.subarray(0, 8).equals(signature), 'PNG signature is invalid');
  let offset = 8; let width; let height; let bitDepth; let colorType; const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length); offset += 12 + length;
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
  }
  assert(bitDepth === 8 && (colorType === 2 || colorType === 6), `unsupported PNG encoding bitDepth=${bitDepth} colorType=${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat)); const stride = width * channels; const pixels = Buffer.alloc(stride * height); let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src++]; const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[src++]; const left = x >= channels ? pixels[rowStart + x - channels] : 0; const up = y > 0 ? pixels[rowStart + x - stride] : 0; const upLeft = y > 0 && x >= channels ? pixels[rowStart + x - stride - channels] : 0;
      if (filter === 0) pixels[rowStart + x] = value;
      else if (filter === 1) pixels[rowStart + x] = (value + left) & 255;
      else if (filter === 2) pixels[rowStart + x] = (value + up) & 255;
      else if (filter === 3) pixels[rowStart + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) { const p = left + up - upLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft); pixels[rowStart + x] = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255; }
      else throw new Error(`unsupported PNG filter ${filter}`);
    }
  }
  return { width, height, channels, pixels };
};

const largestBlackComponent = ({ width, height, channels, pixels }) => {
  const size = width * height; const seen = new Uint8Array(size); const queue = new Int32Array(size); let largest = 0;
  const black = (index) => { const pixel = index * channels; return pixels[pixel] <= 5 && pixels[pixel + 1] <= 5 && pixels[pixel + 2] <= 5 && (channels === 3 || pixels[pixel + 3] >= 250); };
  for (let i = 0; i < size; i += 1) {
    if (seen[i] || !black(i)) continue;
    let head = 0; let tail = 0; queue[tail++] = i; seen[i] = 1;
    while (head < tail) { const current = queue[head++]; const x = current % width; const candidates = [current - width, current + width, x > 0 ? current - 1 : -1, x + 1 < width ? current + 1 : -1]; for (const next of candidates) { if (next >= 0 && next < size && !seen[next] && black(next)) { seen[next] = 1; queue[tail++] = next; } } }
    largest = Math.max(largest, tail);
  }
  return largest;
};

export const createCapture = ({ screenshotDir, viewports, assert }) => {
  const capture = async (page, id, viewport, caseRecord) => {
    await page.setViewportSize(viewport);
    const screenshot = await page.screenshot({ fullPage: false });
    const file = `${id}-${viewport.width}x${viewport.height}.png`; const output = path.join(screenshotDir, file);
    await writeFile(output, screenshot);
    const decoded = parsePng(screenshot, assert);
    assert(decoded.width === viewport.width && decoded.height === viewport.height, `${file} has wrong dimensions`);
    const bytes = (await stat(output)).size;
    assert(bytes > 0, `${file} is empty`);
    const overflow = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > window.innerWidth, scrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
    assert(!overflow.horizontal, `${id} has horizontal overflow at ${viewport.width}`);
    const audit = { file: `screenshots/${file}`, bytes, dimensions: { width: decoded.width, height: decoded.height }, overflow };
    if (id === 'auction-selected' && viewport.width === 390) { audit.largestOpaqueBlackComponentPixels = largestBlackComponent(decoded); assert(audit.largestOpaqueBlackComponentPixels < 8000, `${file} has black-block anomaly (${audit.largestOpaqueBlackComponentPixels} pixels)`); }
    caseRecord.captures.push(audit);
  };
  return { captureBoth: async (page, id, caseRecord) => { for (const viewport of viewports) await capture(page, id, viewport, caseRecord); }, verifyRequired: async (names, results) => {
    for (const file of names) { const output = path.join(screenshotDir, file); const bytes = (await stat(output)).size; const decoded = parsePng(await readFile(output), assert); assert(bytes > 0, `${file} is empty after matrix`); const [width, height] = file.match(/(1440x900|390x844)/)[1].split('x').map(Number); assert(decoded.width === width && decoded.height === height, `${file} final dimension mismatch`); results.pngAudit.push({ file: `screenshots/${file}`, bytes, width: decoded.width, height: decoded.height }); }
  } };
};
