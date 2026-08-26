import { useState } from 'react';
import { getKoreanDateKey, getRelativeKoreanWeekdayLabel, type StudentEconomyAction, type StudentEconomyState } from '../../lib/studentEconomy';
import StudentConfirmDialog from './StudentConfirmDialog';

interface StudentBankPageProps {
  state: StudentEconomyState;
  studentNumber: number;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

type BankModal = 'deposit' | 'loan' | 'transfer' | null;
type PendingBankAction = Exclude<BankModal, null>;
type BankRule = {
  readonly term: string;
  readonly explanation: string;
};

export const STUDENT_BANK_RULES = {
  deposit: [
    { term: '예금 만기', explanation: '월요일부터 수요일에 맡기면 이틀 뒤에 받아요. 목요일이나 금요일에 맡기면 다음 주 월요일에 받아요.' },
    { term: '중도 해지', explanation: '약속한 날보다 일찍 찾으면 이자는 없고 맡긴 고마만 받아요.' },
  ],
  loan: [
    { term: '대출 한도', explanation: '한 번에 최대 50고마까지 빌릴 수 있어요.' },
    { term: '상환 기한', explanation: '빌린 날부터 일주일 안에 모두 갚아야 해요.' },
  ],
  repayment: [
    { term: '전액 상환', explanation: '남은 고마를 한 번에 모두 갚아요.' },
  ],
  transfer: [
    { term: '송금 한도', explanation: '한 번에 최대 30고마까지 보낼 수 있어요.' },
    { term: '송금 횟수', explanation: '하루에 한 명에게 한 번만 보낼 수 있어요.' },
  ],
} as const;

function BankRuleList({ rules }: { readonly rules: readonly BankRule[] }) {
  return (
    <ul className="student-bank-rule">
      {rules.map(({ term, explanation }) => (
        <li key={term}>
          <strong>{term}</strong>
          <span>({explanation})</span>
        </li>
      ))}
    </ul>
  );
}

export default function StudentBankPage({ state, studentNumber, isSaving, onAction }: StudentBankPageProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientNumber, setRecipientNumber] = useState(studentNumber === 1 ? '2' : '1');
  const [activeModal, setActiveModal] = useState<BankModal>(null);
  const [pendingAction, setPendingAction] = useState<PendingBankAction | null>(null);
  const today = getKoreanDateKey();
  const loanDueLabel = state.loanDueDate ? getRelativeKoreanWeekdayLabel(today, state.loanDueDate) : '일주일 안';
  const depositPayout = state.deposits.reduce((total, deposit) => total + deposit.principal + deposit.interest, 0);
  const nextDepositMaturityDate = state.deposits
    .map((deposit) => deposit.maturityDate)
    .filter(Boolean)
    .sort()[0] ?? null;
  const activeDeposit = state.deposits[0] ?? null;
  const canClaimActiveDeposit = activeDeposit !== null
    && Boolean(activeDeposit.maturityDate)
    && activeDeposit.maturityDate <= today;
  const hasTransferredToday = state.lastTransferDateKey === today;
  const numericDepositAmount = Number(depositAmount);
  const numericLoanAmount = Number(loanAmount);
  const numericTransferAmount = Number(transferAmount);
  const numericRecipientNumber = Math.floor(Number(recipientNumber));
  const isValidBankAmount = (amount: number) => Number.isInteger(amount) && amount >= 1;
  const isDepositAmount = isValidBankAmount(numericDepositAmount);
  const isLoanAmount = isValidBankAmount(numericLoanAmount) && numericLoanAmount <= 50;
  const isTransferAmount = Number.isInteger(numericTransferAmount) && numericTransferAmount >= 1 && numericTransferAmount <= 30;
  const depositInterest = isDepositAmount ? Math.round(numericDepositAmount / 10) : 0;
  const loanRepayment = isLoanAmount ? numericLoanAmount + Math.round(numericLoanAmount / 10) : 0;
  const canTransfer = isTransferAmount && numericRecipientNumber !== studentNumber && numericRecipientNumber >= 1 && numericRecipientNumber <= 23;
  const modalTitle = activeModal === 'deposit' ? '고마 맡기기' : activeModal === 'loan' ? state.loan > 0 ? '고마 갚기' : '고마 빌리기' : '고마 보내기';
  const modalDescription = activeModal === 'deposit'
    ? '얼마를 맡길까요?'
    : activeModal === 'loan'
      ? state.loan > 0 ? '갚을 고마를 확인하세요.' : '얼마를 빌릴까요?'
      : '누구에게 보낼까요?';
  const confirmLabel = activeModal === 'deposit' ? '예금 들기' : activeModal === 'loan' ? state.loan > 0 ? '전액 갚기' : '대출받기' : '보내기';
  const isConfirmDisabled = activeModal === 'deposit'
    ? !isDepositAmount
    : activeModal === 'loan'
      ? state.loan === 0 && !isLoanAmount
      : !canTransfer;
  const submit = (source: PendingBankAction, action: StudentEconomyAction) => {
    const pending = onAction(action);
    setActiveModal(null);
    setPendingAction(source);
    void pending.then(
      () => setPendingAction(null),
      () => setPendingAction(null),
    );
  };
  const openDepositModal = () => {
    setDepositAmount('');
    setActiveModal('deposit');
  };
  const handleDepositButton = () => {
    if (!activeDeposit) {
      openDepositModal();
      return;
    }
    submit('deposit', canClaimActiveDeposit
      ? { type: 'claim_deposit', depositId: activeDeposit.id, dateKey: today }
      : { type: 'close_deposit', depositId: activeDeposit.id });
  };
  const handleConfirm = () => {
    if (activeModal === 'deposit' && isDepositAmount) {
      submit('deposit', { type: 'open_deposit', amount: numericDepositAmount, dateKey: today });
    } else if (activeModal === 'loan') {
      if (state.loan > 0) submit('loan', { type: 'repay', amount: state.loan });
      else if (isLoanAmount) submit('loan', { type: 'borrow', amount: numericLoanAmount, dateKey: today });
    } else if (activeModal === 'transfer' && canTransfer) {
      submit('transfer', { type: 'transfer', amount: numericTransferAmount, recipientNumber: numericRecipientNumber, dateKey: today });
    }
  };

