import { loadNewspaper } from './newspaperClient';
import { NEWSPAPER_CONFIG } from './newspaperQuestion';

export interface QuestionSubmissionStatus {
  readonly number: number;
  readonly personalSubmitted: boolean;
  readonly topicSubmitted: boolean;
}

export const loadQuestionSubmissionStatuses = async () => {
  const data = await loadNewspaper(0);
  return Array.from({ length: NEWSPAPER_CONFIG.studentCount }, (_, index) => ({ number: index + 1,
    personalSubmitted: data.questions.some(row => row.student_number === index + 1 && row.question_type === 'personal'),
    topicSubmitted: data.questions.some(row => row.student_number === index + 1 && row.question_type === 'topic'),
  }));
};

export const hasPersonalQuestionSubmission = (
  statuses: readonly QuestionSubmissionStatus[],
  studentNumber: number,
) => statuses.some((status) => status.number === studentNumber && status.personalSubmitted);
