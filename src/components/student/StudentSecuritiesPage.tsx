import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import {
  getDailyStockQuotes,
  type StudentEconomyState,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon, StudentStockTrend } from './StudentStockTrend';

interface StudentSecuritiesPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  onOpenMarket: () => void;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export default function StudentSecuritiesPage({ state, market, onOpenMarket }: StudentSecuritiesPageProps) {
  const dateKey = getKoreanDateKey();
  const quotes = getDailyStockQuotes(dateKey, market);
  const ownedQuotes = quotes.filter((stock) => (state.holdings[stock.id] ?? 0) > 0);
  const totalProfit = ownedQuotes.reduce((sum, stock) => sum + stock.changeAmount, 0);
  const investedAmount = ownedQuotes.reduce((sum, stock) => sum + (state.stockPurchases[stock.id]?.price ?? stock.price), 0);
  const totalValue = investedAmount + totalProfit;

  return (
    <section className="student-securities student-securities-overview" aria-label="내 투자 현황">
      <div className="student-portfolio-summary">
        <div><span>내가 넣은 고마</span><strong>{investedAmount} 고마</strong></div>
        <div><span>지금 가진 가치</span><strong>{totalValue} 고마</strong></div>
        <div><span>나의 결과</span><StudentStockTrend amount={totalProfit} label="전체 투자 결과" /></div>
        <button type="button" onClick={onOpenMarket}>종목 고르기 <ArrowRight aria-hidden="true" /></button>
      </div>

      <section className="student-portfolio-owned" aria-labelledby="owned-stocks-title">
        <h2 id="owned-stocks-title">내 종목</h2>
        {ownedQuotes.length > 0 ? (
          <div className="student-owned-stock-grid">
            {ownedQuotes.map((stock) => (
              <article key={stock.id}>
                <StudentStockIcon stockId={stock.id} />
                <div><h3>{stock.name}</h3><span>내가 가진 수 1개</span></div>
                <div className="student-owned-stock-result">
                  <span>지금 결과</span>
                  <StudentStockTrend amount={stock.changeAmount} label={`${stock.name} 투자 결과`} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-stock-empty-state">
            <BriefcaseBusiness aria-hidden="true" />
            <div><strong>아직 투자한 종목이 없어요</strong><span>마음에 드는 종목을 하나 골라 보세요.</span></div>
          </div>
        )}
      </section>
    </section>
  );
}
