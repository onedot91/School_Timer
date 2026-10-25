import { LoadingDelayedNotice, useLoadingTimeout } from '../AppRecovery';

const SKELETON_CARD_COUNT = 3;
const OVERVIEW_DESTINATION_COUNT = 3;

/** Which loaded screen the placeholder imitates: home scene + dock, bank-style card row, or one large panel. */
export type StudentLoadingSkeletonVariant = 'overview' | 'cards' | 'panel';

export const getStudentLoadingSkeletonVariant = (view: string): StudentLoadingSkeletonVariant => (
  view === 'overview' ? 'overview' : view === 'store-bank' ? 'cards' : 'panel'
);

const SkeletonHeader = () => (
  <div className="student-header" aria-hidden="true">
    <div className="student-header-identity">
      <span className="student-skeleton-block student-skeleton-back" />
      <span className="student-skeleton-block student-skeleton-title" />
    </div>
    <span className="student-skeleton-block student-skeleton-balance" />
  </div>
);

const SkeletonBody = ({ variant }: { readonly variant: StudentLoadingSkeletonVariant }) => {
  if (variant === 'overview') {
    return (
      <>
        <section className="student-overview-hero" aria-hidden="true">
          <span className="student-skeleton-block student-skeleton-overview-scene" />
        </section>
        <div className="student-overview-destinations" aria-hidden="true">
          {Array.from({ length: OVERVIEW_DESTINATION_COUNT }, (_, index) => (
            <span key={index} className="student-skeleton-block student-skeleton-overview-card" />
          ))}
        </div>
      </>
    );
  }
  if (variant === 'panel') {
    return (
      <div className="student-loading-skeleton-panel" aria-hidden="true">
        <span className="student-skeleton-block student-skeleton-scene" />
      </div>
    );
  }
  return (
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
  );
};

// Placeholder in the real student layout, so the loaded screen does not jump into place.
// Uses the loaded screen's own classes (`.student-view`, `.student-header`, overview hero/dock),
// so the Chromebook shell sizes it exactly like the screen it stands in for.
export default function StudentLoadingSkeleton({ label = '불러오는 중', variant = 'panel' }: {
  readonly label?: string;
  readonly variant?: StudentLoadingSkeletonVariant;
}) {
  const delayed = useLoadingTimeout();
  const viewClass = variant === 'overview' ? 'student-view student-overview-view' : 'student-view';
  return (
    <div className={`${viewClass} student-loading-skeleton`} data-variant={variant} role={delayed ? undefined : 'status'} aria-busy={!delayed}>
      {delayed ? null : <span className="sr-only">{label}</span>}
      {delayed ? (
        <>
          {variant === 'overview' ? null : <SkeletonHeader />}
          <div className="student-loading-skeleton-delayed"><LoadingDelayedNotice /></div>
        </>
      ) : (
        <>
          {variant === 'overview' ? null : <SkeletonHeader />}
          <SkeletonBody variant={variant} />
        </>
      )}
    </div>
  );
}

/** Full-screen version for the first student load: the same page shell as a loaded student screen. */
export function StudentLoadingPage({ label, variant }: {
  readonly label?: string;
  readonly variant?: StudentLoadingSkeletonVariant;
}) {
  return (
    <div className="auction-page student-mode-page h-[100dvh] w-full overflow-hidden px-3 py-3 sm:px-5 md:py-5">
      <main className="mx-auto w-full max-w-7xl">
        <StudentLoadingSkeleton label={label} variant={variant} />
      </main>
    </div>
  );
}
