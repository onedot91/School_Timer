import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TodayFriendMissionForm from '../components/student/TodayFriendMissionForm';
import type { TodayFriendGenre } from './todayFriend';
import type { TodayFriendStudentMission } from './todayFriendState';

const createMission = (genre: TodayFriendGenre): TodayFriendStudentMission => ({
  dateKey: '2026-09-01',
  studentNumber: 3,
  partnerNumber: 14,
  genre,
  question: genre === 'interview' ? '잘하고 싶어서 연습 중인 것은 무엇인가요?' : null,
  submission: null,
});

const renderForm = (genre: TodayFriendGenre): string => renderToStaticMarkup(createElement(TodayFriendMissionForm, {
  mission: createMission(genre),
  isSaving: false,
  isPreview: true,
  onSave: async () => true,
  onSendRecommendation: async () => true,
}));

const renderEmotionWithDeclinedReason = (): string => {
  const mission = createMission('emotion');
  return renderToStaticMarkup(createElement(TodayFriendMissionForm, {
    mission: {
      ...mission,
      submission: {
        id: 'submission-1',
        dateKey: mission.dateKey,
        studentNumber: mission.studentNumber,
        partnerNumber: mission.partnerNumber,
        genre: 'emotion',
        payload: {
          kind: 'emotion',
          emotion: '차분하다',
          reason: '작성해 둔 이유',
          declinedToExplain: true,
        },
        status: 'draft',
        revision: 1,
        teacherFeedback: null,
        submittedAt: null,
        reviewedAt: null,
        rewardStatus: 'pending',
      },
    },
    isSaving: false,
    isPreview: true,
    onSave: async () => true,
    onSendRecommendation: async () => true,
  }));
};

test('오늘의 친구 다섯 섹션은 인터뷰와 같은 응답 카드 위계를 사용한다', () => {
  const expectedCardCounts: Readonly<Record<TodayFriendGenre, number>> = {
    interview: 1,
    commonality: 1,
    recommendation: 2,
    compliment: 3,
    emotion: 2,
  };

  for (const [genre, expectedCount] of Object.entries(expectedCardCounts) as [TodayFriendGenre, number][]) {
    const markup = renderForm(genre);
    assert.equal(markup.match(/today-friend-field-card/g)?.length, expectedCount, genre);
  }
});

test('추천 종류는 기본 정보 카드 안에서 네 버튼으로 바로 고른다', () => {
  const markup = renderForm('recommendation');

  assert.match(markup, /today-friend-recommendation-basics/);
  assert.doesNotMatch(markup, /<select/);
  assert.equal(markup.match(/class="today-friend-recommendation-category-option"/g)?.length, 4);
  assert.match(markup, /aria-pressed="false"[^>]*>영화<\/button>/);
  assert.match(markup, /aria-pressed="true"[^>]*>책<\/button>/);
  assert.match(markup, /aria-pressed="false"[^>]*>음악<\/button>/);
  assert.match(markup, /aria-pressed="false"[^>]*>음식<\/button>.*<input/s);
});

test('감정 찾기의 이유 입력과 비공개 선택은 하나의 응답 카드에 있다', () => {
  const markup = renderForm('emotion');
  const declinedMarkup = renderEmotionWithDeclinedReason();

  assert.match(markup, /today-friend-emotion-reason-card.*placeholder="왜 그렇게 느꼈는지 적어요\.".*today-friend-privacy-card/s);
  assert.match(markup, /today-friend-privacy-card/);
  assert.match(markup, /친구가 이유를 말하고 싶지 않았어요/);
  assert.doesNotMatch(markup, /말하고 싶지 않은 내용은 묻지 않아요/);
  assert.match(declinedMarkup, /<textarea[^>]*disabled=""[^>]*>말하고 싶지 않은 내용은 묻지 않아요\.<\/textarea>/);
  assert.doesNotMatch(declinedMarkup, /today-friend-privacy-note/);
});

test('추천하기와 감정 찾기의 모든 텍스트 입력칸은 안내 문구를 표시한다', () => {
  const recommendationMarkup = renderForm('recommendation');
  const emotionMarkup = renderForm('emotion');

  assert.match(recommendationMarkup, /placeholder="친구에게 추천할 이름을 적어요\."/);
  assert.match(recommendationMarkup, /placeholder="친구에게 추천하고 싶은 이유를 적어요\."/);
  assert.match(emotionMarkup, /placeholder="친구가 말한 감정을 적어요\."/);
  assert.match(emotionMarkup, /placeholder="왜 그렇게 느꼈는지 적어요\."/);
});

test('칭찬하기는 행동과 이유와 직접 전할 한마디를 나누어 묻는다', () => {
  const markup = renderForm('compliment');

  assert.match(markup, /어떤 행동을 칭찬하고 싶나요\?/);
  assert.match(markup, /그 행동이 왜 좋았나요\?/);
  assert.match(markup, /친구에게 전하고 싶은 한마디/);
  assert.match(markup, /today-friend-compliment-quote-control/);
  assert.match(markup, /“.*placeholder="친구에게 직접 말하듯 적어요\.".*”/s);
});
