import { lazy, Suspense, useEffect, useState } from 'react';
import { StudentRapidClickGuard } from './components/student/StudentRapidClickGuard';
import { StudentProfanityGuard } from './components/student/StudentProfanityGuard';
import { AppLoadingScreen, AppRecoveryScreen } from './components/AppRecovery';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { StorageAvailabilityBanner } from './components/StorageAvailabilityBanner';
import { startSaveFailureReporting } from './lib/saveFailureClient';
import {
  clearDeviceSession,
  loadDeviceSession,
  registerDeviceSession,
  type BrowserDeviceSession,
} from './lib/deviceSessionClient';
import { appDataMode } from './lib/dataMode';
import { detectEntryResetPlatform, isEntryResetShortcut } from './lib/entryResetShortcut';
import { isSupabaseSettingsEnabled } from './lib/supabaseConfig';
import { captureStorageResponseContext } from './lib/storageResponseOrder';
import { startSaveRecovery } from './lib/saveRecovery';
import { retainStorageResponseActor } from './lib/storageResponseOrder';
import { canReloadWithDrafts } from './lib/draftReloadSafety';
import { GOMA_LOADING_PRELOAD_SRCS } from './lib/gomaLoadingArt';
import EntrySelectPage from './pages/EntrySelectPage';

const AuctionPage = lazy(() => import('./pages/AuctionPage'));
const TimerPage = lazy(() => import('./pages/TimerPage'));

const STUDENT_HOME_SCENE_SRC = '/student-home-mail.webp';

const preloadStudentHomeScene = () => {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('link[data-preload="student-home-scene"]')) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = STUDENT_HOME_SCENE_SRC;
  link.fetchPriority = 'high';
  link.dataset.preload = 'student-home-scene';
  document.head.appendChild(link);
};

const preloadGomaLoadingArt = () => {
  if (typeof document === 'undefined') return;
  for (const href of GOMA_LOADING_PRELOAD_SRCS) {
    if (document.head.querySelector(`link[data-preload="goma-loading"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.fetchPriority = 'low';
    link.dataset.preload = 'goma-loading';
    document.head.appendChild(link);
  }
};

const preloadEntryPage = (entryNumber: number | null) => {
  if (entryNumber === 0) {
    preloadGomaLoadingArt();
    return import('./pages/TimerPage');
  }
  if (entryNumber !== null) {
    preloadStudentHomeScene();
    preloadGomaLoadingArt();
    return import('./pages/AuctionPage');
  }
  return null;
};

const SELECTED_ENTRY_NUMBER_STORAGE_KEY = 'school-timer-entry-number-v1';
const TEACHER_ENTRY_VISIBLE_STORAGE_KEY = 'school-timer-teacher-entry-visible-v1';
const STUDENT_HOME_HASH = '#student-overview';

const PageLoadFallback = () => <AppLoadingScreen />;

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
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 24
    ? parsedValue
    : null;
};

const storeEntryNumber = (studentNumber: number) => {
  try {
    window.localStorage.setItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY, String(studentNumber));
    captureStorageResponseContext();
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
};

const clearStoredEntryNumber = () => {
  try {
    window.localStorage.removeItem(SELECTED_ENTRY_NUMBER_STORAGE_KEY);
    captureStorageResponseContext();
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
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [selectedEntryNumber, setSelectedEntryNumber] = useState<number | null>(() => getStoredEntryNumber());
  const [deviceSession, setDeviceSession] = useState<BrowserDeviceSession | null>(null);
  const [isDeviceSessionReady, setIsDeviceSessionReady] = useState(!requiresDeviceRegistration);
  const [teacherEntryVisible, setTeacherEntryVisible] = useState(() => getStoredTeacherEntryVisible());
  useEffect(() => { retainStorageResponseActor(selectedEntryNumber); }, [selectedEntryNumber]);
  useEffect(() => {
    if (selectedEntryNumber === null) return;
    if (selectedEntryNumber > 0) preloadStudentHomeScene();
    preloadGomaLoadingArt();
  }, [selectedEntryNumber]);

  useEffect(() => startSaveFailureReporting(), [selectedEntryNumber]);
  useEffect(() => {
    if (!isDeviceSessionReady || selectedEntryNumber === null) return;
    if (requiresDeviceRegistration && !(deviceSession?.role === 'student' && deviceSession.studentNumber === selectedEntryNumber)
      && !(deviceSession?.role === 'teacher' && selectedEntryNumber === 0)) return;
    return startSaveRecovery(selectedEntryNumber);
  }, [isDeviceSessionReady, selectedEntryNumber, deviceSession]);

  const selectEntryNumber = async (studentNumber: number, registrationKey?: string) => {
    if (selectedEntryNumber !== null && selectedEntryNumber !== studentNumber && !canReloadWithDrafts(selectedEntryNumber)) return;
    void preloadEntryPage(studentNumber)?.catch(() => undefined);
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
    if (selectedEntryNumber !== null && !canReloadWithDrafts(selectedEntryNumber)) return;
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
    const controller = new AbortController();
    void preloadEntryPage(selectedEntryNumber)?.catch(() => undefined);
    void loadDeviceSession(controller.signal)
      .then((session) => {
        if (cancelled) return;
        setDeviceSession(session);
        setIsDeviceSessionReady(true);
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
        setSessionLoadFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionAttempt]);

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
  }, [deviceSession, selectedEntryNumber]);

  if (!isDeviceSessionReady) {
    return (
      <>
        <NetworkStatusBanner />
        {sessionLoadFailed ? (
          <AppRecoveryScreen
            title="기기 등록을 확인하지 못했어요"
            description="연결을 확인하고 다시 시도해 주세요."
            actionLabel="다시 시도"
            onRetry={() => {
              setSessionLoadFailed(false);
              setSessionAttempt((attempt) => attempt + 1);
            }}
          />
        ) : <AppLoadingScreen label="기기 등록 확인 중" />}
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
          <AuctionPage key={selectedEntryNumber} studentNumber={selectedEntryNumber} />
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
      {selectedEntryNumber !== 0 ? <StorageAvailabilityBanner key={selectedEntryNumber} actor={selectedEntryNumber} /> : null}
    </>
  );
}
