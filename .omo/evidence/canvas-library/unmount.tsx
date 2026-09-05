import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import '../../../src/index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<CanvasLibraryGame studentNumber={7} onBack={() => undefined} />);
window.__qaUnmount = () => root.unmount();
