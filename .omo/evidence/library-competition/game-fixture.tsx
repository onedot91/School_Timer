import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import { createFullLibraryRoom } from '../../../src/lib/canvasLibraryWorld';
import '../../../src/index.css';

const room = createFullLibraryRoom();
function Fixture() {
  const [month, setMonth] = useState('2026-09');
  useEffect(() => { const advance = () => setMonth(current => current === '2026-09' ? '2026-10' : '2026-11'); window.addEventListener('qa-season-change', advance); return () => window.removeEventListener('qa-season-change', advance); }, []);
  return <CanvasLibraryGame studentNumber={23} room={room} seasonId={month} renderCompetition={onClose => <section role="dialog" aria-label="순위판 연결 확인"><button onClick={onClose}>닫기</button></section>} />;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture />);
