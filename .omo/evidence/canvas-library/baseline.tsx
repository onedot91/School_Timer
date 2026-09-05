import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudentLibraryPage from '../../../src/components/student/StudentLibraryPage';
import type { StudentBook } from '../../../src/lib/studentLife';
import '../../../src/index.css';

const BASELINE_BOOK: StudentBook = {
  id: 'qa-baseline',
  studentNumber: 1,
  title: '달빛 우체국',
  author: '김별',
  pageCount: 80,
  createdAt: '2026-09-05T00:00:00.000Z',
  colorIndex: 0,
};

function BaselineFixture() {
  const [books, setBooks] = useState<readonly StudentBook[]>([BASELINE_BOOK]);

  const onAdd = async (title: string, author: string, pageCount: number): Promise<boolean> => {
    setBooks((current) => [
      ...current,
      {
        id: `qa-added-${current.length}`,
        studentNumber: 1,
        title,
        author,
        pageCount,
        createdAt: '2026-09-05T00:00:01.000Z',
        colorIndex: current.length % 6,
      },
    ]);
    return true;
  };

  return (
    <div className="student-mode-page" data-qa-fixture="canvas-library-baseline">
      <main>
        <StudentLibraryPage
          books={books}
          isSaving={false}
          onAdd={onAdd}
          onBack={() => undefined}
        />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BaselineFixture />
  </StrictMode>,
);
