import { getDailyStockQuotes, type StudentEconomyAction, type StudentEconomyState } from '../../lib/studentEconomy';

interface StudentSecuritiesPageProps {
  state: StudentEconomyState;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export default function StudentSecuritiesPage({ state, isSaving, onAction }: StudentSecuritiesPageProps) {
  const dateKey = getKoreanDateKey();
  return (
    <section className="student-economy-panel" aria-labelledby="student-securities-title">
      <div className="student-economy-title-row"><h2 id="student-securities-title">증권사</h2><span>{dateKey}</span></div>
      <div className="student-stock-grid">
        {getDailyStockQuotes(dateKey).map((stock) => {
          const count = state.holdings[stock.id] ?? 0;
          return (
            <article key={stock.id}>
              <span className="student-product-emoji" aria-hidden="true">{stock.emoji}</span>
              <div><h3>{stock.name}</h3><strong>{stock.price} 고마</strong><span className={stock.change >= 0 ? 'student-stock-up' : 'student-stock-down'}>{stock.change >= 0 ? '+' : ''}{stock.change}</span></div>
              <span>보유 {count}주</span>
              <div><button disabled={isSaving} onClick={() => void onAction({ type: 'buy_stock', stockId: stock.id, dateKey })}>매수</button><button disabled={isSaving || count < 1} onClick={() => void onAction({ type: 'sell_stock', stockId: stock.id, dateKey })}>매도</button></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
