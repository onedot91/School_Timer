import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  classifyNetworkProbeFailure,
  getNetworkIssueRevealDelay,
  getNextNetworkFailureCount,
  NETWORK_PROBE_INTERVAL_MS,
  NETWORK_PROBE_RETRY_MS,
  NETWORK_PROBE_TIMEOUT_MS,
  type NetworkProbeOutcome,
  shouldShowNetworkIssue,
} from '../lib/networkStatus';

const NETWORK_PROBE_PATH = '/favicon.png';

export function NetworkStatusBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let disposed = false;
    let consecutiveFailures = 0;
    let offlineSince: number | null = null;
    let offlineRevealTimer: number | null = null;
    let nextProbeTimer: number | null = null;
    let activeProbe: AbortController | null = null;
    // 탭이 숨겨지면 올라가며, 숨겨지기 전에 시작한 확인 결과는 버린다.
    let probeGeneration = 0;

    const isPageHidden = () => document.visibilityState === 'hidden';

    const clearOfflineRevealTimer = () => {
      if (offlineRevealTimer === null) return;
      window.clearTimeout(offlineRevealTimer);
      offlineRevealTimer = null;
    };

    const clearNextProbeTimer = () => {
      if (nextProbeTimer === null) return;
      window.clearTimeout(nextProbeTimer);
      nextProbeTimer = null;
    };

    const updateVisibility = () => {
      if (disposed) return;
      setIsVisible(
        shouldShowNetworkIssue(consecutiveFailures)
        || (offlineSince !== null && getNetworkIssueRevealDelay(offlineSince, Date.now()) === 0),
      );
    };

    const markOffline = () => {
      if (offlineSince === null) offlineSince = Date.now();
      clearOfflineRevealTimer();
      const remainingDelay = getNetworkIssueRevealDelay(offlineSince, Date.now());
      if (remainingDelay === 0) {
        updateVisibility();
        return;
      }
      offlineRevealTimer = window.setTimeout(() => {
        offlineRevealTimer = null;
        updateVisibility();
      }, remainingDelay);
    };

    const clearOffline = () => {
      offlineSince = null;
      clearOfflineRevealTimer();
    };

    const scheduleNextProbe = (delay: number) => {
      clearNextProbeTimer();
      if (disposed || isPageHidden()) return;
      nextProbeTimer = window.setTimeout(() => {
        nextProbeTimer = null;
        void probeConnection();
      }, delay);
    };

    const recordOutcome = (outcome: NetworkProbeOutcome) => {
      consecutiveFailures = getNextNetworkFailureCount(consecutiveFailures, outcome);
      updateVisibility();
    };

    const probeConnection = async () => {
      if (disposed || activeProbe || isPageHidden()) return;
      clearNextProbeTimer();

      if (!window.navigator.onLine) {
        markOffline();
        scheduleNextProbe(NETWORK_PROBE_RETRY_MS);
        return;
      }
      clearOffline();

      const generation = probeGeneration;
      const startedAt = Date.now();
      const controller = new AbortController();
      activeProbe = controller;
      const timeoutTimer = window.setTimeout(
        () => controller.abort(),
        NETWORK_PROBE_TIMEOUT_MS,
      );

      let outcome: NetworkProbeOutcome;
      try {
        const response = await window.fetch(
          `${NETWORK_PROBE_PATH}?network-check=${startedAt}`,
          {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        outcome = response.ok ? 'ok' : 'failed';
      } catch {
        outcome = classifyNetworkProbeFailure(startedAt, Date.now());
      } finally {
        window.clearTimeout(timeoutTimer);
        if (activeProbe === controller) activeProbe = null;
      }

      if (disposed || generation !== probeGeneration) return;
      recordOutcome(outcome);
      scheduleNextProbe(outcome === 'ok' ? NETWORK_PROBE_INTERVAL_MS : NETWORK_PROBE_RETRY_MS);
    };

    const handleVisibilityChange = () => {
      if (isPageHidden()) {
        probeGeneration += 1;
        clearNextProbeTimer();
        activeProbe?.abort();
        activeProbe = null;
        return;
      }
      // 잠자기·백그라운드 동안의 실패는 현재 연결 상태가 아니므로 새로 확인한다.
      consecutiveFailures = 0;
      updateVisibility();
      void probeConnection();
    };

    const handleOffline = () => markOffline();
    const handleOnline = () => {
      clearOffline();
      updateVisibility();
      void probeConnection();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void probeConnection();

    return () => {
      disposed = true;
      clearOfflineRevealTimer();
      clearNextProbeTimer();
      activeProbe?.abort();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <aside className="network-status-banner" role="status" aria-live="polite">
      <span className="network-status-banner-icon" aria-hidden="true">
        <WifiOff size={18} strokeWidth={2.4} />
      </span>
      <span className="network-status-banner-copy">
        <strong>인터넷 연결이 불안정해요</strong>
        <span>최신 정보 반영이 늦어질 수 있습니다.</span>
      </span>
    </aside>
  );
}
