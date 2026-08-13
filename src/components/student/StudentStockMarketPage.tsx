import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  getDailyStockQuotes,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockId,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockTrend } from './StudentStockTrend';

interface StudentStockMarketPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type TradeDraft = {
  readonly stockId: StudentStockId;
  readonly name: string;
  readonly type: 'buy_stock' | 'sell_stock';
  readonly amount: number;
};

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const formatDate = (dateKey: string) => dateKey.slice(5).replace('-', '.');

export default function StudentStockMarketPage({ state, market, isSaving, onAction }: StudentStockMarketPageProps) {
  const dateKey = getKoreanDateKey();
  const [expandedStockId, setExpandedStockId] = useState<StudentStockId | null>(null);
  const [tradeDraft, setTradeDraft] = useState<TradeDraft | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tradeDraft) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setTradeDraft(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSaving, tradeDraft]);

  const confirmTrade = async () => {
    if (!tradeDraft) return;
    const wasApplied = await onAction({ type: tradeDraft.type, stockId: tradeDraft.stockId, dateKey });
    if (wasApplied) setTradeDraft(null);
  };

  return (
    <section className="student-stock-market-page" aria-label="종목 고르기와 시장 소식">
      <div className="student-stock-market">
        {getDailyStockQuotes(dateKey, market).map((stock) => {
          const isOwned = (state.holdings[stock.id] ?? 0) > 0;
          const purchasePrice = state.stockPurchases[stock.id]?.price ?? stock.price;
          const payout = Math.max(0, purchasePrice + stock.changeAmount);
          const previousHistory = stock.history.filter((entry) => entry.dateKey !== dateKey).slice(0, 3);
          const isExpanded = expandedStockId === stock.id;

          return (
            <article key={stock.id} className={`student-market-card${isOwned ? ' is-owned' : ''}`}>
              <header>
                <h2>{stock.name}</h2>
                {isOwned ? <span>보유 1개</span> : null}
              </header>
              <StudentStockTrend amount={stock.changeAmount} label={`${stock.name} 오늘`} />
              <p className="student-market-reason">{stock.comment || '오늘은 변화가 없어요.'}</p>
              <div className="student-market-actions">
                <div><span>{isOwned ? '받는 값' : '사는 값'}</span><strong>{isOwned ? payout : stock.price} 고마</strong></div>
                <button
                  type="button"
                  className={`student-market-trade ${isOwned ? 'is-sell' : 'is-buy'}`}
                  disabled={isSaving}
                  onClick={() => setTradeDraft({ stockId: stock.id, name: stock.name, type: isOwned ? 'sell_stock' : 'buy_stock', amount: isOwned ? payout : stock.price })}
                >
                  {isOwned ? '팔기' : '사기'}
                </button>
              </div>
              {previousHistory.length > 0 ? (
                <button type="button" className="student-stock-history-toggle" aria-expanded={isExpanded} onClick={() => setExpandedStockId(isExpanded ? null : stock.id)}>
                  이전 기록 {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>
              ) : null}
              {isExpanded ? (
                <div className="student-stock-history">
                  {previousHistory.map((entry) => (
                    <div key={entry.dateKey}>
                      <time dateTime={entry.dateKey}>{formatDate(entry.dateKey)}</time>
                      <StudentStockTrend amount={entry.changeAmount} label={`${formatDate(entry.dateKey)} 결과`} />
                      <p>{entry.comment || '변화가 없었어요.'}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {tradeDraft ? (
        <div className="student-stock-dialog-backdrop">
          <section ref={dialogRef} className="student-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="student-stock-dialog-title" tabIndex={-1}>
            <button type="button" className="student-stock-dialog-close" aria-label="거래 확인창 닫기" disabled={isSaving} onClick={() => setTradeDraft(null)}><X aria-hidden="true" /></button>
            <span className="student-stock-dialog-kicker">{tradeDraft.name}</span>
            <h2 id="student-stock-dialog-title">1개를 {tradeDraft.type === 'buy_stock' ? '살까요?' : '팔까요?'}</h2>
            <p>{tradeDraft.type === 'buy_stock' ? `${tradeDraft.amount} 고마를 사용해요.` : `${tradeDraft.amount} 고마를 받아요.`}</p>
            <div className="student-stock-dialog-actions">
              <button type="button" disabled={isSaving} onClick={() => setTradeDraft(null)}>취소</button>
              <button type="button" disabled={isSaving} onClick={() => void confirmTrade()}>{isSaving ? '처리 중' : tradeDraft.type === 'buy_stock' ? '사기' : '팔기'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
