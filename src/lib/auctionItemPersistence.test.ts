import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAcknowledgedTeacherChanges, createTeacherSettingsChanges } from './teacherStorageCommand.js';
import { normalizeAuctionItems } from './currency.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const saveStart = source.indexOf('if (!isSupabaseSettingsEnabled || !sharedSettingsHydratedRef.current) return;');
const save = source.slice(saveStart, source.indexOf('const syncSharedSettingsFromRemote', saveStart));

test('물품 이름 자동 저장은 입력창 포커스를 옮길 때까지 대기하지 않는다', () => {
  assert.doesNotMatch(save, /isEditingAuctionItemRef\.current/);
  const begin = source.slice(source.indexOf('const beginAuctionItemEdit ='), source.indexOf('const endAuctionItemEdit ='));
  assert.doesNotMatch(begin, /clearTimeout/);
  assert.match(save, /!hasUnsavedAuctionItemsRef\.current/);
});

test('오래된 저장 응답은 새 물품 편집을 저장 완료로 표시하지 않는다', () => {
  assert.match(save, /auctionItemsEditVersionAtSave === auctionItemsEditVersionRef\.current/);
  assert.match(save, /JSON\.stringify\(snapshot\.auctionItems\) === JSON\.stringify\(auctionItemsRef\.current\)/);
  const failure = save.slice(save.indexOf('.catch((error)'), save.indexOf('.finally('));
  assert.match(failure, /setAuctionItemsSaveStatus\('error'\)/);
  assert.doesNotMatch(failure, /hasUnsavedAuctionItemsRef\.current = false/);
  const base = { auctionItems: [{ id: 'item-a', name: '기존 이름' }] };
  const firstEdit = { auctionItems: [{ id: 'item-a', name: '먼저 보낸 이름' }] };
  const latestEdit = { auctionItems: [{ id: 'item-a', name: '그 사이 다시 바꾼 이름' }] };
  const acknowledgedBase = applyAcknowledgedTeacherChanges(base, createTeacherSettingsChanges(base, firstEdit));
  const stillPending = createTeacherSettingsChanges(acknowledgedBase, latestEdit);
  assert.equal(stillPending.length, 1);
  assert.deepEqual(stillPending[0], { field: 'auctionItems', before: firstEdit.auctionItems, after: latestEdit.auctionItems });
  assert.deepEqual(latestEdit.auctionItems, [{ id: 'item-a', name: '그 사이 다시 바꾼 이름' }]);
});

test('미저장 물품은 원격 초기 조회와 새로고침으로 덮어쓰지 않는다', () => {
  assert.match(source, /if \(!isEditingAuctionItemRef\.current && !hasUnsavedAuctionItemsRef\.current\)/);
  const sync = source.slice(source.indexOf('const syncSharedSettingsFromRemote'), source.indexOf('const syncSharedSettingsFromRemote') + 1000);
  assert.match(sync, /hasUnsavedAuctionItemsRef\.current/);
  assert.match(source, /hasUnsavedSubjectCatalogRef\.current \|\| hasUnsavedAuctionItemsRef\.current/);
});

test('물품 재등록은 현재 사용 중인 ID를 초기화하지 않는다', () => {
  const add = source.slice(source.indexOf('const addAuctionItem ='), source.indexOf('const removeAuctionItem ='));
  assert.match(add, /find\(\(template\) => !normalizedItems\.some\(\(item\) => item\.id === template\.id\)\)/);
  assert.doesNotMatch(add, /createAuctionItemTemplate\(dayIndex, sameDayItemCount\)/);
});

test('이름을 바꾸지 않고 추가한 물품도 다시 읽으면 등록 상태를 유지한다', () => {
  const defaults = normalizeAuctionItems(null);
  assert.ok(defaults.every(item => !item.isConfigured));
  const added = defaults.map((item, index) => index === 3 ? { ...item, isConfigured: true } : item);
  const reloaded = normalizeAuctionItems(JSON.parse(JSON.stringify(added)));
  assert.equal(reloaded[3].name, defaults[3].name);
  assert.equal(reloaded[3].isConfigured, true);
  assert.equal(reloaded[4].isConfigured, undefined);
  assert.equal(normalizeAuctionItems([{ ...defaults[0], isConfigured: 'true' }])[0].isConfigured, undefined);
});

test('기본 물품 칸을 추가할 때도 저장 대상 데이터와 편집 상태를 갱신한다', () => {
  const add = source.slice(source.indexOf('const addAuctionItem ='), source.indexOf('const removeAuctionItem ='));
  const reuse = add.slice(add.indexOf('if (unusedItem)'), add.indexOf('const normalizedItems'));
  assert.match(reuse, /markAuctionItemsEdited\(\)/);
  assert.match(reuse, /setAuctionItems/);
  assert.match(reuse, /isConfigured: true/);
  assert.doesNotMatch(source, /editingNewAuctionItemIds/);
});
