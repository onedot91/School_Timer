import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_STUDENT_INVESTMENT_SETTINGS,
  getDailyStockQuotes,
  normalizeStudentInvestmentSettings,
  type StudentEconomyAction,
  type StudentEconomyState,
  type StudentStockId,
  type StudentStockMarket,
} from '../../lib/studentEconomy';

interface StudentInvestmentActionPanelProps {
  state: StudentEconomyState;
  market: StudentStockMarket;
  availableBalance: number;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type InvestmentDraft = { type: 'invest' | 'withdraw'; amount: number };

const getKoreanDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const isWeekend = (dateKey: string) => {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export default function StudentInvestmentActionPanel({ state, market, availableBalance, isSaving, onAction }: StudentInvestmentActionPanelProps) {
  const dateKey = getKoreanDateKey();
  const quotes = getDailyStockQuotes(dateKey, market);
  const [selectedStockId, setSelectedStockId] = useState<StudentStockId>('sunny');
  const [amount, setAmount] = useState('');
  const [draft, setDraft] = useState<InvestmentDraft | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const settings = normalizeStudentInvestmentSettings(market.settings ?? DEFAULT_STUDENT_INVESTMENT_SETTINGS);
  const selectedStock = quotes.find((stock) => stock.id === selectedStockId) ?? quotes[0];

  useEffect(() => {
    if (!draft) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setDraft(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [draft, isSaving]);

  if (!selectedStock) return null;

  const position = state.investments[selectedStock.id];
  const investmentAmount = Number(amount);
  const maximum = Math.min(settings.maximumAmount - (position?.currentAmount ?? 0), availableBalance);
  const canInvest = !isWeekend(dateKey) && !isSaving && Number.isInteger(investmentAmount) && investmentAmount >= settings.minimumAmount && investmentAmount <= maximum;
  const canWithdraw = !isWeekend(dateKey) && !isSaving && Boolean(position);

  const confirm = async () => {
    if (!draft) return;
    const action: StudentEconomyAction = draft.type === 'invest'
      ? { type: 'invest', stockId: selectedStock.id, amount: draft.amount, dateKey }
      : { type: 'withdraw_investment', stockId: selectedStock.id, dateKey };
    if (await onAction(action)) {
      setAmount('');
      setDraft(null);
    }
  };

  return (
    <section id="student-investment-actions" className="student-investment-action-panel" aria-labelledby="student-investment-action-title">
      <h2 id="student-investment-action-title">투자하기 · 투자금 찾기</h2>
      <div className="student-investment-action-controls">
        <label>
          <span>종목 고르기</span>
          <select value={selectedStock.id} disabled={isSaving} onChange={(event) => {
            const nextStock = quotes.find((stock) => stock.id === event.target.value);
            if (!nextStock) return;
            setSelectedStockId(nextStock.id);
            setAmount('');
          }}>
            {quotes.map((stock) => <option key={stock.id} value={stock.id}>{stock.name}</option>)}
          </select>
        </label>
        <label className="student-investment-input">
          <span>투자할 고마</span>
          <div><input type="number" min={settings.minimumAmount} max={maximum} step="1" inputMode="numeric" value={amount} disabled={isWeekend(dateKey) || isSaving || maximum < settings.minimumAmount} onChange={(event) => setAmount(event.target.value)} /><span>고마</span></div>
        </label>
        <div className="student-investment-selected-state"><span>선택한 종목의 현재 투자 금액</span><strong>{position?.currentAmount ?? 0} 고마</strong></div>
        <div className="student-investment-actions">
          <button type="button" disabled={!canInvest} onClick={() => setDraft({ type: 'invest', amount: investmentAmount })}>투자하기</button>
          <button type="button" className="is-secondary" disabled={!canWithdraw} onClick={() => position && setDraft({ type: 'withdraw', amount: position.currentAmount })}>투자금 찾기</button>
        </div>
      </div>
      {draft ? (
        <div className="student-stock-dialog-backdrop">
          <section ref={dialogRef} className="student-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="student-investment-dialog-title" tabIndex={-1}>
            <button type="button" className="student-stock-dialog-close" aria-label="확인창 닫기" disabled={isSaving} onClick={() => setDraft(null)}><X aria-hidden="true" /></button>
            <span className="student-stock-dialog-kicker">{selectedStock.name}</span>
            <h2 id="student-investment-dialog-title">{draft.amount} 고마를 {draft.type === 'invest' ? '투자할까요?' : '찾을까요?'}</h2>
            <p>{draft.type === 'invest' ? '내가 가진 고마에서 빠져요.' : '현재 금액이 내 고마로 돌아와요.'}</p>
            <div className="student-stock-dialog-actions"><button type="button" disabled={isSaving} onClick={() => setDraft(null)}>취소</button><button type="button" disabled={isSaving} onClick={() => void confirm()}>{isSaving ? '처리 중' : '확인'}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
