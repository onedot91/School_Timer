export interface StudentFailureRelayPauseState {
  readonly isExternallyPaused: boolean;
  readonly isPointerPaused: boolean;
  readonly isFocusPaused: boolean;
  readonly isStampMenuOpen: boolean;
  readonly isNavigationPressed: boolean;
}

export const shouldPauseStudentFailureRelay = (state: StudentFailureRelayPauseState): boolean => (
  state.isExternallyPaused
  || state.isPointerPaused
  || state.isFocusPaused
  || state.isStampMenuOpen
  || state.isNavigationPressed
);
