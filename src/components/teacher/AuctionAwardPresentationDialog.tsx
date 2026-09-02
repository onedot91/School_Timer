import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Gavel, Trophy, X } from 'lucide-react';
import { playAuctionSound } from '../../lib/auctionAudio';
import {
  formatCurrency,
  getAuctionItemDisplayName,
  getStudentLabelStyle,
  type AuctionAward,
  type AuctionBidHistoryEntry,
  type AuctionItem,
} from '../../lib/currency';

export type AuctionAwardPresentation = {
  item: AuctionItem;
  weekdayLabel: string;
  steps: AuctionBidHistoryEntry[];
  award: AuctionAward;
  currentIndex: number;
  isComplete: boolean;
  hasFinalized: boolean;
};

type CompletedAwardItem = {
  item: AuctionItem;
  award: AuctionAward;
};

type AuctionAwardPresentationDialogProps = {
  presentation: AuctionAwardPresentation;
  completedItems: CompletedAwardItem[];
  hasQueuedPresentations: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  onComplete: (presentationKey: string, finalIndex: number) => void;
  onDismiss: () => void;
};

const getStepDelayMs = (stepCount: number) => {
  if (stepCount >= 12) return 140;
  if (stepCount >= 8) return 170;
  if (stepCount >= 5) return 210;
  return 260;
};

