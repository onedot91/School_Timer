import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasLibraryGame from '../../../src/components/student/library/CanvasLibraryGame';
import {
  createFullLibraryRoom,
  type LibraryPlacedBook,
} from '../../../src/lib/canvasLibraryWorld';
import '../../../src/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Full-room fixture root missing');

const room = createFullLibraryRoom();
const books = Array.from({ length: 100 }, (_, index): LibraryPlacedBook => ({
  studentNumber: index % 23 + 1,
  slotId: index,
  title: index === 0
    ? '첫 번째 별빛 도서관 탐험기'
    : index === 99
      ? '백 번째 책장의 아주 긴 한글 제목 확인본'
      : `우리 반 도서관 책 ${index + 1}`,
  author: index === 99 ? '긴 이름을 가진 마지막 가상 작가' : `가상 작가 ${index % 17 + 1}`,
  pageCount: 80 + index * 7,
}));
const isFull = new URLSearchParams(location.search).get('mode') === 'full';

createRoot(root).render(
  <StrictMode>
    {isFull ? (
      <CanvasLibraryGame
        studentNumber={7}
        room={room}
        books={books}
        onPlace={async () => null}
      />
    ) : (
      <CanvasLibraryGame studentNumber={7} room={room} />
    )}
  </StrictMode>,
);
