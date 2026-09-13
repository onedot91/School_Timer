export const TEST_STUDENT_NUMBER = 24;

export const isPersistedStudentNumber = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= 1
  && (value <= 23 || value === TEST_STUDENT_NUMBER)
);

export const isMailStudentNumber = isPersistedStudentNumber;

export const formatStudentNumberLabel = (studentNumber: number) => (
  studentNumber === TEST_STUDENT_NUMBER ? '테스트' : `${studentNumber}번`
);
