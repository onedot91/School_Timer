import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { ScriptTarget, transpileModule } from 'typescript';
import { normalizeAuctionItems } from './currency.js';
import { classifySaveFailure } from './saveFailure.js';
import { StorageCommandError } from './storageCommandClient.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const removeAuctionItem =');
const end = source.indexOf('  const completeWeeklyAuctionCycle =', start);
const callbackSource = transpileModule(source.slice(start, end) + '\nremoveAuctionItem;', {
  compilerOptions: { target: ScriptTarget.ES2022 },
}).outputText;

const fixture = () => {
  const items = normalizeAuctionItems([
    { id: 'item-a', dayIndex: 0, name: '공책' },
    { id: 'item-b', dayIndex: 1, name: '연필' },
  ]);
  const requests: unknown[] = [];
  let finish: ((result: { value: null; updatedAt: string }) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  const response = new Promise<{ value: null; updatedAt: string }>((resolve, reject) => { finish = resolve; fail = reject; });
  const state = {
    items, status: 'idle', error: '', removing: false, saveVersion: 0,
    auctionItemsRef: { current: items },
    teacherSettingsSavingRef: { current: false },
    hasUnsavedAuctionItemsRef: { current: false },
    sharedSettingsHydratedRef: { current: true },
    sharedSettingsSaveTimeoutRef: { current: null },
    isSharedSettingsSavePendingRef: { current: false },
    teacherSettingsBaseRef: { current: { auctionItems: items } },
    teacherSettingsPersistedBaseRef: { current: { auctionItems: items } },
  };
  const callback: unknown = runInNewContext(callbackSource, {
    ...state, auctionItems: items, isSupabaseSettingsEnabled: true,
    crypto, normalizeAuctionItems, classifySaveFailure, StorageCommandError,
    executeStorageCommand: (request: unknown) => { requests.push(request); return response; },
    setAuctionItems: (update: (current: typeof items) => typeof items) => { state.items = update(state.items); },
    setAuctionItemsSaveStatus: (value: string) => { state.status = value; },
    setAuctionItemsSaveErrorCode: (value: string) => { state.error = value; },
    setIsRemovingAuctionItem: (value: boolean) => { state.removing = value; },
    setTeacherSettingsSaveVersion: (update: (value: number) => number) => { state.saveVersion = update(state.saveVersion); },
    window: { clearTimeout: () => undefined },
  });
  return {
    state, requests,
    remove: () => { if (typeof callback !== 'function') throw new Error('Missing removal callback'); callback('item-a'); },
    finish: async () => { finish?.({ value: null, updatedAt: '2026-09-22T00:00:00Z' }); await new Promise(resolve => setImmediate(resolve)); },
    fail: async () => { fail?.(new StorageCommandError('AUCTION_ITEM_NOT_REMOVABLE', 409)); await new Promise(resolve => setImmediate(resolve)); },
  };
};

test('삭제 버튼 연속 클릭은 완료 전 한 요청만 보내고 오래된 클릭도 재삭제하지 않는다', async () => {
  const screen = fixture();
  screen.remove(); screen.remove(); screen.remove();
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.state.removing, true);
  assert.equal(screen.state.teacherSettingsSavingRef.current, true);
  assert.equal(screen.state.status, 'pending');
  await screen.finish();
  screen.remove();
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.state.removing, false);
  assert.equal(screen.state.teacherSettingsSavingRef.current, false);
  assert.equal(screen.state.items.length, 1);
  assert.equal(screen.state.saveVersion, 1);
});

test('새 물품 저장과 설정 저장이 끝나기 전에는 삭제 요청을 보내지 않는다', () => {
  for (const flag of ['hasUnsavedAuctionItemsRef', 'teacherSettingsSavingRef'] as const) {
    const screen = fixture();
    screen.state[flag].current = true;
    screen.remove();
    assert.equal(screen.requests.length, 0, flag);
  }
  const screen = fixture();
  screen.state.sharedSettingsHydratedRef.current = false;
  screen.remove();
  assert.equal(screen.requests.length, 0);
});

test('삭제 거절은 항목을 보존하고 실제 오류 코드를 표시한 뒤 잠금을 해제한다', async () => {
  const screen = fixture();
  screen.remove();
  await screen.fail();
  assert.equal(screen.state.items.length, 2);
  assert.equal(screen.state.error, 'AUCTION_ITEM_NOT_REMOVABLE');
  assert.equal(screen.state.status, 'error');
  assert.equal(screen.state.removing, false);
  assert.equal(screen.state.teacherSettingsSavingRef.current, false);
});

test('삭제 응답이 도착해도 그 사이 다른 물품에 입력한 변경은 저장 완료로 표시하지 않는다', async () => {
  const screen = fixture();
  screen.remove();
  screen.state.hasUnsavedAuctionItemsRef.current = true;
  screen.state.items = screen.state.items.map(item => item.id === 'item-b' ? { ...item, name: '새 이름' } : item);
  screen.state.auctionItemsRef.current = screen.state.items;
  await screen.finish();
  assert.equal(screen.state.status, 'pending');
  assert.equal(screen.state.items[0]?.name, '새 이름');
  assert.equal(screen.state.hasUnsavedAuctionItemsRef.current, true);
  assert.equal(screen.state.saveVersion, 1);
});

test('물품 삭제 불가는 정상 업무 거절이며 동시 저장 오류로 보고하지 않는다', () => {
  assert.equal(classifySaveFailure(new StorageCommandError('AUCTION_ITEM_NOT_REMOVABLE', 409)), null);
  assert.equal(classifySaveFailure(new StorageCommandError('TEACHER_SETTING_CONFLICT', 409)), 'conflict');
});
