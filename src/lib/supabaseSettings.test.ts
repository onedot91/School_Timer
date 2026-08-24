import assert from 'node:assert/strict';
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
