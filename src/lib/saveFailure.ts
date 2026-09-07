export const SAVE_FAILURE_FEATURES = {
  settings: '학급 설정', numberBaseball: '숫자 야구', emotion: '감정 구슬', auction: '경매 입찰',
  sudoku: '스도쿠', pet: '펫', studentLife: '학생 기록', economy: '고마 거래',
  donation: '기부', announcement: '알림장', classword: 'ㄱㄴㄷ 게임', todayFriend: '오늘의 친구', library: '책장',
} as const;
export type SaveFailureFeature = keyof typeof SAVE_FAILURE_FEATURES;
export const SAVE_FAILURE_CODES = ['network', 'permission', 'conflict', 'server', 'storage', 'response'] as const;
export type SaveFailureCode = typeof SAVE_FAILURE_CODES[number];
export const SAVE_FAILURE_CODE_LABELS: Record<SaveFailureCode, string> = {
  network: '연결 실패', permission: '저장 권한 오류', conflict: '동시 저장 충돌',
  server: '서버 저장 실패', storage: '기기 저장 실패', response: '저장 응답 오류',
};
export type SaveFailureReport = {
  id: string;
  studentNumber: number;
  feature: SaveFailureFeature;
  code: SaveFailureCode;
  occurredAt: string;
};
export type SaveFailureAlert = SaveFailureReport & { acknowledgedAt: string | null };
export const SAVE_FAILURE_ROW_PREFIX = 'school-timer-save-alert-';
export const SAVE_FAILURE_POLL_MS = 5000;

export const parseSaveFailureReport = (value: unknown): SaveFailureReport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = Reflect.get(value, 'id');
  const studentNumber = Reflect.get(value, 'studentNumber');
  const feature = Reflect.get(value, 'feature');
  const code = Reflect.get(value, 'code');
  const occurredAt = Reflect.get(value, 'occurredAt');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(id)
    || typeof studentNumber !== 'number' || !Number.isInteger(studentNumber) || studentNumber < 0 || studentNumber > 23
    || typeof feature !== 'string' || !Object.hasOwn(SAVE_FAILURE_FEATURES, feature)
    || !SAVE_FAILURE_CODES.some((candidate) => candidate === code)
    || typeof occurredAt !== 'string' || occurredAt.length > 32 || !Number.isFinite(Date.parse(occurredAt))) return null;
  return { id, studentNumber, feature: feature as SaveFailureFeature, code: code as SaveFailureCode, occurredAt };
};

export const parseSaveFailureAlert = (value: unknown): SaveFailureAlert | null => {
  const report = parseSaveFailureReport(value);
  if (!report) return null;
  const acknowledgedAt = Reflect.get(Object(value), 'acknowledgedAt');
  if (acknowledgedAt !== null && (typeof acknowledgedAt !== 'string' || !Number.isFinite(Date.parse(acknowledgedAt)))) return null;
  return { ...report, acknowledgedAt };
};

export const classifySaveFailure = (error: unknown): SaveFailureCode | null => {
  if (!(error instanceof Error)) return null;
  const status = Reflect.get(error, 'status') ?? Number(/(?:HTTP_|HTTP )([0-9]{3})/.exec(error.message)?.[1]);
  if (status === 401 || status === 403) return 'permission';
  if (status === 409 || error.message === 'SHARED_SETTINGS_CONFLICT') return 'conflict';
  if (status === 408 || status === 429 || status >= 500) return 'server';
  if (error.name === 'QuotaExceededError' || /LOCAL_SAVE_FAILED|STORAGE/.test(error.message)) return 'storage';
  if (error.name === 'SyntaxError' || /INVALID_RESPONSE/.test(error.message)) return 'response';
  if (error.name === 'TypeError' || error.name === 'TimeoutError' || error.name === 'AbortError') return 'network';
  return null;
};
