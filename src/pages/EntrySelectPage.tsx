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
    <div className="entry-select-page relative min-h-[100dvh] w-full overflow-y-auto px-4 py-6 sm:px-6 md:py-10">
      <button
        type="button"
        onClick={handleZeroUnlockClick}
        className="absolute left-3 top-3 h-8 w-8 rounded-full border border-[#006241]/10 bg-white/20 text-[#006241]/15 transition-colors hover:bg-white/35 hover:text-[#006241]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006241]/20"
        aria-label="0번 표시 숨김 버튼"
        title=""
      />
      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col justify-center">
        <section className="rounded-[2rem] border border-[#D7E6DE] bg-white/92 p-5 shadow-[0_24px_60px_rgba(31,24,18,0.14)] sm:p-7 md:p-9">
          <div className="mb-6 flex flex-col gap-2 border-b border-[#E6D5C9] pb-5">
            <h1 className="section-title text-[2rem] font-extrabold leading-none text-[#006241] md:text-[2.6rem]">
              번호 선택
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {visibleEntryNumbers.map((studentNumber) => {
              const isClockEntry = studentNumber === 0;
              return (
                <button
                  key={studentNumber}
                  type="button"
                  onClick={() => onSelectNumber(studentNumber)}
                  className={`flex min-h-[6.25rem] flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 px-3 py-4 text-center shadow-[0_10px_20px_rgba(31,24,18,0.08)] transition-transform hover:-translate-y-0.5 active:translate-y-0 ${
                    isClockEntry
                      ? 'border-[#9FC7B8] bg-[#EAF6F0] text-[#006241]'
                      : 'border-[#E6D5C9] bg-[#FFFDF8] text-[#2F241D] hover:border-[#9FC7B8] hover:bg-[#F8FCF6]'
                  }`}
                  aria-label={isClockEntry ? '0번 학급 시계 선택' : `${studentNumber}번 경매장 선택`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/86 shadow-inner">
                    {isClockEntry ? <Clock size={21} /> : <Store size={21} />}
                  </span>
                  <span className="font-mono text-[1.7rem] font-black leading-none">{studentNumber}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
