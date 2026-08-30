import { mkdir, writeFile } from 'node:fs/promises';

const targetUrl = 'http://127.0.0.1:3211/tmp/visual-qa/profile-gacha/arcade-harness.html';
const outputDirectory = new URL('./arcade-continuity-reduced-final-3/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const targets = await fetch('http://127.0.0.1:9335/json/list').then((response) => response.json());
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No Chrome page target found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
let frameSequence = 0;
let isRecording = false;
const pending = new Map();
const frameWrites = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Page.screencastFrame') {
    if (isRecording) {
      const filename = `frame-${String(frameSequence).padStart(4, '0')}.jpg`;
      frameSequence += 1;
      frameWrites.push(writeFile(new URL(filename, outputDirectory), Buffer.from(message.params.data, 'base64')));
    }
    socket.send(JSON.stringify({ id: ++sequence, method: 'Page.screencastFrameAck', params: { sessionId: message.params.sessionId } }));
    return;
  }
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
const evaluate = (expression) => command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
const getStage = async () => {
  const result = await evaluate(`(() => {
    const outcome = document.querySelector('.student-profile-gacha-sequence');
    if (outcome?.getAttribute('data-stage') === 'revealing') return 'revealing';
    if (document.querySelector('.student-profile-gacha-processing')) return 'saving';
    if (outcome?.getAttribute('data-stage') === 'result') return 'result';
    if (document.querySelector('.student-profile-gacha-confirm')) return 'confirm';
    return 'closed';
  })()`);
  return result.result.value;
};
const waitForStage = async (stage, timeout = 7000) => {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeout) {
    if (await getStage() === stage) return;
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${stage}; current stage is ${await getStage()}.`);
};
const clickButton = async (label, timeout = 7000) => {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeout) {
    const result = await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(label)}));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (result.result.value) return true;
    await wait(50);
  }
  const buttons = await evaluate(`Array.from(document.querySelectorAll('button')).map((button) => button.textContent?.trim())`);
  throw new Error(`Timed out waiting for button ${label}; buttons=${JSON.stringify(buttons.result.value)}`);
};
const capture = async (filename) => {
  const result = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
  });
  await writeFile(new URL(filename, outputDirectory), Buffer.from(result.data, 'base64'));
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await command('Page.navigate', { url: targetUrl });
await wait(1500);
await clickButton('뽑기 시작');
await wait(1500);
await capture('02-reduced-result.png');
const evidence = await evaluate(`JSON.stringify({
  viewport: [window.innerWidth, window.innerHeight],
  document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  stage: document.querySelector('.student-profile-gacha-sequence[data-stage="result"]') ? 'result' : 'other',
  busy: document.querySelector('[role="dialog"]')?.getAttribute('aria-busy'),
  focused: document.activeElement?.textContent?.trim(),
  result: document.querySelector('[role="dialog"]')?.textContent?.replace(/\\s+/g, ' ').trim(),
  winnerTransform: getComputedStyle(document.querySelector('.student-profile-gacha-winning-frame')).transform,
  backTransform: getComputedStyle(document.querySelector('.student-profile-gacha-flip-back')).transform,
  frontTransform: getComputedStyle(document.querySelector('.student-profile-gacha-flip-front')).transform,
  reelCards: document.querySelectorAll('.student-profile-gacha-reel-card').length,
})`);
console.log(evidence.result.value);
socket.close();
