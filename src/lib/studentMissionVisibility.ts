export const STUDENT_MISSION_VISIBILITY_STORAGE_KEY = 'studentMissionVisibility-v1';

export type StudentMissionVisibility = {
  classroomRole: boolean;
  todayFriend: boolean;
  dailyWriting: boolean;
  emotionOrbs: boolean;
  classword: boolean;
  personalQuestion: boolean;
  failureExhibition: boolean;
  sudoku: boolean;
  numberBaseball: boolean;
  bookStack: boolean;
};

export type StudentMissionVisibilityId = keyof StudentMissionVisibility;

export const STUDENT_MISSION_VISIBILITY_GROUPS = [
  {
    label: '일일 미션',
    items: [
      { id: 'classroomRole', label: '1인 1역' },
      { id: 'todayFriend', label: '오늘의 친구' },
      { id: 'dailyWriting', label: '글밥짓기' },
      { id: 'emotionOrbs', label: '감정 구슬 넣기' },
      { id: 'classword', label: 'ㄱㄴㄷ 게임' },
    ],
  },
  {
    label: '주간 미션',
    items: [
      { id: 'personalQuestion', label: '신문에 개인 질문하기' },
      { id: 'failureExhibition', label: '실패 전시하기' },
      { id: 'sudoku', label: '스도쿠' },
      { id: 'numberBaseball', label: '숫자 야구' },
      { id: 'bookStack', label: '읽은 책 쌓기' },
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ id: StudentMissionVisibilityId; label: string }>;
}>;

export const DEFAULT_STUDENT_MISSION_VISIBILITY: StudentMissionVisibility = {
  classroomRole: true,
  todayFriend: true,
  dailyWriting: true,
  emotionOrbs: true,
  classword: true,
  personalQuestion: true,
  failureExhibition: true,
  sudoku: true,
  numberBaseball: true,
  bookStack: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const normalizeStudentMissionVisibility = (value: unknown): StudentMissionVisibility => {
  const parsed = isRecord(value) ? value : {};
  return {
    classroomRole: parsed.classroomRole !== false,
    todayFriend: parsed.todayFriend !== false,
    dailyWriting: parsed.dailyWriting !== false,
    emotionOrbs: parsed.emotionOrbs !== false,
    classword: parsed.classword !== false,
    personalQuestion: parsed.personalQuestion !== false,
    failureExhibition: parsed.failureExhibition !== false,
    sudoku: parsed.sudoku !== false,
    numberBaseball: parsed.numberBaseball !== false,
    bookStack: parsed.bookStack !== false,
  };
};

export const loadStoredStudentMissionVisibility = (): StudentMissionVisibility => {
  if (typeof localStorage === 'undefined') return normalizeStudentMissionVisibility(undefined);
  try {
    const stored = localStorage.getItem(STUDENT_MISSION_VISIBILITY_STORAGE_KEY);
    return normalizeStudentMissionVisibility(stored ? JSON.parse(stored) : undefined);
  } catch {
    return normalizeStudentMissionVisibility(undefined);
  }
};

export const storeStudentMissionVisibility = (visibility: StudentMissionVisibility) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    STUDENT_MISSION_VISIBILITY_STORAGE_KEY,
    JSON.stringify(normalizeStudentMissionVisibility(visibility)),
  );
};
