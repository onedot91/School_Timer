interface TeacherLoadingStateProps {
  readonly label: string;
  readonly variant?: 'panel' | 'list';
  readonly rows?: number;
}

const LINE_WIDTHS = ['72%', '54%', '86%', '63%', '78%'];

// 서버 기록을 받기 전의 자리표시. 기본값(0개, 미등록)을 실제 상태처럼 보이지 않게 한다.
export default function TeacherLoadingState({ label, variant = 'panel', rows = 3 }: TeacherLoadingStateProps) {
  return (
    <div className="teacher-loading" data-variant={variant} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {variant === 'panel' ? (
        <div className="teacher-loading-head" aria-hidden="true">
          <span className="teacher-loading-block teacher-loading-title" />
          <span className="teacher-loading-block teacher-loading-chip" />
          <span className="teacher-loading-block teacher-loading-chip" />
          <span className="teacher-loading-block teacher-loading-action" />
        </div>
      ) : null}
      <div className="teacher-loading-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="teacher-loading-card">
            <span className="teacher-loading-block teacher-loading-avatar" />
            <span className="teacher-loading-lines">
              <span className="teacher-loading-block teacher-loading-line" style={{ width: LINE_WIDTHS[index % LINE_WIDTHS.length] }} />
              <span className="teacher-loading-block teacher-loading-line teacher-loading-line--short" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeacherLoadingBar({ label }: { readonly label: string }) {
  return (
    <div className="teacher-loading-bar" role="progressbar" aria-label={label} aria-busy="true">
      <span />
    </div>
  );
}
