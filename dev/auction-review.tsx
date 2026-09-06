import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AuctionAwardPresentationDialog, { AUCTION_CEREMONY_TIMING, type AuctionAwardPresentation } from '../src/components/teacher/AuctionAwardPresentationDialog';
import { useModalFocus } from '../src/lib/useModalFocus';
import '../src/index.css';

const params = new URLSearchParams(location.search);
if (params.get('motion') === 'reduce') {
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => {
    const result = matchMedia(query);
    if (query.includes('prefers-reduced-motion')) Object.defineProperty(result, 'matches', { value: true });
    return result;
  };
}
const sample = (count = 3, itemIndex = 0, long = false): AuctionAwardPresentation => {
  const itemId = `qa-auction-${itemIndex}`;
  return {
    item: { id: itemId, name: long ? '하루 동안 선생님 의자와 특별한 책상 함께 사용하기' : itemIndex ? '급식 먼저 먹기 이용권' : '하루 동안 선생님 의자 이용권', startPrice: 50, dayIndex: 0 },
    weekdayLabel: '월요일',
    steps: Array.from({ length: count }, (_, i) => ({ itemId, bidder: i === count - 1 ? 12 : i % 2 ? 7 : 12, amount: long ? 100000 + i * 10000 : 100 + i * 50, createdAt: new Date(i * 1000).toISOString() })),
    award: { itemId, winner: 12, amount: long ? 999999 : 100 + (count - 1) * 50, awardedAt: `${Date.now()}-${itemIndex}` },
    currentIndex: 0, isComplete: false, hasFinalized: false, hasRevealed: false,
  };
};

function Review() {
  const [presentation, setPresentation] = useState<AuctionAwardPresentation | null>(null);
  const [scenario, setScenario] = useState('normal');
  const [queued, setQueued] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canDismiss = Boolean(presentation?.error) || (presentation?.hasRevealed === true && !queued);
  const dismiss = useCallback(() => setPresentation(null), []);
  useModalFocus({ dialogRef, isOpen: !!presentation, isDismissible: canDismiss, returnFocusRef: triggerRef, onDismiss: dismiss });
  const complete = useCallback((key: string) => setPresentation(p => p?.award.awardedAt === key ? { ...p, isComplete: true } : p), []);
  const revealed = useCallback((key: string) => setPresentation(p => p?.award.awardedAt === key ? { ...p, hasRevealed: true } : p), []);
  useEffect(() => {
    if (!presentation?.isComplete || presentation.hasFinalized || presentation.error) return;
    const timer = window.setTimeout(() => {
      setSaveCount(n => n + 1);
      setPresentation(p => p ? scenario === 'failure'
        ? { ...p, error: '저장 결과를 확인하지 못했어요. 경매 상태를 확인해 주세요.' }
        : { ...p, hasFinalized: true } : p);
    }, scenario === 'slow' ? 5000 : 100);
    return () => window.clearTimeout(timer);
  }, [presentation?.isComplete, presentation?.hasFinalized, presentation?.error, scenario]);
  useEffect(() => {
    if (!queued || !presentation?.hasRevealed) return;
    const timer = window.setTimeout(() => { setQueued(false); setPresentation(sample(1, 1)); }, AUCTION_CEREMONY_TIMING.resultHold);
    return () => window.clearTimeout(timer);
  }, [queued, presentation?.hasRevealed]);
  useEffect(() => {
    if (!presentation) return;
    const root = dialogRef.current?.querySelector('.auction-ceremony');
    if (!root) return;
    const started = performance.now();
    const log = () => setEvents(previous => [...previous, `${root.getAttribute('data-phase')} ${Math.round(performance.now() - started)}ms`]);
    log();
    const observer = new MutationObserver(log);
    observer.observe(root, { attributes: true, attributeFilter: ['data-phase'] });
    return () => observer.disconnect();
  }, [presentation?.award.awardedAt]);
  return <main className="teacher-settings-theme" style={{ minHeight: '100dvh', padding: 32, background: '#f8f4ea' }}>
    <h1>낙찰 모션 검수 · 저장하지 않는 가상 데이터</h1>
    <label>시나리오 <select aria-label="시나리오" value={scenario} onChange={event => setScenario(event.target.value)}>
      <option value="normal">일반</option><option value="single">입찰 1건</option><option value="many">입찰 50건</option><option value="queue">연속 2건</option><option value="slow">저장 5초 지연</option><option value="failure">저장 실패</option><option value="empty">기본 프로필</option><option value="long">긴 상품명·큰 금액</option>
    </select></label>
    <button ref={triggerRef} onClick={() => { setEvents([]); setQueued(scenario === 'queue'); setPresentation(sample(scenario === 'single' ? 1 : scenario === 'many' ? 50 : 3, 0, scenario === 'long')); }}>낙찰 재생</button>
    <a href={params.get('motion') === 'reduce' ? '/dev/auction-review.html' : '/dev/auction-review.html?motion=reduce'}>동작 줄이기 {params.get('motion') === 'reduce' ? '해제' : '검수'}</a>
    <p>가상 저장 횟수: {saveCount}</p><output>{events.join(' → ')}</output>
    {presentation && <AuctionAwardPresentationDialog key={presentation.award.awardedAt} presentation={presentation}
      profileAssignments={scenario === 'empty' ? {} : { 12: '/failure-profiles/thumbs/12-frog.png' }} completedItems={[]} hasQueuedPresentations={queued} dialogRef={dialogRef}
      onComplete={complete} onRevealComplete={revealed} onDismiss={dismiss} />}
  </main>;
}

if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root')!);
  root.render(<Review />);
  import.meta.hot?.dispose(() => root.unmount());
}
