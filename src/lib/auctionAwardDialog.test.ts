import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuctionAwardPresentationDialog, {
  AUCTION_CEREMONY_TIMING,
  getAuctionAwardReplaySteps,
  type AuctionAwardPresentation,
} from '../components/teacher/AuctionAwardPresentationDialog';
import { formatCurrency, type AuctionAward, type AuctionBidHistoryEntry } from './currency';
import { FAILURE_EMPTY_PROFILE_IMAGE, FAILURE_PROFILE_OPTIONS, type FailureProfileAssignments } from './failureExhibition';

const dialogSource = readFileSync(
  new URL('../components/teacher/AuctionAwardPresentationDialog.tsx', import.meta.url),
  'utf8',
);
const stylesheetSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const timerPageSource = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const auctionPageSource = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

const award: AuctionAward = {
  itemId: 'test-auction-lot', winner: 12, amount: 120, awardedAt: '2026-09-07T01:00:00.000Z',
};
const finalBid: AuctionBidHistoryEntry = {
  itemId: award.itemId, bidder: award.winner, amount: award.amount, createdAt: award.awardedAt,
};
const presentation: AuctionAwardPresentation = {
  item: { id: award.itemId, name: '테스트 경매 상품', startPrice: 10, dayIndex: 0 },
  weekdayLabel: '월요일', steps: [finalBid], award, currentIndex: 0,
  isComplete: false, hasFinalized: false, hasRevealed: false,
};

const renderDialog = (
  state: Partial<AuctionAwardPresentation> = {},
  hasQueuedPresentations = false,
  profileAssignments: FailureProfileAssignments = {},
) => renderToStaticMarkup(createElement(AuctionAwardPresentationDialog, {
  presentation: { ...presentation, ...state }, completedItems: [], profileAssignments,
  hasQueuedPresentations, dialogRef: createRef<HTMLDivElement>(),
  onComplete: () => {}, onRevealComplete: () => {}, onDismiss: () => {},
}));

test('마지막 호가는 긴 기록 중 실제 마지막 세 입찰만 순서대로 재생한다', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    itemId: award.itemId, bidder: index + 1, amount: (index + 1) * 10,
    createdAt: `2026-09-07T00:00:${String(index).padStart(2, '0')}.000Z`,
  }));
  const original = structuredClone(history);

  assert.deepEqual(getAuctionAwardReplaySteps(history, award), history.slice(-3));
  assert.deepEqual(history, original, '표시용 기록을 줄여도 원본 입찰 기록은 보존해야 합니다.');
});

test('입찰 기록이 없어도 확정 대상 금액을 표시하고 단일 최종 입찰은 중복하지 않는다', () => {
  assert.deepEqual(getAuctionAwardReplaySteps([], award), [finalBid]);
  assert.deepEqual(getAuctionAwardReplaySteps([finalBid], award), [finalBid]);
});

test('오래된 입찰 기록은 확정 대상의 낙찰자와 금액으로 끝난다', () => {
  const history = [20, 40, 60].map((amount, index) => ({
    itemId: award.itemId, bidder: index + 1, amount, createdAt: `2026-09-07T00:00:0${index}.000Z`,
  }));

  assert.deepEqual(getAuctionAwardReplaySteps(history, award), [...history.slice(-2), finalBid]);
  assert.deepEqual(getAuctionAwardReplaySteps([{ ...finalBid, bidder: 8 }], award), [
    { ...finalBid, bidder: 8 }, finalBid,
  ]);
});

test('다른 상품과 유효하지 않은 금액은 마지막 호가에 섞이지 않는다', () => {
  const earlier = { ...finalBid, bidder: 7, amount: 50 };
  const history = [
    earlier, { ...finalBid, itemId: 'another-lot', amount: 999 },
    { ...finalBid, amount: 0 }, { ...finalBid, amount: -5 }, finalBid,
  ];

  assert.deepEqual(getAuctionAwardReplaySteps(history, award), [earlier, finalBid]);
});

test('저장 대기 중에는 낙찰 도장과 결과 닫기를 제공하지 않는다', () => {
  const markup = renderDialog({ isComplete: true });

  assert.match(markup, /data-phase="saving"/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /낙찰을 확정하고 있어요/);
  assert.match(markup, /class="auction-ceremony-certificate" aria-hidden="true"/);
  assert.doesNotMatch(markup, /class="auction-ceremony-stamp"|aria-label="낙찰 결과 닫기"|class="auction-ceremony-confirm"/);
});

