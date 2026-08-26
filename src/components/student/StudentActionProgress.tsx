interface StudentActionProgressProps {
  readonly isActive: boolean;
}

export default function StudentActionProgress({ isActive }: StudentActionProgressProps) {
  if (!isActive) return null;

  return (
    <div className="student-action-progress" role="status" aria-live="polite" aria-label="요청 처리 중">
      <div className="student-action-progress-card">
        <span className="student-action-progress-spinner" aria-hidden="true" />
        <strong>처리 중</strong>
      </div>
    </div>
  );
}
