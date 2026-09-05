import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CanvasLibraryGame studentNumber={7} onBack={() => undefined} />
  </StrictMode>,
);
