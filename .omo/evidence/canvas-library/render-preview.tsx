import { createLibraryRenderer } from '../../../src/components/student/library/CanvasLibraryRenderer';
import {
  createLibraryPlayer,
  createSmallLibraryRoom,
  type LibraryBookDraft,
  type LibraryPlacedBook,
  type LibraryScene,
} from '../../../src/lib/canvasLibraryWorld';

const canvas = document.querySelector('canvas');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Preview canvas missing');

const room = createSmallLibraryRoom();
const player = createLibraryPlayer(room, 8);
const draft: LibraryBookDraft = {
  studentNumber: 8,
  title: '달빛 우체국',
  author: '가상 작가',
  pageCount: 128,
};
const previewBooks: readonly LibraryPlacedBook[] = [
  { ...draft, slotId: 0 },
  { ...draft, title: '초록 탐험', slotId: 4 },
  { ...draft, title: '푸른 지도', slotId: 12 },
];
const mode = new URLSearchParams(location.search).get('mode');
const placedBooks = mode === 'placed' ? previewBooks : [];
const carriedDraft = mode === 'carry' || mode === 'reduced' ? draft : null;
const scene: LibraryScene = {
  player: mode === 'carry' || mode === 'reduced'
    ? { ...player, position: { x: 370, y: 196 }, facing: 'right', isWalking: true }
    : player,
  placedBooks,
  carriedDraft,
  nearbyTarget: mode === 'placed'
    ? { kind: 'placed-book', id: 'placed-book:0', slotId: 0, shelfId: room.shelves[0].id, interactionPoint: room.shelves[0].slots[0].interactionPoint, book: previewBooks[0] }
    : null,
  selectedSlotId: mode === 'placed' ? 12 : null,
  timeMs: mode === 'reduced' ? Number.NaN : mode === 'carry' ? 420 : 0,
  reducedMotion: mode === 'reduced',
};

createLibraryRenderer(canvas, room).draw(scene);
