import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  STUDENT_PET_HATCH_AMOUNT,
  getStudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';

interface StudentPetStageProps {
  pet: StudentPetState;
  onOpenPetPicker: () => void;
  onMovePet: (position: StudentPetState['position']) => void;
}

export default function StudentPetStage({ pet, onOpenPetPicker, onMovePet }: StudentPetStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(pet.position);
  const isHatched = pet.fedAmount >= STUDENT_PET_HATCH_AMOUNT;
  const petKind = getStudentPetKind(pet.petKind);

  useEffect(() => setPosition(pet.position), [pet.position]);

  const getPositionFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return position;
    return {
      x: Math.max(0.08, Math.min(0.92, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0.12, Math.min(0.88, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenPetPicker();
      return;
    }
    const changes: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -0.03, y: 0 },
      ArrowRight: { x: 0.03, y: 0 },
      ArrowUp: { x: 0, y: -0.03 },
      ArrowDown: { x: 0, y: 0.03 },
    };
    const change = changes[event.key];
    if (!change) return;
    event.preventDefault();
    const nextPosition = {
      x: Math.max(0.08, Math.min(0.92, position.x + change.x)),
      y: Math.max(0.12, Math.min(0.88, position.y + change.y)),
    };
    setPosition(nextPosition);
    onMovePet(nextPosition);
  };

  return (
    <div
      ref={stageRef}
      className="student-character-stage-card"
      aria-label={isHatched ? '펫 배경. 두 번 누르면 펫을 바꿀 수 있습니다.' : '학생 캐릭터와 배경 이미지 영역'}
      onDoubleClick={isHatched ? onOpenPetPicker : undefined}
    >
      <div className="student-character-stage-placeholder" aria-hidden="true" />
      {isHatched ? (
        <button
          type="button"
          className="student-pet-stage-character"
          style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
          aria-label={`${pet.name || petKind.label} 위치 옮기기. Enter 키로 펫 바꾸기`}
          title="드래그해서 위치를 옮기세요"
          onDoubleClick={(event) => {
            event.stopPropagation();
            onOpenPetPicker();
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setPosition(getPositionFromPointer(event));
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            setPosition(getPositionFromPointer(event));
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const nextPosition = getPositionFromPointer(event);
            event.currentTarget.releasePointerCapture(event.pointerId);
            setPosition(nextPosition);
            onMovePet(nextPosition);
          }}
          onKeyDown={handleKeyDown}
        >
          <span aria-hidden="true">{petKind.emoji}</span>
          {pet.name ? <strong>{pet.name}</strong> : null}
        </button>
      ) : null}
    </div>
  );
}
