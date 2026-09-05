import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import { createFullLibraryRoom, type LibraryPlacedBook } from '../../../src/lib/canvasLibraryWorld';
import '../../../src/index.css';
const room = createFullLibraryRoom();
let attempts = 0;
function Fixture() {
  const [books, setBooks] = useState<readonly LibraryPlacedBook[]>([]);
  return <CanvasLibraryGame studentNumber={23} room={room} books={books} onPlace={async (draft, slotId) => {
    attempts += 1;
    document.body.dataset.attempts = String(attempts);
    await new Promise(resolve => setTimeout(resolve, 800));
    if (attempts === 1) return null;
    const placed = { ...draft, slotId };
    setBooks([placed]);
    return placed;
  }} />;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture />);
