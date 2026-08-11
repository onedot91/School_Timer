import { useState } from 'react';
import type { StudentEconomyAction, StudentEconomyState } from '../../lib/studentEconomy';

interface StudentBankPageProps {
  state: StudentEconomyState;
  isSaving: boolean;
  onAction: (action: StudentEconomyAction) => Promise<boolean>;
}

export default function StudentBankPage({ state, isSaving, onAction }: StudentBankPageProps) {
  const [amount, setAmount] = useState('5');
  const numericAmount = Math.floor(Number(amount));
  const isValid = Number.isInteger(numericAmount) && numericAmount >= 5 && numericAmount <= 500;
  const run = (type: 'deposit' | 'withdraw' | 'save' | 'borrow' | 'repay') => {
    if (isValid) void onAction({ type, amount: numericAmount });
  };

  return (
    <section className="student-economy-panel" aria-labelledby="student-bank-title">
      <div className="student-economy-title-row">
        <h2 id="student-bank-title">은행</h2>
        <label className="student-economy-amount">
          <span className="sr-only">거래 금액</span>
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
    </section>
  );
}
