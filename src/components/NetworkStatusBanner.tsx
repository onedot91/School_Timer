import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getNetworkIssueRevealDelay,
  NETWORK_ISSUE_REVEAL_DELAY_MS,
  NETWORK_PROBE_INTERVAL_MS,
  NETWORK_PROBE_TIMEOUT_MS,
} from '../lib/networkStatus';

const NETWORK_PROBE_PATH = '/favicon.png';

export function NetworkStatusBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let disposed = false;
    let issueStartedAt: number | null = null;
    let revealTimer: number | null = null;
    let activeProbe: AbortController | null = null;

    const clearRevealTimer = () => {
      if (revealTimer === null) return;
      window.clearTimeout(revealTimer);
      revealTimer = null;
    };

    const markHealthy = () => {
      issueStartedAt = null;
      clearRevealTimer();
      if (!disposed) setIsVisible(false);
    };

    const markUnstable = (startedAt = Date.now()) => {
      issueStartedAt = issueStartedAt === null
        ? startedAt
        : Math.min(issueStartedAt, startedAt);
      clearRevealTimer();

      const remainingDelay = getNetworkIssueRevealDelay(issueStartedAt, Date.now());
      if (remainingDelay === 0) {
        if (!disposed) setIsVisible(true);
        return;
      }

      revealTimer = window.setTimeout(() => {
        revealTimer = null;
        if (!disposed && issueStartedAt !== null) setIsVisible(true);
      }, remainingDelay);
    };

    const probeConnection = async () => {
      if (activeProbe) return;
      if (!window.navigator.onLine) {
        markUnstable();
        return;
      }

      const startedAt = Date.now();
      const controller = new AbortController();
      activeProbe = controller;
      const slowTimer = window.setTimeout(
        () => markUnstable(startedAt),
        NETWORK_ISSUE_REVEAL_DELAY_MS,
      );
      const timeoutTimer = window.setTimeout(
        () => controller.abort(),
        NETWORK_PROBE_TIMEOUT_MS,
      );

      try {
        const response = await window.fetch(
          `${NETWORK_PROBE_PATH}?network-check=${startedAt}`,
          {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error(`NETWORK_PROBE_${response.status}`);
        if (!disposed) markHealthy();
      } catch {
        if (!disposed) markUnstable(startedAt);
      } finally {
        window.clearTimeout(slowTimer);
        window.clearTimeout(timeoutTimer);
        if (activeProbe === controller) activeProbe = null;
      }
    };

    const handleOffline = () => markUnstable();
    const handleOnline = () => void probeConnection();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    void probeConnection();
    const probeInterval = window.setInterval(
      () => void probeConnection(),
      NETWORK_PROBE_INTERVAL_MS,
    );

    return () => {
      disposed = true;
      clearRevealTimer();
      window.clearInterval(probeInterval);
      activeProbe?.abort();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
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
