import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentShopPage, { getVisibleStudentShopTabs } from '../components/student/StudentShopPage';
import {
  getStudentProfileGachaDeck,
  getStudentProfileGachaRevealDuration,
  getStudentProfileGachaShuffleDuration,
} from '../components/student/StudentProfileGachaDialog';
import { createStudentEconomyState } from './studentEconomy';
import { FAILURE_PROFILE_IMAGES, normalizeFailureProfileAssignments } from './failureExhibition';

test('프로필이 없는 학생 상점은 무료 랜덤 프로필만 표시한다', () => {
  assert.deepEqual(getVisibleStudentShopTabs(false), ['items']);

  const markup = renderToStaticMarkup(createElement(StudentShopPage, {
    studentNumber: 1,
    profileAssignments: normalizeFailureProfileAssignments(undefined),
    state: createStudentEconomyState(),
    availableBalance: 100,
    isSaving: false,
    onAction: async () => true,
    onSelectProfile: async () => ({ ok: true as const, profileImage: FAILURE_PROFILE_IMAGES[0], price: 0 }),
  }));

  assert.doesNotMatch(markup, /role="tablist"/);
  assert.doesNotMatch(markup, /id="student-shop-tab-items"/);
  assert.match(markup, /class="student-profile-onboarding"/);
  assert.match(markup, />무료로 뽑기<\/button>/);
  assert.match(markup, /어떤 동물이 나올지는 뽑은 뒤 확인할 수 있어요/);
  assert.match(markup, /프로필을 받으면 열려요/);
  assert.match(markup, />건축 사무소<\/span>/);
  assert.equal((markup.match(/>잠김<\/small>/g) ?? []).length, 2);
  assert.doesNotMatch(markup, />내 프로필</);
  assert.doesNotMatch(markup, />곰</);
  assert.doesNotMatch(markup, /id="student-shop-tab-(characters|houses)"/);
  assert.doesNotMatch(markup, /첫 프로필은 랜덤으로만 받을 수 있고, 한 번 무료예요/);
  assert.doesNotMatch(markup, /프로필 선택|첫 1회 무료|<strong>랜덤<\/strong>/);
  assert.doesNotMatch(markup, /student-profile-shop-groups/);
  assert.doesNotMatch(markup, />물품</);
  assert.doesNotMatch(markup, /연필|간식 쿠폰|자리 선택권/);
});

test('프로필을 받은 학생 상점은 랜덤 30고마와 직접 교체 50고마를 표시한다', () => {
  assert.deepEqual(getVisibleStudentShopTabs(true), ['items', 'characters', 'houses']);

  const markup = renderToStaticMarkup(createElement(StudentShopPage, {
    studentNumber: 1,
    profileAssignments: normalizeFailureProfileAssignments({ 1: FAILURE_PROFILE_IMAGES[0] }),
    state: createStudentEconomyState(),
    availableBalance: 100,
    isSaving: false,
    onAction: async () => true,
    onSelectProfile: async () => ({ ok: true as const, profileImage: FAILURE_PROFILE_IMAGES[1], price: 30 }),
  }));

  assert.match(markup, />랜덤 교체</);
  assert.match(markup, />30 고마</);
  assert.match(markup, />50 고마</);
  assert.match(markup, />내 프로필</);
  assert.match(markup, /role="tablist"/);
  assert.equal((markup.match(/role="tab"/g) ?? []).length, 3);
});

test('가챠 릴의 마지막 중앙 카드는 저장된 결과 프로필이고 다른 카드는 결과를 노출하지 않는다', () => {
  const profiles = FAILURE_PROFILE_IMAGES.slice(0, 12).map((imageSrc, index) => ({
    id: `profile-${index}`,
    imageSrc,
    label: `동물 ${index}`,
  }));
  const resultImage = profiles[4].imageSrc;
  const availableProfiles = profiles.filter((profile) => profile.imageSrc !== resultImage);
  const deck = getStudentProfileGachaDeck(availableProfiles, resultImage);

  assert.equal(deck.length, 12);
  assert.equal(deck[10]?.imageSrc, resultImage);
  assert.equal(deck.filter((profile) => profile.imageSrc === resultImage).length, 1);
  const sourceImages = new Set<string>(profiles.map((profile) => profile.imageSrc));
  assert.equal(deck.every((profile) => sourceImages.has(profile.imageSrc)), true);
  assert.deepEqual(deck, getStudentProfileGachaDeck(availableProfiles, resultImage));
});

test('프로필 릴은 3.2초 동안 감속하고 동작 줄이기에서는 220ms 전환으로 줄인다', () => {
  assert.equal(getStudentProfileGachaShuffleDuration(false), 3200);
  assert.equal(getStudentProfileGachaRevealDuration(false), 560);
  assert.equal(getStudentProfileGachaShuffleDuration(true), 0);
  assert.equal(getStudentProfileGachaRevealDuration(true), 220);
});
