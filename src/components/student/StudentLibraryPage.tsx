import type { StudentBook } from '../../lib/studentLife';
import { createFullLibraryRoom, type LibraryBookDraft, type LibraryPlacedBook } from '../../lib/canvasLibraryWorld';
import type { FailureStampId, FailureProfileAssignments, FailureStory } from '../../lib/failureExhibition';
import StudentFailureExhibitionPage from './StudentFailureExhibitionPage';
import CanvasLibraryGame from './library/CanvasLibraryGame';
import { LibraryCompetitionPanel } from './library/LibraryCompetitionPanel';
import type { LibraryCompetitionResponse } from '../../lib/libraryCompetitionTransport';

interface StudentLibraryPageProps {
  readonly studentNumber: number;
  readonly books: readonly StudentBook[];
  readonly onPlace: (draft: LibraryBookDraft, slotId: number) => Promise<LibraryPlacedBook | null>;
  readonly failureStories: readonly FailureStory[];
  readonly profileAssignments: FailureProfileAssignments;
  readonly isFailureSaving: boolean;
  readonly onCreateFailure: (failure: string, lesson: string) => Promise<boolean>;
  readonly onStampFailure: (storyId: string, stampId: FailureStampId) => Promise<boolean>;
  readonly initialFailureBoardOpen?: boolean;
  readonly competitionSeasonId?: string | null;
  readonly onCompetitionSnapshot?: (response: LibraryCompetitionResponse) => void;
  readonly onBack: () => void;
}

const FULL_LIBRARY_ROOM = createFullLibraryRoom();

const toPlacedBook = (book: StudentBook): LibraryPlacedBook | null => (
  book.librarySlot === undefined
    ? null
    : {
      bookId: book.id,
      studentNumber: book.studentNumber,
      title: book.title,
      author: book.author,
      pageCount: book.pageCount,
      ...(book.reflection === undefined ? {} : { reflection: book.reflection }),
      slotId: book.librarySlot,
    }
);

const toUnplacedDraft = (book: StudentBook): LibraryBookDraft => ({
  bookId: book.id,
  studentNumber: book.studentNumber,
  title: book.title,
  author: book.author,
  pageCount: book.pageCount,
  ...(book.reflection === undefined ? {} : { reflection: book.reflection }),
});

export default function StudentLibraryPage({
  studentNumber,
  books,
  onPlace,
  failureStories,
  profileAssignments,
  isFailureSaving,
  onCreateFailure,
  onStampFailure,
  initialFailureBoardOpen = false,
  competitionSeasonId,
  onCompetitionSnapshot,
  onBack,
}: StudentLibraryPageProps) {
  const placedBooks = books.flatMap((book) => {
    const placed = toPlacedBook(book);
    return placed ? [placed] : [];
  });
  const unplacedBooks = books
    .filter((book) => book.studentNumber === studentNumber && book.librarySlot === undefined)
    .map(toUnplacedDraft);

  return (
    <CanvasLibraryGame
      studentNumber={studentNumber}
      room={FULL_LIBRARY_ROOM}
      books={placedBooks}
      unplacedBooks={unplacedBooks}
      onPlace={onPlace}
      initialFailureBoardOpen={initialFailureBoardOpen}
      boardNoteCount={failureStories.length}
      seasonId={competitionSeasonId}
      renderCompetition={(onClose, returnFocusRef) => (
        <LibraryCompetitionPanel onClose={onClose} onSnapshot={response => onCompetitionSnapshot?.(response)} returnFocusRef={returnFocusRef} />
      )}
      renderFailureBoard={(onClose, returnFocusRef) => (
        <StudentFailureExhibitionPage
          embedded
          studentNumber={studentNumber}
          profileAssignments={profileAssignments}
          stories={failureStories}
          isSaving={isFailureSaving}
          onCreate={onCreateFailure}
          onStamp={onStampFailure}
          onOpenBookshelf={() => undefined}
          onBack={() => undefined}
          onRequestClose={onClose}
          returnFocusRef={returnFocusRef}
        />
      )}
      onBack={onBack}
    />
  );
}
