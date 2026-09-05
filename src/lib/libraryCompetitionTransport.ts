import type { LibraryCompetitionState, LibraryCompetitionStanding, LibraryCompetitionSpeed } from './libraryCompetition.js';
import type { StudentBook } from './studentLife.js';

export type LibraryCompetitionResponse = {
  readonly competition: {
    readonly state: LibraryCompetitionState | null;
    readonly standings: readonly LibraryCompetitionStanding[];
    readonly serverAt: string;
  };
  readonly value: Record<string, unknown>;
  readonly updatedAt: string | null;
  readonly rolledOver: boolean;
};
export type LibraryCompetitionArchive = {
  readonly seasonId: string;
  readonly archivedAt: string;
  readonly standings: readonly LibraryCompetitionStanding[];
  readonly books: readonly StudentBook[];
};
export type LibraryCompetitionHistoryResponse = {
  readonly months: readonly { readonly seasonId: string; readonly archivedAt: string }[];
  readonly archive: LibraryCompetitionArchive | null;
};
export type LibraryCompetitionSettingsInput = {
  readonly expectedRevision: number;
  readonly speed: LibraryCompetitionSpeed;
  readonly paused: boolean;
  readonly counts: readonly { readonly schoolId: string; readonly count: number }[];
};

const MESSAGES: Readonly<Record<string, string>> = {
  LIBRARY_COMPETITION_UNAVAILABLE: '책방 챌린지를 준비 중이에요. 기존 책방은 그대로 이용할 수 있어요.',
  LIBRARY_COMPETITION_CONFLICT: '다른 선생님이 설정을 바꿨어요. 최신값을 확인한 뒤 다시 저장해 주세요.',
  SHARED_SETTINGS_CONFLICT: '공유 기록이 바뀌었어요. 최신값을 확인한 뒤 다시 저장해 주세요.',
  LIBRARY_SEASON_CHANGED: '새 달이 시작됐어요. 최신 기록을 확인해 주세요.',
  READ_ONLY_DATA_MODE: '읽기 전용 모드에서는 변경할 수 없어요.',
  LIBRARY_COMPETITION_INVALID: '학교별 권수와 설정값을 다시 확인해 주세요.',
  LIBRARY_COMPETITION_INVALID_RESPONSE: '순위판 응답을 확인하지 못했어요. 다시 열어 주세요.',
  LIBRARY_COMPETITION_NETWORK: '순위판에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  LIBRARY_COMPETITION_LOCAL_SAVE_FAILED: '이 기기에 기록을 저장하지 못했어요. 기존 기록은 유지됩니다.',
};

export class LibraryCompetitionClientError extends Error {
  readonly name = 'LibraryCompetitionClientError';
  constructor(readonly code: string) {
    super(MESSAGES[code] ?? '순위판을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
