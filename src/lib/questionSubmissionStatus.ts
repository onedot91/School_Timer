import { loadNewspaper } from './newspaperClient';
import { NEWSPAPER_CONFIG, type NewspaperQuestion } from './newspaperQuestion';

export interface QuestionSubmissionStatus {
  readonly number: number;
  readonly personalSubmitted: boolean;
  readonly topicSubmitted: boolean;
  readonly personalQuestion?: string;
  readonly topicQuestion?: string;
}

export const buildQuestionSubmissionStatuses = (questions: readonly NewspaperQuestion[]): QuestionSubmissionStatus[] =>
  Array.from({ length: NEWSPAPER_CONFIG.studentCount }, (_, index) => {
    const number = index + 1;
    const personal = questions.find(row => row.student_number === number && row.question_type === 'personal');
    const topic = questions.find(row => row.student_number === number && row.question_type === 'topic');
    return {
      number,
      personalSubmitted: personal !== undefined,
      topicSubmitted: topic !== undefined,
      personalQuestion: personal?.question_text,
      topicQuestion: topic?.question_text,
    };
  });

export const loadQuestionSubmissionStatuses = async () => {
  const data = await loadNewspaper(0);
  return buildQuestionSubmissionStatuses(data.questions);
};

export const hasPersonalQuestionSubmission = (
  statuses: readonly QuestionSubmissionStatus[],
  studentNumber: number,
) => statuses.some((status) => status.number === studentNumber && status.personalSubmitted);
