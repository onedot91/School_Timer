import { parseTodayFriendCommonalities } from './todayFriend.js';

const HANGUL_AGE = '열아홉|열여덟|열일곱|열여섯|열다섯|열넷|열네|열셋|열세|열둘|열두|열한|열|스무|아홉|여덟|일곱|여섯|다섯|넷|네|셋|세|둘|두|하나|한';

const VISIBLE_TRAIT_PATTERNS = [
  /남\s*자|여\s*자|남\s*성|여\s*성|남\s*학생|여\s*학생|남\s*잔|여\s*잔|성\s*별/u,
  /삼\s*학\s*년|3\s*학\s*년|학\s*년|(?:^|[^\d])3\s*반(?!찬)|삼\s*반(?!찬)/u,
  new RegExp(`나\\s*이(?!스|프|키|팅)|동\\s*갑|몇\\s*살|(?:^|\\D)(?:[1-9]|1[0-9])\\s*살|(?:${HANGUL_AGE})\\s*살`, 'u'),
  /안\s*경|운\s*동\s*화|신\s*발|교\s*복|옷\s*색(?:깔)?|같은\s*옷|옷\s*이\s*같|머리\s*색(?:깔)?|머리카락|피부\s*색(?:깔)?|단발|장발|곱슬|(?<![가-힣])키(?:\s*(?:가|는|도|와|랑|의))?(?:\s*(?:아주|정말|너무|안|조금))?\s*(?:비슷|같|크|작|큰)|(?:같은|큰|작은)\s*키(?![가-힣])/u,
] as const;

const FIELD_LABELS = ['첫 번째', '두 번째', '세 번째'] as const;

const normalizeTraitText = (value: string): string => (
  value.normalize('NFKC').toLocaleLowerCase('ko-KR')
);

export const findTodayFriendVisibleTrait = (value: string): boolean => {
  const text = normalizeTraitText(value);
  return VISIBLE_TRAIT_PATTERNS.some((pattern) => pattern.test(text));
};

export const findTodayFriendCommonalityVisibleTraitIndex = (commonality: string): number | null => {
  const index = parseTodayFriendCommonalities(commonality).findIndex((item) => findTodayFriendVisibleTrait(item));
  return index >= 0 ? index : null;
};

export const todayFriendVisibleTraitMessage = (index: number): string => {
  const label = FIELD_LABELS[index] ?? `${index + 1}번`;
  return `${label} 공통점은 눈으로 바로 보이는 특징이라 적을 수 없어요.`;
};
