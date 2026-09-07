(() => {
  const key = 'school-timer-startup-diagnostics-v1';
  const categories = ['script-load', 'chunk-load', 'runtime', 'render', 'startup-timeout', 'page-timeout'];
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  const version = document.querySelector('meta[name="app-build"]')?.content || 'unknown';
  const safeVersion = (value) => typeof value === 'string' && /^(?:unknown|development|[0-9TZ:.-]{20,30})$/.test(value) ? value : 'unknown';
  const safeAsset = (value) => {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin && /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(url.pathname) ? url.pathname : null;
    } catch { return null; }
  };
  const normalize = (values) => Array.isArray(values) ? values.flatMap((value) => {
    if (!value || typeof value !== 'object' || !categories.includes(value.category)) return [];
    const time = typeof value.time === 'string' ? Date.parse(value.time) : NaN;
    if (!Number.isFinite(time) || Date.now() - time > maxAge || time > Date.now()) return [];
    return [{ time: new Date(time).toISOString(), version: safeVersion(value.version), category: value.category, asset: safeAsset(value.asset) }];
  }).slice(-20) : [];
  let records = [];
  try { records = normalize(JSON.parse(window.localStorage.getItem(key) || '[]')); } catch { /* Storage may be unavailable. */ }
  const persist = () => {
    try { window.localStorage.setItem(key, JSON.stringify(records)); } catch { /* Keep this page's records in memory. */ }
  };
  persist();
  const record = (category, asset) => {
    if (!categories.includes(category)) return;
    records = normalize(records);
    const item = { time: new Date().toISOString(), version: safeVersion(version), category, asset: safeAsset(asset) };
    const previous = records[records.length - 1];
    if (previous && previous.category === item.category && previous.asset === item.asset && previous.version === item.version
      && Date.now() - Date.parse(previous.time) < 1000) return;
    records = [...records, item].slice(-20);
    persist();
  };
  window.schoolStartupDiagnostics = { record, read: () => normalize(records) };

  window.addEventListener('error', (event) => {
    if (event.target?.tagName === 'SCRIPT') record('script-load', event.target.src);
    else if (event.target === window) record('runtime', event.filename);
  }, true);
  window.addEventListener('unhandledrejection', () => record('runtime'));
  window.addEventListener('vite:preloadError', (event) => {
    // Extract only an application asset URL; never retain the error message or stack.
    const message = event.payload instanceof Error ? event.payload.message : '';
    const candidates = message.match(/(?:https?:\/\/[^\s"'<>]+)?\/assets\/[A-Za-z0-9_-]+\.js(?:\?[^\s"'<>]*)?/g) || [];
    record('chunk-load', candidates.map(safeAsset).find(Boolean));
  });
})();
