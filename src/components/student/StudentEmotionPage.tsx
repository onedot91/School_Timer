import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Coins, Heart, MessageCircle, PencilLine } from 'lucide-react';
import {
  STUDENT_EMOTION_COMMENT_MAX_LENGTH,
  STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH,
  STUDENT_EMOTIONS,
  STUDENT_EMOTION_ZONES,
  getStudentEmotion,
  getStudentEmotionsByZone,
  getKoreanLocalDateKey,
  getSchoolWeekDateKeys,
  type StudentEmotionEntry,
  type StudentEmotionDefinition,
  type StudentEmotionId,
  type StudentEmotionZoneDefinition,
  type StudentEmotionZoneId,
} from '../../lib/studentEmotion';
import StudentEmotionOrb, { StudentEmotionOrbVisual } from './StudentEmotionOrb';
import StudentHeader from './StudentHeader';
import { useModalFocus } from '../../lib/useModalFocus';

interface EmotionZonePanelProps {
  key?: string;
  zone: StudentEmotionZoneDefinition;
  selectedEmotionId: StudentEmotionId | null;
  firstFocusableEmotionId: StudentEmotionId;
  onSelect: (emotion: StudentEmotionDefinition, trigger: HTMLButtonElement) => void;
}

function EmotionZonePanel({
  zone,
  selectedEmotionId,
  firstFocusableEmotionId,
  onSelect,
}: EmotionZonePanelProps) {
  const emotions = getStudentEmotionsByZone(zone.id);
  return (
    <section className="student-emotion-zone" data-zone={zone.id} aria-labelledby={`emotion-zone-${zone.id}`}>
      <div className="student-emotion-zone-heading">
        <div>
          <h2 id={`emotion-zone-${zone.id}`}>{zone.label}</h2>
        </div>
      </div>
      <div className="student-emotion-orb-grid">
        {emotions.map((emotion) => (
          <StudentEmotionOrb
            key={emotion.id}
            emotion={emotion}
            selected={emotion.id === selectedEmotionId}
            focusable={emotion.id === selectedEmotionId || emotion.id === firstFocusableEmotionId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

interface StudentEmotionPageProps {
  todayEntry: StudentEmotionEntry | null;
  history: StudentEmotionEntry[];
  isSaving: boolean;
  onSave: (emotionId: StudentEmotionId, comment: string, selfMessage: string) => Promise<boolean>;
  onBack: () => void;
}

const SCHOOL_WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

function StudentEmotionParticipation({ weekEntries }: { weekEntries: Array<StudentEmotionEntry | null> }) {
  const isComplete = weekEntries.every((entry) => entry !== null);
  const summary = weekEntries
    .map((entry, index) => `${SCHOOL_WEEKDAY_LABELS[index]}요일 ${getStudentEmotion(entry?.emotionId)?.label ?? '기록 없음'}`)
    .join(', ');

  return (
    <div
      className="student-emotion-participation"
      data-complete={isComplete}
      aria-label={`나의 이번 주 감정 구슬, ${summary}. 다섯 칸 보상 25고마${isComplete ? ' 달성' : ''}`}
    >
      <div className="student-emotion-participation-week" aria-hidden="true">
        {weekEntries.map((entry, weekdayIndex) => {
          const emotion = getStudentEmotion(entry?.emotionId);
          return (
            <div
              key={SCHOOL_WEEKDAY_LABELS[weekdayIndex]}
              className={`student-emotion-participation-day${emotion ? ' is-filled' : ''}`}
              data-zone={emotion?.zone}
            >
              <span className="student-emotion-participation-day-label">{SCHOOL_WEEKDAY_LABELS[weekdayIndex]}</span>
              {emotion
                ? <StudentEmotionOrbVisual emotion={emotion} compact />
                : <span className="student-emotion-participation-empty" />}
            </div>
          );
        })}
      </div>
      <span className="student-emotion-participation-reward" data-complete={isComplete} aria-hidden="true">
        {isComplete ? <Check size={16} strokeWidth={3} /> : <Coins size={15} />}
        <strong>다 채우면 25고마</strong>
      </span>
    </div>
  );
}

interface EmotionCalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
}

const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
const calendarMonthFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
});
const calendarDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const getLocalDateFromKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getInitialHistoryDateKey = (
  todayEntry: StudentEmotionEntry | null,
  history: StudentEmotionEntry[],
) => todayEntry?.dateKey ?? history[0]?.dateKey ?? getKoreanLocalDateKey();

const getCalendarDays = (visibleMonth: Date): EmotionCalendarDay[] => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - firstWeekday + 1);
    return {
      date,
      dateKey: getKoreanLocalDateKey(date),
      isCurrentMonth: date.getMonth() === month,
    };
  });
};

