import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
  assert.match(save, /JSON\.stringify\(savedSnapshot\.auctionItems\) === JSON\.stringify\(auctionItemsRef\.current\)/);
  const failure = save.slice(save.indexOf('.catch((error)'), save.indexOf('.finally('));
  assert.match(failure, /setAuctionItemsSaveStatus\('error'\)/);
  assert.doesNotMatch(failure, /hasUnsavedAuctionItemsRef\.current = false/);
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
