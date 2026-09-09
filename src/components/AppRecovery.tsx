import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { recordStartupFailure } from '../lib/appDiagnostics';
import { canReloadAllDrafts, getUnsafeDraftRecoveryText, getDraftReloadSafetySnapshot, subscribeDraftReloadSafety } from '../lib/draftReloadSafety';
import { captureStorageResponseContext } from '../lib/storageResponseOrder';
import LoadingLabel from './LoadingLabel';
import GomaLoadingAnimation from './GomaLoadingAnimation';

const reloadPage = () => { if (canReloadAllDrafts()) window.location.reload(); };

export function AppRecoveryScreen({
  title = '화면을 다시 불러와 주세요',
  description = '화면을 불러오지 못했어요. 새로고침해 주세요.',
  actionLabel = '새로고침',
  onRetry = reloadPage,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  useSyncExternalStore(subscribeDraftReloadSafety, getDraftReloadSafetySnapshot, () => 0);
  const unsafe = !canReloadAllDrafts();
  const actor = captureStorageResponseContext().actor;
  const recoveryText = unsafe && actor !== null ? getUnsafeDraftRecoveryText(Number(actor)) : '';
  return (
    <main className="runtime-fallback-page">
      <section className="runtime-fallback-surface">
        <div role="alert">
          <h1 className="runtime-fallback-title">{title}</h1>
          <p className="runtime-fallback-description">{unsafe ? '이 기기에 임시 보관하지 못했어요. 내용을 복사한 뒤 다시 확인해 주세요.' : description}</p>
        </div>
        {recoveryText ? <textarea aria-label="보관하지 못한 내용" readOnly value={recoveryText} onFocus={event => event.currentTarget.select()} className="w-full min-h-32 p-3" /> : null}
        <button type="button" className="runtime-fallback-action" disabled={unsafe} onClick={onRetry}>{actionLabel}</button>
        <a href="/diagnostics.html" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center p-3 underline">진단 기록</a>
      </section>
    </main>
  );
}

export function AppLoadingScreen({ label = '불러오는 중', embedded = false }: { label?: string; embedded?: boolean }) {
  const Container = embedded ? 'section' : 'main';
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      recordStartupFailure('page-timeout');
      setDelayed(true);
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, []);
  return (
    <Container className={embedded ? 'grid min-h-[60vh] place-items-center p-4' : 'runtime-fallback-page'}>
      <section className="runtime-fallback-surface">
        <GomaLoadingAnimation />
        <p role="status">{delayed ? '화면을 불러오는 데 시간이 걸리고 있어요.' : <LoadingLabel>{label}</LoadingLabel>}</p>
        {delayed ? <button type="button" className="runtime-fallback-action" onClick={reloadPage}>새로고침</button> : null}
      </section>
    </Container>
  );
}

type Failure = 'runtime' | 'chunk' | null;
const hasChunkFailure = () => typeof document !== 'undefined'
  && document.documentElement.dataset.appChunkFailed === 'true';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failure: Failure }> {
  state: { failure: Failure } = { failure: hasChunkFailure() ? 'chunk' : null };

  static getDerivedStateFromError() {
    return { failure: hasChunkFailure() ? 'chunk' : 'runtime' };
  }

  componentDidCatch() {
    if (!hasChunkFailure()) recordStartupFailure('render');
  }

  private handleRuntimeError = () => {
    this.setState({ failure: hasChunkFailure() ? 'chunk' : 'runtime' });
  };

  private handleChunkError = () => {
    document.documentElement.dataset.appChunkFailed = 'true';
    this.setState({ failure: 'chunk' });
  };

  componentDidMount() {
    window.addEventListener('error', this.handleRuntimeError);
    window.addEventListener('unhandledrejection', this.handleRuntimeError);
    window.addEventListener('vite:preloadError', this.handleChunkError);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleRuntimeError);
    window.removeEventListener('unhandledrejection', this.handleRuntimeError);
    window.removeEventListener('vite:preloadError', this.handleChunkError);
  }

  render() {
    if (this.state.failure === 'chunk') {
      return <AppRecoveryScreen description="새 버전의 화면 파일을 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요." />;
    }
    if (this.state.failure) return <AppRecoveryScreen />;
    return this.props.children;
  }
}
