import { CircleDashed } from 'lucide-react';
import type { StudentEmotionDefinition } from '../../lib/studentEmotion';
import { StudentEmotionOrbVisual } from './StudentEmotionOrb';

interface StudentEmotionSummaryProps {
  emotion: StudentEmotionDefinition | null;
  onOpen: () => void;
}

export default function StudentEmotionSummary({
  emotion,
  onOpen,
}: StudentEmotionSummaryProps) {
  return (
    <section
      className="student-emotion-summary"
      aria-label="오늘의 감정"
      data-emotion-zone={emotion?.zone}
    >
      <div className="student-emotion-summary-copy">
        <span>오늘의 감정</span>
        <strong>{emotion?.label ?? '아직 선택하지 않았어요'}</strong>
      </div>
      <button
        type="button"
        className="student-emotion-summary-action"
        onClick={onOpen}
        aria-label={emotion ? `오늘의 감정 ${emotion.label}. 감정 바꾸기` : '오늘의 감정 고르기'}
        title={emotion ? `오늘의 감정 ${emotion.label}. 감정 바꾸기` : '오늘의 감정 고르기'}
      >
        {emotion ? (
          <StudentEmotionOrbVisual emotion={emotion} compact />
        ) : (
          <span className="student-emotion-empty-orb" aria-hidden="true"><CircleDashed size={24} /></span>
        )}
      </button>
    </section>
  );
}
