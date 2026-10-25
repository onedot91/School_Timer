import { LoadingDelayedNotice, useLoadingTimeout } from '../AppRecovery';

const SKELETON_CARD_COUNT = 3;

// Placeholder in the real student layout (header + card row), so the loaded screen does not jump into place.
// Uses `.student-view` / `.student-header`, so the Chromebook shell sizes it exactly like a loaded view.
export default function StudentLoadingSkeleton({ label = '불러오는 중' }: { readonly label?: string }) {
  const delayed = useLoadingTimeout();
  return (
    <div className="student-view student-loading-skeleton" role={delayed ? undefined : 'status'} aria-busy={!delayed}>
      {delayed ? null : <span className="sr-only">{label}</span>}
      <div className="student-header" aria-hidden="true">
        <div className="student-header-identity">
          <span className="student-skeleton-block student-skeleton-back" />
          <span className="student-skeleton-block student-skeleton-title" />
        </div>
        <span className="student-skeleton-block student-skeleton-balance" />
      </div>
      {delayed ? (
        <div className="student-loading-skeleton-delayed"><LoadingDelayedNotice /></div>
      ) : (
        <div className="student-loading-skeleton-cards" aria-hidden="true">
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <div key={index} className="student-loading-skeleton-card">
              <span className="student-skeleton-block student-skeleton-scene" />
              <span className="student-skeleton-block student-skeleton-line" />
              <span className="student-skeleton-block student-skeleton-amount" />
              <span className="student-skeleton-block student-skeleton-action" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen version for the first student load: the same page shell as a loaded student screen. */
export function StudentLoadingPage({ label }: { readonly label?: string }) {
  return (
    <div className="auction-page student-mode-page h-[100dvh] w-full overflow-hidden px-3 py-3 sm:px-5 md:py-5">
      <main className="mx-auto w-full max-w-7xl">
        <StudentLoadingSkeleton label={label} />
      </main>
    </div>
  );
}
