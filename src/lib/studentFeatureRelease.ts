export type StudentFeatureReleaseId = 'bank' | 'securities' | 'bookstore' | 'emotionOrbs' | 'petEgg';

export const STUDENT_FEATURE_RELEASES: Readonly<Record<StudentFeatureReleaseId, boolean>> = {
  bank: true,
  securities: false,
  bookstore: true,
  emotionOrbs: true,
  petEgg: false,
};

export const STUDENT_CUSTOM_HOUSE_RELEASED = false;

const STUDENT_VIEW_FEATURES: Readonly<Record<string, StudentFeatureReleaseId>> = {
  emotions: 'emotionOrbs',
  library: 'bookstore',
  'library-bookstore': 'bookstore',
  'library-bookshelf': 'bookstore',
  'store-bank': 'bank',
  'store-securities': 'securities',
  'store-securities-trade': 'securities',
};

export const getUnavailableStudentFeature = (view: string): StudentFeatureReleaseId | null => {
  const feature = STUDENT_VIEW_FEATURES[view];
  return feature && !STUDENT_FEATURE_RELEASES[feature] ? feature : null;
};

export const getStudentFeatureFallbackView = (feature: StudentFeatureReleaseId): 'overview' | 'store' => (
  feature === 'bank' || feature === 'securities' ? 'store' : 'overview'
);
