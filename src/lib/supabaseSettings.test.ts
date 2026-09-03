import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canReadSharedBackend,
  canWriteSharedBackend,
  resolveAppDataMode,
} from './dataMode.ts';
import { shouldEnableSupabaseSettings } from './supabaseSettings.ts';

test('개발 모드는 요청값에 따라 연습용 또는 보기 전용으로 정해진다', () => {
  // Given
  const isProduction = false;

  // When
  const mockMode = resolveAppDataMode(isProduction, undefined);
  const readonlyMode = resolveAppDataMode(isProduction, 'readonly');

  // Then
  assert.equal(mockMode, 'mock');
  assert.equal(readonlyMode, 'readonly');
});

test('배포 빌드는 개발 환경변수와 관계없이 운영 모드를 사용한다', () => {
  // Given
  const isProduction = true;

  // When
  const mode = resolveAppDataMode(isProduction, 'readonly');

  // Then
  assert.equal(mode, 'production');
});

test('보기 전용 모드는 공유 데이터를 읽되 쓸 수 없다', () => {
  // Given
  const mode = 'readonly';

  // When
  const canRead = canReadSharedBackend(mode);
  const canWrite = canWriteSharedBackend(mode);

  // Then
  assert.equal(canRead, true);
  assert.equal(canWrite, false);
});

test('기본 개발 모드는 보안 프록시가 있어도 공유 설정을 사용하지 않는다', () => {
  // Given
  const hasSupabaseCredentials = true;

  // When
  const enabled = shouldEnableSupabaseSettings({
    hasSupabaseCredentials,
    usesServerProxy: true,
    dataMode: 'mock',
  });

  // Then
  assert.equal(enabled, false);
});

test('보기 전용 모드는 보안 프록시가 연결되면 공유 설정을 읽는다', () => {
  // Given
  const hasSupabaseCredentials = true;

  // When
  const enabled = shouldEnableSupabaseSettings({
    hasSupabaseCredentials,
    usesServerProxy: true,
    dataMode: 'readonly',
  });

  // Then
  assert.equal(enabled, true);
});

test('보안 프록시가 없으면 익명 Supabase 설정 저장을 시도하지 않는다', () => {
  // Given
  const hasSupabaseCredentials = true;

  // When
  const enabled = shouldEnableSupabaseSettings({
    hasSupabaseCredentials,
    usesServerProxy: false,
    dataMode: 'production',
  });

  // Then
  assert.equal(enabled, false);
});

test('학생 설정 변경은 투영된 읽기 결과 대신 쓰기용 전체 행을 사용한다', async () => {
  const source = await readFile(new URL('./supabaseSettings.ts', import.meta.url), 'utf8');
  const updateStart = source.indexOf('export const updateSharedSettings');
  const updateEnd = source.indexOf('\nexport const donateToClassGoal', updateStart);
  const updateSource = source.slice(updateStart, updateEnd);

  assert.match(source, /fetchJson\('\/api\/shared-settings\?full=1'\)/);
  assert.match(updateSource, /loadWritableSharedSettingsRow\(\)/);
});

test('서버 프록시 모드에서는 Supabase 브라우저 클라이언트 없이 API를 호출한다', async () => {
  const source = await readFile(new URL('./supabaseSettings.ts', import.meta.url), 'utf8');
  const functionNames = [
    'loadSharedSettingsRow',
    'loadSharedSettingsUpdatedAt',
    'saveSharedSettings',
    'updateSharedSettings',
    'donateToClassGoal',
    'loadAnnouncementNote',
    'loadAnnouncementNoteHistory',
    'saveAnnouncementNote',
  ] as const;

  functionNames.forEach((functionName) => {
    const functionStart = source.indexOf(`export const ${functionName}`);
    const functionEnd = source.indexOf('\nexport const ', functionStart + 1);
    const functionSource = source.slice(functionStart, functionEnd < 0 ? undefined : functionEnd);
    const proxyBranch = functionSource.indexOf('if (useServerProxy)');
    const browserClientGuard = functionSource.indexOf('if (!supabase)');

    assert.ok(proxyBranch >= 0, `${functionName}에 서버 프록시 분기가 있어야 합니다.`);
    assert.ok(
      browserClientGuard < 0 || proxyBranch < browserClientGuard,
      `${functionName}의 서버 프록시 분기는 브라우저 클라이언트 검사보다 먼저 실행되어야 합니다.`,
    );
  });
});
