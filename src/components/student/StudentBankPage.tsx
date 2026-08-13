import { useState } from 'react';
import type { StudentEconomyAction, StudentEconomyState } from '../../lib/studentEconomy';
import StudentConfirmDialog from './StudentConfirmDialog';

interface StudentBankPageProps {
  state: StudentEconomyState;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

export default function StudentBankPage({ state, isSaving, onAction }: StudentBankPageProps) {
  const [amount, setAmount] = useState('5');
  const [pendingAction, setPendingAction] = useState<'deposit' | 'save' | 'repay' | null>(null);
  const numericAmount = Math.floor(Number(amount));
  const isValid = Number.isInteger(numericAmount) && numericAmount >= 5 && numericAmount <= 500;
  const run = (type: 'deposit' | 'withdraw' | 'save' | 'borrow' | 'repay') => {
    if (!isValid) return;
    if (type === 'deposit' || type === 'save' || type === 'repay') {
      setPendingAction(type);
      return;
    }
    void onAction({ type, amount: numericAmount });
  };
  const actionName = pendingAction === 'deposit' ? '예금에 맡기기' : pendingAction === 'save' ? '적금에 넣기' : '대출 갚기';

  return (
    <section className="student-economy-panel" aria-labelledby="student-bank-title">
      <div className="student-economy-title-row">
        <h2 id="student-bank-title" className="sr-only">은행 거래</h2>
        <label className="student-economy-amount">
          <span className="student-economy-amount-label">거래 금액</span>
          <input
            type="number"
            min="5"
            max="500"
            step="5"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span>고마</span>
        </label>
      </div>
      <div className="student-bank-grid">
        <article>
          <span>예금</span><strong>{state.deposit}</strong>
          <div><button disabled={isSaving || !isValid} onClick={() => run('deposit')}>맡기기</button><button disabled={isSaving || !isValid} onClick={() => run('withdraw')}>찾기</button></div>
        </article>
        <article>
          <span>적금</span><strong>{state.savings}</strong>
          <button disabled={isSaving || !isValid} onClick={() => run('save')}>넣기</button>
        </article>
        <article>
          <span>대출</span><strong>{state.loan}</strong>
          <div><button disabled={isSaving || !isValid} onClick={() => run('borrow')}>빌리기</button><button disabled={isSaving || !isValid} onClick={() => run('repay')}>갚기</button></div>
        </article>
      </div>
      <StudentConfirmDialog
        isOpen={pendingAction !== null}
        kicker={actionName}
        title={`${numericAmount} 고마를 사용할까요?`}
        description="금액이 맞는지 한 번 더 확인해 주세요."
        confirmLabel={actionName}
        isPending={isSaving}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) return;
          void onAction({ type: pendingAction, amount: numericAmount }).then((saved) => {
            if (saved) setPendingAction(null);
          });
        }}
      />
    </section>
  );
}
