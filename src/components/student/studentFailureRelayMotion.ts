export type StudentFailureRelayDirection = 'newer' | 'older';

const STUDENT_FAILURE_RELAY_BUTTON_MOVES = {
  left: 1,
  right: -1,
} as const;

export type StudentFailureRelayButtonDirection = keyof typeof STUDENT_FAILURE_RELAY_BUTTON_MOVES;

export const getStudentFailureRelayButtonMove = (
  direction: StudentFailureRelayButtonDirection,
): number => STUDENT_FAILURE_RELAY_BUTTON_MOVES[direction];

export const STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE = STUDENT_FAILURE_RELAY_BUTTON_MOVES.right;

export const STUDENT_FAILURE_RELAY_TRANSITION = {
  type: 'spring',
  duration: 0.36,
  bounce: 0,
} as const;

export const STUDENT_FAILURE_PAPER_TRANSITION = {
  type: 'spring',
  duration: 0.36,
  bounce: 0.1,
} as const;

export const splitStudentFailureRelayRows = <Story>(stories: readonly Story[]): readonly (readonly Story[])[] => [
  stories.slice(0, 3),
  stories.slice(3, 6),
];

export const studentFailureRelayMotionVariants = {
  enter: (direction: StudentFailureRelayDirection) => ({
    transform: `translateX(${direction === 'older' ? '105%' : '-105%'})`,
  }),
  center: { transform: 'translateX(0)' },
  exit: (direction: StudentFailureRelayDirection) => ({
    transform: `translateX(${direction === 'older' ? '-105%' : '105%'})`,
  }),
};

export const studentFailurePaperMotionVariants = {
  enter: (direction: StudentFailureRelayDirection) => ({
    transform: `rotate(${direction === 'older' ? '0.4deg' : '-0.4deg'})`,
  }),
  center: { transform: 'rotate(0deg)' },
};
