import { useState } from 'react';
import { Clock, Store } from 'lucide-react';

interface EntrySelectPageProps {
  onSelectNumber: (studentNumber: number) => void;
}

const ENTRY_NUMBERS = Array.from({ length: 24 }, (_, index) => index);

export default function EntrySelectPage({ onSelectNumber }: EntrySelectPageProps) {
  const [zeroUnlockClickCount, setZeroUnlockClickCount] = useState(0);
  const [isZeroVisible, setIsZeroVisible] = useState(false);
  const visibleEntryNumbers = isZeroVisible ? ENTRY_NUMBERS : ENTRY_NUMBERS.filter((studentNumber) => studentNumber !== 0);

  const handleZeroUnlockClick = () => {
    if (isZeroVisible) return;

    setZeroUnlockClickCount((previous) => {
      const nextCount = previous + 1;
      if (nextCount >= 5) {
        setIsZeroVisible(true);
        return 0;
      }

      return nextCount;
    });
  };

  return (
    <div className="entry-select-page">
      <button
        type="button"
        onClick={handleZeroUnlockClick}
        className="entry-admin-reveal"
        aria-label="0번 표시 숨김 버튼"
        title=""
      />
      <main className="entry-select-main">
        <section className="entry-select-surface">
          <div className="entry-select-header">
            <h1 className="entry-select-title">번호 선택</h1>
          </div>

          <div className="entry-number-grid">
            {visibleEntryNumbers.map((studentNumber) => {
              const isClockEntry = studentNumber === 0;
              return (
                <button
                  key={studentNumber}
                  type="button"
                  onClick={() => onSelectNumber(studentNumber)}
                  className={`entry-number-button${isClockEntry ? ' entry-number-button-admin' : ''}`}
                  aria-label={isClockEntry ? '0번 학급 시계 선택' : `${studentNumber}번 경매장 선택`}
                >
                  <span className="entry-number-icon" aria-hidden="true">
                    {isClockEntry ? <Clock size={20} /> : <Store size={20} />}
                  </span>
                  <span className="entry-number-value">{studentNumber}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
