import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentCharacterInitialCard } from '../components/student/StudentCharacterInitialChoice';

const candidates = [
  { name: '여우 고마', imageSrc: '/goma-skins/여우 고마.png', initials: 'ㅇㅇ 고마' },
  { name: '냉장고 고마', imageSrc: '/goma-skins/refrigerator-goma.png', initials: 'ㄴㅈㄱ 고마' },
  { name: '거꾸로 고마', imageSrc: '/goma-skins/upside-down-goma.png', initials: 'ㄱㄲㄹ 고마' },
];

const renderCard = (index: number, isSelected = false, isRevealed = false, disabled = false) => renderToStaticMarkup(createElement(StudentCharacterInitialCard, {
  character: candidates[index], number: index + 1, isSelected, isRevealed, disabled, onChoose: () => undefined,
}));

test('선택 전에는 세 카드 모두 공통 실루엣을 사용하고 초성 외의 스킨 정보를 노출하지 않는다', () => {
  for (const [index, character] of candidates.entries()) {
    const markup = renderCard(index);
    assert.ok(markup.includes(`aria-label="${index + 1}번 ${character.initials}"`));
    assert.ok(markup.includes('student-gacha-initial-silhouette'));
    assert.ok(markup.includes('student-gacha-initial-question'));
    assert.ok(!markup.includes(character.name));
    assert.ok(!markup.includes(character.imageSrc));
    assert.doesNotMatch(markup, /<img|<link|mask-image|background-image|style=/);
  }
});

test('선택 처리 중에도 실제 이미지를 렌더링하지 않고 카드 조작을 잠근다', () => {
  const markup = renderCard(1, true, false, true);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /data-selected="true"/);
  assert.ok(markup.includes('2번 ㄴㅈㄱ 고마'));
  assert.ok(!markup.includes(candidates[1].name));
  assert.doesNotMatch(markup, /<img|<link/);
  assert.doesNotMatch(markup, /student-gacha-initial-burst/);
});

test('지급이 확인된 카드만 같은 무대 안에 실제 이미지와 이름을 공개한다', () => {
  const cards = candidates.map((_, index) => renderCard(index, index === 1, index === 1, true));
  assert.ok(cards[1].includes('2번 냉장고 고마, 선택됨'));
  assert.ok(cards[1].includes(`src="${candidates[1].imageSrc}"`));
  assert.match(cards[1], /data-revealed="true"/);
  assert.match(cards[1], /student-gacha-initial-art[\s\S]*<img/);
  assert.match(cards[1], /data-visible="false"/);
  assert.match(cards[1], /data-image-ready="false"/);
  assert.doesNotMatch(cards[1], /student-gacha-initial-burst/);
  for (const index of [0, 2]) {
    assert.doesNotMatch(cards[index], /<img|<link/);
    assert.ok(!cards[index].includes(candidates[index].name));
    assert.ok(!cards[index].includes(candidates[index].imageSrc));
  }
});
