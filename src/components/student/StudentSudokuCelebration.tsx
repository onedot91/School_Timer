const PARTICLE_COUNT = 8;

interface StudentSudokuCelebrationProps {
  readonly isActive: boolean;
}

export default function StudentSudokuCelebration({ isActive }: StudentSudokuCelebrationProps) {
  if (!isActive) return null;

  return (
    <div className="student-sudoku-celebration" aria-hidden="true">
      <span className="student-sudoku-celebration-wave" />
      {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
        <span className="student-sudoku-celebration-particle" key={index} />
      ))}
    </div>
  );
}
