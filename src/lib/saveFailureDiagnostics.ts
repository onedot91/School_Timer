import { parseSaveFailureDiagnostics, SAVE_FAILURE_CODE_LABELS, SAVE_FAILURE_FEATURES, SAVE_FAILURE_VIEWS, type SaveFailureAlert, type SaveFailureDiagnostics } from './saveFailure.js';

export const collectSaveFailureDiagnostics = (error: unknown, context: SaveFailureDiagnostics = {}): SaveFailureDiagnostics | undefined => {
  let details = parseSaveFailureDiagnostics(context) ?? {};
  let current = error;
  for (let depth = 0; depth < 4 && (current instanceof Error || (typeof DOMException !== 'undefined' && current instanceof DOMException)); depth += 1) {
    const errorCode = Reflect.get(current, 'code');
    const candidate = parseSaveFailureDiagnostics({
      errorCode: typeof errorCode === 'string' ? errorCode : current.message,
      causeCode: Reflect.get(current, 'serverCode'),
      httpStatus: Reflect.get(current, 'status') ?? Number(/(?:HTTP_|HTTP )([0-9]{3})/.exec(current.message)?.[1]),
      errorName: current.name, endpoint: Reflect.get(current, 'endpoint'),
    }) ?? {};
    details = {
      ...candidate, ...details,
      ...(details.errorName === 'Error' && candidate.errorName ? { errorName: candidate.errorName } : {}),
      ...(details.errorCode && candidate.errorCode && candidate.errorCode !== details.errorCode && !details.causeCode
        ? { causeCode: candidate.causeCode ?? candidate.errorCode } : {}),
    };
    current = Reflect.get(current, 'cause');
  }
  return parseSaveFailureDiagnostics(details);
};

export const getSaveFailureExplanation = (alert: SaveFailureAlert): { problem: string; action: string } => {
  const details = alert.diagnostics;
  if ([details?.errorCode, details?.causeCode].includes('SHARED_SETTINGS_NOT_CONFIGURED')) return {
    problem: '서버에 학급 기록 저장 연결 설정이 없어 요청이 거절됐습니다.',
    action: '진단 정보를 전달해 서버 연결 설정을 수정해야 합니다. 설정 복구 후 기록 반영 여부를 확인하세요.',
  };
  if (details?.httpStatus === 429) return {
    problem: '요청이 너무 많아 서버가 저장 요청을 제한했습니다.',
    action: '잠시 기다린 뒤 기록 반영 여부를 확인하세요. 기록이 없을 때만 다시 저장하세요.',
  };
  if (alert.code === 'response') return {
    problem: details?.httpStatus ? `서버가 HTTP ${details.httpStatus} 오류를 반환해 저장 완료를 확인하지 못했습니다. 실제로 저장됐을 수도 있습니다.` : '서버의 저장 완료 응답을 확인하지 못했습니다. 실제로 저장됐을 수도 있습니다.',
    action: '해당 학생의 기록·잔액을 먼저 확인하세요. 중복 지급·차감을 피하도록 저장 여부가 확인되기 전에는 반복 실행하지 마세요.',
  };
  if (alert.code === 'network') return {
    problem: details?.online === false ? '오류 발생 당시 기기가 오프라인 상태였습니다.'
      : details?.errorName === 'TimeoutError' || details?.errorName === 'AbortError' ? '제한 시간 안에 응답을 받지 못했거나 요청이 중단됐습니다.'
        : '저장 요청 중 연결 오류가 발생했습니다. 이 알림만으로 기기·학교 Wi-Fi·서버 중 원인을 확정할 수 없습니다.',
    action: '학생의 작성 중 화면을 유지하고 연결을 확인하세요. 기록 반영 여부를 확인한 뒤, 저장되지 않은 경우에만 다시 시도하세요.',
  };
  if (alert.code === 'permission') return {
    problem: details?.httpStatus === 401 ? '기기 인증이 없거나 만료되어 서버가 요청을 거절했습니다.' : '서버가 해당 기기의 저장 권한을 허용하지 않았습니다.',
    action: '해당 기기의 학생 번호와 등록 상태를 확인하세요. 올바르게 등록해도 계속되면 진단 정보를 전달해 주세요.',
  };
  if (alert.code === 'conflict') return {
    problem: '다른 기기의 변경과 겹쳐 최신 기록을 덮어쓰지 않도록 저장을 중단했습니다.',
    action: '최신 기록을 확인한 뒤 필요한 변경만 다시 적용하세요. 반복되면 진단 정보를 전달해 주세요.',
  };
  if (alert.code === 'storage') return {
    problem: details?.errorName === 'QuotaExceededError' ? '기기의 저장 공간이 부족하거나 브라우저가 저장을 제한했습니다.' : '브라우저의 기기 내 저장소에 기록을 남기지 못했습니다.',
    action: '작성 중 화면과 내용을 보존하고 기기 저장 공간·브라우저 설정을 확인하세요. 기록 확인 전에는 사이트 데이터를 삭제하지 마세요.',
  };
  return {
    problem: details?.httpStatus ? `서버가 HTTP ${details.httpStatus} 오류를 반환했습니다. 저장 완료 여부를 확인해야 합니다.` : '서버 저장 처리에서 오류가 발생했습니다. 구체적인 서버 원인은 진단 정보 확인이 필요합니다.',
    action: '해당 기록이 반영됐는지 확인하세요. 여러 학생에게 반복되면 진단 정보를 복사해 오류 수정을 요청해 주세요.',
  };
};

export const formatSaveFailureDiagnostic = (alert: SaveFailureAlert): string => {
  const details = alert.diagnostics;
  const explanation = getSaveFailureExplanation(alert);
  return [
    `저장 오류 ID: ${alert.id}`,
    `발생 시각: ${alert.occurredAt}`,
    ...(details?.requestId ? [`저장 요청 ID: ${details.requestId}`] : []),
    ...(details?.buildVersion ? [`배포 버전: ${details.buildVersion}`] : []),
    ...(details?.stage ? [`실패 단계: ${details.stage}`] : []),
    ...(details?.retryCount !== undefined ? [`재시도 횟수: ${details.retryCount}`] : []),
    `대상: ${alert.studentNumber === 0 ? '교사' : `${alert.studentNumber}번 학생`}`,
    `기능: ${SAVE_FAILURE_FEATURES[alert.feature]}`,
    ...(details?.view ? [`화면: ${SAVE_FAILURE_VIEWS[details.view]}`] : []),
    `분류: ${SAVE_FAILURE_CODE_LABELS[alert.code]}`,
    ...(details?.errorCode ? [`오류 코드: ${details.errorCode}`] : []),
    ...(details?.causeCode ? [`원인 코드: ${details.causeCode}`] : []),
    ...(details?.httpStatus ? [`HTTP 상태: ${details.httpStatus}`] : []),
    ...(details?.endpoint ? [`요청 경로: ${details.endpoint}`] : []),
    ...(details?.errorName ? [`오류 유형: ${details.errorName}`] : []),
    ...(details?.online !== undefined ? [`기기 연결: ${details.online ? '온라인으로 감지' : '오프라인으로 감지'}`] : []),
    ...(!details ? ['세부 정보: 이전 알림에는 상세 진단이 저장되지 않았습니다.'] : []),
    `문제: ${explanation.problem}`, `조치: ${explanation.action}`,
  ].join('\n');
};
