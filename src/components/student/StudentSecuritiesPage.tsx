import {
  getDailyStockQuotes,
  getInvestmentStagePresentation,
  type StudentEconomyState,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon } from './StudentStockTrend';

interface StudentSecuritiesPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function StudentSecuritiesPage({ state, market }: StudentSecuritiesPageProps) {
  const dateKey = getKoreanDateKey();
  const quotes = getDailyStockQuotes(dateKey, market);
  const positions = quotes.flatMap((stock) => {
    const position = state.investments[stock.id];
    return position ? [{ stock, position }] : [];
  });
  if (positions.length === 0) return null;

  return (
    <section className="student-securities student-investment-positions" aria-label="보유 중인 투자">
      <div className="student-investment-grid">
        {positions.map(({ stock, position }) => {
          const result = getInvestmentStagePresentation(position.lastStage);
          const isTodayResult = position.lastSettledDateKey === dateKey;
          return (
            <article key={stock.id} className={position.lastChangeAmount > 0 ? 'is-up' : position.lastChangeAmount < 0 ? 'is-down' : ''}>
              <header><StudentStockIcon stockId={stock.id} /><h2>{stock.name}</h2></header>
              <div><span>투자한 돈</span><strong>{position.investedAmount} 고마</strong></div>
              <div className="student-investment-result"><span>{isTodayResult ? '오늘의 결과' : '최근 결과'}</span><strong>{result.symbol} {result.studentLabel} · {position.currentAmount} 고마</strong></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
