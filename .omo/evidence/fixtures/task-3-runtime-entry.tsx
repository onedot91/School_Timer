import { createRoot } from 'react-dom/client';
import RootApp from '../../../src/RootApp';
import '../../../src/index.css';

const faultFlag = 'task-3-runtime-fault-fired';

createRoot(document.getElementById('root')!).render(<RootApp />);

if (window.sessionStorage.getItem(faultFlag) !== 'true') {
  window.sessionStorage.setItem(faultFlag, 'true');
  window.setTimeout(() => {
    throw new Error('Todo 3 evidence-only runtime throw');
  }, 50);
}
