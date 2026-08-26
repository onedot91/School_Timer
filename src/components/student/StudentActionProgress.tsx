interface StudentActionProgressProps {
  readonly isActive: boolean;
}

export default function StudentActionProgress({ isActive }: StudentActionProgressProps) {
  if (!isActive) return null;

  return (
    <div className="student-action-progress" role="status" aria-live="polite">
      <span>처리 중</span>
      <div className="student-action-progress-track" role="progressbar" aria-label="요청 처리 중">
        <span className="student-action-progress-fill" />
      </div>
    </div>
  );
}
