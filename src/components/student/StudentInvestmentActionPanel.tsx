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
  selectedStockId: StudentStockId;
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

interface InvestmentStatusMessageOptions {
  isSaving: boolean;
  marketClosed: boolean;
  isBelowMinimum: boolean;
  hasInvalidAmount: boolean;
  hasPosition: boolean;
}

export const getInvestmentStatusMessage = ({ isSaving, marketClosed, isBelowMinimum, hasInvalidAmount, hasPosition }: InvestmentStatusMessageOptions) => {
  if (isSaving) return '';
  if (marketClosed) return '오늘은 휴장';
  if (isBelowMinimum) return '투자 한도 없음';
  if (hasInvalidAmount) return '입력 금액 확인';
  if (!hasPosition) return '찾을 투자금 없음';
  return '';
};

export default function StudentInvestmentActionPanel({ state, market, selectedStockId, availableBalance, isSaving, onAction }: StudentInvestmentActionPanelProps) {
  const dateKey = getKoreanDateKey();
  const quotes = getDailyStockQuotes(dateKey, market);
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

  useEffect(() => {
    setAmount('');
  }, [selectedStockId]);

  if (!selectedStock) return null;

  const position = state.investments[selectedStock.id];
  const investmentAmount = Number(amount);
  const marketClosed = isWeekend(dateKey);
  const hasEnteredAmount = amount.trim() !== '';
  const maximum = Math.min(settings.maximumAmount - (position?.currentAmount ?? 0), availableBalance);
  const canInvest = !marketClosed && !isSaving && Number.isInteger(investmentAmount) && investmentAmount >= settings.minimumAmount && investmentAmount <= maximum;
  const canWithdraw = !marketClosed && !isSaving && Boolean(position);
  const hasPosition = Boolean(position);
  const statusMessage = getInvestmentStatusMessage({
    isSaving,
    marketClosed,
    isBelowMinimum: maximum < settings.minimumAmount,
    hasInvalidAmount: hasEnteredAmount && !canInvest,
    hasPosition,
  });
  const footerStatusMessage = marketClosed || (!hasPosition && statusMessage === '찾을 투자금 없음') ? '' : statusMessage;

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
    <section id="student-investment-actions" className="student-investment-action-panel" aria-label={`${selectedStock.name} 투자 거래`} aria-busy={isSaving}>
      <div className="student-investment-action-controls">
        <div className="student-investment-stock-choice">
          <span>선택 종목</span>
          <strong>{selectedStock.name}</strong>
        </div>
        <label className="student-investment-input">
          <span>투자할 고마</span>
          <div><input type="number" min={settings.minimumAmount} max={maximum} step="1" inputMode="numeric" aria-label="투자할 고마" value={amount} disabled={marketClosed || isSaving || maximum < settings.minimumAmount} onChange={(event) => setAmount(event.target.value)} /><span>고마</span></div>
        </label>
        <div className="student-investment-actions">
          <button type="button" disabled={!canInvest} onClick={() => setDraft({ type: 'invest', amount: investmentAmount })}>투자하기</button>
          <button type="button" className="is-secondary" disabled={!canWithdraw} onClick={() => position && setDraft({ type: 'withdraw', amount: position.currentAmount })}>투자금 찾기</button>
        </div>
      </div>
      {footerStatusMessage ? <p className="student-investment-status-message" aria-live="polite">{footerStatusMessage}</p> : null}
      {draft ? (
        <div className="student-stock-dialog-backdrop">
          <section ref={dialogRef} className="student-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="student-investment-dialog-title" tabIndex={-1}>
            <button type="button" className="student-stock-dialog-close" aria-label="확인창 닫기" disabled={isSaving} onClick={() => setDraft(null)}><X aria-hidden="true" /></button>
            <span className="student-stock-dialog-kicker">{selectedStock.name}</span>
            <h2 id="student-investment-dialog-title">{draft.amount} 고마를 {draft.type === 'invest' ? '투자할까요?' : '찾을까요?'}</h2>
            <p>{draft.type === 'invest' ? '내가 가진 고마에서 빠져요.' : '현재 금액이 내 고마로 돌아와요.'}</p>
            <div className="student-stock-dialog-actions"><button type="button" disabled={isSaving} onClick={() => setDraft(null)}>취소</button><button type="button" disabled={isSaving} onClick={() => void confirm()}>확인</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
