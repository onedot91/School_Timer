import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppRecovery';
import './index.css';
import { canReloadAllDrafts } from './lib/draftReloadSafety';

if (window.schoolChunkRecovery) window.schoolChunkRecovery.canReload = canReloadAllDrafts;

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== '1') {
  void import('./reactDevTools.js');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
