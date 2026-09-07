type StartupFailure = 'render' | 'startup-timeout' | 'page-timeout';

declare global {
  interface Window {
    schoolStartupDiagnostics?: { record: (category: StartupFailure) => void };
  }
}

export function recordStartupFailure(category: StartupFailure) {
  window.schoolStartupDiagnostics?.record(category);
}
