import { useEffect, useRef } from 'react';
import {
  getDailyStockQuotes,
  getInvestmentStagePresentation,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockId,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon } from './StudentStockTrend';

interface StudentStockMarketPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  selectedStockId: StudentStockId;
  onSelectStock: (stockId: StudentStockId) => void;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const isWeekend = (dateKey: string) => {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export default function StudentStockMarketPage({ state, market, selectedStockId, onSelectStock, onAction }: StudentStockMarketPageProps) {
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
      <div className="student-stock-market">
        {getDailyStockQuotes(dateKey, market).map((stock) => {
          const position = state.investments[stock.id];
          const presentation = getInvestmentStagePresentation(stock.stage);
          return (
            <button
              key={stock.id}
              type="button"
              className={`student-market-card stage-${stock.stage}${position ? ' is-owned' : ''}${closed ? ' is-closed' : ''}${selectedStockId === stock.id ? ' is-selected' : ''}`}
              aria-pressed={selectedStockId === stock.id}
              onClick={() => onSelectStock(stock.id)}
            >
              <span className="student-market-card-header">
                <StudentStockIcon stockId={stock.id} />
                <strong>{stock.name}</strong>
                <span className={`student-market-trend stage-${stock.stage}`} aria-label={closed ? '오늘 휴장' : `오늘 ${presentation.studentLabel}`}>
                  {closed ? '휴장' : `${presentation.symbol} ${presentation.studentLabel}`}
                </span>
                <span
                  className={`student-market-position${position ? '' : ' is-empty'}`}
                  aria-label={position ? `내 투자 ${position.currentAmount} 고마` : '투자 없음'}
                >
                  {position ? (
                    <>
                      <span>내 투자</span>
                      <strong>{position.currentAmount} 고마</strong>
                    </>
                  ) : (
                    <strong>투자 없음</strong>
                  )}
                </span>
              </span>
              {stock.comment && !closed ? <span className="student-market-reason">{stock.comment}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