test('저장이 호가 재생보다 먼저 끝나도 호가를 건너뛰거나 도장을 찍지 않는다', () => {
  const markup = renderDialog({ hasFinalized: true });

  assert.match(markup, /data-phase="bidding"/);
  assert.match(markup, /class="auction-ceremony-certificate" aria-hidden="true"/);
  assert.doesNotMatch(markup, /class="auction-ceremony-stamp"|class="auction-ceremony-confirm"/);
  assert.match(timerPageSource, /if \(!awardPresentation \|\| awardPresentation\.hasFinalized \|\| awardPresentation\.error\) return/);
});

test('저장 성공 후 타격을 시작하고 프로필 공개가 끝나기 전에는 닫지 않는다', () => {
  const markup = renderDialog({ isComplete: true, hasFinalized: true });

  assert.match(markup, /data-phase="strike"/);
  assert.match(markup, /class="auction-ceremony-stamp"/);
  assert.match(markup, /class="auction-ceremony-certificate" aria-hidden="true"/);
  assert.doesNotMatch(markup, /aria-label="낙찰 결과 닫기"|class="auction-ceremony-confirm"/);
  assert.match(dialogSource, /if \(!presentation\.isComplete \|\| !presentation\.hasFinalized \|\| presentation\.error \|\| presentation\.hasRevealed\) return/);
});

test('화면 처리가 늦어져도 결과가 실제로 펼쳐진 뒤 공개 시간을 센다', () => {
  assert.match(dialogSource, /if \(!revealing \|\| presentation\.hasRevealed \|\| presentation\.error\) return/);
  assert.match(dialogSource, /\(\) => onRevealComplete\(key\),\s*AUCTION_CEREMONY_TIMING\.settled - AUCTION_CEREMONY_TIMING\.reveal/);
  assert.doesNotMatch(dialogSource, /setTimeout\(\(\) => onRevealComplete\(key\), AUCTION_CEREMONY_TIMING\.settled\)/);
});

test('저장 실패는 축하 결과 대신 오류와 독립적인 닫기를 제공한다', () => {
  const markup = renderDialog({ isComplete: true, error: '테스트 저장 오류' }, true);

  assert.match(markup, /data-phase="error"/);
  assert.match(markup, /테스트 저장 오류/);
  assert.match(markup, /aria-busy="false"/);
  assert.match(markup, /aria-label="낙찰 결과 닫기"/);
  assert.match(markup, /class="auction-ceremony-confirm"[^>]*>닫기<\/button>/);
  assert.doesNotMatch(markup, /class="auction-ceremony-certificate"|class="auction-ceremony-stamp"/);
});

test('공개된 소유증서는 실제 학생 프로필과 상품, 금액을 표시한다', () => {
  const assignedProfile = FAILURE_PROFILE_OPTIONS[0].imageSrc;
  const markup = renderDialog({ isComplete: true, hasFinalized: true, hasRevealed: true }, false, {
    [String(award.winner)]: assignedProfile,
  });

  assert.match(markup, /data-phase="result"/);
  assert.match(markup, /class="auction-ceremony-certificate" aria-hidden="false"/);
  assert.ok(markup.includes(`src="${assignedProfile}" alt="12번 학생 프로필"`));
  assert.ok(markup.includes(presentation.item.name));
  assert.ok(markup.includes(formatCurrency(award.amount)));
  assert.match(markup, /<strong>12번 학생<\/strong>에게/);
  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(timerPageSource, /profileAssignments=\{studentLife\.failureProfileAssignments\}/);
});

test('프로필이 없는 학생은 기존 기본 프로필로 표시한다', () => {
  const markup = renderDialog({ isComplete: true, hasFinalized: true, hasRevealed: true });

  assert.ok(markup.includes(`src="${FAILURE_EMPTY_PROFILE_IMAGE}" alt="12번 학생 프로필"`));
  assert.match(dialogSource, /getFailureProfileImage\(presentation\.award\.winner, profileAssignments\)/);
  assert.match(dialogSource, /imageFailed \? FAILURE_EMPTY_PROFILE_IMAGE : profileImage/);
});

