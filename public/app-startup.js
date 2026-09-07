(() => {
  const startup = document.getElementById('app-startup');
  const message = document.getElementById('app-startup-message');
  const reload = document.getElementById('app-startup-reload');
  reload?.addEventListener('click', () => window.location.reload());

  const showRecovery = (text) => {
    if (!startup?.isConnected) return;
    if (message) message.textContent = text;
    if (reload) reload.hidden = false;
    const diagnostics = document.getElementById('app-startup-diagnostics');
    if (diagnostics) diagnostics.hidden = false;
  };
  const timeout = window.setTimeout(() => {
    window.schoolStartupDiagnostics?.record('startup-timeout');
    showRecovery('화면을 불러오는 데 시간이 걸리고 있어요. 연결을 확인하고 새로고침해 주세요.');
  }, 15_000);

  const handleFailure = () => showRecovery('화면을 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.');
  window.addEventListener('error', handleFailure);
  window.addEventListener('unhandledrejection', handleFailure);
  window.addEventListener('vite:preloadError', () => {
    document.documentElement.dataset.appChunkFailed = 'true';
    showRecovery('새 버전의 화면 파일을 불러오지 못했어요. 새로고침해 주세요.');
  });

  const observer = new MutationObserver(() => {
    if (startup?.isConnected) return;
    window.clearTimeout(timeout);
    window.removeEventListener('error', handleFailure);
    window.removeEventListener('unhandledrejection', handleFailure);
    observer.disconnect();
  });
  observer.observe(document.getElementById('root'), { childList: true });
})();
