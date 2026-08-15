import { useEffect, useRef } from 'react';
import {
  getDailyStockQuotes,
  getInvestmentStagePresentation,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon } from './StudentStockTrend';

interface StudentStockMarketPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const isWeekend = (dateKey: string) => {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export default function StudentStockMarketPage({ state, market, onAction }: StudentStockMarketPageProps) {
  const dateKey = getKoreanDateKey();
  const settledDateRef = useRef('');

  useEffect(() => {
    if (settledDateRef.current === dateKey) return;
    settledDateRef.current = dateKey;
    void onAction({ type: 'settle_investments', dateKey });
  }, [dateKey, onAction]);

  const closed = isWeekend(dateKey);

  return (
    <section className="student-stock-market-page" aria-label="종목별 오늘의 변화">
      {closed ? <div className="student-market-closed"><strong>토·일은 휴장</strong><span>월요일에 다시 만나요.</span></div> : null}
      <div className="student-stock-market">
        {getDailyStockQuotes(dateKey, market).map((stock) => {
          const position = state.investments[stock.id];
          const presentation = getInvestmentStagePresentation(stock.stage);
          return (
            <article key={stock.id} className={`student-market-card stage-${stock.stage}${position ? ' is-owned' : ''}${closed ? ' is-closed' : ''}`}>
              <header><StudentStockIcon stockId={stock.id} /><h2>{stock.name}</h2></header>
              <div className="student-market-stage" aria-label={closed ? '오늘 휴장' : `오늘 ${presentation.studentLabel}`}>
                <strong>{presentation.symbol}</strong><span>{closed ? '휴장' : presentation.studentLabel}</span>
              </div>
              {stock.comment && !closed ? <p className="student-market-reason">{stock.comment}</p> : <div className="student-market-reason is-empty" />}
              {position ? <div className="student-market-position"><span>현재 투자 금액</span><strong>{position.currentAmount} 고마</strong></div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
