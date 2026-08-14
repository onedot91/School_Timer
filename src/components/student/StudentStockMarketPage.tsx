import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_STUDENT_INVESTMENT_SETTINGS,
  getDailyStockQuotes,
  getInvestmentStagePresentation,
  normalizeStudentInvestmentSettings,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockId,
  type StudentStockMarket,
} from '../../lib/studentEconomy';
import { StudentStockIcon } from './StudentStockTrend';

interface StudentStockMarketPageProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  availableBalance: number;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type InvestmentDraft = { stockId: StudentStockId; name: string; type: 'invest' | 'withdraw'; amount: number };

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const isWeekend = (dateKey: string) => {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export default function StudentStockMarketPage({ state, market, availableBalance, isSaving, onAction }: StudentStockMarketPageProps) {
  const dateKey = getKoreanDateKey();
  const settings = normalizeStudentInvestmentSettings(market.settings ?? DEFAULT_STUDENT_INVESTMENT_SETTINGS);
  const [amounts, setAmounts] = useState<Record<StudentStockId, string>>({ sunny: '', sprout: '', cloud: '', star: '' });
  const [draft, setDraft] = useState<InvestmentDraft | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const settledDateRef = useRef('');

  useEffect(() => {
    if (settledDateRef.current === dateKey) return;
    settledDateRef.current = dateKey;
    void onAction({ type: 'settle_investments', dateKey });
  }, [dateKey, onAction]);

  useEffect(() => {
    if (!draft) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setDraft(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [draft, isSaving]);

  const confirm = async () => {
    if (!draft) return;
    const action: StudentEconomyAction = draft.type === 'invest'
      ? { type: 'invest', stockId: draft.stockId, amount: draft.amount, dateKey }
      : { type: 'withdraw_investment', stockId: draft.stockId, dateKey };
    if (await onAction(action)) {
      setAmounts((current) => ({ ...current, [draft.stockId]: '' }));
      setDraft(null);
    }
  };

  const closed = isWeekend(dateKey);

  return (
    <section className="student-stock-market-page" aria-label="투자하기">
      {closed ? <div className="student-market-closed"><strong>토·일은 휴장</strong><span>월요일에 다시 만나요.</span></div> : null}
      <div className="student-stock-market">
        {getDailyStockQuotes(dateKey, market).map((stock) => {
          const position = state.investments[stock.id];
          const presentation = getInvestmentStagePresentation(stock.stage);
          const amount = Number(amounts[stock.id]);
          const maximum = Math.min(settings.maximumAmount - (position?.currentAmount ?? 0), availableBalance);
          const validAmount = Number.isInteger(amount) && amount >= settings.minimumAmount && amount <= maximum;
          return (
            <article key={stock.id} className={`student-market-card stage-${stock.stage}${position ? ' is-owned' : ''}`}>
              <header><StudentStockIcon stockId={stock.id} /><h2>{stock.name}</h2></header>
              <div className="student-market-stage" aria-label={closed ? '오늘 휴장' : `오늘 ${presentation.studentLabel}`}>
                <strong>{presentation.symbol}</strong><span>{closed ? '휴장' : presentation.studentLabel}</span>
              </div>
              {stock.comment && !closed ? <p className="student-market-reason">{stock.comment}</p> : <div className="student-market-reason is-empty" />}
              {position ? <div className="student-market-position"><span>현재 투자 금액</span><strong>{position.currentAmount} 고마</strong></div> : null}
              <label className="student-investment-input">
                <span>투자할 고마</span>
                <div><input type="number" min={settings.minimumAmount} max={maximum} step="1" inputMode="numeric" value={amounts[stock.id]} disabled={closed || isSaving || maximum < settings.minimumAmount} onChange={(event) => setAmounts((current) => ({ ...current, [stock.id]: event.target.value }))} /><span>고마</span></div>
              </label>
              <div className="student-investment-actions">
                <button type="button" disabled={closed || isSaving || !validAmount} onClick={() => setDraft({ stockId: stock.id, name: stock.name, type: 'invest', amount })}>투자하기</button>
                <button type="button" className="is-secondary" disabled={closed || isSaving || !position} onClick={() => position && setDraft({ stockId: stock.id, name: stock.name, type: 'withdraw', amount: position.currentAmount })}>투자금 찾기</button>
              </div>
            </article>
          );
        })}
      </div>
      {draft ? (
        <div className="student-stock-dialog-backdrop">
          <section ref={dialogRef} className="student-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="student-investment-dialog-title" tabIndex={-1}>
            <button type="button" className="student-stock-dialog-close" aria-label="확인창 닫기" disabled={isSaving} onClick={() => setDraft(null)}><X aria-hidden="true" /></button>
            <span className="student-stock-dialog-kicker">{draft.name}</span>
            <h2 id="student-investment-dialog-title">{draft.amount} 고마를 {draft.type === 'invest' ? '투자할까요?' : '찾을까요?'}</h2>
            <p>{draft.type === 'invest' ? '내가 가진 고마에서 빠져요.' : '현재 금액이 내 고마로 돌아와요.'}</p>
            <div className="student-stock-dialog-actions"><button type="button" disabled={isSaving} onClick={() => setDraft(null)}>취소</button><button type="button" disabled={isSaving} onClick={() => void confirm()}>{isSaving ? '처리 중' : '확인'}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
