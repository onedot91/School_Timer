export interface QuestionSubmissionStatus {
  readonly number: number;
  readonly personalSubmitted: boolean;
  readonly topicSubmitted: boolean;
}

const QUESTION_SUBMISSION_STATUS_ENDPOINT = '/api/question-submission-status';

const isQuestionSubmissionStatusRecord = (
  value: unknown,
): value is {
  readonly number: number;
  readonly personalSubmitted: boolean;
  readonly topicSubmitted: boolean;
} => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'number' in value &&
    'personalSubmitted' in value &&
    'topicSubmitted' in value &&
    typeof value.number === 'number' &&
    Number.isInteger(value.number) &&
    typeof value.personalSubmitted === 'boolean' &&
    typeof value.topicSubmitted === 'boolean'
  );
};

const parseQuestionSubmissionStatuses = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw new Error('QUESTION_SUBMISSION_STATUS_INVALID_RESPONSE');
  }

  if (!value.every(isQuestionSubmissionStatusRecord)) {
    throw new Error('QUESTION_SUBMISSION_STATUS_INVALID_ITEM');
  }

  return value
    .filter((record) => record.number >= 1 && record.number <= 23)
    .sort((left, right) => left.number - right.number);
};

export const loadQuestionSubmissionStatuses = async () => {
  const response = await fetch(QUESTION_SUBMISSION_STATUS_ENDPOINT, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`QUESTION_SUBMISSION_STATUS_HTTP_${response.status}`);
  }

  return parseQuestionSubmissionStatuses(await response.json());
};

export const hasPersonalQuestionSubmission = (
  statuses: readonly QuestionSubmissionStatus[],
  studentNumber: number,
) => statuses.some((status) => status.number === studentNumber && status.personalSubmitted);
