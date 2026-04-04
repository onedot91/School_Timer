export type DictionaryErrorCode =
  | 'empty_word'
  | 'not_found'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'network'
  | 'invalid_response'
  | 'unknown';

export class DictionaryLookupError extends Error {
  code: DictionaryErrorCode;

  constructor(code: DictionaryErrorCode, message?: string) {
    super(message || code);
    this.name = 'DictionaryLookupError';
    this.code = code;
  }
}

export const classifyLookupError = (error: unknown) => {
  if (error instanceof DictionaryLookupError) return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'unknown';
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('api_key') ||
    normalizedMessage.includes('permission') ||
    normalizedMessage.includes('unauth') ||
    normalizedMessage.includes('403') ||
    normalizedMessage.includes('401')
  ) {
    return new DictionaryLookupError('invalid_api_key', message);
  }

  if (
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('failed to fetch')
  ) {
    return new DictionaryLookupError('network', message);
  }

  if (
    normalizedMessage.includes('json') ||
    normalizedMessage.includes('schema') ||
    normalizedMessage.includes('candidate')
  ) {
    return new DictionaryLookupError('invalid_response', message);
  }

  return new DictionaryLookupError('unknown', message);
};

export const getDictionaryErrorMessage = (error: unknown) => {
  const lookupError = classifyLookupError(error);

  if (lookupError.code === 'empty_word') {
    return '찾고 싶은 낱말을 먼저 입력해 주세요.';
  }

  if (lookupError.code === 'not_found') {
    return '사전에 없는 단어예요. 철자나 띄어쓰기를 다시 확인해 주세요.';
  }

  if (lookupError.code === 'missing_api_key') {
    return import.meta.env.PROD
      ? '사전 기능을 쓰려면 배포 환경 변수에 `VITE_GEMINI_API_KEY` 또는 `GEMINI_API_KEY`를 넣고 다시 배포해 주세요.'
      : '사전 기능을 쓰려면 `.env.local`에 `VITE_GEMINI_API_KEY` 또는 `GEMINI_API_KEY`를 넣어 주세요.';
  }

  if (lookupError.code === 'invalid_api_key') {
    return 'Gemini API 키를 확인해 주세요. 키가 없거나 권한이 맞지 않을 수 있어요.';
  }

  if (lookupError.code === 'network') {
    return '인터넷 연결이 잠시 불안정해서 낱말을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  if (lookupError.code === 'invalid_response') {
    return '낱말 설명을 정리하는 중에 결과가 어긋났어요. 다시 한 번 검색해 주세요.';
  }

  return '낱말 사전을 여는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
};
