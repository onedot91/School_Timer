import { useEffect, useState } from 'react';
import AuctionPage from './pages/AuctionPage';
import EntrySelectPage from './pages/EntrySelectPage';
import TimerPage from './pages/TimerPage';

const SELECTED_ENTRY_NUMBER_STORAGE_KEY = 'school-timer-entry-number-v1';

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
    const handleEntryResetShortcut = (event: KeyboardEvent) => {
      const isEnter = event.key === 'Enter' || event.code === 'Enter';
      if (!isEnter) return;

      if (!event.altKey || !event.metaKey) return;

      event.preventDefault();
      changeEntryNumber();
    };

    window.addEventListener('keydown', handleEntryResetShortcut);
    return () => window.removeEventListener('keydown', handleEntryResetShortcut);
  }, []);

  if (selectedEntryNumber === null) {
    return <EntrySelectPage onSelectNumber={selectEntryNumber} />;
  }

  if (selectedEntryNumber === 0) {
    return <TimerPage />;
  }

  return <AuctionPage studentNumber={selectedEntryNumber} />;
}
