import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_WRITING_PROMPTS, pickDailyWritingPrompt } from './dailyWritingPrompts.ts';

test('랜덤 글밥은 현재 주제와 다른 완성된 묶음을 고른다', () => {
  // Given
  const currentPrompt = DAILY_WRITING_PROMPTS[0];

  // When
  const pickedPrompt = pickDailyWritingPrompt(currentPrompt.topic, () => 0);

  // Then
  assert.notEqual(pickedPrompt.id, currentPrompt.id);
  assert.equal(pickedPrompt, DAILY_WRITING_PROMPTS[1]);
  assert.ok(pickedPrompt.topic.length > 0);
  assert.ok(pickedPrompt.requiredWord.length > 0);
  assert.ok(pickedPrompt.requiredWordMeaning.length > 0);
});
