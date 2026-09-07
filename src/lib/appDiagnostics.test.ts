import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../public/app-diagnostics.js', import.meta.url), 'utf8');
type RecordItem = { time: string; version: string; category: string; asset: string | null };

function setup(initial = '[]', blocked = false) {
  let stored = initial;
  const listeners = new Map<string, (event: unknown) => void>();
  const window = {
    location: { origin: 'https://school.example' },
    localStorage: {
      getItem: () => { if (blocked) throw new Error('blocked'); return stored; },
      setItem: (_key: string, value: string) => { if (blocked) throw new Error('blocked'); stored = value; },
    },
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
    schoolStartupDiagnostics: undefined as { record: (category: string, asset?: string) => void; read: () => RecordItem[] } | undefined,
  };
  runInNewContext(source, { window, document: { querySelector: () => ({ content: '2026-09-07T07:00:00.000Z' }) }, URL, Date, Error });
  const diagnostics = window.schoolStartupDiagnostics;
  assert.ok(diagnostics);
  return { window, diagnostics, stored: () => stored, emit: (name: string, event: unknown) => listeners.get(name)?.(event) };
}

test('청크 오류는 자체 파일 경로만 기록하고 쿼리·원문·학생 정보는 보관하지 않는다', () => {
  const state = setup();
  state.emit('vite:preloadError', { payload: new Error('student-secret Failed to fetch dynamically imported module: https://school.example/assets/AuctionPage-old.js?token=private') });
  const [item] = state.diagnostics.read();
  assert.equal(item.category, 'chunk-load');
  assert.equal(item.asset, '/assets/AuctionPage-old.js');
  assert.equal(item.version, '2026-09-07T07:00:00.000Z');
  assert.doesNotMatch(state.stored(), /private|token|student-secret|message|stack/);
  state.emit('vite:preloadError', { payload: new Error('https://external.example/assets/Secret.js') });
  assert.equal(state.diagnostics.read().at(-1)?.asset, null);
});

test('초기 스크립트 실패와 실행 오류를 구별하고 이미지 오류는 제외한다', () => {
  const state = setup();
  state.emit('error', { target: { tagName: 'SCRIPT', src: 'https://school.example/assets/index-old.js' } });
  state.emit('error', { target: { tagName: 'IMG', src: '/student.png' } });
  state.emit('error', { target: state.window, filename: 'https://school.example/assets/index-new.js', message: 'private' });
  assert.deepEqual(Array.from(state.diagnostics.read(), item => item.category), ['script-load', 'runtime']);
});

test('새로고침 후 기록을 보존하고 보관 기간·개수·허용 필드를 제한한다', () => {
  const initial = JSON.stringify([
    { time: '2000-01-01T00:00:00.000Z', category: 'render' },
    { time: new Date().toISOString(), category: 'runtime', version: 'student-name', asset: '/api/device-session', studentNumber: 2, message: 'private' },
  ]);
  const state = setup(initial);
  assert.equal(state.diagnostics.read().length, 1);
  assert.doesNotMatch(state.stored(), /student|private|device-session/);
  for (let i = 0; i < 30; i++) state.diagnostics.record('script-load', `/assets/chunk-${i}.js`);
  const afterReload = setup(state.stored());
  assert.equal(afterReload.diagnostics.read().length, 20);
  assert.equal(afterReload.diagnostics.read()[0].asset, '/assets/chunk-10.js');
  afterReload.diagnostics.record('script-load', '/assets/chunk-29.js');
  assert.equal(afterReload.diagnostics.read().length, 20);
});

test('저장소 차단·손상 시에도 동작하고 허용되지 않은 분류는 무시한다', () => {
  for (const state of [setup('{broken'), setup('[]', true)]) {
    state.diagnostics.record('render');
    state.diagnostics.record('private');
    assert.equal(state.diagnostics.read().length, 1);
    state.diagnostics.read()[0].asset = 'mutated';
    assert.equal(state.diagnostics.read()[0].asset, null);
  }
});
