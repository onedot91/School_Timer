import { useEffect, useState } from 'react';
import AuctionPage from './pages/AuctionPage';
import EntrySelectPage from './pages/EntrySelectPage';
import TimerPage from './pages/TimerPage';

const SELECTED_ENTRY_NUMBER_STORAGE_KEY = 'school-timer-entry-number-v1';

const isChromeOS = () => {
  if (typeof window === 'undefined') return false;
  return window.navigator.userAgent.includes('CrOS');
};

const getStoredEntryNumber = () => {
  if (typeof window === 'undefined') return null;
  const savedValue = window.localStorage.getItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY);
  if (savedValue === null) return null;
  const parsedValue = Number.parseInt(savedValue, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 23
    ? parsedValue
    : null;
};

export default function RootApp() {
  const [hasRuntimeError, setHasRuntimeError] = useState(false);
  const [selectedEntryNumber, setSelectedEntryNumber] = useState<number | null>(() => getStoredEntryNumber());

  const selectEntryNumber = (studentNumber: number) => {
    window.localStorage.setItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY, String(studentNumber));
    setSelectedEntryNumber(studentNumber);
  };

  const changeEntryNumber = () => {
    window.localStorage.removeItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY);
    setSelectedEntryNumber(null);
  };

  useEffect(() => {
    const handleRuntimeError = (event: ErrorEvent | PromiseRejectionEvent) => {
      console.error('School Timer runtime failed.', 'reason' in event ? event.reason : event.error);
      setHasRuntimeError(true);
    };

    window.addEventListener('error', handleRuntimeError);
    window.addEventListener('unhandledrejection', handleRuntimeError);

    return () => {
      window.removeEventListener('error', handleRuntimeError);
      window.removeEventListener('unhandledrejection', handleRuntimeError);
    };
  }, []);

  useEffect(() => {
    const handleEntryResetShortcut = (event: KeyboardEvent) => {
      const isEnter = event.key === 'Enter' || event.code === 'Enter';
      if (!isEnter) return;

      const isEntryResetShortcut = isChromeOS()
        ? event.altKey && event.ctrlKey && !event.metaKey
        : event.altKey && event.metaKey && !event.ctrlKey;
      if (!isEntryResetShortcut) return;

      event.preventDefault();
      changeEntryNumber();
    };

    window.addEventListener('keydown', handleEntryResetShortcut);
    return () => window.removeEventListener('keydown', handleEntryResetShortcut);
  }, []);

  if (hasRuntimeError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F2E8] p-6 text-[#26322A]">
        <section className="w-full max-w-md rounded-2xl border border-[#D7E2D1] bg-white p-6 text-center shadow-lg">
          <h1 className="text-2xl font-extrabold">화면을 다시 불러와 주세요</h1>
          <p className="mt-3 text-sm font-bold text-[#5D6B60]">
            설정을 적용하는 중 문제가 생겼습니다. 새로고침하면 저장된 설정으로 다시 시작합니다.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-[#5C8D5D] px-5 py-3 text-sm font-extrabold text-white"
          >
            새로고침
          </button>
        </section>
      </main>
    );
  }

  if (selectedEntryNumber === null) {
    return <EntrySelectPage onSelectNumber={selectEntryNumber} />;
  }

  if (selectedEntryNumber === 0) {
    return <TimerPage />;
  }

  return <AuctionPage studentNumber={selectedEntryNumber} />;
}
