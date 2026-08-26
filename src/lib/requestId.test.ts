import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserRequestId } from './requestId.js';

test('randomUUID가 없는 브라우저도 충돌 방지 요청 ID를 만든다', () => {
  // Given
  const source = {
    fillRandomValues: (target: Uint8Array) => {
      target.set(Array.from({ length: 16 }, (_, index) => index));
    },
  };

  // When
  const requestId = createBrowserRequestId(source);

  // Then
  assert.equal(requestId, '00010203-0405-4607-8809-0a0b0c0d0e0f');
});
