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
  diagnostics?: SaveFailureDiagnostics;
};
export const SAVE_FAILURE_VIEWS = {
  teacher: '교사 화면', overview: '광장', store: '상점', 'store-auction': '경매장',
  'store-bank': '은행', 'store-shop': '고마 상점', 'store-donation': '기부',
  missions: '미션', emotions: '감정 구슬', 'number-baseball': '숫자 야구', sudoku: '스도쿠',
  classword: 'ㄱㄴㄷ 게임', 'today-friend': '오늘의 친구', mailbox: '우체통',
  library: '도서관', 'library-bookstore': '책방', 'library-bookshelf': '책장', 'library-failure-board': '실패 게시판',
} as const;
export type SaveFailureDiagnostics = {
  errorCode?: string;
  causeCode?: string;
  httpStatus?: number;
  errorName?: string;
  endpoint?: string;
  view?: keyof typeof SAVE_FAILURE_VIEWS;
  online?: boolean;
};
export const parseSaveFailureDiagnostics = (value: unknown): SaveFailureDiagnostics | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: SaveFailureDiagnostics = {};
  for (const field of ['errorCode', 'causeCode'] as const) {
    const code = Reflect.get(value, field);
    if (typeof code === 'string' && /^(?:SHARED_|STUDENT_|LIBRARY_|CLASSWORD_|TODAY_FRIEND_|DEVICE_|ANNOUNCEMENT_|CLASS_DONATION_|LOCAL_|AUCTION_|INVALID_|CROSS_SITE_|RATE_LIMIT_|STORAGE)[A-Z0-9_]{1,64}$/.test(code)) result[field] = code;
  }
  const status = Reflect.get(value, 'httpStatus');
  if (Number.isInteger(status) && status >= 400 && status <= 599) result.httpStatus = status;
  const errorName = Reflect.get(value, 'errorName');
  if (['Error', 'TypeError', 'TimeoutError', 'AbortError', 'QuotaExceededError', 'SyntaxError'].includes(errorName)) result.errorName = errorName;
  const endpoint = Reflect.get(value, 'endpoint');
  if (['/api/shared-settings', '/api/student-economy', '/api/classword', '/api/today-friend', '/api/class-donation', '/api/announcement-notes'].includes(endpoint)) result.endpoint = endpoint;
  const view = Reflect.get(value, 'view');
  if (typeof view === 'string' && Object.hasOwn(SAVE_FAILURE_VIEWS, view)) result.view = view as keyof typeof SAVE_FAILURE_VIEWS;
  const online = Reflect.get(value, 'online');
  if (typeof online === 'boolean') result.online = online;
  return Object.keys(result).length > 0 ? result : undefined;
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
  const diagnostics = parseSaveFailureDiagnostics(Reflect.get(value, 'diagnostics'));
  return { id, studentNumber, feature: feature as SaveFailureFeature, code: code as SaveFailureCode, occurredAt, ...(diagnostics ? { diagnostics } : {}) };
};

export const parseSaveFailureAlert = (value: unknown): SaveFailureAlert | null => {
  const report = parseSaveFailureReport(value);
  if (!report) return null;
  const acknowledgedAt = Reflect.get(Object(value), 'acknowledgedAt');
  if (acknowledgedAt !== null && (typeof acknowledgedAt !== 'string' || !Number.isFinite(Date.parse(acknowledgedAt)))) return null;
  return { ...report, acknowledgedAt };
};

export const classifySaveFailure = (error: unknown): SaveFailureCode | null => {
  if (!(error instanceof Error) && !(typeof DOMException !== 'undefined' && error instanceof DOMException)) return null;
  const errorCode = Reflect.get(error, 'code');
  if (errorCode === 'CLASSWORD_INITIAL_OCCUPIED' || errorCode === 'CLASSWORD_STUDENT_ALREADY_ENTERED' || errorCode === 'CLASSWORD_ENTRY_CHANGED') return null;
  const status = Reflect.get(error, 'status') ?? Number(/(?:HTTP_|HTTP )([0-9]{3})/.exec(error.message)?.[1]);
  if (status === 401 || status === 403) return 'permission';
  if (status === 409 || error.message === 'SHARED_SETTINGS_CONFLICT') return 'conflict';
  if (status === 408 || status === 429 || status >= 500) return 'server';
  if (error.name === 'QuotaExceededError' || /LOCAL_SAVE_FAILED|STORAGE/.test(error.message)) return 'storage';
  if (error.name === 'SyntaxError' || /INVALID_RESPONSE|SHARED_SETTINGS_SAVE_UNCONFIRMED/.test(error.message)) return 'response';
  if (error.name === 'TypeError' || error.name === 'TimeoutError' || error.name === 'AbortError') return 'network';
  return null;
};
