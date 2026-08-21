import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Library, X } from 'lucide-react';
import type { BookstoreSettings, FeaturedWriting } from '../../lib/bookstore';
import { useModalFocus } from '../../lib/useModalFocus';
import StudentHeader from './StudentHeader';

type StudentBookstorePageProps = {
  readonly settings: BookstoreSettings;
  readonly onOpenBookshelf: () => void;
  readonly onBack: () => void;
};

export const StudentBookstorePage = ({
  settings,
  onOpenBookshelf,
  onBack,
}: StudentBookstorePageProps) => {
  const [selectedWriting, setSelectedWriting] = useState<FeaturedWriting | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const writingTriggerRef = useRef<HTMLButtonElement>(null);
  const publishedWritings = settings.featuredWritings.filter((writing) => (
    writing.isPublished && writing.title.length > 0 && writing.content.length > 0
  ));

  useModalFocus({
    dialogRef,
    isOpen: selectedWriting !== null,
    onDismiss: () => setSelectedWriting(null),
    returnFocusRef: writingTriggerRef,
  });

  return (
    <div className="student-view student-bookstore-view">
      <StudentHeader title="책방" onBack={onBack} />
      <div className="student-bookstore-content">
        <section className="student-featured-writing-section" aria-label="우수글 진열대">
          {publishedWritings.length > 0 ? (
            <div className="student-featured-writing-shelf" aria-label={`우수글 ${publishedWritings.length}편`}>
              <div className="student-featured-writing-list">
                {publishedWritings.map((writing, index) => (
                  <button
                    key={writing.id}
                    type="button"
                    className="student-featured-writing-card"
                    data-cover={index % 4}
                    onClick={(event) => {
                      writingTriggerRef.current = event.currentTarget;
                      setSelectedWriting(writing);
                    }}
                    aria-label={`${writing.title}, ${writing.author || '작성자 미상'} 글 읽기`}
                  >
                    <span className="student-featured-writing-number">추천 글 {index + 1}</span>
                    <strong>{writing.title}</strong>
                    <span className="student-featured-writing-author">{writing.author || '작성자 미상'}</span>
                    <p>{writing.summary || writing.content}</p>
                    <span className="student-featured-writing-action">전체 글 읽기 <ArrowRight aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
              <div className="student-featured-writing-shelf-edge" aria-hidden="true" />
            </div>
          ) : (
            <div className="student-bookstore-empty">
              <BookOpen aria-hidden="true" />
              <strong>아직 진열된 글이 없어요</strong>
              <p>선생님이 좋은 글을 골라 주시면 이곳에 나타나요.</p>
            </div>
          )}
        </section>

        <button type="button" className="student-bookshelf-entry" onClick={onOpenBookshelf}>
          <span className="student-bookshelf-entry-icon"><Library aria-hidden="true" /></span>
          <span className="student-bookshelf-entry-copy">
            <strong>책장으로 가기</strong>
          </span>
          <ArrowRight className="student-bookshelf-entry-arrow" aria-hidden="true" />
        </button>
      </div>

      {selectedWriting ? (
        <div
          className="student-featured-writing-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedWriting(null);
          }}
        >
          <div
            ref={dialogRef}
            className="student-featured-writing-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-featured-writing-dialog-title"
          >
            <button
              type="button"
              className="student-featured-writing-close"
              onClick={() => setSelectedWriting(null)}
              aria-label="우수글 닫기"
            >
              <X aria-hidden="true" />
            </button>
            <span>우수글 진열대</span>
            <h2 id="student-featured-writing-dialog-title">{selectedWriting.title}</h2>
            <strong>{selectedWriting.author || '작성자 미상'}</strong>
            {selectedWriting.summary ? <p className="student-featured-writing-summary">{selectedWriting.summary}</p> : null}
            <div className="student-featured-writing-body">{selectedWriting.content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
