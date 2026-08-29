export const STUDENT_RAPID_CLICK_LIMIT = 8;
export const STUDENT_RAPID_CLICK_WINDOW_MS = 2000;

export type StudentRapidClickState = {
  readonly target: object | null;
  readonly clicks: readonly number[];
};

export type StudentRapidClickResult = {
  readonly state: StudentRapidClickState;
  readonly shouldWarn: boolean;
};

export const createStudentRapidClickState = (): StudentRapidClickState => ({
  target: null,
  clicks: [],
});

export const trackStudentRapidClick = (
  previous: StudentRapidClickState,
  target: object,
  clickedAt: number,
): StudentRapidClickResult => {
  const recentClicks = previous.target === target
    ? previous.clicks.filter((timestamp) => clickedAt - timestamp <= STUDENT_RAPID_CLICK_WINDOW_MS)
    : [];
  const clicks = [...recentClicks, clickedAt];

  if (clicks.length >= STUDENT_RAPID_CLICK_LIMIT) {
    return {
      state: createStudentRapidClickState(),
      shouldWarn: true,
    };
  }

  return {
    state: { target, clicks },
    shouldWarn: false,
  };
};