export default function StudentEmotionPage({
  todayEntry,
  history,
  isSaving,
  onSave,
  onBack,
}: StudentEmotionPageProps) {
  const [activeSection, setActiveSection] = useState<'pick' | 'history'>('pick');
  const [draftEmotionId, setDraftEmotionId] = useState<StudentEmotionId | null>(todayEntry?.emotionId ?? null);
  const [comment, setComment] = useState(todayEntry?.comment ?? '');
  const [selfMessage, setSelfMessage] = useState(todayEntry?.selfMessage ?? '');
  const [isEmotionDialogOpen, setIsEmotionDialogOpen] = useState(false);
  const [isEmotionConfirmed, setIsEmotionConfirmed] = useState(false);
  const [saveError, setSaveError] = useState('');
  const emotionDialogRef = useRef<HTMLElement>(null);
  const emotionCommentRef = useRef<HTMLTextAreaElement>(null);
  const emotionConfirmedButtonRef = useRef<HTMLButtonElement>(null);
  const emotionTriggerRef = useRef<HTMLButtonElement>(null);
  const initialHistoryDateKey = getInitialHistoryDateKey(todayEntry, history);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = getLocalDateFromKey(initialHistoryDateKey);
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const [selectedHistoryDateKey, setSelectedHistoryDateKey] = useState(initialHistoryDateKey);
  const draftEmotion = useMemo(() => getStudentEmotion(draftEmotionId), [draftEmotionId]);
  const closeEmotionDialog = () => {
    setIsEmotionDialogOpen(false);
    setIsEmotionConfirmed(false);
  };
  useModalFocus({
    dialogRef: emotionDialogRef,
    isOpen: isEmotionDialogOpen,
    onDismiss: closeEmotionDialog,
    initialFocusRef: emotionCommentRef,
    returnFocusRef: emotionTriggerRef,
    isDismissible: !isSaving,
  });
  const historyByDate = useMemo(
    () => new Map(history.map((entry) => [entry.dateKey, entry])),
    [history],
  );
  const schoolWeekEntries = getSchoolWeekDateKeys().map((dateKey) => historyByDate.get(dateKey) ?? null);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const monthlyZoneCounts = useMemo(() => {
    const counts: Record<StudentEmotionZoneId, number> = {
      red: 0,
      yellow: 0,
      blue: 0,
      green: 0,
    };
    history.forEach((entry) => {
      const entryDate = getLocalDateFromKey(entry.dateKey);
      if (
        entryDate.getFullYear() !== visibleMonth.getFullYear()
        || entryDate.getMonth() !== visibleMonth.getMonth()
      ) return;
      const emotion = getStudentEmotion(entry.emotionId);
      if (emotion) counts[emotion.zone] += 1;
    });
    return counts;
  }, [history, visibleMonth]);
  const monthlyEmotionTotal = STUDENT_EMOTION_ZONES.reduce(
    (total, zone) => total + monthlyZoneCounts[zone.id],
    0,
  );
  const selectedHistoryEntry = historyByDate.get(selectedHistoryDateKey) ?? null;
  const selectedHistoryEmotion = getStudentEmotion(selectedHistoryEntry?.emotionId);

  useEffect(() => {
    setDraftEmotionId(todayEntry?.emotionId ?? null);
    setComment(todayEntry?.comment ?? '');
    setSelfMessage(todayEntry?.selfMessage ?? '');
  }, [todayEntry?.emotionId, todayEntry?.comment, todayEntry?.selfMessage, todayEntry?.updatedAt]);

  const selectEmotion = (emotion: StudentEmotionDefinition, trigger: HTMLButtonElement) => {
    emotionTriggerRef.current = trigger;
    setDraftEmotionId(emotion.id as StudentEmotionId);
    setSaveError('');
    setIsEmotionConfirmed(false);
    setIsEmotionDialogOpen(true);
  };

  useEffect(() => {
    if (!isEmotionDialogOpen || !isEmotionConfirmed) return;
    emotionConfirmedButtonRef.current?.focus();
  }, [isEmotionDialogOpen, isEmotionConfirmed]);

  const confirmEmotion = async () => {
    if (!draftEmotionId || comment.trim().length === 0 || selfMessage.trim().length === 0 || isSaving) return false;
    if (!await onSave(draftEmotionId, comment, selfMessage)) {
      setSaveError('이 기기에는 저장할 수 없어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
    return true;
  };

  const firstDesktopEmotionId = STUDENT_EMOTIONS[0].id;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tablist = event.currentTarget.closest('[role="tablist"]');
    if (!tablist) return;
    const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0 || tabs.length === 0) return;
    event.preventDefault();
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
    tabs[targetIndex]?.focus();
    tabs[targetIndex]?.click();
  };

  const changeVisibleMonth = (offset: number) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );
    setVisibleMonth(nextMonth);
    setSelectedHistoryDateKey('');
  };

  const selectHistoryDate = (day: EmotionCalendarDay) => {
    setSelectedHistoryDateKey(day.dateKey);
    if (!day.isCurrentMonth) {
      setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    }
  };

  return (
    <div className={`student-view student-emotion-view student-emotion-view-${activeSection}`}>
      <StudentHeader
        title="감정 구슬"
        onBack={onBack}
        status={<StudentEmotionParticipation weekEntries={schoolWeekEntries} />}
        actions={<div className="student-emotion-section-tabs" role="tablist" aria-label="감정 구슬 메뉴">
        <button
          type="button"
          role="tab"
          id="emotion-section-pick-tab"
          aria-controls="emotion-section-pick-panel"
          aria-selected={activeSection === 'pick'}
          tabIndex={activeSection === 'pick' ? 0 : -1}
          onClick={() => setActiveSection('pick')}
          onKeyDown={handleTabKeyDown}
        >
          <PencilLine size={18} aria-hidden="true" />
          선택하기
        </button>
        <button
          type="button"
          role="tab"
          id="emotion-section-history-tab"
          aria-controls="emotion-section-history-panel"
          aria-selected={activeSection === 'history'}
          tabIndex={activeSection === 'history' ? 0 : -1}
          onClick={() => setActiveSection('history')}
          onKeyDown={handleTabKeyDown}
        >
          <CalendarDays size={18} aria-hidden="true" />
          내 기록
        </button>
      </div>}
      />

      {activeSection === 'pick' ? <main
        id="emotion-section-pick-panel"
        role="tabpanel"
        aria-labelledby="emotion-section-pick-tab"
        className="student-emotion-picker"
      >
        <div className="student-emotion-desktop-grid" role="radiogroup" aria-label="오늘의 감정 36개">
          {STUDENT_EMOTION_ZONES.map((zone) => (
            <EmotionZonePanel
              key={zone.id}
              zone={zone}
              selectedEmotionId={draftEmotionId}
              firstFocusableEmotionId={draftEmotionId ?? firstDesktopEmotionId}
              onSelect={selectEmotion}
            />
          ))}
        </div>
      </main> : (
        <main
          id="emotion-section-history-panel"
          role="tabpanel"
          aria-labelledby="emotion-section-history-tab"
          className="student-emotion-history"
        >
          <div className="student-emotion-calendar-layout">
            <section className="student-emotion-calendar" aria-label={`${calendarMonthFormatter.format(visibleMonth)} 감정 기록`}>
              <header className="student-emotion-calendar-header">
                <button
                  type="button"
                  className="student-emotion-calendar-nav"
                  aria-label="이전 달"
                  title="이전 달"
                  onClick={() => changeVisibleMonth(-1)}
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <h2>{calendarMonthFormatter.format(visibleMonth)}</h2>
                <button
                  type="button"
                  className="student-emotion-calendar-nav"
                  aria-label="다음 달"
                  title="다음 달"
                  onClick={() => changeVisibleMonth(1)}
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </header>

              <div className="student-emotion-calendar-weekdays" aria-hidden="true">
                {calendarWeekdays.map((weekday, index) => (
                  <span key={weekday} data-weekday={index}>{weekday}</span>
                ))}
              </div>

              <div className="student-emotion-calendar-grid" role="grid" aria-label="감정 기록 날짜">
                {calendarDays.map((day) => {
                  const entry = historyByDate.get(day.dateKey);
                  const emotion = getStudentEmotion(entry?.emotionId);
                  const isSelected = day.dateKey === selectedHistoryDateKey;
                  const isToday = day.dateKey === getKoreanLocalDateKey();
                  return (
                    <div
                      key={day.dateKey}
                      role="gridcell"
                      aria-selected={isSelected}
                      className={`student-emotion-calendar-cell${day.isCurrentMonth ? '' : ' is-adjacent'}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                      data-emotion-zone={emotion?.zone}
                      data-weekday={day.date.getDay()}
                    >
                      <button
                        type="button"
                        aria-label={`${calendarDateFormatter.format(day.date)}${emotion ? `, ${emotion.label}` : ', 기록 없음'}`}
                        onClick={() => selectHistoryDate(day)}
                      >
                        <span className="student-emotion-calendar-day-heading">
                          <span className="student-emotion-calendar-day-number">{day.date.getDate()}</span>
                          {isToday && day.isCurrentMonth ? (
                            <span className="student-emotion-calendar-today-badge">오늘</span>
                          ) : null}
                        </span>
                        {emotion ? <span className="student-emotion-calendar-record">
                          <StudentEmotionOrbVisual emotion={emotion} compact />
                          <span>{emotion.label}</span>
                        </span> : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="student-emotion-calendar-sidebar">
              <aside
                className="student-emotion-calendar-detail"
                data-emotion-zone={selectedHistoryEmotion?.zone}
                aria-live="polite"
              >
                {selectedHistoryEntry && selectedHistoryEmotion ? (
                  <>
                    <div className="student-emotion-calendar-detail-heading">
                      <span>{calendarDateFormatter.format(getLocalDateFromKey(selectedHistoryEntry.dateKey))}</span>
                      <strong>기록한 감정</strong>
                    </div>
                    <div className="student-emotion-calendar-detail-emotion">
                      <StudentEmotionOrbVisual emotion={selectedHistoryEmotion} />
                      <strong>{selectedHistoryEmotion.label}</strong>
                    </div>
                    <div className="student-emotion-calendar-notes">
                      <p><strong>어떤 일이 있었나요?</strong><span>{selectedHistoryEntry.comment}</span></p>
                      {selectedHistoryEntry.selfMessage ? <p><strong>나에게 해주는 한 마디</strong><span>{selectedHistoryEntry.selfMessage}</span></p> : null}
                    </div>
                  </>
                ) : (
                  <div className="student-emotion-calendar-detail-empty">
                    <CalendarDays size={24} aria-hidden="true" />
                    <strong>{selectedHistoryDateKey ? '이날은 기록이 없어요' : '날짜를 선택해 주세요'}</strong>
                    <span>구슬을 고른 날에는 여기에 코멘트가 보여요.</span>
                    <button type="button" onClick={() => setActiveSection('pick')}>오늘 감정 고르기</button>
                  </div>
                )}
              </aside>

              <section className="student-emotion-monthly-summary" aria-labelledby="student-emotion-monthly-summary-title">
                <header>
                  <div>
                    <span>{calendarMonthFormatter.format(visibleMonth)}</span>
                    <h2 id="student-emotion-monthly-summary-title">월간 감정색</h2>
                  </div>
                  <strong>{monthlyEmotionTotal}일</strong>
                </header>
                <div className="student-emotion-monthly-bar" aria-hidden="true">
                  {STUDENT_EMOTION_ZONES.map((zone) => monthlyZoneCounts[zone.id] > 0 ? (
                    <span
                      key={zone.id}
                      data-zone={zone.id}
                      style={{ flexGrow: monthlyZoneCounts[zone.id] }}
                    />
                  ) : null)}
                </div>
                <ul>
                  {STUDENT_EMOTION_ZONES.map((zone) => (
                    <li key={zone.id} data-zone={zone.id}>
                      <span aria-hidden="true" />
                      <strong>{zone.label.replace(' 영역', '')}</strong>
                      <b>{monthlyZoneCounts[zone.id]}</b>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </main>
      )}

      {isEmotionDialogOpen && draftEmotion ? <div className="student-emotion-dialog-backdrop" role="presentation">
        <section
          ref={emotionDialogRef}
          className="student-emotion-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emotion-dialog-title"
          aria-describedby={isEmotionConfirmed ? 'emotion-confirmation-status' : 'emotion-event-label emotion-self-message-label'}
        >
          <button
            type="button"
            className="student-emotion-dialog-close"
            aria-label="감정 기록 닫기"
            onClick={closeEmotionDialog}
          >
            ×
          </button>
          <StudentEmotionOrbVisual emotion={draftEmotion} />
          <div className="student-emotion-dialog-heading">
            <span>오늘 선택한 감정</span>
            <h2 id="emotion-dialog-title">{draftEmotion.label}</h2>
          </div>
          {isEmotionConfirmed ? <div className="student-emotion-confirmed" aria-live="polite">
            <p id="emotion-confirmation-status" className="student-emotion-confirmed-status">
              <Check size={18} aria-hidden="true" />오늘의 감정 기록을 확정했어요
            </p>
            <section className="student-emotion-confirmed-note" aria-labelledby="emotion-confirmed-event-label">
              <h3 id="emotion-confirmed-event-label"><MessageCircle size={20} aria-hidden="true" />어떤 일이 있었나요?</h3>
              <p>{comment.trim()}</p>
            </section>
            <blockquote className="student-emotion-confirmed-quote" aria-labelledby="emotion-confirmed-self-message-label">
              <h3 id="emotion-confirmed-self-message-label"><Heart size={20} aria-hidden="true" />나에게 해주는 한 마디</h3>
              <p>{selfMessage.trim()}</p>
            </blockquote>
            <button
              ref={emotionConfirmedButtonRef}
              type="button"
              className="student-emotion-dialog-save"
              onClick={closeEmotionDialog}
            >
              <Check size={20} aria-hidden="true" />
              확인
            </button>
          </div> : <>
            <label className="student-emotion-comment-field">
              <span id="emotion-event-label"><MessageCircle size={20} aria-hidden="true" />어떤 일이 있었나요?</span>
              <textarea
                ref={emotionCommentRef}
                value={comment}
                maxLength={STUDENT_EMOTION_COMMENT_MAX_LENGTH}
                rows={2}
                placeholder="있었던 일을 구체적으로 적어주세요."
                onChange={(event) => {
                  setComment(event.target.value);
                  setSaveError('');
                }}
              />
              <small>{comment.length}/{STUDENT_EMOTION_COMMENT_MAX_LENGTH}</small>
            </label>
            <label className="student-emotion-comment-field">
              <span id="emotion-self-message-label"><Heart size={20} aria-hidden="true" />나에게 해주는 한 마디</span>
              <input
                value={selfMessage}
                maxLength={STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH}
                placeholder="오늘의 나에게 한마디를 적어 주세요"
                onChange={(event) => {
                  setSelfMessage(event.target.value);
                  setSaveError('');
                }}
              />
              <small>{selfMessage.length}/{STUDENT_EMOTION_SELF_MESSAGE_MAX_LENGTH}</small>
            </label>
            <button
              type="button"
              className="student-emotion-dialog-save"
              disabled={comment.trim().length === 0 || selfMessage.trim().length === 0 || isSaving}
              onClick={() => {
                void confirmEmotion().then((saved) => {
                  if (saved) setIsEmotionConfirmed(true);
                });
              }}
            >
              <Check size={20} aria-hidden="true" />
              {isSaving ? '저장 중' : '기록하기'}
            </button>
            {saveError ? <p role="alert">{saveError}</p> : null}
          </>}
        </section>
      </div> : null}

    </div>
  );
}
