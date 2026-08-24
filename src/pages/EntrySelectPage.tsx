import { useState, type FormEvent } from 'react';
import { Clock, Store } from 'lucide-react';
import type { BrowserDeviceSession } from '../lib/deviceSessionClient';

interface EntrySelectPageProps {
  onSelectNumber: (studentNumber: number, registrationKey?: string) => Promise<void>;
  requiresRegistration: boolean;
  deviceSession: BrowserDeviceSession | null;
}

const ENTRY_NUMBERS = Array.from({ length: 24 }, (_, index) => index);

export default function EntrySelectPage({
  onSelectNumber,
  requiresRegistration,
  deviceSession,
}: EntrySelectPageProps) {
  const [zeroUnlockClickCount, setZeroUnlockClickCount] = useState(0);
  const [isZeroVisible, setIsZeroVisible] = useState(false);
  const [pendingEntryNumber, setPendingEntryNumber] = useState<number | null>(null);
  const [registrationKey, setRegistrationKey] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
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

  const selectNumber = (studentNumber: number) => {
    const canUseExistingSession = deviceSession?.role === 'teacher'
      || (deviceSession?.role === 'student' && deviceSession.studentNumber === studentNumber);
    if (!requiresRegistration || canUseExistingSession) {
      void onSelectNumber(studentNumber);
      return;
    }
    setPendingEntryNumber(studentNumber);
    setRegistrationKey('');
    setRegistrationError('');
  };

  const registerNumber = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingEntryNumber === null || registrationKey.length === 0 || isRegistering) return;
    setIsRegistering(true);
    setRegistrationError('');
    try {
      await onSelectNumber(pendingEntryNumber, registrationKey);
    } catch {
      setRegistrationError('승인 키가 올바르지 않습니다. 교사에게 확인해 주세요.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="entry-select-page">
      {!isZeroVisible ? (
        <button
          type="button"
          onClick={handleZeroUnlockClick}
          className="entry-admin-reveal"
          aria-label="0번 표시 잠금 해제"
        />
      ) : null}
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
                  onClick={() => selectNumber(studentNumber)}
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
      {pendingEntryNumber !== null ? (
        <div className="entry-registration-backdrop" role="presentation">
          <section className="entry-registration-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-registration-title">
            <form onSubmit={registerNumber}>
              <h2 id="entry-registration-title" className="entry-registration-title">
                {pendingEntryNumber}번 기기 등록
              </h2>
              <p className="entry-registration-description">
                교사가 이 기기를 확인한 뒤 승인 키를 입력해 주세요.
              </p>
              <label className="entry-registration-label" htmlFor="device-registration-key">
                교사 승인 키
              </label>
              <input
                id="device-registration-key"
                type="password"
                value={registrationKey}
                onChange={(event) => setRegistrationKey(event.target.value)}
                className="entry-registration-input"
                autoComplete="off"
                autoFocus
                disabled={isRegistering}
              />
              {registrationError ? <p className="entry-registration-error" role="alert">{registrationError}</p> : null}
              <div className="entry-registration-actions">
                <button
                  type="button"
                  className="entry-registration-cancel"
                  onClick={() => setPendingEntryNumber(null)}
                  disabled={isRegistering}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="entry-registration-submit"
                  disabled={registrationKey.length === 0 || isRegistering}
                >
                  {isRegistering ? '확인 중…' : '등록'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
