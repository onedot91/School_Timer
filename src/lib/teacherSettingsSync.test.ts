import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('교사 화면은 변경 시각이 달라졌을 때만 전체 공유 설정을 다시 받는다', async () => {
  const source = await readFile(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const syncStart = source.indexOf('const syncSharedSettingsFromRemote = async () => {');
  const syncEnd = source.indexOf('const intervalId = window.setInterval', syncStart);
  const syncSource = source.slice(syncStart, syncEnd);
  const metadataRead = syncSource.indexOf('await loadSharedSettingsUpdatedAt()');
  const unchangedGuard = syncSource.indexOf('remoteUpdatedAt === lastSharedSettingsUpdatedAtRef.current');
  const fullRead = syncSource.indexOf('await loadSharedSettingsRow()');

  assert.ok(syncStart >= 0);
  assert.ok(syncEnd > syncStart);
  assert.ok(metadataRead >= 0);
  assert.ok(unchangedGuard > metadataRead);
  assert.ok(fullRead > unchangedGuard);
});
