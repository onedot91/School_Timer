import assert from 'node:assert/strict';
import test from 'node:test';

import { claimClasswordReward } from '../server/classwordRepository.js';

test('ㄱㄴㄷ 게임 보상은 낱말을 등록한 날짜를 중복 방지 키로 사용한다', async () => {
  // Given
  const originalFetch = globalThis.fetch;
  let requestBody = '';
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    return Response.json({
      missionType: 'classword_word_entry',
      weekKey: '2026-08-30',
      completed: true,
      awarded: true,
      rewardAmount: 5,
      balance: 105,
    });
  };

  try {
    // When
    await claimClasswordReward(
      { url: 'https://example.supabase.co', key: 'service-role-key' },
      {
        studentNumber: 6,
        entryId: 'entry-2026-08-30-6',
        dateKey: '2026-08-30',
      },
    );

    // Then
    assert.equal(JSON.parse(requestBody).p_week_key, '2026-08-30');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
