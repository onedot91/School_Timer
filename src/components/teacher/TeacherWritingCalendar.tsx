import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getKoreanLocalDateKey } from '../../lib/studentEmotion';
import { isDailyWritingWeekday } from '../../lib/dailyWriting';

type TeacherWritingCalendarProps = {
  readonly value: string;
  readonly assignedDateKeys: readonly string[];
  readonly onChange: (dateKey: string) => void;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateKey = (dateKey: string): Date => {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateKey = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
};

export default function TeacherWritingCalendar({
  value,
  assignedDateKeys,
  onChange,
}: TeacherWritingCalendarProps) {
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDateKey(value);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarPosition, setCalendarPosition] = useState<{ readonly left: number; readonly top: number } | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => (
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  ));
  const assignedDateKeySet = useMemo(() => new Set(assignedDateKeys), [assignedDateKeys]);
  const todayKey = getKoreanLocalDateKey();

  useEffect(() => {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !containerRef.current?.contains(event.target)
        && !calendarRef.current?.contains(event.target)
      ) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCalendarPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    const calendar = calendarRef.current;
    if (!trigger || !calendar) return;
    const gutter = 12;
    const gap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const calendarRect = calendar.getBoundingClientRect();
    const maximumLeft = window.innerWidth - calendarRect.width - gutter;
    const maximumTop = window.innerHeight - calendarRect.height - gutter;
    const belowTop = triggerRect.bottom + gap;
    const aboveTop = triggerRect.top - calendarRect.height - gap;
    const top = belowTop <= maximumTop
      ? belowTop
      : aboveTop >= gutter
        ? aboveTop
        : Math.max(gutter, Math.min(window.innerHeight * 0.16, maximumTop));
    setCalendarPosition({
      left: Math.max(gutter, Math.min(triggerRect.left, maximumLeft)),
      top,
    });
  }, [isOpen, visibleMonth]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= lastDay ? new Date(year, month, day) : null;
  });

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="teacher-writing-date-field" ref={containerRef}>
      <span id={labelId}>활동 날짜</span>
      <button
        ref={triggerRef}
        type="button"
        className="teacher-writing-date-trigger"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{formatDateKey(value)}</span>
        <CalendarDays size={19} aria-hidden="true" />
      </button>

      {isOpen ? createPortal(
        <div
          ref={calendarRef}
          className="teacher-writing-calendar"
          role="dialog"
          aria-label="활동 날짜 선택"
          style={{
            left: calendarPosition?.left ?? 0,
            top: calendarPosition?.top ?? 0,
            visibility: calendarPosition ? 'visible' : 'hidden',
          }}
        >
          <header>
            <strong>{year}년 {month + 1}월</strong>
            <div>
              <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="teacher-writing-calendar-grid" role="grid">
            {WEEKDAYS.map((weekday) => <span key={weekday} role="columnheader">{weekday}</span>)}
            {calendarDays.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
              const dateKey = toDateKey(date);
              const isAssigned = assignedDateKeySet.has(dateKey);
              const isSelected = dateKey === value;
              const isToday = dateKey === todayKey;
              const isWeekend = !isDailyWritingWeekday(dateKey);
              return (
                <button
                  key={dateKey}
                  type="button"
                  className="teacher-writing-calendar-day"
                  data-assigned={isAssigned || undefined}
                  data-selected={isSelected || undefined}
                  data-today={isToday || undefined}
                  data-weekend={isWeekend || undefined}
                  disabled={isWeekend}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                  aria-label={`${month + 1}월 ${date.getDate()}일${isWeekend ? ', 주말 선택 불가' : ''}${isAssigned ? ', 글쓰기 주제 할당됨' : ''}`}
                  onClick={() => {
                    onChange(dateKey);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span>{date.getDate()}</span>
                  {isAssigned ? <i aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <p><i aria-hidden="true" />주제 할당됨</p>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
