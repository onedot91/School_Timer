import assert from 'node:assert/strict';
import test from 'node:test';
import { CLASSWORD_INITIALS, validateClasswordWord } from './classword';
import {
  CLASSWORD_BROAD_TOPICS_START, CLASSWORD_TOPICS_V1, CLASSWORD_TOPICS_V2,
  getClasswordTopicCatalog, getClasswordTopicCandidates, getElapsedClasswordTopics,
  resolveClasswordTopic,
} from './classwordTopics';

test('선별한 주제는 개수를 채우지 않고 고유 주제와 유효한 초성 예시를 갖는다', () => {
  assert.ok(CLASSWORD_TOPICS_V2.length > 0 && CLASSWORD_TOPICS_V2.length < 300);
  assert.equal(new Set(CLASSWORD_TOPICS_V2.map(topic => topic.id)).size, CLASSWORD_TOPICS_V2.length);
  assert.equal(new Set(CLASSWORD_TOPICS_V2.map(topic => topic.title.replace(/\s/g, ''))).size, CLASSWORD_TOPICS_V2.length);
  for (const topic of CLASSWORD_TOPICS_V2) {
    assert.match(topic.id, /^(school|nature|life)-v2-\d{3}$/);
    assert.ok(topic.title.length <= 40, topic.title);
    assert.equal(topic.examples.length, 14, topic.title);
    assert.equal(new Set(topic.examples).size, 14, topic.title);
    CLASSWORD_INITIALS.forEach((initial, index) => {
      assert.equal(validateClasswordWord(topic.examples[index], initial, topic.title).ok, true,
        `${topic.title}: ${initial} / ${topic.examples[index]}`);
    });
  }
});

test('절차형·모호한 주제를 자동 배정과 추천에 재사용하지 않는다', () => {
  const narrowTopic = '셀프 세차장에서 자동차를 씻기';
  assert.ok(CLASSWORD_TOPICS_V1.some(topic => topic.title === narrowTopic), '게시된 원본은 보존합니다.');
  assert.ok(CLASSWORD_TOPICS_V2.every(topic => topic.title !== narrowTopic));
  const first = resolveClasswordTopic(CLASSWORD_BROAD_TOPICS_START, '');
  assert.ok(CLASSWORD_TOPICS_V2.some(topic => topic.title === first.topic));
  assert.deepEqual(getElapsedClasswordTopics(CLASSWORD_BROAD_TOPICS_START), [first.topic]);
  const candidates = getClasswordTopicCandidates([first.topic], CLASSWORD_BROAD_TOPICS_START);
  assert.equal(candidates.length, CLASSWORD_TOPICS_V2.length - 1);
  assert.ok(!candidates.includes(first.topic));
  assert.ok(!candidates.includes(narrowTopic));
  for (const excluded of ['게임 속 세상', '상상 속 세상', '주인공의 성격과 태도', '꿈과 목표', '질문과 호기심']) {
    assert.ok(CLASSWORD_TOPICS_V2.every(topic => topic.title !== excluded), excluded);
    assert.ok(!candidates.includes(excluded), excluded);
  }
});

test('개정판의 의미 분류는 다음 주제와 순환 경계에서도 연속되지 않는다', () => {
  CLASSWORD_TOPICS_V2.forEach((topic, index) => {
    assert.notEqual(topic.family, CLASSWORD_TOPICS_V2[(index + 1) % CLASSWORD_TOPICS_V2.length].family, topic.title);
  });
});

test('적용일 이전 카탈로그와 교사 직접 설정은 개정판으로 덮어쓰지 않는다', () => {
  assert.equal(getClasswordTopicCatalog('2026-09-06'), CLASSWORD_TOPICS_V1);
  assert.equal(getClasswordTopicCatalog('2026-09-07'), CLASSWORD_TOPICS_V2);
  assert.deepEqual(resolveClasswordTopic('2026-09-04', ''), { topic: '', source: 'automatic' });
  assert.deepEqual(resolveClasswordTopic('2026-09-07', ' 선생님이 정한 주제 '), {
    topic: '선생님이 정한 주제', source: 'teacher',
  });
});
