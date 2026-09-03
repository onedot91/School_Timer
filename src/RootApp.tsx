import { lazy, Suspense, useEffect, useState } from 'react';
import { StudentRapidClickGuard } from './components/student/StudentRapidClickGuard';
import { StudentProfanityGuard } from './components/student/StudentProfanityGuard';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import {
  clearDeviceSession,
  loadDeviceSession,
  registerDeviceSession,
  type BrowserDeviceSession,
} from './lib/deviceSessionClient';
import { appDataMode } from './lib/dataMode';
import { detectEntryResetPlatform, isEntryResetShortcut } from './lib/entryResetShortcut';
import { isSupabaseSettingsEnabled } from './lib/supabaseConfig';
import EntrySelectPage from './pages/EntrySelectPage';

const AuctionPage = lazy(() => import('./pages/AuctionPage'));
const TimerPage = lazy(() => import('./pages/TimerPage'));

const SELECTED_ENTRY_NUMBER_STORAGE_KEY = 'school-timer-entry-number-v1';
const TEACHER_ENTRY_VISIBLE_STORAGE_KEY = 'school-timer-teacher-entry-visible-v1';
const STUDENT_HOME_HASH = '#student-overview';

const PageLoadFallback = () => (
  <main className="entry-session-loading" aria-label="화면 불러오는 중" role="status" />
);

const getPlatformText = () => {
  if (typeof window === 'undefined') return '';

  const navigatorWithUserAgentData = window.navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };

  return [
    window.navigator.userAgent,
    window.navigator.platform,
    navigatorWithUserAgentData.userAgentData?.platform,
  ]
    .filter(Boolean)
    .join(' ');
};

const requiresDeviceRegistration = isSupabaseSettingsEnabled;

const getStoredEntryNumber = () => {
  if (typeof window === 'undefined') return null;
  let savedValue: string | null;
  try {
    savedValue = window.localStorage.getItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY);
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
  if (savedValue === null) return null;
  const parsedValue = Number.parseInt(savedValue, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 23
    ? parsedValue
    : null;
};

const storeEntryNumber = (studentNumber: number) => {
  try {
    window.localStorage.setItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY, String(studentNumber));
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
};

const clearStoredEntryNumber = () => {
  try {
    window.localStorage.removeItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY);
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
};

const getStoredTeacherEntryVisible = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TEACHER_ENTRY_VISIBLE_STORAGE_KEY) === 'true';
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};

