export interface StudentLetter {
  readonly id: string;
  readonly recipient: number;
  readonly senderLabel: string;
  readonly senderStudentNumber: number | null;
  readonly replyToId: string | null;
  readonly title: string;
  readonly content: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}

export interface StudentBook {
  readonly id: string;
  readonly studentNumber: number;
  readonly title: string;
  readonly author: string;
  readonly pageCount: number;
  readonly createdAt: string;
}

export type BookStackLayout = {
  readonly widthPercent: number;
  readonly offsetPercent: number;
};

export interface StudentLifeState {
  readonly letters: readonly StudentLetter[];
  readonly books: readonly StudentBook[];
}

type LetterInput = Omit<StudentLetter, 'readAt' | 'senderStudentNumber' | 'replyToId'> & {
  readonly senderStudentNumber?: number | null;
  readonly replyToId?: string | null;
};
type BookInput = StudentBook;

const STUDENT_LIFE_STORAGE_KEY = 'school-timer-student-life';
const MAX_STUDENT_NUMBER = 23;
export const TEACHER_LETTER_RECIPIENT = 0;
const MAX_LETTERS = 600;
const MAX_BOOKS = 600;
const BOOK_PAPER_THICKNESS_PER_PAGE_CM = 0.005;
const BOOK_SPINE_MIN_HEIGHT_PX = 27;
const BOOK_SPINE_MAX_HEIGHT_PX = 45;
const BOOK_STACK_LAYOUTS: readonly BookStackLayout[] = [
  { widthPercent: 86, offsetPercent: -1.25 },
  { widthPercent: 82, offsetPercent: 1.25 },
  { widthPercent: 90, offsetPercent: -0.75 },
  { widthPercent: 85, offsetPercent: 0.75 },
  { widthPercent: 88, offsetPercent: -1 },
  { widthPercent: 81, offsetPercent: 1 },
  { widthPercent: 92, offsetPercent: -0.5 },
  { widthPercent: 84, offsetPercent: 0.5 },
  { widthPercent: 89, offsetPercent: -1.25 },
  { widthPercent: 83, offsetPercent: 1.25 },
  { widthPercent: 87, offsetPercent: -0.75 },
  { widthPercent: 85, offsetPercent: 0.75 },
];

const isStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_STUDENT_NUMBER
);

const isLetterRecipient = (value: unknown): value is number => (
  value === TEACHER_LETTER_RECIPIENT || isStudentNumber(value)
);

const parseLetter = (value: unknown): StudentLetter | null => {
  if (!value || typeof value !== 'object') return null;
  const letter = value as Partial<StudentLetter>;
  if (typeof letter.id !== 'string' || letter.id.length === 0 || !isLetterRecipient(letter.recipient)) return null;
  if (typeof letter.senderLabel !== 'string' || typeof letter.content !== 'string' || letter.content.trim().length === 0) return null;
  if (typeof letter.createdAt !== 'string') return null;
  return {
    id: letter.id.slice(0, 80),
    recipient: letter.recipient,
    senderLabel: letter.senderLabel.trim().slice(0, 20) || '보낸 사람',
    senderStudentNumber: isStudentNumber(letter.senderStudentNumber) ? letter.senderStudentNumber : null,
    replyToId: typeof letter.replyToId === 'string' && letter.replyToId.length > 0
      ? letter.replyToId.slice(0, 80)
      : null,
    title: typeof letter.title === 'string' ? letter.title.trim().slice(0, 40) : '',
    content: letter.content.trim().slice(0, 300),
    createdAt: letter.createdAt,
    readAt: typeof letter.readAt === 'string' ? letter.readAt : null,
  };
};

const parseBook = (value: unknown): StudentBook | null => {
  if (!value || typeof value !== 'object') return null;
  const book = value as Partial<StudentBook>;
  if (typeof book.id !== 'string' || book.id.length === 0 || !isStudentNumber(book.studentNumber)) return null;
  if (typeof book.title !== 'string' || book.title.trim().length === 0) return null;
  if (typeof book.pageCount !== 'number' || !Number.isInteger(book.pageCount) || book.pageCount < 1 || book.pageCount > 5000) return null;
  if (typeof book.createdAt !== 'string') return null;
  return {
    id: book.id.slice(0, 80),
    studentNumber: book.studentNumber,
    title: book.title.trim().slice(0, 50),
    author: typeof book.author === 'string' ? book.author.trim().slice(0, 30) : '',
    pageCount: book.pageCount,
    createdAt: book.createdAt,
  };
};

