import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryAudio } from './canvasLibraryAudio';

class FakeParam {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = new FakeParam();
  playbackRate = new FakeParam();
  type = '';
  buffer: unknown;
  active = false;
  disconnected = false;
  onended: (() => void) | null = null;
  connect() {}
  disconnect() { this.disconnected = true; }
  start() { this.active = true; }
  stop(time?: number) { if (time === undefined) this.active = false; }
  finish() { this.active = false; this.onended?.(); }
}

class FakeContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 1000;
  destination = new FakeNode();
  sources: FakeNode[] = [];
  nodes: FakeNode[] = [];
  resumeCount = 0;
  closeCount = 0;
  async resume() { this.resumeCount += 1; this.state = 'running'; }
  async close() { this.closeCount += 1; this.state = 'closed'; }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createGain() { const node = new FakeNode(); this.nodes.push(node); return node; }
  createBiquadFilter() { return this.createGain(); }
  createBufferSource() { const node = this.createGain(); this.sources.push(node); return node; }
  createOscillator() { return this.createBufferSource(); }
}

const setup = () => {
  const context = new FakeContext();
  const audio = createLibraryAudio(() => context as unknown as AudioContext);
  return { context, audio };
};

test('library audio creates no voices and cannot resume until enabled and unlocked by caller', async () => {
  const { context, audio } = setup();
  await audio.unlock();
  audio.play('receive');
  assert.equal(context.resumeCount, 0);
  audio.setEnabled(true);
  audio.play('receive');
  assert.equal(context.sources.length, 0);
  await audio.unlock();
  audio.play('receive');
  assert.equal(context.resumeCount, 1);
  assert.equal(context.sources.length, 2);
  context.state = 'suspended';
  context.currentTime = 1;
  audio.play('place');
  assert.equal(context.resumeCount, 1);
  assert.equal(context.sources.length, 2);
  audio.dispose();
});

test('library audio throttles rapid footsteps and caps simultaneous voices', async () => {
  const { context, audio } = setup();
  audio.setEnabled(true);
  await audio.unlock();
  for (let index = 0; index < 20; index += 1) audio.play('footstep');
  assert.equal(context.sources.length, 1);
  for (let index = 1; index < 20; index += 1) {
    context.currentTime = index * 0.28;
    audio.play('place');
    assert.ok(context.sources.filter(source => source.active).length <= 4);
  }
  audio.dispose();
  assert.ok(context.nodes.every(node => node.disconnected));
});

test('pause and mute immediately release playing nodes and reject subsequent cues', async () => {
  const { context, audio } = setup();
  audio.setEnabled(true);
  await audio.unlock();
  audio.play('receive');
  audio.setPaused(true);
  assert.ok(context.sources.every(source => !source.active));
  const count = context.sources.length;
  audio.play('place');
  await audio.unlock();
  assert.equal(context.sources.length, count);
  audio.setPaused(false);
  audio.play('page');
  assert.equal(context.sources.length, count + 1);
  audio.setEnabled(false);
  assert.ok(context.nodes.every(node => node.disconnected));
  audio.play('footstep');
  assert.equal(context.sources.length, count + 1);
  audio.dispose();
});

test('completed voices disconnect their nodes and disposal closes context once', async () => {
  const { context, audio } = setup();
  audio.setEnabled(true);
  await audio.unlock();
  audio.play('receive');
  for (const source of context.sources) source.finish();
  assert.ok(context.nodes.every(node => node.disconnected));
  audio.dispose();
  audio.dispose();
  await audio.unlock();
  audio.play('page');
  assert.equal(context.closeCount, 1);
  assert.equal(context.sources.length, 2);
});

test('unsupported or rejected audio stays nonfatal', async () => {
  const unsupported = createLibraryAudio(() => { throw new Error('unavailable'); });
  unsupported.setEnabled(true);
  await assert.doesNotReject(unsupported.unlock());
  assert.doesNotThrow(() => unsupported.play('receive'));
  unsupported.dispose();
  const { audio, context } = setup();
  context.resume = async () => { throw new Error('gesture required'); };
  audio.setEnabled(true);
  await assert.doesNotReject(audio.unlock());
  assert.doesNotThrow(() => audio.play('place'));
  assert.equal(context.sources.length, 0);
  audio.dispose();
});
