export const TEST_STUDENT_NUMBER = 24;

export const formatStudentNumberLabel = (studentNumber: number) => (
  studentNumber === TEST_STUDENT_NUMBER ? '테스트' : `${studentNumber}번`
);
