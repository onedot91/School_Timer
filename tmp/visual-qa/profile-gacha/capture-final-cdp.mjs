import { writeFile } from 'node:fs/promises';

const targets = await fetch('http://127.0.0.1:9333/json/list').then((response) => response.json());
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No Chrome page target found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = (expression) => command('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
});
const capture = async (filename) => {
  const result = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
  });
  await writeFile(new URL(filename, import.meta.url), Buffer.from(result.data, 'base64'));
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.navigate', { url: 'http://127.0.0.1:3207/' });
await wait(900);
await evaluate(`localStorage.clear(); localStorage.setItem('school-timer-entry-number-v1', '1'); location.href = 'http://127.0.0.1:3207/#student-store-shop'`);
await wait(1400);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('무료로 뽑기'))?.click()`);
await wait(500);
await capture('confirm-current-1280.png');
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('뽑기 시작'))?.click()`);
await wait(260);
await capture('saving-current-1280.png');
await wait(650);
await capture('shuffle-current-1280.png');
await wait(1900);
await capture('result-current-1280.png');
const resultEvidence = await evaluate(`JSON.stringify({
  viewport: [window.innerWidth, window.innerHeight],
  scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  busy: document.querySelector('[role="dialog"]')?.getAttribute('aria-busy'),
  focused: document.activeElement?.textContent?.trim(),
  tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim()),
  globalProgress: Boolean(document.querySelector('.student-action-progress')),
  result: document.querySelector('[role="dialog"]')?.textContent?.replace(/\\s+/g, ' ').trim(),
})`);
console.log(resultEvidence.result.value);
socket.close();