export const normalizeStudentLifeState = (value: unknown): StudentLifeState => {
  const parsed = value && typeof value === 'object' ? value as { letters?: unknown; books?: unknown } : {};
  return {
    letters: (Array.isArray(parsed.letters) ? parsed.letters : []).map(parseLetter).filter((entry): entry is StudentLetter => entry !== null).slice(-MAX_LETTERS),
    books: (Array.isArray(parsed.books) ? parsed.books : []).map(parseBook).filter((entry): entry is StudentBook => entry !== null).slice(-MAX_BOOKS),
  };
};

export const createStudentLetter = (state: StudentLifeState, input: LetterInput): StudentLifeState => {
  if (state.letters.some((letter) => letter.id === input.id)) return state;
  const letter = parseLetter({ ...input, readAt: null });
  if (!letter) return state;
  return { ...state, letters: [...state.letters, letter].slice(-MAX_LETTERS) };
};

export const markStudentLetterRead = (
  state: StudentLifeState,
  studentNumber: number,
  letterId: string,
  readAt: string,
): StudentLifeState => ({
  ...state,
  letters: state.letters.map((letter) => (
    letter.id === letterId && letter.recipient === studentNumber && letter.readAt === null
      ? { ...letter, readAt }
      : letter
  )),
});

export const addStudentBook = (state: StudentLifeState, input: BookInput): StudentLifeState => {
  if (state.books.some((book) => book.id === input.id)) return state;
  const book = parseBook(input);
  if (!book) return state;
  return { ...state, books: [...state.books, book].slice(-MAX_BOOKS) };
};

export const getStudentLetters = (state: StudentLifeState, studentNumber: number): readonly StudentLetter[] => (
  [...state.letters].reverse().filter((letter) => letter.recipient === studentNumber)
);

export const getStudentSentLetters = (state: StudentLifeState, studentNumber: number): readonly StudentLetter[] => (
  [...state.letters].reverse().filter((letter) => letter.senderStudentNumber === studentNumber)
);

export const getTeacherLetters = (state: StudentLifeState): readonly StudentLetter[] => (
  [...state.letters].reverse().filter((letter) => letter.recipient === TEACHER_LETTER_RECIPIENT)
);

export const getUnreadStudentLetterCount = (state: StudentLifeState, studentNumber: number): number => (
  state.letters.filter((letter) => letter.recipient === studentNumber && letter.readAt === null).length
);

export const getStudentBooks = (state: StudentLifeState, studentNumber: number): readonly StudentBook[] => (
  [...state.books].reverse().filter((book) => book.studentNumber === studentNumber)
);

const calculateBookHeightCm = (pageCount: number): number => (
  pageCount * BOOK_PAPER_THICKNESS_PER_PAGE_CM
);

const roundBookHeightCm = (heightCm: number): number => Math.round((heightCm + Number.EPSILON) * 100) / 100;

export const getBookHeightCm = (pageCount: number): number => roundBookHeightCm(calculateBookHeightCm(pageCount));

export const getBookSpineHeightPx = (pageCount: number, pageCounts: readonly number[]): number => {
  if (pageCounts.length === 0) return BOOK_SPINE_MIN_HEIGHT_PX;
  const minPageCount = Math.min(...pageCounts);
  const maxPageCount = Math.max(...pageCounts);
  if (minPageCount === maxPageCount) return (BOOK_SPINE_MIN_HEIGHT_PX + BOOK_SPINE_MAX_HEIGHT_PX) / 2;
  const pageRatio = (pageCount - minPageCount) / (maxPageCount - minPageCount);
  const boundedRatio = Math.min(1, Math.max(0, pageRatio));
  return Number((BOOK_SPINE_MIN_HEIGHT_PX + boundedRatio * (BOOK_SPINE_MAX_HEIGHT_PX - BOOK_SPINE_MIN_HEIGHT_PX)).toFixed(2));
};

export const getBookStackLayout = (index: number): BookStackLayout => (
  BOOK_STACK_LAYOUTS[index % BOOK_STACK_LAYOUTS.length] ?? { widthPercent: 82, offsetPercent: 0 }
);

export const getBookStackHeightCm = (books: readonly StudentBook[]): number => (
  roundBookHeightCm(books.reduce((height, book) => height + calculateBookHeightCm(book.pageCount), 0))
);

export const loadStoredStudentLifeState = (): StudentLifeState => {
  try {
    const stored = window.localStorage.getItem(STUDENT_LIFE_STORAGE_KEY);
    return normalizeStudentLifeState(stored ? JSON.parse(stored) : null);
  } catch (error) {
    if (error instanceof Error) return normalizeStudentLifeState(null);
    throw error;
  }
};

export const storeStudentLifeState = (state: StudentLifeState): void => {
  window.localStorage.setItem(STUDENT_LIFE_STORAGE_KEY, JSON.stringify(state));
};
