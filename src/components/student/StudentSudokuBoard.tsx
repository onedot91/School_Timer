type SudokuInteractionMode = 'keyboard' | 'pointer';

interface StudentSudokuBoardProps {
  readonly cells: readonly number[];
  readonly puzzleCells: readonly number[];
  readonly selectedIndex: number;
  readonly matchingIndices: ReadonlySet<number>;
  readonly lastEditedIndex: number | null;
  readonly feedbackSequence: number;
  readonly interactionMode: SudokuInteractionMode;
  readonly difficultyLabel: string;
  readonly gridSize: number;
  readonly boxRows: number;
  readonly boxColumns: number;
  readonly onSelect: (index: number, mode: SudokuInteractionMode) => void;
}

export default function StudentSudokuBoard({
  cells,
  puzzleCells,
  selectedIndex,
  matchingIndices,
  lastEditedIndex,
  feedbackSequence,
  interactionMode,
  difficultyLabel,
  gridSize,
  boxRows,
  boxColumns,
  onSelect,
}: StudentSudokuBoardProps) {
  return (
    <div
      className={`student-sudoku-grid is-size-${gridSize} ${interactionMode === 'keyboard' ? 'is-keyboard-mode' : ''}`}
      role="grid"
      aria-label={`${difficultyLabel} ${gridSize}×${gridSize} 스도쿠 문제`}
    >
      {cells.map((value, index) => {
        const row = Math.floor(index / gridSize);
        const column = index % gridSize;
        const isGiven = puzzleCells[index] !== 0;
        const isEntered = !isGiven && value !== 0;
        const isSelected = selectedIndex === index;
        const isMatching = matchingIndices.has(index);
        const isPeer = selectedIndex >= 0 && (
          row === Math.floor(selectedIndex / gridSize)
          || column === selectedIndex % gridSize
          || (Math.floor(row / boxRows) === Math.floor(Math.floor(selectedIndex / gridSize) / boxRows)
            && Math.floor(column / boxColumns) === Math.floor((selectedIndex % gridSize) / boxColumns))
        );
        const isBoxEndColumn = (column + 1) % boxColumns === 0 && column < gridSize - 1;
        const isBoxEndRow = (row + 1) % boxRows === 0 && row < gridSize - 1;
        const isLastColumn = column === gridSize - 1;
        const isLastRow = row === gridSize - 1;
        const shouldAnimateInput = interactionMode === 'pointer' && lastEditedIndex === index;

        return (
          <button
            type="button"
            role="gridcell"
            key={index}
            className={`${isGiven ? 'is-given' : ''} ${isEntered ? 'is-entered' : ''} ${isSelected ? 'is-selected' : ''} ${isPeer ? 'is-peer' : ''} ${isMatching ? 'is-matching' : ''} ${isBoxEndColumn ? 'is-box-end-column' : ''} ${isBoxEndRow ? 'is-box-end-row' : ''} ${isLastColumn ? 'is-last-column' : ''} ${isLastRow ? 'is-last-row' : ''}`}
            aria-label={`${row + 1}행 ${column + 1}열, ${value || '빈칸'}${isGiven ? ', 주어진 숫자' : isEntered ? ', 내가 입력한 숫자' : ''}${isMatching ? ', 선택한 숫자와 같음' : ''}`}
            aria-selected={isSelected}
            onClick={(event) => onSelect(index, event.detail === 0 ? 'keyboard' : 'pointer')}
          >
            {value ? (
              <span
                key={`${value}-${shouldAnimateInput ? feedbackSequence : 0}`}
                className={`student-sudoku-digit ${shouldAnimateInput ? 'has-input-feedback' : ''}`}
              >
                {value}
              </span>
            ) : shouldAnimateInput ? (
              <span key={`clear-${feedbackSequence}`} className="student-sudoku-clear-feedback" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
