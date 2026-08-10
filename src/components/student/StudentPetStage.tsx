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
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: StudentPetState['position'];
  } | null>(null);
  const [position, setPosition] = useState(pet.position);
  const hasActivePet = pet.petKind !== null;
  const petKind = getStudentPetKind(pet.petKind);

  useEffect(() => setPosition(pet.position), [pet.position]);

  const getPositionFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    const drag = dragRef.current;
    if (!bounds || !drag) return position;
    return {
      x: Math.max(0.08, Math.min(0.92, drag.startPosition.x + (event.clientX - drag.startClientX) / bounds.width)),
      y: Math.max(0.12, Math.min(0.88, drag.startPosition.y + (event.clientY - drag.startClientY) / bounds.height)),
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
      aria-label={hasActivePet ? '펫 배경. 두 번 누르면 보유한 펫을 바꿀 수 있습니다.' : '학생 캐릭터와 배경 이미지 영역'}
      onDoubleClick={hasActivePet ? onOpenPetPicker : undefined}
    >
      <div className="student-character-stage-placeholder" aria-hidden="true" />
      {hasActivePet ? (
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
            dragRef.current = {
              pointerId: event.pointerId,
              startClientX: event.clientX,
              startClientY: event.clientY,
              startPosition: position,
            };
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId) || dragRef.current?.pointerId !== event.pointerId) return;
            setPosition(getPositionFromPointer(event));
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId) || dragRef.current?.pointerId !== event.pointerId) return;
            const nextPosition = getPositionFromPointer(event);
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragRef.current = null;
            setPosition(nextPosition);
            if (nextPosition.x !== position.x || nextPosition.y !== position.y) onMovePet(nextPosition);
          }}
          onPointerCancel={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return;
            dragRef.current = null;
            setPosition(pet.position);
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
