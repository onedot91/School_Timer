import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const runTeacherCurrencyCommand =');
const handler = ts.transpileModule(source.slice(start, source.indexOf('  const commitCurrencyAdjustment =', start)), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
type Pending = { requestId: string; groupKey: string; delta: number };

const harness = () => {
  let pending: Pending[] = [];
  let confirmed = 0;
  let committed = 0;
  let error = '';
  let id = 0;
  const responses: { resolve: () => void; reject: () => void }[] = [];
  const queue = { current: Promise.resolve() as Promise<unknown> };
  const group = { current: '16,23' };
  const context = {
    crypto: { randomUUID: () => String(++id) }, currencyGroupKey: '16,23', currencyGroupKeyRef: group,
    teacherCommandQueueRef: queue, isSharedSettingsSavePendingRef: { current: false }, lastSharedSettingsUpdatedAtRef: { current: '' },
    setPendingGroupCurrencyAdjustments: (update: (previous: Pending[]) => Pending[]) => { pending = update(pending); },
    executeStorageCommand: () => new Promise((resolve, reject) => {
      responses.push({ resolve: () => resolve({ updatedAt: '2026-09-09', value: {} }), reject: () => reject(new Error('unconfirmed')) });
    }),
    normalizeCurrencyBalances: () => ({}), normalizeCurrencyHistory: () => ({}),
    commitCurrencyState: () => { committed += 1; },
    recordCurrencyAdjustment: (_target: string, delta: number) => { confirmed += delta; },
    setCurrencyDeductionError: (value: string) => { error = value; },
  };
  const click = runInNewContext(`${handler}\nrunTeacherCurrencyCommand`, context) as (action: string, payload: object, target: string, delta: number) => void;
  return { click: (delta: number) => click('teacher.currency.adjust', { studentNumbers: [16, 23], amount: delta }, 'group', delta),
    queue, group, responses, state: () => ({ pending, confirmed, committed, error }) };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('queued group clicks display immediately while balances wait for confirmation', async () => {
  const h = harness();
  h.click(1); h.click(1); h.click(-1);
  assert.equal(h.state().pending.reduce((sum, entry) => sum + entry.delta, 0), 1);
  assert.equal(h.state().confirmed, 0);
  assert.equal(h.state().committed, 0);
  for (let i = 0; i < 3; i += 1) {
    await tick();
    assert.equal(h.responses.length, i + 1);
    h.responses[i].resolve();
  }
  await h.queue.current;
  assert.equal(h.state().pending.length, 0);
  assert.equal(h.state().confirmed, 1);
  assert.equal(h.state().committed, 3);
});

test('unconfirmed saves remove the pending display without claiming a balance change', async () => {
  const h = harness(); h.click(1); await tick(); h.responses[0].reject();
  await assert.rejects(h.queue.current);
  assert.equal(h.state().pending.length, 0);
  assert.equal(h.state().committed, 0);
  assert.equal(h.state().confirmed, 0);
  assert.match(h.state().error, /저장 결과를 확인하지 못/);
});

test('old group confirmation does not change the new group summary', async () => {
  const h = harness(); h.click(1); h.group.current = '1,2';
  await tick(); h.responses[0].resolve(); await h.queue.current;
  assert.equal(h.state().confirmed, 0);
  assert.equal(h.state().committed, 1);
  assert.equal(h.state().pending.length, 0);
});

test('feedback latency does not include a delayed storage response', async (t) => {
  const h = harness();
  const startedAt = performance.now();
  h.click(1);
  assert.equal(h.state().pending.length, 1);
  const feedbackMs = performance.now() - startedAt;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(h.state().confirmed, 0);
  h.responses[0].resolve();
  await h.queue.current;
  const confirmationMs = performance.now() - startedAt;
  assert.ok(feedbackMs < confirmationMs);
  t.diagnostic(`Immediate feedback: ${feedbackMs.toFixed(2)}ms; server-confirmed feedback: ${confirmationMs.toFixed(2)}ms (150ms simulated storage delay).`);
});
