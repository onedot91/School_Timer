import { useState } from 'react';
import { BookPlus } from 'lucide-react';
import {
  getBookHeightCm,
  getBookSpineHeightPx,
  getBookStackHeightCm,
  getBookStackLayout,
} from '../../lib/studentLife';
import type { StudentBook } from '../../lib/studentLife';
import StudentConfirmDialog from './StudentConfirmDialog';
import StudentHeader from './StudentHeader';

const BOOK_HEIGHT_FORMATTER = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

interface StudentLibraryPageProps {
  readonly books: readonly StudentBook[];
  readonly isSaving: boolean;
  readonly onAdd: (title: string, author: string, pageCount: number) => Promise<boolean>;
  readonly onBack: () => void;
}

export default function StudentLibraryPage({ books, isSaving, onAdd, onBack }: StudentLibraryPageProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [pendingBook, setPendingBook] = useState<{ title: string; author: string; pageCount: number } | null>(null);
  const visibleBooks = books.slice(0, 18);
  const visiblePageCounts = visibleBooks.map((book) => book.pageCount);
  const stackHeightCm = getBookStackHeightCm(visibleBooks);
  return (
    <div className="student-view student-library-view">
      <StudentHeader
        title="책장"
        onBack={onBack}
        backLabel="책방으로 돌아가기"
        backText="책방"
      />
      <section className="student-library-layout">
        <form className="student-book-form" onSubmit={(event) => {
          event.preventDefault();
          setPendingBook({ title: title.trim(), author: author.trim(), pageCount: Number(pageCount) });
        }}>
          <BookPlus size={32} aria-hidden="true" />
          <label><span>책 제목</span><input value={title} maxLength={50} required onChange={(event) => setTitle(event.target.value)} placeholder="읽은 책" /></label>
          <label><span>글쓴이</span><input value={author} maxLength={30} required onChange={(event) => setAuthor(event.target.value)} placeholder="글쓴이 이름" /></label>
          <label><span>쪽수</span><input value={pageCount} type="number" min="1" max="5000" required onChange={(event) => setPageCount(event.target.value)} placeholder="80" /></label>
          <button type="submit" className="student-primary-action" disabled={isSaving || title.trim().length === 0 || author.trim().length === 0 || Number(pageCount) < 1}>{isSaving ? '쌓는 중' : '책 쌓기'}</button>
        </form>
        <div className="student-bookshelf" aria-label={`읽은 책 ${books.length}권`}>
          <div className="student-book-stack">
            {visibleBooks.length > 0 ? (
              <div className="student-book-height" aria-label={`현재 책 높이 약 ${BOOK_HEIGHT_FORMATTER.format(stackHeightCm)}센티미터`}>
                <span>쌓인 높이</span>
                <strong>약 {BOOK_HEIGHT_FORMATTER.format(stackHeightCm)}cm</strong>
              </div>
            ) : null}
            {visibleBooks.length === 0 ? <p>첫 책을 쌓아 보세요.</p> : visibleBooks.map((book, index) => {
              const layout = getBookStackLayout(index);
              return (
                <article
                  key={book.id}
                  data-color={index % 6}
                  style={{
                    height: `${getBookSpineHeightPx(book.pageCount, visiblePageCounts)}px`,
                    width: `${layout.widthPercent}%`,
                    transform: `translateX(${layout.offsetPercent}%)`,
                  }}
                  title={`${book.title} · ${book.pageCount}쪽 · 약 ${BOOK_HEIGHT_FORMATTER.format(getBookHeightCm(book.pageCount))}cm`}
                  aria-label={`${book.title}, ${book.pageCount}쪽, 약 ${BOOK_HEIGHT_FORMATTER.format(getBookHeightCm(book.pageCount))}센티미터`}
                >
                  <strong>{book.title}</strong>
                  <span className="student-book-pages">{book.pageCount}쪽</span>
                </article>
              );
            })}
          </div>
          <div className="student-bookshelf-base" />
        </div>
      </section>
      <StudentConfirmDialog
        isOpen={pendingBook !== null}
        kicker={pendingBook?.title}
        title="이 책을 쌓을까요?"
        description={pendingBook ? `${pendingBook.author} 지음 · ${pendingBook.pageCount}쪽으로 기록해요.` : ''}
        confirmLabel="책 쌓기"
        isPending={isSaving}
        onCancel={() => setPendingBook(null)}
        onConfirm={() => {
          if (!pendingBook) return;
          void onAdd(pendingBook.title, pendingBook.author, pendingBook.pageCount).then((saved) => {
            if (!saved) return;
            setPendingBook(null);
            setTitle('');
            setAuthor('');
            setPageCount('');
          });
        }}
      />
    </div>
  );
}
