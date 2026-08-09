const version = await fetch('http://127.0.0.1:9222/json/version').then((response) => response.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const resolver = pending.get(message.id);
  if (resolver) {
    pending.delete(message.id);
    resolver(message);
  }
};
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const target = await send('Target.createTarget', { url: 'http://127.0.0.1:3002/#student-overview' });
const attached = await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true });
const sessionId = attached.result.sessionId;
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await new Promise((resolve) => setTimeout(resolve, 1000));
await send('Runtime.evaluate', { expression: "localStorage.setItem('school-timer-entry-number-v1','1'); location.reload()" }, sessionId);
await new Promise((resolve) => setTimeout(resolve, 1800));
for (const [width, height, name] of [[1280, 900, '1280'], [768, 1024, '768'], [375, 812, '375']]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const metrics = await send('Runtime.evaluate', {
    expression: `JSON.stringify((() => { const card=document.querySelector('.student-character-stage-card'); const buttons=[...document.querySelectorAll('button')]; const r=card?.getBoundingClientRect(); return {href:location.href, viewport:[innerWidth,innerHeight], body:[document.body.scrollWidth,document.body.clientWidth], root:[document.documentElement.scrollWidth,document.documentElement.clientWidth], card:r?{x:r.x,y:r.y,width:r.width,height:r.height,children:card.children.length,text:card.textContent,background:getComputedStyle(card).backgroundImage}:null, images:[...document.images].map(i=>({alt:i.alt,src:i.getAttribute('src')})), buttons:buttons.map(b=>b.textContent?.trim()).filter(Boolean)};})())`,
    returnByValue: true,
  }, sessionId);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  const fs = await import('node:fs/promises');
  await fs.writeFile(`/private/tmp/student-overview-live-${name}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log(name, metrics.result.result.value);
}
socket.close();
