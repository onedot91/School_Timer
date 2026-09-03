import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dialogSource = readFileSync(
  new URL('../components/teacher/AuctionAwardPresentationDialog.tsx', import.meta.url),
  'utf8',
);
const stylesheetSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const timerPageSource = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const auctionPageSource = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

test('완료된 낙찰 모달은 선명한 테마와 독립적인 닫기 버튼을 제공한다', () => {
  assert.match(
    dialogSource,
    /className="auction-award-backdrop teacher-settings-theme/,
    '낙찰 모달 자체에 교사 테마 토큰이 없어 확인 버튼 배경이 투명해집니다.',
  );
  assert.match(dialogSource, /presentation\.isComplete && !hasQueuedPresentations/);
  assert.match(dialogSource, /aria-label="낙찰 결과 닫기"[\s\S]*?onClick=\{onDismiss\}/);
  assert.match(dialogSource, /onClick=\{onDismiss\}[\s\S]*?className="auction-award-confirm-button"/);
  assert.match(
    timerPageSource,
    /dialogRef: awardPresentationDialogRef,[\s\S]*?isDismissible: awardPresentation\?\.isComplete === true/,
  );
});

test('낙찰 모달은 중복 설명 없이 학생 번호와 금액을 크게 강조한다', () => {
  assert.doesNotMatch(dialogSource, />입찰 흐름</);
  assert.doesNotMatch(dialogSource, /최종 결과|최종 낙찰|현재 최고 입찰|낙찰 금액|낙찰 물품/);
  assert.doesNotMatch(dialogSource, /auction-award-step-state/);
  assert.match(dialogSource, /\{award\.winner\}번 \(\{formatCurrency\(award\.amount\)\}\)/);
  assert.match(dialogSource, /className="auction-award-result-status"/);
});

test('오늘 낙찰은 교사와 학생 화면에서도 학생 번호 뒤에 금액을 괄호로 표시한다', () => {
  const expectedFormat = /\{award\.winner\}번 \(\{formatCurrency\(award\.amount\)\}\)/;
  const legacyFormat = /\{award\.winner\}번 · \{formatCurrency\(award\.amount\)\}/;

  assert.match(timerPageSource, expectedFormat);
  assert.match(auctionPageSource, expectedFormat);
  assert.doesNotMatch(timerPageSource, legacyFormat);
  assert.doesNotMatch(auctionPageSource, legacyFormat);
});

test('낙찰 단계 모션은 빠른 GPU 전환과 동작 줄이기를 사용한다', () => {
  assert.match(dialogSource, /stepCount >= 12\) return 140/);
  assert.match(dialogSource, /stepCount >= 8\) return 170/);
  assert.match(dialogSource, /stepCount >= 5\) return 210/);
  assert.match(dialogSource, /return 260/);
  assert.match(stylesheetSource, /auctionAwardStageIn 220ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(stylesheetSource, /auctionAwardValueIn 180ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(stylesheetSource, /auction-award-stage-complete \.auction-award-price,[\s\S]*?auctionAwardWinner 260ms/);
  assert.match(stylesheetSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*auctionAwardReducedFade/);
});

test('PC 동작 줄이기 설정에서도 낙찰 단계 재생을 건너뛰지 않는다', () => {
  assert.doesNotMatch(
    timerPageSource,
    /matchMedia\('\(prefers-reduced-motion: reduce\)'\)[\s\S]*?currentIndex: prefersReducedMotion/,
  );
  assert.match(timerPageSource, /currentIndex: 0,[\s\S]*?isComplete: steps\.length <= 1/);
});
