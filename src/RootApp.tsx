import { useEffect, useState } from 'react';
import PageNav from './components/PageNav';
import RandomDrawPage from './pages/RandomDrawPage';
import TimerPage from './pages/TimerPage';

type AppRoute = '/' | '/draw';

const normalizeHashRoute = (hash: string): AppRoute => {
  const rawPath = hash.replace(/^#/, '') || '/';
  return rawPath === '/draw' ? '/draw' : '/';
};

const buildCanonicalUrl = (route: AppRoute) => {
  if (typeof window === 'undefined') return `#${route}`;
  return `${window.location.pathname}${window.location.search}#${route}`;
};

export default function RootApp() {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window === 'undefined' ? '/' : normalizeHashRoute(window.location.hash),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncRoute = () => {
      const nextRoute = normalizeHashRoute(window.location.hash);
      const nextHash = `#${nextRoute}`;

      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', buildCanonicalUrl(nextRoute));
      }

      setRoute(nextRoute);
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;

      event.preventDefault();
      const nextRoute: AppRoute = route === '/draw' ? '/' : '/draw';
      window.history.replaceState(null, '', buildCanonicalUrl(nextRoute));
      setRoute(nextRoute);
    };

    window.addEventListener('keydown', handleGlobalShortcuts);

    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts);
    };
  }, [route]);

  return (
    <div className="relative">
      <PageNav currentPath={route} />
      {route === '/draw' ? <RandomDrawPage /> : <TimerPage />}
    </div>
  );
}