const storeTeacherEntryVisible = () => {
  try {
    window.localStorage.setItem(TEACHER_ENTRY_VISIBLE_STORAGE_KEY, 'true');
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
};

export default function RootApp() {
  const [hasRuntimeError, setHasRuntimeError] = useState(false);
  const [selectedEntryNumber, setSelectedEntryNumber] = useState<number | null>(() => getStoredEntryNumber());
  const [deviceSession, setDeviceSession] = useState<BrowserDeviceSession | null>(null);
  const [isDeviceSessionReady, setIsDeviceSessionReady] = useState(!requiresDeviceRegistration);
  const [teacherEntryVisible, setTeacherEntryVisible] = useState(() => getStoredTeacherEntryVisible());

  const selectEntryNumber = async (studentNumber: number, registrationKey?: string) => {
    if (requiresDeviceRegistration) {
      const canUseExistingSession = deviceSession?.role === 'teacher'
        || (deviceSession?.role === 'student' && deviceSession.studentNumber === studentNumber);
      if (!canUseExistingSession) {
        if (studentNumber === 0 && !registrationKey) throw new Error('DEVICE_REGISTRATION_KEY_REQUIRED');
        const nextSession = await registerDeviceSession(studentNumber, registrationKey);
        if (!nextSession) throw new Error('DEVICE_REGISTRATION_FAILED');
        setDeviceSession(nextSession);
      }
    }
    if (studentNumber === 0) {
      storeTeacherEntryVisible();
      setTeacherEntryVisible(true);
    }
    window.history.replaceState(
      null,
      '',
      studentNumber === 0
        ? `${window.location.pathname}${window.location.search}`
        : STUDENT_HOME_HASH,
    );
    storeEntryNumber(studentNumber);
    setSelectedEntryNumber(studentNumber);
  };

  const changeEntryNumber = async () => {
    if (requiresDeviceRegistration && deviceSession?.role === 'student') {
      await clearDeviceSession();
      setDeviceSession(null);
    }
    clearStoredEntryNumber();
    setSelectedEntryNumber(null);
  };

  useEffect(() => {
    if (!requiresDeviceRegistration) return;

    let cancelled = false;
    void loadDeviceSession()
      .then((session) => {
        if (cancelled) return;
        setDeviceSession(session);
        const storedNumber = getStoredEntryNumber();
        const canUseStoredNumber = session?.role === 'teacher'
          || (session?.role === 'student' && session.studentNumber === storedNumber);
        if (!canUseStoredNumber) {
          clearStoredEntryNumber();
          setSelectedEntryNumber(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredEntryNumber();
        setSelectedEntryNumber(null);
        setDeviceSession(null);
      })
      .finally(() => {
        if (!cancelled) setIsDeviceSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      if (!isEntryResetShortcut(event, detectEntryResetPlatform(getPlatformText()))) return;

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (
          target.isContentEditable
          || target.matches('input, textarea, select, [role="textbox"]')
        )
      ) {
        return;
      }

      event.preventDefault();
      void changeEntryNumber().catch((error: unknown) => {
        console.error('Failed to reset the registered entry number.', error);
      });
    };

    window.addEventListener('keydown', handleEntryResetShortcut);
    return () => window.removeEventListener('keydown', handleEntryResetShortcut);
  }, [deviceSession]);

  if (!isDeviceSessionReady) {
    return (
      <>
        <NetworkStatusBanner />
        <main className="entry-session-loading" aria-label="기기 등록 확인 중" />
      </>
    );
  }

  if (hasRuntimeError) {
    return (
      <>
        <NetworkStatusBanner />
        <main className="runtime-fallback-page">
          <section className="runtime-fallback-surface">
            <h1 className="runtime-fallback-title">화면을 다시 불러와 주세요</h1>
            <p className="runtime-fallback-description">
              설정을 적용하는 중 문제가 생겼습니다. 새로고침하면 저장된 설정으로 다시 시작합니다.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="runtime-fallback-action"
            >
              새로고침
            </button>
          </section>
        </main>
      </>
    );
  }

  let activePage;

  if (selectedEntryNumber === null) {
    activePage = (
      <EntrySelectPage
        onSelectNumber={selectEntryNumber}
        requiresRegistration={requiresDeviceRegistration}
        deviceSession={deviceSession}
        teacherEntryVisible={teacherEntryVisible || deviceSession?.role === 'teacher'}
      />
    );
  } else if (selectedEntryNumber === 0) {
    activePage = <TimerPage />;
  } else {
    activePage = (
      <StudentProfanityGuard>
        <StudentRapidClickGuard>
          <AuctionPage studentNumber={selectedEntryNumber} />
        </StudentRapidClickGuard>
      </StudentProfanityGuard>
    );
  }

  return (
    <>
      {appDataMode !== 'production' ? (
        <aside className={`data-mode-banner data-mode-banner-${appDataMode}`} role="status">
          <strong>{appDataMode === 'readonly' ? '실제 데이터 보기 전용' : '연습 모드'}</strong>
          <span>
            {appDataMode === 'readonly'
              ? '저장과 거래는 실제 데이터에 반영되지 않아요.'
              : '실제 학생 고마에는 반영되지 않아요.'}
          </span>
        </aside>
      ) : null}
      <NetworkStatusBanner />
      <Suspense fallback={<PageLoadFallback />}>
        {activePage}
      </Suspense>
    </>
  );
}
