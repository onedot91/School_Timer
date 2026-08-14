import { useEffect, useRef } from 'react';
import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import {
  getDailyStockQuotes,
  getInvestmentStagePresentation,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon } from './StudentStockTrend';

interface StudentSecuritiesPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
  onOpenMarket: () => void;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function StudentSecuritiesPage({ state, market, onAction, onOpenMarket }: StudentSecuritiesPageProps) {
  const dateKey = getKoreanDateKey();
  const settledDateRef = useRef('');
  useEffect(() => {
    if (settledDateRef.current === dateKey) return;
    settledDateRef.current = dateKey;
    void onAction({ type: 'settle_investments', dateKey });
  }, [dateKey, onAction]);
  const quotes = getDailyStockQuotes(dateKey, market);
  const positions = quotes.flatMap((stock) => {
    const position = state.investments[stock.id];
    return position ? [{ stock, position }] : [];
  });
  const totalInvested = positions.reduce((sum, item) => sum + item.position.investedAmount, 0);
  const totalCurrent = positions.reduce((sum, item) => sum + item.position.currentAmount, 0);
  const totalChange = totalCurrent - totalInvested;

  return (
    <section className="student-securities student-securities-overview" aria-label="내 투자 현황">
      {positions.length > 0 ? (
        <>
          <div className="student-investment-summary">
            <div><span>투자한 돈</span><strong>{totalInvested} 고마</strong></div>
            <div className={totalChange > 0 ? 'is-up' : totalChange < 0 ? 'is-down' : ''}><span>늘거나 줄어든 고마</span><strong>{totalChange > 0 ? '+' : ''}{totalChange} 고마</strong></div>
            <div><span>현재 금액</span><strong>{totalCurrent} 고마</strong></div>
            <button type="button" onClick={onOpenMarket}>투자하기 <ArrowRight aria-hidden="true" /></button>
          </div>
          <div className="student-investment-grid">
            {positions.map(({ stock, position }) => {
              const result = getInvestmentStagePresentation(position.lastStage);
              const isTodayResult = position.lastSettledDateKey === dateKey;
              return (
                <article key={stock.id} className={position.lastChangeAmount > 0 ? 'is-up' : position.lastChangeAmount < 0 ? 'is-down' : ''}>
                  <header><StudentStockIcon stockId={stock.id} /><h2>{stock.name}</h2></header>
                  <div><span>투자한 돈</span><strong>{position.investedAmount} 고마</strong></div>
                  <div className="student-investment-result"><span>{isTodayResult ? '오늘의 결과' : '최근 결과'}</span><strong>{result.symbol} {result.studentLabel}</strong></div>
                  <div className="student-investment-delta"><span>{position.lastChangeAmount >= 0 ? '늘어난 고마' : '줄어든 고마'}</span><strong>{position.lastChangeAmount > 0 ? '+' : ''}{position.lastChangeAmount} 고마</strong></div>
                  <div><span>현재 금액</span><strong>{position.currentAmount} 고마</strong></div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="student-stock-empty-state"><BriefcaseBusiness aria-hidden="true" /><h2>아직 투자한 고마가 없어요</h2><button type="button" onClick={onOpenMarket}>투자하기 <ArrowRight aria-hidden="true" /></button></div>
      )}
    </section>
  );
}