  return (
    <section className="student-economy-panel" aria-label="은행">
      <div className="student-bank-grid">
        <article>
          <img className="student-bank-card-scene" src="/bank-deposit-scene.png" alt="예금 안내 그림" />
          <div className="student-bank-summary">
            <div className="student-bank-card-amount"><small>맡긴 고마</small><strong>{state.deposit} 고마</strong></div>
            {state.deposits.length > 0 ? <div className="student-bank-outcome"><b>→ 만기 {depositPayout} 고마</b><span>{nextDepositMaturityDate ? getRelativeKoreanWeekdayLabel(today, nextDepositMaturityDate) : `진행 중 ${state.deposits.length}건`}</span></div> : <b className="student-bank-empty">맡긴 고마 없음</b>}
          </div>
          <button type="button" className={activeDeposit && !canClaimActiveDeposit ? 'student-bank-break-button' : undefined} disabled={isSaving} onClick={handleDepositButton}>{pendingAction === 'deposit' ? '처리 중' : activeDeposit ? canClaimActiveDeposit ? '예금 받기' : '예금 깨기' : '예금 (고마 맡기기)'}</button>
        </article>
        <article>
          <img className="student-bank-card-scene" src={state.loan > 0 ? '/bank-repayment-scene.png' : '/bank-loan-scene.png'} alt={state.loan > 0 ? '상환 안내 그림' : '대출 안내 그림'} />
          <div className="student-bank-summary student-bank-loan-summary">
            <div className="student-bank-card-amount"><small>{state.loan > 0 ? '갚을 고마' : '빌린 고마'}</small><strong>{state.loan} 고마</strong></div>
            <b className={state.loan > 0 ? 'student-bank-outcome' : 'student-bank-empty'}>{state.loan > 0 ? `${loanDueLabel}까지 갚기` : '빌린 고마 없음'}</b>
          </div>
          <button type="button" className={state.loan > 0 ? 'student-bank-repay-button' : undefined} disabled={isSaving} onClick={() => setActiveModal('loan')}>{pendingAction === 'loan' ? '처리 중' : state.loan > 0 ? '상환(고마 갚기)' : '대출 (고마 빌리기)'}</button>
        </article>
        <article>
          <img className="student-bank-card-scene" src="/bank-transfer-scene.png" alt="송금 안내 그림" />
          <div className="student-bank-summary">
            <div className="student-bank-card-amount"><small>오늘 보낼 수 있는 횟수</small><strong>하루 1회</strong></div>
            <b className="student-bank-outcome">최대 30고마 · 한 명</b>
          </div>
          <button type="button" disabled={isSaving || hasTransferredToday} onClick={() => setActiveModal('transfer')}>{pendingAction === 'transfer' ? '처리 중' : '송금 (고마 보내기)'}</button>
        </article>
      </div>
      <StudentConfirmDialog
        isOpen={activeModal !== null}
        title={modalTitle}
        description={modalDescription}
        confirmLabel={confirmLabel}
        isPending={isSaving}
        isConfirmDisabled={isConfirmDisabled}
        onCancel={() => setActiveModal(null)}
        onConfirm={handleConfirm}
      >
        {activeModal === 'deposit' ? (
          <div className="student-bank-modal-form">
            <label className="student-bank-amount-field" htmlFor="student-bank-deposit-amount"><span>맡길 고마</span><input id="student-bank-deposit-amount" type="number" min="1" max="500" step="1" placeholder="예: 20" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} /><span>고마</span></label>
            {isDepositAmount ? <div className="student-bank-interest-flow" aria-label={`${numericDepositAmount} 고마를 맡기면 ${numericDepositAmount + depositInterest} 고마를 받습니다.`}><span>{numericDepositAmount} 고마</span><i>보관</i><b>+{depositInterest} 고마</b><strong>{numericDepositAmount + depositInterest} 고마</strong></div> : null}
            <BankRuleList rules={STUDENT_BANK_RULES.deposit} />
          </div>
        ) : null}
        {activeModal === 'loan' ? (
          <div className="student-bank-modal-form">
            {state.loan > 0 ? <BankRuleList rules={STUDENT_BANK_RULES.repayment} /> : <><label className="student-bank-amount-field" htmlFor="student-bank-loan-amount"><span>빌릴 고마</span><input id="student-bank-loan-amount" type="number" min="1" max="50" step="1" placeholder="예: 30" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} /><span>고마</span></label>{isLoanAmount ? <div className="student-bank-interest-flow student-bank-loan-flow" aria-label={`${numericLoanAmount} 고마를 빌리면 ${loanRepayment} 고마를 갚습니다.`}><span>{numericLoanAmount} 고마</span><i>일주일 뒤</i><b>갚기</b><strong>{loanRepayment} 고마</strong></div> : null}<BankRuleList rules={STUDENT_BANK_RULES.loan} /></>}
          </div>
        ) : null}
        {activeModal === 'transfer' ? (
          <div className="student-bank-modal-form">
            <label className="student-bank-amount-field" htmlFor="student-bank-transfer-amount"><span>보낼 고마</span><input id="student-bank-transfer-amount" type="number" min="1" max="30" step="1" placeholder="예: 20" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /><span>고마</span></label>
            <label className="student-bank-recipient" htmlFor="student-bank-transfer-recipient"><span>받는 학생</span><select id="student-bank-transfer-recipient" value={recipientNumber} onChange={(event) => setRecipientNumber(event.target.value)}>{Array.from({ length: 23 }, (_, index) => index + 1).filter((number) => number !== studentNumber).map((number) => <option key={number} value={number}>{number}번</option>)}</select></label>
            <BankRuleList rules={STUDENT_BANK_RULES.transfer} />
          </div>
        ) : null}
      </StudentConfirmDialog>
    </section>
  );
}