test('공개가 끝난 마지막 낙찰은 독립 테마와 접근 가능한 닫기를 제공한다', () => {
  const markup = renderDialog({ isComplete: true, hasFinalized: true, hasRevealed: true });

  assert.match(markup, /class="auction-award-backdrop teacher-settings-theme/);
  assert.match(markup, /role="dialog" aria-modal="true" aria-labelledby="auction-award-title" aria-describedby="auction-award-status"/);
  assert.match(markup, /aria-label="낙찰 결과 닫기"/);
  assert.match(markup, /class="auction-ceremony-confirm"[^>]*>확인<\/button>/);
  assert.match(markup, /class="auction-ceremony-history-toggle" aria-expanded="false" aria-controls="auction-award-records"/);
  assert.doesNotMatch(markup, /누가 오늘의 주인공|오늘의 주인공|축하해요|이제 나의 것이에요|조금 더, 조금 더/);
  assert.match(dialogSource, /aria-label="낙찰 결과 닫기" onClick=\{onDismiss\}/);
  assert.match(dialogSource, /if \(canDismiss\) confirmRef\.current\?\.focus/);
  assert.match(timerPageSource, /isDismissible: Boolean\(awardPresentation\?\.error\) \|\| \(awardPresentation\?\.hasRevealed === true && queuedAwardItems\.length === 0\)/);
});

test('연속 낙찰은 프로필 공개 후 결과 유지 시간을 갖고 다음으로 넘어간다', () => {
  const markup = renderDialog({ isComplete: true, hasFinalized: true, hasRevealed: true }, true);

  assert.match(markup, /다음 낙찰 대기 중/);
  assert.doesNotMatch(markup, /aria-label="낙찰 결과 닫기"|class="auction-ceremony-confirm"|class="auction-ceremony-history-toggle"/);
  assert.ok(AUCTION_CEREMONY_TIMING.resultHold >= 3000);
  assert.ok(AUCTION_CEREMONY_TIMING.impact < AUCTION_CEREMONY_TIMING.reveal);
  assert.ok(AUCTION_CEREMONY_TIMING.reveal < AUCTION_CEREMONY_TIMING.settled);
  assert.match(timerPageSource, /AUCTION_AWARD_QUEUE_ADVANCE_DELAY_MS = AUCTION_CEREMONY_TIMING\.resultHold/);
  assert.match(timerPageSource, /if \(!awardPresentation\?\.hasRevealed \|\| !awardPresentation\.hasFinalized \|\| queuedAwardItems\.length === 0\) \{/);
  assert.match(timerPageSource, /Math\.max\(0, awardQueueAdvanceRef\.current\.dueAt - Date\.now\(\)\)/);
});

test('오늘 낙찰은 교사와 학생 화면에서도 학생 번호 뒤에 금액을 괄호로 표시한다', () => {
  const expectedFormat = /\{award\.winner\}번 \(\{formatCurrency\(award\.amount\)\}\)/;
  const legacyFormat = /\{award\.winner\}번 · \{formatCurrency\(award\.amount\)\}/;

  assert.match(timerPageSource, expectedFormat);
  assert.match(auctionPageSource, expectedFormat);
  assert.doesNotMatch(timerPageSource, legacyFormat);
  assert.doesNotMatch(auctionPageSource, legacyFormat);
});

test('낙찰 연출은 transform과 opacity만 애니메이션하고 호가 교체 전에 진입을 끝낸다', () => {
  const keyframes = [...stylesheetSource.matchAll(/@keyframes (auctionCeremony\w+) \{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  assert.ok(keyframes.length >= 8, '낙찰 연출의 키프레임을 검사해야 합니다.');
  for (const [, name, frames] of keyframes) {
    for (const [, property] of frames.matchAll(/([a-z-]+)\s*:/g)) {
      assert.ok(['transform', 'opacity'].includes(property), `${name}에서 ${property}를 애니메이션합니다.`);
    }
  }
  const bidDuration = stylesheetSource.match(/animation: auctionCeremonyBid (\d+)ms/);
  assert.ok(bidDuration);
  assert.ok(Number(bidDuration[1]) < AUCTION_CEREMONY_TIMING.bid);
  const ceremonyStyles = stylesheetSource.slice(stylesheetSource.indexOf('.auction-ceremony-backdrop'));
  assert.doesNotMatch(ceremonyStyles, /transition:\s*all\b/);
});

test('동작 줄이기는 호가와 저장 절차를 유지하며 경매봉과 종이 움직임을 제거한다', () => {
  assert.match(dialogSource, /useReducedMotion\(\)/);
  assert.match(dialogSource, /data-reduced-motion=\{reduceMotion\}/);
  assert.match(stylesheetSource, /\.auction-ceremony\[data-reduced-motion="true"\] \* \{ animation: none !important; transition: none !important;/);
  assert.match(stylesheetSource, /\.auction-ceremony\[data-reduced-motion="true"\] :is\(\.auction-ceremony-gavel-scene, \.auction-ceremony-paper-bits\) \{ display: none;/);
  assert.match(stylesheetSource, /@media \(prefers-reduced-motion: reduce\) \{\s*\.auction-ceremony, \.auction-ceremony \* \{ animation: none !important; transition: none !important;/);
  assert.match(stylesheetSource, /@keyframes auctionCeremonyFade \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  assert.doesNotMatch(
    timerPageSource,
    /matchMedia\('\(prefers-reduced-motion: reduce\)'\)[\s\S]*?currentIndex: prefersReducedMotion/,
  );
  assert.match(timerPageSource, /currentIndex: 0,\s*isComplete: false,\s*hasFinalized: false,\s*hasRevealed: false/);
});
