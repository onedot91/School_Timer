export type TeacherSaveIndicatorState =
  | 'unsafe' | 'failed' | 'unconfirmed' | 'maintenance' | 'update'
  | 'saving' | 'refresh' | 'loading' | 'reviewed' | 'local' | 'saved';

export interface TeacherSaveIndicatorInput {
  /** Drafts could not be kept on this device. */
  readonly unsafe: boolean;
  readonly saveError: boolean;
  readonly noticeKind: 'maintenance' | 'update' | null;
  /** Requests whose server result is still unknown, reviewed or not. */
  readonly pendingRecovery: number;
  readonly activeIssues: number;
  readonly reviewedIssues: number;
  readonly recovering: boolean;
  readonly inFlightSaves: number;
  readonly refreshPending: boolean;
  readonly loading: boolean;
  /** False when settings only persist to this browser (mock data or no shared backend). */
  readonly sharedBackend: boolean;
}

export interface TeacherSaveIndicator {
  readonly state: TeacherSaveIndicatorState;
  readonly label: string;
  readonly count: number;
  readonly tone: 'danger' | 'warning' | 'progress' | 'success' | 'neutral';
}

const indicators: Record<TeacherSaveIndicatorState, Omit<TeacherSaveIndicator, 'state' | 'count'>> = {
  unsafe: { label: '기기 보관 실패', tone: 'danger' },
  failed: { label: '저장 실패', tone: 'danger' },
  unconfirmed: { label: '저장 결과 미확인', tone: 'warning' },
  maintenance: { label: '저장 점검 중', tone: 'warning' },
  update: { label: '새로고침 필요', tone: 'warning' },
  saving: { label: '저장 중', tone: 'progress' },
  refresh: { label: '저장됨 · 화면 갱신 필요', tone: 'success' },
  loading: { label: '설정 불러오는 중', tone: 'neutral' },
  reviewed: { label: '확인 처리한 알림 있음', tone: 'neutral' },
  local: { label: '이 기기에만 저장', tone: 'neutral' },
  saved: { label: '저장됨', tone: 'success' },
};

// Problems outrank progress so a failure is never hidden behind a later save; "saved" only shows when nothing is pending.
export const deriveTeacherSaveIndicator = (input: TeacherSaveIndicatorInput): TeacherSaveIndicator => {
  const unconfirmed = input.activeIssues > 0 || input.pendingRecovery > input.reviewedIssues;
  const state: TeacherSaveIndicatorState = input.unsafe ? 'unsafe'
    : input.saveError ? 'failed'
      : unconfirmed ? 'unconfirmed'
        : input.noticeKind === 'maintenance' ? 'maintenance'
          : input.noticeKind === 'update' ? 'update'
            : input.inFlightSaves > 0 || input.recovering ? 'saving'
              : input.refreshPending ? 'refresh'
                : input.loading ? 'loading'
                  : input.reviewedIssues > 0 ? 'reviewed'
                    : input.sharedBackend ? 'saved' : 'local';
  const count = state === 'unconfirmed' ? Math.max(input.activeIssues, input.pendingRecovery - input.reviewedIssues, 1)
    : state === 'reviewed' ? input.reviewedIssues : 0;
  return { state, count, ...indicators[state] };
};
