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

export default function StudentBankPage({ state, studentNumber, isSaving, onAction }: StudentBankPageProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientNumber, setRecipientNumber] = useState(studentNumber === 1 ? '2' : '1');
  const [activeModal, setActiveModal] = useState<BankModal>(null);
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
  const numericDepositAmount = Math.floor(Number(depositAmount));
  const numericLoanAmount = Math.floor(Number(loanAmount));
  const numericTransferAmount = Math.floor(Number(transferAmount));
  const numericRecipientNumber = Math.floor(Number(recipientNumber));
  const isValidBankAmount = (amount: number) => Number.isInteger(amount) && amount >= 10 && amount % 10 === 0;
  const isDepositAmount = isValidBankAmount(numericDepositAmount);
  const isLoanAmount = isValidBankAmount(numericLoanAmount) && numericLoanAmount <= 50;
  const isTransferAmount = Number.isInteger(numericTransferAmount) && numericTransferAmount >= 5 && numericTransferAmount <= 30;
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
  const submit = async (action: StudentEconomyAction) => {
    const saved = await onAction(action);
    if (saved) setActiveModal(null);
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
    void submit(canClaimActiveDeposit
      ? { type: 'claim_deposit', depositId: activeDeposit.id, dateKey: today }
      : { type: 'close_deposit', depositId: activeDeposit.id });
  };
  const handleConfirm = () => {
    if (activeModal === 'deposit' && isDepositAmount) {
      void submit({ type: 'open_deposit', amount: numericDepositAmount, dateKey: today });
    } else if (activeModal === 'loan') {
      if (state.loan > 0) void submit({ type: 'repay', amount: state.loan });
      else if (isLoanAmount) void submit({ type: 'borrow', amount: numericLoanAmount, dateKey: today });
    } else if (activeModal === 'transfer' && canTransfer) {
      void submit({ type: 'transfer', amount: numericTransferAmount, recipientNumber: numericRecipientNumber, dateKey: today });
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
          <button className={activeDeposit && !canClaimActiveDeposit ? 'student-bank-break-button' : undefined} disabled={isSaving} onClick={handleDepositButton}>{activeDeposit ? canClaimActiveDeposit ? '예금 받기' : '예금 깨기' : '예금 (고마 맡기기)'}</button>
        </article>
        <article>
          <img className="student-bank-card-scene" src={state.loan > 0 ? '/bank-repayment-scene.png' : '/bank-loan-scene.png'} alt={state.loan > 0 ? '상환 안내 그림' : '대출 안내 그림'} />
          <div className="student-bank-summary student-bank-loan-summary">
            <div className="student-bank-card-amount"><small>{state.loan > 0 ? '갚을 고마' : '빌린 고마'}</small><strong>{state.loan} 고마</strong></div>
            <b className={state.loan > 0 ? 'student-bank-outcome' : 'student-bank-empty'}>{state.loan > 0 ? `${loanDueLabel}까지 갚기` : '빌린 고마 없음'}</b>
          </div>
          <button className={state.loan > 0 ? 'student-bank-repay-button' : undefined} disabled={isSaving} onClick={() => setActiveModal('loan')}>{state.loan > 0 ? '상환(고마 갚기)' : '대출 (고마 빌리기)'}</button>
        </article>
        <article>
          <img className="student-bank-card-scene" src="/bank-transfer-scene.png" alt="송금 안내 그림" />
          <div className="student-bank-summary">
            <div className="student-bank-card-amount"><small>오늘 보낼 수 있는 횟수</small><strong>하루 1회</strong></div>
            <b className="student-bank-outcome">최대 30고마 · 한 명</b>
          </div>
          <button disabled={isSaving || hasTransferredToday} onClick={() => setActiveModal('transfer')}>송금 (고마 보내기)</button>
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
            <label className="student-bank-amount-field"><span>맡길 고마</span><input type="number" min="10" max="500" step="10" placeholder="예: 20" aria-describedby="deposit-amount-hint" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} /><span>고마</span></label>
            <p id="deposit-amount-hint" className="student-bank-amount-hint">10고마 단위 · 예: 20</p>
            {isDepositAmount ? <div className="student-bank-interest-flow" aria-label={`${numericDepositAmount} 고마를 맡기면 ${numericDepositAmount + depositInterest} 고마를 받습니다.`}><span>{numericDepositAmount} 고마</span><i>보관</i><b>+{depositInterest} 고마</b><strong>{numericDepositAmount + depositInterest} 고마</strong></div> : <p className="student-bank-amount-example">20 고마 → 22 고마</p>}
            <p className="student-bank-rule">월~수: 이틀 뒤 · 목·금: 다음주 월요일 · 중도 해지: 원금만</p>
          </div>
        ) : null}
        {activeModal === 'loan' ? (
          <div className="student-bank-modal-form">
            {state.loan > 0 ? <p className="student-bank-rule">갚을 고마 {state.loan} 고마 · 한 번에 모두 갚기</p> : <><label className="student-bank-amount-field"><span>빌릴 고마</span><input type="number" min="10" max="50" step="10" placeholder="예: 30" aria-describedby="loan-amount-hint" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} /><span>고마</span></label><p id="loan-amount-hint" className="student-bank-amount-hint">10고마 단위 · 예: 30</p>{isLoanAmount ? <div className="student-bank-interest-flow student-bank-loan-flow" aria-label={`${numericLoanAmount} 고마를 빌리면 ${loanRepayment} 고마를 갚습니다.`}><span>{numericLoanAmount} 고마</span><i>일주일 뒤</i><b>갚기</b><strong>{loanRepayment} 고마</strong></div> : <p className="student-bank-amount-example student-bank-loan-example">30 고마 → 33 고마</p>}<p className="student-bank-rule">최대 50고마 · 일주일 안에 갚기</p></>}
          </div>
        ) : null}
        {activeModal === 'transfer' ? (
          <div className="student-bank-modal-form">
            <label className="student-bank-amount-field"><span>보낼 고마</span><input type="number" min="5" max="30" step="5" placeholder="예: 20" aria-describedby="transfer-amount-hint" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /><span>고마</span></label>
            <p id="transfer-amount-hint" className="student-bank-amount-hint">5고마 단위 · 예: 20</p>
            <label className="student-bank-recipient"><span>받는 학생</span><select value={recipientNumber} onChange={(event) => setRecipientNumber(event.target.value)}>{Array.from({ length: 23 }, (_, index) => index + 1).filter((number) => number !== studentNumber).map((number) => <option key={number} value={number}>{number}번</option>)}</select></label>
            <p className="student-bank-rule">최대 30고마 · 오늘 한 명에게만</p>
          </div>
        ) : null}
      </StudentConfirmDialog>
    </section>
  );
}
