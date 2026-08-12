import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  STUDENT_PET_HATCH_AMOUNT,
  getStudentPetKind,
  type StudentPetState,
} from '../../lib/studentPet';
import { STUDENT_CHARACTER_PRIZES, STUDENT_HOUSE_DESIGNS, type StudentCharacterPrizeId, type StudentCustomHouseTheme, type StudentHouseDesignId } from '../../lib/studentEconomy';

interface StudentPetStageProps {
  pet: StudentPetState;
  hasUnreadMail: boolean;
  isHouseRepaired: boolean;
  activeCharacterId: StudentCharacterPrizeId | null;
  activeHouseId: StudentHouseDesignId | 'custom' | null;
  customHouseTheme: StudentCustomHouseTheme | null;
  onOpenMailbox: () => void;
  onOpenLibrary: () => void;
  onOpenPetPicker: () => void;
  onMovePet: (position: StudentPetState['position']) => void;
  onMoveGoma: (position: StudentPetState['gomaPosition']) => void;
}

export default function StudentPetStage({ pet, hasUnreadMail, isHouseRepaired, activeCharacterId, activeHouseId, customHouseTheme, onOpenMailbox, onOpenLibrary, onOpenPetPicker, onMovePet, onMoveGoma }: StudentPetStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: StudentPetState['position'];
  } | null>(null);
  const gomaDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: StudentPetState['gomaPosition'];
  } | null>(null);
  const [position, setPosition] = useState(pet.position);
  const [gomaPosition, setGomaPosition] = useState(pet.gomaPosition);
  const hasActivePet = pet.petKind !== null;
  const petKind = getStudentPetKind(pet.petKind);
  const activeCharacter = STUDENT_CHARACTER_PRIZES.find((character) => character.id === activeCharacterId);
  const activeHouse = STUDENT_HOUSE_DESIGNS.find((house) => house.id === activeHouseId);

  useEffect(() => setPosition(pet.position), [pet.position]);
  useEffect(() => setGomaPosition(pet.gomaPosition), [pet.gomaPosition]);

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

  const getGomaPositionFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    const drag = gomaDragRef.current;
    if (!bounds || !drag) return gomaPosition;
    return {
      x: Math.max(0.12, Math.min(0.88, drag.startPosition.x + (event.clientX - drag.startClientX) / bounds.width)),
      y: Math.max(0.2, Math.min(0.82, drag.startPosition.y + (event.clientY - drag.startClientY) / bounds.height)),
    };
  };

  const handleGomaKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
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
      x: Math.max(0.12, Math.min(0.88, gomaPosition.x + change.x)),
      y: Math.max(0.2, Math.min(0.82, gomaPosition.y + change.y)),
    };
    setGomaPosition(nextPosition);
    onMoveGoma(nextPosition);
  };

  return (
    <div
      ref={stageRef}
      className="student-character-stage-card"
      data-unread-mail={hasUnreadMail ? 'true' : 'false'}
      aria-label={hasActivePet ? '펫 배경. 두 번 누르면 보유한 펫을 바꿀 수 있습니다.' : '학생 캐릭터와 배경 이미지 영역'}
      onDoubleClick={hasActivePet ? onOpenPetPicker : undefined}
    >
      <div className="student-character-stage-placeholder" aria-hidden="true" />
      <img
        className={`student-home-house${activeHouseId === 'custom' && customHouseTheme ? ` student-home-house-${customHouseTheme}` : ''}`}
        src={activeHouse?.imageSrc ?? (isHouseRepaired ? '/student-house-after.png' : '/student-house-before.png')}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <button type="button" className="student-home-hotspot student-home-hotspot-mailbox" onClick={onOpenMailbox} aria-label={hasUnreadMail ? '새 편지가 있는 우편함 열기' : '우편함 열기'} />
      <button type="button" className="student-home-hotspot student-home-hotspot-library" onClick={onOpenLibrary} aria-label="책방 열기" />
      <button
        type="button"
        className="student-goma-stage-character"
        style={{ left: `${gomaPosition.x * 100}%`, top: `${gomaPosition.y * 100}%` }}
        aria-label="고마 캐릭터 위치 옮기기"
        title="드래그해서 위치를 옮기세요"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          gomaDragRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPosition: gomaPosition,
          };
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId) || gomaDragRef.current?.pointerId !== event.pointerId) return;
          setGomaPosition(getGomaPositionFromPointer(event));
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId) || gomaDragRef.current?.pointerId !== event.pointerId) return;
          const drag = gomaDragRef.current;
          const nextPosition = getGomaPositionFromPointer(event);
          event.currentTarget.releasePointerCapture(event.pointerId);
          gomaDragRef.current = null;
          setGomaPosition(nextPosition);
          if (nextPosition.x !== drag.startPosition.x || nextPosition.y !== drag.startPosition.y) onMoveGoma(nextPosition);
        }}
        onPointerCancel={(event) => {
          if (gomaDragRef.current?.pointerId !== event.pointerId) return;
          gomaDragRef.current = null;
          setGomaPosition(pet.gomaPosition);
        }}
        onKeyDown={handleGomaKeyDown}
      >
        {activeCharacter ? (
          <img className="student-goma-selected-character" src={activeCharacter.imageSrc} alt={activeCharacter.name} draggable={false} />
        ) : (
          <img src="/goma-canvas-character.png" alt="" draggable={false} />
        )}
      </button>
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
            const drag = dragRef.current;
            const nextPosition = getPositionFromPointer(event);
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragRef.current = null;
            setPosition(nextPosition);
            if (nextPosition.x !== drag.startPosition.x || nextPosition.y !== drag.startPosition.y) onMovePet(nextPosition);
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
