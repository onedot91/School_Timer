import { mkdir, writeFile } from 'node:fs/promises';

const evidenceDirectory = new URL('./', import.meta.url);
await mkdir(evidenceDirectory, { recursive: true });
const targets = await fetch('http://127.0.0.1:9334/json/list').then((response) => response.json());
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

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.navigate', { url: 'http://127.0.0.1:3210/' });
await wait(900);
await evaluate(`localStorage.clear(); localStorage.setItem('school-timer-entry-number-v1', '1'); location.href = 'http://127.0.0.1:3210/#student-store-shop'`);
await wait(6000);

const screenshot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
  clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
});
await writeFile(new URL('onboarding-layout-current-1280.png', evidenceDirectory), Buffer.from(screenshot.data, 'base64'));

const evidence = await evaluate(`JSON.stringify({
  viewport: [window.innerWidth, window.innerHeight],
  document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  tablists: document.querySelectorAll('[role="tablist"]').length,
  visibleTabs: Array.from(document.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim()),
  onboardingRect: (() => { const rect = document.querySelector('.student-profile-shop')?.getBoundingClientRect(); return rect ? [rect.x, rect.y, rect.width, rect.height] : null; })(),
  actionRect: (() => { const rect = document.querySelector('.student-profile-onboarding-action')?.getBoundingClientRect(); return rect ? [rect.x, rect.y, rect.width, rect.height] : null; })(),
  copy: document.querySelector('.student-profile-onboarding')?.textContent?.replace(/\\s+/g, ' ').trim(),
  page: [location.href, document.title, document.querySelector('#root')?.childElementCount],
})`);
console.log(evidence.result.value);
socket.close();
