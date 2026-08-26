import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionRewardInput } from '../components/teacher/MissionRewardInput';

test('미션 보상 입력은 네 개의 빠른 선택값과 현재 선택 상태를 제공한다', () => {
  // Given
  const rewardInput = createElement(MissionRewardInput, {
    missionIndex: 1,
    value: 10,
    onValueChange: () => undefined,
    onFocus: () => undefined,
    onBlur: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(rewardInput);

  // Then
  assert.deepEqual(
    [...markup.matchAll(/data-reward-preset="(\d+)"/g)].map((match) => Number(match[1])),
    [5, 10, 15, 20],
  );
  assert.equal((markup.match(/data-reward-preset="\d+"[^>]*aria-pressed="true"/g) ?? []).length, 1);
  assert.match(markup, /data-reward-preset="10"[^>]*aria-pressed="true"/);
});

test('범위 보상 입력은 최소값과 최대값을 각각 편집할 수 있다', () => {
  // Given
  const rewardInput = createElement(MissionRewardInput, {
    missionIndex: 2,
    value: [5, 20],
    onValueChange: () => undefined,
    onFocus: () => undefined,
    onBlur: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(rewardInput);

  // Then
  assert.equal((markup.match(/data-reward-bound=/g) ?? []).length, 2);
  assert.match(markup, /data-reward-mode="range"[^>]*aria-pressed="true"/);
});
