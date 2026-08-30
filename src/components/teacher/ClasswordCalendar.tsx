import { ChevronLeft, ChevronRight } from 'lucide-react';

import { getKoreanDateKey, type ClasswordRoundSummary } from '../../lib/classword';

type ClasswordCalendarProps = {
  readonly month: Date;
  readonly selectedDateKey: string;
  readonly rounds: readonly ClasswordRoundSummary[];
  readonly onMonthChange: (month: Date) => void;
  readonly onSelect: (dateKey: string) => void;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const getMonthCells = (month: Date) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, index - firstWeekday + 1);
    return {
      date,
      dateKey: getKoreanDateKey(date),
      currentMonth: date.getMonth() === monthIndex,
    };
  });
};

export default function ClasswordCalendar({
  month,
  selectedDateKey,
  rounds,
  onMonthChange,
  onSelect,
}: ClasswordCalendarProps) {
  const today = getKoreanDateKey();
  const activeDates = new Set(rounds.filter((round) => round.topic).map((round) => round.dateKey));
  const cells = getMonthCells(month);
  const monthLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(month);
  const moveMonth = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <section className="teacher-classword-calendar" aria-label="낱말판 날짜 선택">
      <header>
        <h3>{monthLabel}</h3>
        <div className="teacher-classword-calendar-nav">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight aria-hidden="true" /></button>
        </div>
      </header>
      <div className="teacher-classword-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="teacher-classword-days">
        {cells.map(({ date, dateKey, currentMonth }) => {
          const hasTopic = activeDates.has(dateKey);
          return (
            <button
              type="button"
              key={dateKey}
              className={`${currentMonth ? '' : 'is-outside'}${hasTopic ? ' has-topic' : ''}${dateKey === selectedDateKey ? ' is-selected' : ''}${dateKey === today ? ' is-today' : ''}`}
              onClick={() => onSelect(dateKey)}
              aria-pressed={dateKey === selectedDateKey}
              aria-current={dateKey === today ? 'date' : undefined}
              aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${hasTopic ? ', 주제 있음' : ''}`}
            >
              <span>{date.getDate()}</span>
              {hasTopic ? <i className="teacher-classword-topic-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <footer>
        <div className="teacher-classword-calendar-legend"><i aria-hidden="true" /> 주제 있음</div>
        <button
          type="button"
          className="teacher-classword-today"
          onClick={() => {
            const now = new Date();
            onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
            onSelect(today);
          }}
        >
          오늘
        </button>
      </footer>
    </section>
  );
}