export default function AuctionAwardPresentationDialog({
  presentation,
  completedItems,
  hasQueuedPresentations,
  dialogRef,
  onComplete,
  onDismiss,
}: AuctionAwardPresentationDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(presentation.currentIndex);
  const playedStepRef = useRef(-1);
  const finalSoundPlayedRef = useRef(false);
  const stepListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (presentation.isComplete) {
      if (!finalSoundPlayedRef.current) {
        finalSoundPlayedRef.current = true;
        void playAuctionSound('final', currentIndex);
      }
      return;
    }

    if (playedStepRef.current !== currentIndex) {
      playedStepRef.current = currentIndex;
      void playAuctionSound('bid', currentIndex);
    }
  }, [currentIndex, presentation.isComplete]);

  useEffect(() => {
    if (presentation.isComplete) return;

    const timeoutId = window.setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= presentation.steps.length) {
        onComplete(presentation.award.awardedAt, Math.max(presentation.steps.length - 1, 0));
        return;
      }
      setCurrentIndex(nextIndex);
    }, getStepDelayMs(presentation.steps.length));

    return () => window.clearTimeout(timeoutId);
  }, [currentIndex, onComplete, presentation.award.awardedAt, presentation.isComplete, presentation.steps.length]);

  useLayoutEffect(() => {
    if (presentation.isComplete) return;
    const list = stepListRef.current;
    const activeRow = list?.children.item(currentIndex);
    if (!list || !(activeRow instanceof HTMLElement)) return;

    const rowTop = activeRow.offsetTop;
    const rowBottom = rowTop + activeRow.offsetHeight;
    if (rowTop < list.scrollTop) {
      list.scrollTop = rowTop;
    } else if (rowBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = rowBottom - list.clientHeight;
    }
  }, [currentIndex, presentation.isComplete]);

  const activeStep = presentation.steps[currentIndex] ?? presentation.steps[0];
  const activeStepIndex = presentation.isComplete
    ? Math.max(presentation.steps.length - 1, 0)
    : currentIndex;
  const progressPercent = presentation.steps.length <= 1
    ? 100
    : Math.round((activeStepIndex / (presentation.steps.length - 1)) * 100);

  const itemDisplayName = getAuctionItemDisplayName(presentation.item.name, presentation.item.dayIndex);
  const resultBidder = presentation.isComplete
    ? presentation.award.winner
    : activeStep?.bidder ?? presentation.award.winner;
  const resultAmount = presentation.isComplete
    ? presentation.award.amount
    : activeStep?.amount ?? 0;

  return (
    <div
      ref={dialogRef}
      className="auction-award-backdrop teacher-settings-theme fixed inset-0 z-[80] flex items-center justify-center px-6 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auction-award-title"
    >
      <section
        className={`apple-material-layer auction-award-stage relative overflow-hidden ${presentation.isComplete ? 'auction-award-stage-complete' : ''}`}
      >
        <div className="auction-award-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={`auction-award-confetti-${index}`}
              style={{
                left: `${6 + ((index * 17) % 88)}%`,
                animationDelay: `${index * 0.035}s`,
                backgroundColor: ['#007A57', '#B2793A', '#2E7D86', '#7A5BA8'][index % 4],
              }}
            />
          ))}
        </div>

        <header className="auction-award-header relative">
          <div className="auction-award-heading">
            <div className="auction-award-heading-icon" aria-hidden="true">
              {presentation.isComplete ? <Trophy size={30} /> : <Gavel size={30} />}
            </div>
            <div className="min-w-0">
              <p className="auction-award-eyebrow">
                <span>{presentation.weekdayLabel} 경매</span>
                <strong>{presentation.isComplete ? '낙찰 완료' : '진행 중'}</strong>
              </p>
              <h2 id="auction-award-title" className="auction-award-title">
                {itemDisplayName}
              </h2>
            </div>
          </div>

          <div className="auction-award-header-actions">
            <div className="auction-award-step-counter" aria-label={`전체 ${presentation.steps.length}단계 중 ${activeStepIndex + 1}단계`}>
              <strong>{activeStepIndex + 1}<small>/ {Math.max(presentation.steps.length, 1)}</small></strong>
            </div>
            {presentation.isComplete && !hasQueuedPresentations ? (
              <button
                type="button"
                className="auction-award-close-button"
                aria-label="낙찰 결과 닫기"
                onClick={onDismiss}
              >
                <X size={24} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        <div className="auction-award-progress-track" aria-hidden="true">
          <div
            className="auction-award-progress-fill"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>

        <div className="auction-award-content relative">
          <section className="auction-award-history" aria-labelledby="auction-award-history-title">
            <div className="auction-award-section-heading">
              <h3 id="auction-award-history-title">입찰 기록</h3>
            </div>

            <div ref={stepListRef} className="auction-award-step-list">
              {presentation.steps.map((step, stepIndex) => {
                const isPast = stepIndex < activeStepIndex || presentation.isComplete;
                const isActive = stepIndex === activeStepIndex && !presentation.isComplete;
                const isWinnerStep = presentation.isComplete && stepIndex === presentation.steps.length - 1;

                return (
                  <div
                    key={`award-step-row-${step.itemId}-${step.createdAt}-${stepIndex}`}
                    className={`auction-award-step-row ${isActive ? 'auction-award-step-active' : ''} ${isWinnerStep ? 'auction-award-step-winner' : ''} ${!isPast && !isActive ? 'auction-award-step-pending' : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`${stepIndex + 1}번째 입찰, ${step.bidder}번, ${formatCurrency(step.amount)}${isWinnerStep ? ', 낙찰' : isActive ? ', 현재' : ''}`}
                  >
                    <span className="auction-award-step-number">{stepIndex + 1}</span>
                    <span
                      className="auction-award-step-bidder"
                      style={getStudentLabelStyle(step.bidder)}
                    >
                      {step.bidder}번
                    </span>
                    <strong className="auction-award-step-price">{formatCurrency(step.amount)}</strong>
                  </div>
                );
              })}
            </div>

            {completedItems.length > 0 ? (
              <div className="auction-award-completed-strip">
                <span className="auction-award-completed-label">오늘 낙찰</span>
                <div className="auction-award-completed-items">
                  {completedItems.map(({ item, award }) => (
                    <span key={award.itemId} className="auction-award-completed-item">
                      <span>{getAuctionItemDisplayName(item.name, item.dayIndex)}</span>
                      <strong>{award.winner}번 ({formatCurrency(award.amount)})</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside
            className={`auction-award-result-card ${presentation.isComplete ? 'auction-award-result-complete' : ''}`}
            aria-live="polite"
            aria-label={presentation.isComplete
              ? `${resultBidder}번 학생, ${formatCurrency(resultAmount)} 낙찰`
              : `현재 ${resultBidder}번 학생, ${formatCurrency(resultAmount)}`}
          >
            <span className="auction-award-result-status">
              {presentation.isComplete ? '낙찰' : '현재'}
            </span>

            <div
              key={`result-bidder-${presentation.isComplete ? 'winner' : currentIndex}`}
              className={`auction-award-current-chip ${presentation.isComplete ? 'auction-award-winner-chip' : ''}`}
              style={getStudentLabelStyle(resultBidder)}
            >
              {resultBidder}번
            </div>

            <div className="auction-award-price-block">
              <strong
                key={`result-price-${presentation.isComplete ? 'final' : currentIndex}`}
                className="auction-award-price"
              >
                {formatCurrency(resultAmount)}
              </strong>
            </div>

            {presentation.isComplete ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={hasQueuedPresentations}
                className="auction-award-confirm-button"
              >
                {hasQueuedPresentations ? '다음 낙찰 준비 중' : '확인'}
              </button>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
