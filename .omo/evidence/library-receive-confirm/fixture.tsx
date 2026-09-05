import React from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import { createFullLibraryRoom } from '../../../src/lib/canvasLibraryWorld';
import '../../../src/index.css';
const room = createFullLibraryRoom();
const root = document.getElementById('root');
if (root) createRoot(root).render(<CanvasLibraryGame studentNumber={23} room={{...room, spawn:room.desk.interactionPoint}} />);
