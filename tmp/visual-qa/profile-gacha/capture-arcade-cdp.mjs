import { mkdir, writeFile } from 'node:fs/promises';

const targetUrl = 'http://127.0.0.1:3211/';
const debugUrl = 'http://127.0.0.1:9335';
const outputDirectory = new URL('./arcade-continuity-final-5/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const targets = await fetch(`${debugUrl}/json/list`).then((response) => response.json());
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
  await writeFile(new URL(filename, outputDirectory), Buffer.from(result.data, 'base64'));
};
const getStage = async () => {
  const result = await evaluate(`(() => {
    const outcome = document.querySelector('.student-profile-gacha-sequence');
    if (outcome?.getAttribute('data-stage') === 'revealing') return 'revealing';
    if (document.querySelector('.student-profile-gacha-shuffling')) return 'shuffling';
    if (document.querySelector('.student-profile-gacha-processing')) return 'saving';
    if (outcome?.getAttribute('data-stage') === 'result') return 'result';
    if (document.querySelector('.student-profile-gacha-confirm')) return 'confirm';
    return 'closed';
  })()`);
  return result.result.value;
};
const waitForStage = async (expectedStage, timeout = 5000) => {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeout) {
    if (await getStage() === expectedStage) return Date.now();
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${expectedStage}; current stage is ${await getStage()}.`);
};
const waitUntil = async (targetTime) => {
  const remaining = targetTime - Date.now();
  if (remaining > 0) await wait(remaining);
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await command('Page.navigate', { url: targetUrl });
await wait(900);
await evaluate(`localStorage.clear(); localStorage.setItem('school-timer-entry-number-v1', '1'); location.href = '${targetUrl}#student-store-shop'`);
await wait(1500);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('무료로 뽑기'))?.click()`);
await wait(350);
await capture('01-confirm.png');

await command('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });
isRecording = true;
await evaluate(`(() => {
  window.__profileGachaRevealImage = null;
  window.__profileGachaRevealAt = null;
  window.__profileGachaTimeline = [];
  window.__profileGachaStartedAt = performance.now();
  let previousStage = null;
  const observer = new MutationObserver(() => {
    const card = document.querySelector('.student-profile-gacha-flip-front');
    if (card && !card.dataset.continuityProbe) {
      card.dataset.continuityProbe = 'same-node';
      window.__profileGachaRevealImage = card.querySelector('img')?.getAttribute('src') ?? null;
      window.__profileGachaRevealAt = performance.now();
    }
    const sequenceStage = document.querySelector('.student-profile-gacha-sequence')?.getAttribute('data-stage');
    const currentStage = sequenceStage
      ?? (document.querySelector('.student-profile-gacha-processing') ? 'saving' : null)
      ?? (document.querySelector('.student-profile-gacha-confirm') ? 'confirm' : 'closed');
    if (currentStage !== previousStage) {
      previousStage = currentStage;
      window.__profileGachaTimeline.push({ at: Math.round(performance.now() - window.__profileGachaStartedAt), stage: currentStage });
    }
  });
  observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  window.__profileGachaObserver = observer;
})()`);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('뽑기 시작'))?.click()`);
await wait(4500);
await capture('05-result-settled.png');
isRecording = false;
await command('Page.stopScreencast');
await Promise.all(frameWrites);

const normalEvidence = await evaluate(`JSON.stringify({
  viewport: [window.innerWidth, window.innerHeight],
  document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  busy: document.querySelector('[role="dialog"]')?.getAttribute('aria-busy'),
  focused: document.activeElement?.textContent?.trim(),
  result: document.querySelector('[role="dialog"]')?.textContent?.replace(/\\s+/g, ' ').trim(),
  resultImage: document.querySelector('.student-profile-gacha-flip-front img')?.getAttribute('src'),
  revealImage: window.__profileGachaRevealImage,
  continuityProbe: document.querySelector('.student-profile-gacha-flip-front')?.getAttribute('data-continuity-probe'),
  reelCards: document.querySelectorAll('.student-profile-gacha-reel-card').length,
  timeline: window.__profileGachaTimeline,
})`);

console.log(JSON.stringify({
  normal: JSON.parse(normalEvidence.result.value),
  recordedFrames: frameSequence,
}));
socket.close();
