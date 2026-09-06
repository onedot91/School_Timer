import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ChevronDown, Volume2, VolumeX, X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { playAuctionSound } from '../../lib/auctionAudio';
import { FAILURE_EMPTY_PROFILE_IMAGE, getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';
import {
  formatCurrency,
  getAuctionItemDisplayName,
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
  hasRevealed: boolean;
  error?: string;
};

type AuctionAwardPresentationDialogProps = {
  readonly presentation: AuctionAwardPresentation;
  readonly completedItems: { item: AuctionItem; award: AuctionAward }[];
  readonly profileAssignments: FailureProfileAssignments;
  readonly hasQueuedPresentations: boolean;
  readonly dialogRef: RefObject<HTMLDivElement | null>;
  readonly onComplete: (presentationKey: string, finalIndex: number) => void;
  readonly onRevealComplete: (presentationKey: string) => void;
  readonly onDismiss: () => void;
};

export const AUCTION_CEREMONY_TIMING = {
  intro: 480,
  bid: 260,
  lastCall: 440,
  impact: 340,
  reveal: 720,
  settled: 1380,
  resultHold: 3200,
} as const;

// The authoritative award always ends the replay, even when history is stale.
export function getAuctionAwardReplaySteps(steps: AuctionBidHistoryEntry[], award: AuctionAward) {
  const history = steps.filter(step => step.itemId === award.itemId && step.amount > 0);
  const last = history.at(-1);
  const result = { itemId: award.itemId, bidder: award.winner, amount: award.amount, createdAt: award.awardedAt };
  return (last?.bidder === award.winner && last.amount === award.amount ? history : [...history, result]).slice(-3);
}

function AuctionGavel() {
  return <svg viewBox="0 0 320 210" className="auction-ceremony-gavel" aria-hidden="true">
    <defs>
      <linearGradient id="auction-gavel-wood" x2="0" y2="1"><stop stopColor="#c48d53"/><stop offset=".45" stopColor="#986439"/><stop offset="1" stopColor="#553824"/></linearGradient>
      <linearGradient id="auction-gavel-brass" x2="0" y2="1"><stop stopColor="#ffe2a0"/><stop offset=".5" stopColor="#c99d53"/><stop offset="1" stopColor="#8f6a32"/></linearGradient>
    </defs>
    <ellipse className="auction-ceremony-gavel-shadow" cx="125" cy="193" rx="75" ry="9" fill="#061c16" opacity=".3"/>
    <g className="auction-ceremony-block">
      <path d="M65 182 Q65 170 126 170 Q187 170 187 182 V192 Q126 205 65 192Z" fill="#523727"/>
      <ellipse cx="126" cy="181" rx="61" ry="11" fill="#b1804b"/>
      <ellipse cx="126" cy="179" rx="48" ry="7" fill="#d2a76b"/>
    </g>
    <g className="auction-ceremony-mallet">
      <path d="M141 136 L265 102 Q279 100 283 110 Q285 119 274 123 L148 153Z" fill="url(#auction-gavel-wood)" stroke="#452e20" strokeWidth="2"/>
      <path d="M156 137 L265 108" stroke="#e2b581" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
      <rect x="100" y="108" width="50" height="64" rx="8" fill="url(#auction-gavel-wood)" stroke="#513421" strokeWidth="2"/>
      <rect x="91" y="104" width="68" height="13" rx="5" fill="url(#auction-gavel-brass)"/>
      <rect x="91" y="158" width="68" height="14" rx="5" fill="url(#auction-gavel-brass)"/>
      <path d="M107 121 V151" stroke="#e2b581" strokeWidth="3" opacity=".5"/>
    </g>
    <g className="auction-ceremony-impact" fill="none" stroke="#f1d698" strokeWidth="3" strokeLinecap="round">
      <path d="M60 155 L48 145 M125 149 V132 M185 155 L198 144"/>
    </g>
  </svg>;
}

export default function AuctionAwardPresentationDialog({
  presentation, completedItems, profileAssignments, hasQueuedPresentations, dialogRef,
  onComplete, onRevealComplete, onDismiss,
}: AuctionAwardPresentationDialogProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [replay] = useState(() => getAuctionAwardReplaySteps(presentation.steps, presentation.award));
  const [index, setIndex] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const soundEnabledRef = useRef(soundEnabled);
  const playedStepRef = useRef(-1);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const historyToggleRef = useRef<HTMLButtonElement>(null);
  soundEnabledRef.current = soundEnabled;
  const key = presentation.award.awardedAt;
  const isResult = presentation.hasRevealed;
  const phase = presentation.error ? 'error' : isResult ? 'result' : revealing ? 'reveal'
    : presentation.hasFinalized ? 'strike' : presentation.isComplete ? 'saving' : 'bidding';
  const canDismiss = Boolean(presentation.error) || (isResult && !hasQueuedPresentations);
  const itemName = getAuctionItemDisplayName(presentation.item.name, presentation.item.dayIndex);
  const step = replay[index];
  const profileImage = getFailureProfileImage(presentation.award.winner, profileAssignments);
  const showCertificate = revealing || isResult;
  const closeHistory = () => {
    setHistoryOpen(false);
    historyToggleRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (presentation.isComplete || presentation.error) return;
    const delay = index === replay.length - 1
      ? AUCTION_CEREMONY_TIMING.lastCall + (index === 0 ? AUCTION_CEREMONY_TIMING.intro : 0)
      : index === 0 ? AUCTION_CEREMONY_TIMING.intro : AUCTION_CEREMONY_TIMING.bid;
    const timer = window.setTimeout(() => {
      if (index < replay.length - 1) setIndex(previous => previous + 1);
      else onComplete(key, Math.max(presentation.steps.length - 1, 0));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [index, replay.length, key, onComplete, presentation.isComplete, presentation.error, presentation.steps.length]);

  useEffect(() => {
    if (presentation.isComplete || playedStepRef.current === index) return;
    playedStepRef.current = index;
    if (soundEnabledRef.current) void playAuctionSound(index === 0 ? 'start' : 'bid', index);
  }, [index, presentation.isComplete]);

  useEffect(() => {
    if (!presentation.hasFinalized || presentation.error || presentation.hasRevealed) return;
    const timers = [
      window.setTimeout(() => { if (soundEnabledRef.current) void playAuctionSound('strike'); }, AUCTION_CEREMONY_TIMING.impact),
      window.setTimeout(() => {
        setRevealing(true);
        if (soundEnabledRef.current) void playAuctionSound('final');
      }, AUCTION_CEREMONY_TIMING.reveal),
      window.setTimeout(() => onRevealComplete(key), AUCTION_CEREMONY_TIMING.settled),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [presentation.hasFinalized, presentation.hasRevealed, presentation.error, key, onRevealComplete]);

  useEffect(() => {
    if (canDismiss) confirmRef.current?.focus({ preventScroll: true });
  }, [canDismiss]);

  const status = presentation.error ? presentation.error : isResult
    ? `${presentation.award.winner}번 학생에게 ${itemName}, ${formatCurrency(presentation.award.amount)}에 낙찰되었습니다.`
    : presentation.hasFinalized ? '낙찰이 확정되었습니다.' : presentation.isComplete ? '낙찰을 확정하고 있어요.' : '마지막 입찰을 확인하고 있어요.';
  const timingStyle = {
    '--auction-impact-at': `${AUCTION_CEREMONY_TIMING.impact}ms`,
    '--auction-reveal-duration': `${AUCTION_CEREMONY_TIMING.settled - AUCTION_CEREMONY_TIMING.reveal}ms`,
  } as CSSProperties;

  return <div ref={dialogRef}
    className="auction-award-backdrop teacher-settings-theme auction-ceremony-backdrop"
    role="dialog" aria-modal="true" aria-labelledby="auction-award-title" aria-describedby="auction-award-status"
    onKeyDownCapture={event => {
      if (event.key === 'Escape' && historyOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeHistory();
      }
    }}
    onClick={event => { if (event.target === event.currentTarget && canDismiss) onDismiss(); }}>
    <section className="auction-ceremony" data-phase={phase} data-reduced-motion={reduceMotion} style={timingStyle}>
      <header className="auction-ceremony-header">
        <span className="auction-ceremony-brand">{presentation.weekdayLabel} 경매</span>
        <div className="auction-ceremony-controls">
          <button type="button" aria-label={soundEnabled ? '경매 효과음 끄기' : '경매 효과음 켜기'} aria-pressed={soundEnabled} onClick={() => setSoundEnabled(value => !value)}>
            {soundEnabled ? <Volume2 aria-hidden="true"/> : <VolumeX aria-hidden="true"/>}
          </button>
          {canDismiss && <button type="button" aria-label="낙찰 결과 닫기" onClick={onDismiss}><X aria-hidden="true"/></button>}
        </div>
      </header>
      <h2 id="auction-award-title" className="sr-only">{itemName} 낙찰 발표</h2>
      <p id="auction-award-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">{status}</p>
      <div className="auction-ceremony-scene" aria-busy={!isResult && !presentation.error}>
        <div className="auction-ceremony-spotlight" aria-hidden="true"/>
        {!presentation.error && <>
          <div className="auction-ceremony-lot" aria-hidden={showCertificate}>
            <h3>{itemName}</h3>
            <div className="auction-ceremony-bid" key={index}>{formatCurrency(step.amount)}</div>
            <div className="auction-ceremony-bid-marks" aria-hidden="true">{replay.map((_, i) => <i key={i} data-past={i <= index}/>)}</div>
          </div>
          <div className="auction-ceremony-gavel-scene" aria-hidden="true"><AuctionGavel/></div>
          {presentation.hasFinalized && <div className="auction-ceremony-stamp" aria-hidden="true"><span>낙찰</span></div>}
          <article className="auction-ceremony-certificate" aria-hidden={!showCertificate}>
            <div className="auction-ceremony-certificate-inner">
              <div className="auction-ceremony-portrait">
                <div className="auction-ceremony-profile">
                  <img src={imageFailed ? FAILURE_EMPTY_PROFILE_IMAGE : profileImage} alt={`${presentation.award.winner}번 학생 프로필`} width={192} height={192}
                    onError={() => setImageFailed(true)} />
                </div>
              </div>
              <div className="auction-ceremony-deed">
                <h3><strong>{presentation.award.winner}번 학생</strong>에게<br/>낙찰!</h3>
                <div className="auction-ceremony-deed-item"><span>{itemName}</span><strong>{formatCurrency(presentation.award.amount)}</strong></div>
                <span className="auction-ceremony-seal" aria-hidden="true">낙찰</span>
              </div>
            </div>
          </article>
          <div className="auction-ceremony-paper-bits" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--bit-x': `${(i % 2 ? 1 : -1) * (100 + i * 27)}px`, '--bit-y': `${-75 + (i % 4) * 60}px`, '--bit-turn': `${i * 45}deg`, '--bit-delay': `${(i % 5) * 35}ms` } as CSSProperties}/>)}</div>
        </>}
        {presentation.error && <div className="auction-ceremony-error"><h3>낙찰 확인 실패</h3><p>{presentation.error}</p></div>}
      </div>
      <footer className="auction-ceremony-footer">
        {canDismiss ? <button ref={confirmRef} type="button" className="auction-ceremony-confirm" onClick={onDismiss}>{presentation.error ? '닫기' : '확인'}</button>
          : <p>{isResult ? '다음 낙찰 대기 중' : phase === 'saving' ? '낙찰 처리 중' : ''}</p>}
        {isResult && !hasQueuedPresentations && <button ref={historyToggleRef} type="button" className="auction-ceremony-history-toggle" aria-expanded={historyOpen} aria-controls="auction-award-records" onClick={() => setHistoryOpen(value => !value)}>입찰 기록 <ChevronDown size={16} aria-hidden="true"/></button>}
      </footer>
      {isResult && historyOpen && <section id="auction-award-records" className="auction-ceremony-records" aria-label="입찰 기록">
        <header><h3>입찰 기록</h3><button type="button" aria-label="입찰 기록 닫기" onClick={closeHistory}><X size={20} aria-hidden="true"/></button></header>
        <ol>{presentation.steps.map((entry, i) => <li key={`${entry.createdAt}-${i}`}><span>{i + 1}</span><strong>{entry.bidder}번</strong><span>{formatCurrency(entry.amount)}</span></li>)}</ol>
        {completedItems.length > 0 && <div className="auction-ceremony-completed"><strong>오늘 낙찰</strong>{completedItems.map(({ item, award }) => <p key={item.id}>{getAuctionItemDisplayName(item.name, item.dayIndex)} · {award.winner}번 ({formatCurrency(award.amount)})</p>)}</div>}
      </section>}
    </section>
  </div>;
}
