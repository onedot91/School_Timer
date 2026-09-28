import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../components/student/StudentClasswordPage.tsx', import.meta.url), 'utf8');
const script = ts.transpileModule(source.slice(source.indexOf('  const refresh = useCallback'), source.indexOf('  const submitQuiz =')),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

const harness = (appDataMode = 'production', online = true) => {
  let now = Date.parse('2026-09-28T09:00:00+09:00'), timerId = 0;
  let today = '2026-09-28';
  const timers = new Map<number, { at: number; interval: number; run: () => void }>();
  const listeners = new Map<string, () => void>();
  const boards: unknown[] = [], quizzes: unknown[] = [];
  const boardRequests: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const quizRequests: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const navigator = { onLine: online }, document = { visibilityState: 'visible' };
  let cleanup = () => {};
  const events = {
    addEventListener: (name: string, run: () => void) => listeners.set(name, run),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const schedule = (run: () => void, delay: number, interval = 0) => {
    timers.set(++timerId, { at: now + delay, interval, run });
    return timerId;
  };
  runInNewContext(script, {
    useCallback: (callback: unknown) => callback,
    useEffect: (run: () => () => void) => { cleanup = run(); },
    window: { ...events, setTimeout: schedule, clearTimeout: (id: number) => timers.delete(id),
      setInterval: (run: () => void, delay: number) => schedule(run, delay, delay), clearInterval: (id: number) => timers.delete(id) },
    document: Object.assign(document, events), navigator,
    Date: { now: () => now, parse: Date.parse }, Math,
    dateKey: today, displayDateKey: today, studentNumber: 1, readOnly: false, appDataMode,
    getKoreanDateKey: () => today,
    readGenerationRef: { current: 0 }, boardReadSequenceRef: { current: 0 }, quizReadSequenceRef: { current: 0 },
    completionCountRef: { current: 0 },
    loadClasswordBoard: () => new Promise((resolve, reject) => boardRequests.push({ resolve, reject })),
    loadClasswordQuizStudentState: () => new Promise((resolve, reject) => quizRequests.push({ resolve, reject })),
    setBoard: (value: unknown) => boards.push(value), setQuizState: (value: unknown) => quizzes.push(value),
    setLoading: () => {}, setQuizLoading: () => {}, setFeedback: () => {}, setQuizLoadError: () => {},
    setDateKey: (value: string) => { today = value; },
    getErrorMessage: () => '조회 실패', playClasswordSound: async () => {}, CLASSWORD_LOCAL_CHANGE_EVENT: 'local-change',
  });
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  const advance = async (ms: number) => {
    const until = now + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(id);
      timer.run();
      await flush();
    }
    now = until;
    await flush();
  };
  const settle = async (index: number) => {
    boardRequests[index].resolve({ dateKey: today, entries: [] });
    quizRequests[index].resolve({ dateKey: today });
    await flush();
  };
  return { advance, settle, flush, boardRequests, quizRequests, boards, quizzes, navigator, document, timers, listeners,
    event: (name: string) => listeners.get(name)?.(), cleanup: () => cleanup() };
};

test('8초 조회 중 폴링·포커스가 요청을 겹치거나 정상 응답을 무효화하지 않는다', async () => {
  const h = harness();
  await h.advance(8_000);
  h.event('focus');
  h.event('visibilitychange');
  assert.equal(h.boardRequests.length, 1);
  assert.equal(h.quizRequests.length, 1);
  await h.settle(0);
  assert.equal(h.boards.length, 1);
  assert.equal(h.quizzes.length, 1);
  await h.advance(2_999);
  assert.equal(h.boardRequests.length, 1);
  await h.advance(1);
  assert.equal(h.boardRequests.length, 2);
  h.cleanup();
});

test('조회 중 저장 알림은 완료 후 한 번 새로 조회하며 화면 종료 뒤 응답은 적용하지 않는다', async () => {
  const h = harness();
  h.event('local-change');
  h.event('local-change');
  assert.equal(h.boardRequests.length, 1);
  await h.settle(0);
  assert.equal(h.boardRequests.length, 2);
  assert.equal(h.quizRequests.length, 2);
  h.cleanup();
  await h.settle(1);
  assert.equal(h.boards.length, 1);
  assert.equal(h.quizzes.length, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('오프라인·숨겨진 화면에서는 폴링을 멈추고 복귀하면 실패 후에도 조회를 재개한다', async () => {
  const h = harness();
  h.boardRequests[0].reject(new TypeError('synthetic network failure'));
  h.quizRequests[0].reject(new TypeError('synthetic network failure'));
  await h.flush();
  h.navigator.onLine = false;
  await h.advance(10_000);
  h.event('focus');
  assert.equal(h.boardRequests.length, 1);
  h.navigator.onLine = true;
  h.document.visibilityState = 'hidden';
  h.event('online');
  assert.equal(h.boardRequests.length, 1);
  h.document.visibilityState = 'visible';
  h.event('visibilitychange');
  assert.equal(h.boardRequests.length, 2);
  await h.settle(1);
  h.cleanup();
});

test('연습 모드는 인터넷 연결 없이 로컬 낱말판을 읽는다', async () => {
  const h = harness('mock', false);
  assert.equal(h.boardRequests.length, 1);
  await h.settle(0);
  assert.equal(h.boards.length, 1);
  await h.advance(3_000);
  assert.equal(h.boardRequests.length, 2);
  h.cleanup();
});
