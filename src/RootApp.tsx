import { useEffect, useState } from 'react';
import RandomDrawPage from './pages/RandomDrawPage';
import TimerPage from './pages/TimerPage';

type AppRoute = '/' | '/draw';

const getCurrentRoute = (): AppRoute => (window.location.hash === '#/draw' ? '/draw' : '/');

export default function RootApp() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => getCurrentRoute());

  useEffect(() => {
    const handleHashChange = () => setCurrentRoute(getCurrentRoute());

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      {currentRoute === '/draw' ? <RandomDrawPage /> : <TimerPage />}
    </>
  );
}
