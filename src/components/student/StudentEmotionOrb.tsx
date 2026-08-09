import type { KeyboardEvent } from 'react';
import type {
  StudentEmotionDefinition,
} from '../../lib/studentEmotion';

interface StudentEmotionOrbVisualProps {
  emotion: StudentEmotionDefinition;
  selected?: boolean;
  compact?: boolean;
}

export function StudentEmotionOrbVisual({
  emotion,
  selected = false,
  compact = false,
}: StudentEmotionOrbVisualProps) {
  return (
    <span
      className={`student-emotion-orb student-emotion-orb-${emotion.zone}${compact ? ' student-emotion-orb-compact' : ''}`}
      data-emotion-id={emotion.id}
      aria-hidden="true"
    >
      <img
        src={`/emotions-v2/${emotion.id}.png`}
        alt=""
        width={220}
        height={220}
        draggable="false"
      />
    </span>
  );
}

interface StudentEmotionOrbProps {
  key?: string;
  emotion: StudentEmotionDefinition;
  selected: boolean;
  focusable: boolean;
  onSelect: (emotion: StudentEmotionDefinition) => void;
}

export default function StudentEmotionOrb({
  emotion,
  selected,
  focusable,
  onSelect,
}: StudentEmotionOrbProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const group = event.currentTarget.closest('[role="radiogroup"]');
    if (!group) return;
    const options = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .filter((option) => option.offsetParent !== null);
    const currentIndex = options.indexOf(event.currentTarget);
    if (currentIndex < 0 || options.length === 0) return;
    event.preventDefault();
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : (currentIndex + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + options.length)
          % options.length;
    options[targetIndex]?.focus();
    options[targetIndex]?.click();
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={focusable ? 0 : -1}
      className="student-emotion-option"
      data-zone={emotion.zone}
      onClick={() => onSelect(emotion)}
      onKeyDown={handleKeyDown}
    >
      <StudentEmotionOrbVisual emotion={emotion} selected={selected} />
      <span>{emotion.label}</span>
    </button>
  );
}
