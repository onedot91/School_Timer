import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatTodayFriendCommonalities } from './todayFriend';
import {
  findTodayFriendCommonalityVisibleTraitIndex,
  findTodayFriendVisibleTrait,
  todayFriendVisibleTraitMessage,
} from './todayFriendCommonalityGuard';

test('공통점 금칙어는 성별, 학년, 나이와 겉으로 보이는 특징을 막는다', () => {
  const blocked = [
    '남자',
    '여자예요',
    '남 자',
    '여성',
    '여학생',
    '삼학년이다',
    '3학년',
    '3 학년',
    '같은 학년',
    '3반',
    '3 반',
    '삼반이다',
    '나이가 같다',
    '10살',
    '열 살',
    '동갑',
    '키가 비슷하다',
    '키 크다',
    '안경을 쓴다',
    '옷 색깔이 같다',
    '운동화를 신는다',
    '단발이다',
  ];

  assert.deepEqual(blocked.map(findTodayFriendVisibleTrait), blocked.map(() => true));
});

test('공통점 금칙어는 대화로 알게 된 내용과 비슷한 낱말을 허용한다', () => {
  const allowed = [
    '키우는 동물',
    '좋아하는 음식',
    '주말에 하는 일',
    '둘 다 떡볶이를 좋아한다',
    '강아지를 키운다',
    '나이키를 좋아한다',
    '스키를 탄다',
    '쿠키를 좋아한다',
    '좋아하는 색깔이 보라색이다',
    '이야기하는 것을 좋아한다',
    '나이스하다고 했다',
    '반찬을 좋아한다',
  ];

  assert.deepEqual(allowed.map(findTodayFriendVisibleTrait), allowed.map(() => false));
});

test('공통점 목록에서는 걸린 칸의 번호만 알려 준다', () => {
  const commonality = formatTodayFriendCommonalities([
    '떡볶이를 좋아한다',
    '3학년이다',
    '강아지를 키운다',
  ]);

  assert.equal(findTodayFriendCommonalityVisibleTraitIndex(commonality), 1);
  assert.equal(todayFriendVisibleTraitMessage(1), '두 번째 공통점은 눈으로 바로 보이는 특징이라 적을 수 없어요.');
  assert.equal(findTodayFriendCommonalityVisibleTraitIndex(formatTodayFriendCommonalities([
    '주말에 자전거를 탄다',
    '그림을 그린다',
    '고양이를 키운다',
  ])), null);
});
