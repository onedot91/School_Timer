export type StudentFeatureReleaseId = 'bank' | 'securities' | 'bookstore' | 'failureExhibition' | 'emotionOrbs' | 'petEgg';

export const STUDENT_FEATURE_RELEASES: Readonly<Record<StudentFeatureReleaseId, boolean>> = {
  bank: true,
  securities: false,
  bookstore: true,
  failureExhibition: false,
  emotionOrbs: true,
  petEgg: false,
};

export const STUDENT_FAILURE_EXHIBITION_HIDDEN_LABEL = '?? ???';

export const STUDENT_FAILURE_EXHIBITION_HINTS = [
  '넘어진 이야기는 끝이 아니라, 다음 장의 제목일지도 몰라.',
  '아직 비어 있는 종이는 실패보다 용기를 먼저 기다리고 있어.',
  '정답보다 다시 해 본 흔적이 더 반짝이는 곳이 있대.',
  '문이 열리는 날에는 실수도 자랑이 될 수 있을까?',
] as const;

export const getStudentFailureExhibitionHint = (random = Math.random): string => {
  const index = Math.min(
    STUDENT_FAILURE_EXHIBITION_HINTS.length - 1,
    Math.max(0, Math.floor(random() * STUDENT_FAILURE_EXHIBITION_HINTS.length)),
  );
  return STUDENT_FAILURE_EXHIBITION_HINTS[index];
};

export const STUDENT_CUSTOM_HOUSE_RELEASED = false;

const STUDENT_VIEW_FEATURES: Readonly<Record<string, StudentFeatureReleaseId>> = {
  emotions: 'emotionOrbs',
  library: 'bookstore',
  'library-bookstore': 'bookstore',
  'library-bookshelf': 'bookstore',
  'library-failure-board': 'failureExhibition',
  'store-bank': 'bank',
  'store-securities': 'securities',
  'store-securities-trade': 'securities',
};

export const getUnavailableStudentFeature = (view: string): StudentFeatureReleaseId | null => {
  const feature = STUDENT_VIEW_FEATURES[view];
  return feature && !STUDENT_FEATURE_RELEASES[feature] ? feature : null;
};

export const getStudentFeatureFallbackView = (feature: StudentFeatureReleaseId): 'overview' | 'library' | 'store' => (
  feature === 'bank' || feature === 'securities'
    ? 'store'
    : feature === 'failureExhibition'
      ? 'library'
      : 'overview'
);
