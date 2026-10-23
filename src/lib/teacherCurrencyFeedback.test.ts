import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { normalizeStudentEconomyStates } from './studentEconomy.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { teacherCurrencySaveErrorMessage } from './teacherStorageClient.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const runTeacherCurrencyCommand =');
const handler = ts.transpileModule(source.slice(start, source.indexOf('  const commitCurrencyAdjustment =', start)), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
type Pending = { requestId: string; target: string; key: string; delta: number };

const harness = () => {
  let pending: Pending[] = [];
  let confirmed = 0;
  let committed = 0;
  let error = '';
  let id = 0;
  let pendingCommands = 0;
  const responses: { resolve: () => void; reject: () => void }[] = [];
  const queue = { current: Promise.resolve() as Promise<unknown> };
  const group = { current: '16,23' };
  const context = {
    crypto: { randomUUID: () => String(++id) }, performance, currencyGroupKey: '16,23', currencyGroupKeyRef: group,
    teacherCommandQueueRef: queue, isSharedSettingsSavePendingRef: { current: false }, lastSharedSettingsUpdatedAtRef: { current: '' },
    setPendingCurrencyAdjustments: (update: (previous: Pending[]) => Pending[]) => { pending = update(pending); },
    setPendingCurrencyCommandCount: (update: (previous: number) => number) => { pendingCommands = update(pendingCommands); },
    executeStorageCommand: () => new Promise((resolve, reject) => {
      responses.push({ resolve: () => resolve({ updatedAt: '2026-09-09', value: {} }), reject: () => reject(new Error('unconfirmed')) });
    }),
    normalizeCurrencyBalances: () => ({}), normalizeCurrencyHistory: () => ({}),
    normalizeStudentEconomyStates, normalizeCurrentStudentLifeState: normalizeStudentLifeState,
    setStudentEconomyStates: () => undefined, setStudentLife: () => undefined,
    setCurrencyAdjustmentSummary: () => undefined,
    commitCurrencyState: () => { committed += 1; },
    recordCurrencyAdjustment: (_target: string, delta: number) => { confirmed += delta; },
    setCurrencyDeductionError: (value: string) => { error = value; }, teacherCurrencySaveErrorMessage,
  };
  const click = runInNewContext(`${handler}\nrunTeacherCurrencyCommand`, context) as (action: string, payload: object, target: string, delta: number) => void;
  return { click: (delta: number) => click('teacher.currency.adjust', { studentNumbers: [16, 23], amount: delta }, 'group', delta),
    queue, group, responses, state: () => ({ pending, pendingCommands, confirmed, committed, error }) };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('queued group clicks display immediately while balances wait for confirmation', async () => {
  const h = harness();
  h.click(1); h.click(1); h.click(-1);
  assert.equal(h.state().pendingCommands, 3);
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
  assert.equal(h.state().pendingCommands, 0);
  assert.equal(h.state().confirmed, 1);
  assert.equal(h.state().committed, 3);
});

test('unconfirmed saves remove the pending display without claiming a balance change', async () => {
  const h = harness(); h.click(1); await tick(); h.responses[0].reject();
  await assert.rejects(h.queue.current);
  assert.equal(h.state().pending.length, 0);
  assert.equal(h.state().pendingCommands, 0);
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

const queueStart = source.indexOf('  const runTeacherCurrencyCommandRef = useRef(');
const queueCode = ts.transpileModule(source.slice(queueStart, source.indexOf('  useEffect(() => () => flushCurrencyClickBatchRef.current()', queueStart)) + '\nqueueCurrencyClick;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

test('전체 +5 스무 번은 즉시 +100 저장 중으로 보이고 멈춘 뒤 요청 한 번으로 저장된다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const commands: { payload: { studentNumbers: number[]; amount: number }; target: string; delta: number; key: string }[] = [];
  let batch: { delta: number } | null = null;
  const allStudents = Array.from({ length: 23 }, (_, index) => index + 1);
  const context = {
    useRef: (value: unknown) => ({ current: value }),
    window: { setTimeout, clearTimeout }, performance,
    runTeacherCurrencyCommand: (_action: string, payload: { studentNumbers: number[]; amount: number }, target: string, delta: number, key: string) => {
      commands.push({ payload, target, delta, key });
    },
    currencyClickBatchTimerRef: { current: null }, currencyClickBatchRef: { current: null },
    setCurrencyClickBatch: (value: { delta: number } | null) => { batch = value; },
    setCurrencyDeductionError: () => undefined,
    addTeacherCurrencyClick: (await import('./teacherCurrencyBatch.js')).addTeacherCurrencyClick,
    TEACHER_CURRENCY_BATCH_DELAY_MS: 700,
  };
  const queue = runInNewContext(queueCode, context) as (click: object) => void;
  const startedAt = performance.now();
  for (let click = 0; click < 20; click += 1) queue({ target: 'all', key: 'all', studentNumbers: allStudents, delta: 5 });
  const feedbackMs = performance.now() - startedAt;
  assert.equal(batch?.delta, 100);
  assert.equal(commands.length, 0);
  t.mock.timers.tick(699);
  assert.equal(commands.length, 0);
  t.mock.timers.tick(1);
  assert.equal(commands.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(commands[0])), { payload: { studentNumbers: allStudents, amount: 100 }, target: 'all', delta: 100, key: 'all' });
  assert.equal(batch, null);
  t.diagnostic(`20 clicks: display updated in ${feedbackMs.toFixed(2)}ms without a server round trip; storage requests 20 -> ${commands.length}.`);
});

test('차감 클릭도 즉시 표시되고 합친 금액 한 번으로 저장된다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const commands: { amount: number }[] = [];
  let batch: { delta: number } | null = null;
  const context = {
    useRef: (value: unknown) => ({ current: value }), window: { setTimeout, clearTimeout }, performance,
    runTeacherCurrencyCommand: (_action: string, payload: { amount: number }) => { commands.push(payload); },
    currencyClickBatchTimerRef: { current: null }, currencyClickBatchRef: { current: null },
    setCurrencyClickBatch: (value: { delta: number } | null) => { batch = value; }, setCurrencyDeductionError: () => undefined,
    addTeacherCurrencyClick: (await import('./teacherCurrencyBatch.js')).addTeacherCurrencyClick, TEACHER_CURRENCY_BATCH_DELAY_MS: 700,
  };
  const queue = runInNewContext(queueCode, context) as (click: object) => void;
  for (let click = 0; click < 3; click += 1) queue({ target: 'student', key: '7', studentNumbers: [7], delta: -5 });
  assert.equal(batch?.delta, -15);
  queue({ target: 'student', key: '8', studentNumbers: [8], delta: -5 });
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [{ studentNumbers: [7], amount: -15 }]);
  t.mock.timers.tick(700);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [{ studentNumbers: [7], amount: -15 }, { studentNumbers: [8], amount: -5 }]);
});
