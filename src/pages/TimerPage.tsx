import React, { useState, useEffect, useRef } from 'react';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import { CalendarClock, ChevronDown, Coffee, Download, ImageDown, NotebookText, Pause, Play, Plus, RotateCcw, Search, Settings, Sparkles, StickyNote, Timer, Trash2, Upload, Utensils, Volume2, VolumeX, X } from 'lucide-react';
import {
  buildStudentRosterBulkInput,
  createDefaultCaseState,
  createHistoryEntry,
  createUniqueCaseLabel,
  getCaseBounds,
  getCaseDrawData,
  getHiddenQueueInstruction,
  getCaseLabelByIndex,
  getCaseSummaryLabel,
  getInitialRandomDrawState,
  getStudentDisplayText,
  getStudentName,
  MAX_DRAW_NUMBER,
  MAX_HISTORY_LENGTH,
  MIN_DRAW_NUMBER,
  normalizeCaseLabel,
  normalizeSavedRandomDrawState,
  parseStudentRosterBulkInput,
  persistRandomDrawState,
  playRandomDrawSound,
  prepareRandomDrawAudio,
  RANDOM_DRAW_DURATION_MS,
  RANDOM_DRAW_RESULT_DISPLAY_MS,
  REPEAT_PICK_PROBABILITY,
  removeHiddenNumberQueueItem,
  sampleOne,
  type RandomDrawCaseState,
  type RandomDrawHistoryEntry,
} from '../lib/randomDraw';
import DictionaryNotebookOverlay from '../components/DictionaryNotebookOverlay';

type TimerType = 'break' | 'lunch' | 'class' | 'morning' | 'none';
type SettingsPanel = 'schedule' | 'draw';
interface ScheduleSlot {
  id: string;
  name: string;
  type: TimerType;
  start: number; // minutes from 00:00
  end: number;
}

interface AnnouncementItem {
  id: string;
  text: string;
}

interface AnnouncementOverlayTimerState {
  isVisible: boolean;
  timeText: string;
  progress: number;
  timerType: TimerType;
  timerTypeLabel: string;
  currentSlotName: string;
}

interface ManualTimerState {
  totalTime: number;
  timeLeft: number;
  isRunning: boolean;
  endTime: number | null;
  isVisible: boolean;
}

interface DrawOverlayState {
  caseId: string;
  displayText: string;
  kind: 'normal' | 'repeat' | 'empty' | 'reset';
  number: number | null;
}

type WeeklySchedule = {
  [key: number]: ScheduleSlot[]; // 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri
};

const MORNING_ACTIVITY_LABEL = '\uC544\uCE68\uD65C\uB3D9';
const MORNING_DEFAULT_DURATION = 15;
const CLASS_DURATION = 40;
const BREAK_DURATION = 10;
const BACKGROUND_MUSIC_VOLUME = 0.24;
const SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS = 59;
const WEEKDAYS = [1, 2, 3, 4, 5];
const ANNOUNCEMENT_VISIBLE_LINES = 5;
const ANNOUNCEMENT_MIN_RULE_GAP_PX = 92;
const ANNOUNCEMENT_SAFETY_PHRASE = '차 조심, 낯선 사람 조심!';
const ANNOUNCEMENT_NOTE_PLACEHOLDER = '알림장을 입력하세요';
const MEMO_NOTE_STORAGE_KEY = 'school-memo-note-v1';
const MEMO_NOTE_PLACEHOLDER = '메모 입력';
const MEMO_NOTE_MIN_FONT_SCALE = 0;
const MEMO_NOTE_MAX_FONT_SCALE = 100;
const MEMO_NOTE_DEFAULT_FONT_SCALE = 50;
const MEMO_NOTE_FONT_SCALE_STEP = 5;
const MEMO_NOTE_MIN_FONT_SIZE = 40;
const MEMO_NOTE_MAX_FONT_SIZE = 168;
const TIMER_APP_STATE_STORAGE_KEY = 'timerAppStateV3';
const LEGACY_TIMER_APP_STATE_STORAGE_KEY = 'timerAppStateV2';
const MEMO_NOTE_TEXT_COLORS = [
  { id: 'black', label: '검정', value: '#2c1e16' },
  { id: 'red', label: '빨강', value: '#c7684a' },
  { id: 'blue', label: '파랑', value: '#2d63b8' },
] as const;
const DRAW_EMPTY_MESSAGE = '완료';
const DRAW_RESET_MESSAGE = '섞는 중';
const DRAW_SHORTCUT_LABEL = 'Enter';
const DRAW_RESET_EFFECT_DURATION_MS = 940;
const SECRET_DRAW_MAX_LENGTH = 240;
const SECRET_DRAW_BUTTON_LABEL = '예약 결과';
const SECRET_DRAW_SECTION_LABEL = '다음 결과 예약';
const SECRET_DRAW_SECTION_DESCRIPTION =
  '쉼표로 여러 번호를 입력하면 다음 추첨부터 순서대로 적용됩니다. 이미 나온 번호도 한 번 더 나오게 할 수 있습니다.';
const SECRET_DRAW_INPUT_LABEL = '예약 번호 목록';
const SECRET_DRAW_HINT = '예: 7, 12, 18. 빈칸으로 반영하면 예약이 해제됩니다.';
const SECRET_DRAW_CLEAR_LABEL = '지우기';
const SECRET_DRAW_APPLY_LABEL = '반영';
const SECRET_DRAW_EMPTY_LABEL = '없음';
const DRAWN_BALLS_SECTION_LABEL = '뽑힌 공';
const DRAWN_BALLS_SECTION_DESCRIPTION = '선택한 상황에서 이미 나온 공을 확인합니다.';
const DRAWN_BALLS_EMPTY_LABEL = '아직 뽑힌 공이 없습니다.';
const NORMAL_WIN_PARTICLES = [
  { angle: '6deg', distance: '6.3rem', size: '0.72rem', delay: '0ms' },
  { angle: '34deg', distance: '5.6rem', size: '0.54rem', delay: '38ms' },
  { angle: '66deg', distance: '6.9rem', size: '0.68rem', delay: '12ms' },
  { angle: '96deg', distance: '5.9rem', size: '0.58rem', delay: '54ms' },
  { angle: '126deg', distance: '6.7rem', size: '0.74rem', delay: '18ms' },
  { angle: '156deg', distance: '5.3rem', size: '0.5rem', delay: '64ms' },
  { angle: '188deg', distance: '6rem', size: '0.6rem', delay: '22ms' },
  { angle: '218deg', distance: '5.4rem', size: '0.52rem', delay: '58ms' },
  { angle: '248deg', distance: '6.8rem', size: '0.7rem', delay: '8ms' },
  { angle: '282deg', distance: '5.7rem', size: '0.56rem', delay: '48ms' },
  { angle: '316deg', distance: '6.5rem', size: '0.66rem', delay: '26ms' },
  { angle: '344deg', distance: '5.8rem', size: '0.58rem', delay: '42ms' },
] as const;

const DEFAULT_MANUAL_TIMER_STATE: ManualTimerState = {
  totalTime: 600,
  timeLeft: 600,
  isRunning: false,
  endTime: null,
  isVisible: false,
};

const MANUAL_TIMER_PRESETS = [
  { label: '3분', seconds: 180 },
  { label: '5분', seconds: 300 },
  { label: '10분', seconds: 600 },
] as const;

type MemoTextColorId = (typeof MEMO_NOTE_TEXT_COLORS)[number]['id'];

const createSlotId = () => Math.random().toString(36).slice(2, 11);

const getFixedDurationByType = (type: TimerType) => {
  if (type === 'class') return CLASS_DURATION;
  if (type === 'break') return BREAK_DURATION;
  return null;
};

const clampScheduleClockOffsetSeconds = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(
    -SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS,
    Math.min(SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS, Math.trunc(numeric)),
  );
};

const clampMemoFontScale = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return MEMO_NOTE_DEFAULT_FONT_SCALE;
  return Math.max(MEMO_NOTE_MIN_FONT_SCALE, Math.min(MEMO_NOTE_MAX_FONT_SCALE, Math.round(numeric)));
};

const getMemoFontSizeFromScale = (scale: number) =>
  Math.round(
    MEMO_NOTE_MIN_FONT_SIZE +
      ((MEMO_NOTE_MAX_FONT_SIZE - MEMO_NOTE_MIN_FONT_SIZE) * clampMemoFontScale(scale)) / 100,
  );

const getMemoTextColorById = (colorId: MemoTextColorId) =>
  MEMO_NOTE_TEXT_COLORS.find((color) => color.id === colorId) || MEMO_NOTE_TEXT_COLORS[0];

const getMemoTextColorByValue = (value: string | null | undefined) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;

  const rgbValueMap = new Map(
    MEMO_NOTE_TEXT_COLORS.map((color) => {
      const hex = color.value.slice(1);
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return [color.id, `rgb(${red}, ${green}, ${blue})`];
    }),
  );

  return (
    MEMO_NOTE_TEXT_COLORS.find(
      (color) =>
        normalized === color.id ||
        normalized === color.value ||
        normalized === rgbValueMap.get(color.id),
    ) || null
  );
};

const clampDrawNumberInput = (value: string, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(MIN_DRAW_NUMBER, Math.min(MAX_DRAW_NUMBER, Math.trunc(numeric)));
};

const buildHiddenDrawResultInput = (queue: number[]) => queue.join(', ');

const parseHiddenDrawResultInput = (rawValue: string, minNumber: number, maxNumber: number) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  return (trimmed.match(/\d{1,3}/g) ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value))
    .filter((value) => value >= minNumber && value <= maxNumber)
    .slice(0, SECRET_DRAW_MAX_LENGTH);
};

const isEditableShortcutTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;

  const tagName = element.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    tagName === 'BUTTON' ||
    tagName === 'A'
  );
};

const sanitizeMemoHtml = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) return '';

  const sourceRoot = document.createElement('div');
  sourceRoot.innerHTML = value;
  const sanitizedRoot = document.createElement('div');

  const sanitizeNode = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.textContent || '')];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') {
      return [document.createElement('br')];
    }

    if (tagName === 'div' || tagName === 'p') {
      const block = document.createElement('div');
      Array.from(element.childNodes).forEach((child) => {
        sanitizeNode(child).forEach((sanitizedChild) => block.appendChild(sanitizedChild));
      });
      if (!block.hasChildNodes()) {
        block.appendChild(document.createElement('br'));
      }
      return [block];
    }

    if (tagName === 'span' || tagName === 'font') {
      const colorOption = getMemoTextColorByValue(
        element.dataset.memoColor || element.style.color || element.getAttribute('color'),
      );
      const childContainer = document.createElement('div');
      Array.from(element.childNodes).forEach((child) => {
        sanitizeNode(child).forEach((sanitizedChild) => childContainer.appendChild(sanitizedChild));
      });
      const childNodes = Array.from(childContainer.childNodes);

      if (!colorOption) {
        return childNodes;
      }

      const span = document.createElement('span');
      span.dataset.memoColor = colorOption.id;
      span.style.color = colorOption.value;
      childNodes.forEach((child) => span.appendChild(child));
      return span.textContent || span.querySelector('br') ? [span] : [];
    }

    const fallbackContainer = document.createElement('div');
    Array.from(element.childNodes).forEach((child) => {
      sanitizeNode(child).forEach((sanitizedChild) => fallbackContainer.appendChild(sanitizedChild));
    });
    return Array.from(fallbackContainer.childNodes);
  };

  Array.from(sourceRoot.childNodes).forEach((child) => {
    sanitizeNode(child).forEach((sanitizedChild) => sanitizedRoot.appendChild(sanitizedChild));
  });

  return sanitizedRoot.innerHTML;
};

const getPlainTextFromMemoHtml = (value: string) => {
  if (!value) return '';

  const root = document.createElement('div');
  root.innerHTML = sanitizeMemoHtml(value);
  return (root.textContent || '').replace(/\u00a0/g, ' ').trim();
};

const getAdjustedScheduleDate = (timeMs: number, offsetSeconds: number) =>
  new Date(timeMs + clampScheduleClockOffsetSeconds(offsetSeconds) * 1000);

const renderAnnouncementNoteLine = (text: string, keyPrefix: string) => {
  const sourceText = text.length > 0 ? text : '\u200b';
  const segments: React.ReactNode[] = [];
  let searchStart = 0;
  let matchCount = 0;

  while (searchStart < sourceText.length) {
    const matchIndex = sourceText.indexOf(ANNOUNCEMENT_SAFETY_PHRASE, searchStart);
    if (matchIndex === -1) {
      segments.push(sourceText.slice(searchStart));
      break;
    }

    if (matchIndex > searchStart) {
      segments.push(sourceText.slice(searchStart, matchIndex));
    }

    segments.push(
      <span key={`${keyPrefix}-safety-${matchCount}`} className="announcement-note-highlight-safety">
        {ANNOUNCEMENT_SAFETY_PHRASE}
      </span>,
    );

    searchStart = matchIndex + ANNOUNCEMENT_SAFETY_PHRASE.length;
    matchCount += 1;
  }

  return segments;
};

const renderAnnouncementNoteDisplay = (text: string) => {
  const lines = text.length > 0 ? text.split('\n') : [''];
  const isPlaceholderVisible = text.length === 0;

  return lines.map((line, index) => (
    <div key={`announcement-note-line-${index}`} className="announcement-note-display-line">
      <span className="announcement-note-display-marker">{index + 1}.</span>
      <span
        className={`announcement-note-display-line-text${isPlaceholderVisible ? ' announcement-note-display-line-text-placeholder' : ''}`}
      >
        {isPlaceholderVisible
          ? ANNOUNCEMENT_NOTE_PLACEHOLDER
          : renderAnnouncementNoteLine(line, `announcement-note-line-${index}`)}
      </span>
    </div>
  ));
};

const getScheduleClockParts = (timeMs: number, offsetSeconds: number) => {
  const adjustedNow = getAdjustedScheduleDate(timeMs, offsetSeconds);
  return {
    dayOfWeek: adjustedNow.getDay(),
    currentMinutes: adjustedNow.getHours() * 60 + adjustedNow.getMinutes(),
    currentSeconds: adjustedNow.getSeconds(),
  };
};

const isMorningSlot = (slot: ScheduleSlot) => slot.type === 'morning' || slot.name === MORNING_ACTIVITY_LABEL;

const normalizeDaySchedule = (daySchedule: ScheduleSlot[]) => {
  const cloned = (daySchedule || []).map((slot) => ({ ...slot }));
  const morningSlots = cloned.filter(isMorningSlot);
  const morningSlot =
    morningSlots[0] || {
      id: createSlotId(),
      name: MORNING_ACTIVITY_LABEL,
      type: 'morning' as TimerType,
      start: 540 - MORNING_DEFAULT_DURATION,
      end: 540,
    };

  const others = cloned
    .filter((slot) => !isMorningSlot(slot))
    .map((slot) => {
      const fixedDuration = getFixedDurationByType(slot.type);
      if (fixedDuration !== null) {
        return { ...slot, end: slot.start + fixedDuration };
      }
      if (slot.end <= slot.start) {
        return { ...slot, end: slot.start + 1 };
      }
      return slot;
    })
    .sort((a, b) => a.start - b.start);

  const ordered = [
    {
      ...morningSlot,
      id: morningSlot.id || createSlotId(),
      name: MORNING_ACTIVITY_LABEL,
      type: 'morning' as TimerType,
    },
    ...others,
  ];

  const normalized: ScheduleSlot[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const slot = ordered[i];
    const fixedDuration = getFixedDurationByType(slot.type);
    const rawDuration = slot.end - slot.start;
    const fallbackDuration = rawDuration > 0 ? rawDuration : (slot.type === 'morning' ? MORNING_DEFAULT_DURATION : 1);
    const duration = Math.max(1, fixedDuration ?? fallbackDuration);

    const startFallback = slot.type === 'morning' ? 540 - MORNING_DEFAULT_DURATION : 540;
    const start = Math.max(0, Number.isFinite(slot.start) ? slot.start : startFallback);
    normalized.push({ ...slot, start, end: start + duration });
  }

  return normalized;
};

const normalizeWeeklySchedule = (schedule: WeeklySchedule): WeeklySchedule => {
  const normalized: WeeklySchedule = {};
  WEEKDAYS.forEach((day) => {
    const daySchedule = Array.isArray(schedule?.[day]) ? schedule[day] : [];
    normalized[day] = normalizeDaySchedule(daySchedule);
  });
  return normalized;
};
const defaultDailySchedule: ScheduleSlot[] = [
  { id: 'm0', name: MORNING_ACTIVITY_LABEL, type: 'morning', start: 525, end: 540 },
  { id: '1', name: '1교시', type: 'class', start: 540, end: 580 },
  { id: '2', name: '쉬는 시간', type: 'break', start: 580, end: 590 },
  { id: '3', name: '2교시', type: 'class', start: 590, end: 630 },
  { id: '4', name: '쉬는 시간', type: 'break', start: 630, end: 640 },
  { id: '5', name: '3교시', type: 'class', start: 640, end: 680 },
  { id: '6', name: '쉬는 시간', type: 'break', start: 680, end: 690 },
  { id: '7', name: '4교시', type: 'class', start: 690, end: 730 },
  { id: '8', name: '점심시간', type: 'lunch', start: 730, end: 780 },
  { id: '9', name: '5교시', type: 'class', start: 780, end: 820 },
  { id: '10', name: '쉬는 시간', type: 'break', start: 820, end: 830 },
  { id: '11', name: '6교시', type: 'class', start: 830, end: 870 },
];

const defaultWeeklySchedule: WeeklySchedule = normalizeWeeklySchedule({
  1: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  2: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  3: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  4: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
  5: defaultDailySchedule.map((slot) => ({ ...slot, id: createSlotId() })),
});
const DAYS = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];
const ANNOUNCEMENT_STORAGE_KEY = 'school-announcements-v4';
const ANNOUNCEMENT_CLOSING_MESSAGE = '차 조심, 낯선 사람 조심!';
const ANNOUNCEMENT_WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

let announcementAudioContext: AudioContext | null = null;

const createAnnouncementId = () => `announcement-${Math.random().toString(36).slice(2, 11)}`;
const createEmptyAnnouncement = (): AnnouncementItem => ({ id: createAnnouncementId(), text: '' });

const getAnnouncementAudioContext = () => {
  try {
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!announcementAudioContext) {
      announcementAudioContext = new AudioContextConstructor();
    }
    return announcementAudioContext;
  } catch {
    return null;
  }
};

const playAnnouncementSound = async (kind: 'pop' | 'tada') => {
  try {
    const ctx = getAnnouncementAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const playTone = (
      frequency: number,
      startOffset: number,
      duration: number,
      type: OscillatorType,
      volume: number,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + startOffset;
      const endTime = startTime + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(120, frequency * 1.06), endTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + duration * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    };

    if (kind === 'pop') {
      playTone(720, 0, 0.08, 'triangle', 0.09);
      playTone(980, 0.03, 0.06, 'sine', 0.05);
      return;
    }

    playTone(660, 0, 0.08, 'triangle', 0.07);
    playTone(880, 0.08, 0.1, 'triangle', 0.08);
    playTone(1174, 0.2, 0.16, 'sine', 0.06);
  } catch {
    // Ignore browsers that block or do not support Web Audio.
  }
};

const formatAnnouncementDate = (date: Date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${ANNOUNCEMENT_WEEKDAYS[date.getDay()]}`;

const parseAnnouncementDate = (value: string) => {
  const trimmed = value.trim();
  const koreanMatch = trimmed.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const parts = koreanMatch ?? isoMatch;

  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const normalizeAnnouncementDateText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return formatAnnouncementDate(new Date());

  const parsed = parseAnnouncementDate(trimmed);
  return parsed ? formatAnnouncementDate(parsed) : trimmed;
};

const normalizeAnnouncementItems = (value: unknown): AnnouncementItem[] => {
  if (!Array.isArray(value)) return [createEmptyAnnouncement()];

  const normalized = value
    .map((item) => {
      if (typeof item === 'string') {
        return { id: createAnnouncementId(), text: item };
      }

      if (item && typeof item === 'object') {
        const nextItem = item as Partial<AnnouncementItem>;
        return {
          id:
            typeof nextItem.id === 'string' && nextItem.id.trim().length > 0
              ? nextItem.id
              : createAnnouncementId(),
          text: typeof nextItem.text === 'string' ? nextItem.text : '',
        };
      }

      return null;
    })
    .filter((item): item is AnnouncementItem => item !== null);

  return normalized.length > 0 ? normalized : [createEmptyAnnouncement()];
};

const buildAnnouncementFilename = (value: string) => {
  const parsed = parseAnnouncementDate(value) ?? new Date();
  const year = parsed.getFullYear().toString();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}${month}${day}_알림장.png`;
};

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

function NotebookOverlayTimerBadge({
  liveTimer,
  captureStatic = false,
}: {
  liveTimer: AnnouncementOverlayTimerState;
  captureStatic?: boolean;
}) {
  const shouldShowLiveTimerSlotName =
    liveTimer.currentSlotName.length > 0 &&
    liveTimer.currentSlotName !== '일정 없음' &&
    liveTimer.currentSlotName.replace(/\s+/g, '') !== liveTimer.timerTypeLabel.replace(/\s+/g, '');
  const liveTimerBadgeLabel = shouldShowLiveTimerSlotName ? liveTimer.currentSlotName : liveTimer.timerTypeLabel;
  const liveTimerProgress = Math.max(0, Math.min(1, liveTimer.progress));
  const liveTimerRadius = 40;
  const liveTimerCircumference = 2 * Math.PI * liveTimerRadius;
  const liveTimerStrokeDashoffset = liveTimerCircumference * (1 - liveTimerProgress);
  const liveTimerStrokeColor =
    liveTimer.timerType === 'class'
      ? '#5C8D6D'
      : liveTimer.timerType === 'break'
        ? '#7AA160'
        : liveTimer.timerType === 'morning'
          ? '#D19A43'
          : liveTimer.timerType === 'lunch'
            ? '#C47A52'
            : '#B89E87';

  if (!liveTimer.isVisible) return null;

  return (
    <div
      className={`announcement-date-badge${captureStatic ? ' announcement-date-badge-static' : ''}`}
      aria-label={`${liveTimerBadgeLabel} ${liveTimer.timeText}`}
    >
      {!captureStatic ? (
        <svg viewBox="0 0 100 100" className="announcement-date-badge-ring" aria-hidden="true">
          <circle className="announcement-date-badge-track" cx="50" cy="50" r={liveTimerRadius} />
          <circle
            className="announcement-date-badge-fill"
            cx="50"
            cy="50"
            r={liveTimerRadius}
            stroke={liveTimerStrokeColor}
            strokeDasharray={liveTimerCircumference}
            strokeDashoffset={liveTimerStrokeDashoffset}
          />
        </svg>
      ) : null}
      <div className="announcement-date-badge-content">
        <span className="announcement-date-badge-icon">
          {liveTimer.timerType === 'break' ? (
            <Coffee size={15} strokeWidth={2.2} />
          ) : liveTimer.timerType === 'lunch' ? (
            <Utensils size={15} strokeWidth={2.2} />
          ) : liveTimer.timerType === 'class' || liveTimer.timerType === 'morning' ? (
            <CalendarClock size={15} strokeWidth={2.2} />
          ) : (
            <Timer size={15} strokeWidth={2.2} />
          )}
        </span>
        <span className="announcement-date-badge-time">{liveTimer.timeText}</span>
        <span className="announcement-date-badge-label">{liveTimerBadgeLabel}</span>
      </div>
    </div>
  );
}

const getAnnouncementTypography = (count: number) => {
  if (count <= 4) {
    return {
      listGap: 'gap-4',
      numberClass: 'text-[clamp(1.55rem,3.2vw,2.1rem)]',
      textClass: 'text-[clamp(1.28rem,2.45vw,1.72rem)] leading-[1.56]',
      inputClass: 'text-[clamp(1.16rem,2.2vw,1.5rem)]',
    };
  }

  if (count <= 6) {
    return {
      listGap: 'gap-3',
      numberClass: 'text-[clamp(1.42rem,2.9vw,1.9rem)]',
      textClass: 'text-[clamp(1.18rem,2.1vw,1.5rem)] leading-[1.54]',
      inputClass: 'text-[clamp(1.08rem,1.9vw,1.34rem)]',
    };
  }

  if (count <= 8) {
    return {
      listGap: 'gap-2.5',
      numberClass: 'text-[clamp(1.24rem,2.5vw,1.62rem)]',
      textClass: 'text-[clamp(1.05rem,1.85vw,1.28rem)] leading-[1.5]',
      inputClass: 'text-[clamp(1rem,1.7vw,1.18rem)]',
    };
  }

  return {
    listGap: 'gap-2',
    numberClass: 'text-[clamp(1.12rem,2.15vw,1.42rem)]',
    textClass: 'text-[clamp(0.96rem,1.55vw,1.1rem)] leading-[1.46]',
    inputClass: 'text-[clamp(0.92rem,1.45vw,1.04rem)]',
  };
};

const playAlarm = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.setValueAtTime(0.3, startTime + duration - 0.1);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Westminster Quarters (School Bell Style)
    playTone(659.25, now, 0.5);
    playTone(523.25, now + 0.5, 0.5);
    playTone(587.33, now + 1.0, 0.5);
    playTone(392.00, now + 1.5, 1.0);
    
    playTone(392.00, now + 3.0, 0.5);
    playTone(587.33, now + 3.5, 0.5);
    playTone(659.25, now + 4.0, 0.5);
    playTone(523.25, now + 4.5, 1.0);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const getInitialAppState = () => {
  const saved =
    localStorage.getItem(TIMER_APP_STATE_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_TIMER_APP_STATE_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const savedManual = parsed?.manual || {};
      const totalTime =
        typeof savedManual.totalTime === 'number' && savedManual.totalTime > 0
          ? Math.floor(savedManual.totalTime)
          : DEFAULT_MANUAL_TIMER_STATE.totalTime;
      let timeLeft =
        typeof savedManual.timeLeft === 'number' && savedManual.timeLeft >= 0
          ? Math.min(Math.floor(savedManual.timeLeft), totalTime)
          : totalTime;
      let endTime =
        typeof savedManual.endTime === 'number' && Number.isFinite(savedManual.endTime)
          ? savedManual.endTime
          : null;
      let isRunning = savedManual.isRunning === true && endTime !== null;

      if (isRunning && endTime !== null) {
        timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        if (timeLeft === 0) {
          isRunning = false;
          endTime = null;
        }
      } else {
        endTime = null;
      }

      return {
        manual: {
          totalTime,
          timeLeft,
          isRunning,
          endTime,
          isVisible:
            savedManual.isVisible === true ||
            parsed?.mode === 'manual' ||
            isRunning,
        },
      };
    } catch (e) {}
  }
  return { manual: DEFAULT_MANUAL_TIMER_STATE };
};

function AnnouncementNotebookOverlay({
  isOpen,
  onClose,
  liveTimer,
}: {
  isOpen: boolean;
  onClose: () => void;
  liveTimer: AnnouncementOverlayTimerState;
}) {
  const [dateText, setDateText] = useState(() => formatAnnouncementDate(new Date()));
  const [noteText, setNoteText] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);

  const noteCaptureRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const noteDisplayRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hasRestoredRef = useRef(false);
  const announcementFontEmbedCssRef = useRef<string | null>(null);
  const announcementFontEmbedCssPromiseRef = useRef<Promise<string> | null>(null);
  const [noteRuleGapPx, setNoteRuleGapPx] = useState(104);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    try {
      localStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY);
    } catch {
      // Ignore storage access errors.
    }

    try {
      const saved = sessionStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      const restoredDate =
        parsed && typeof parsed === 'object' && typeof parsed.date === 'string'
          ? normalizeAnnouncementDateText(parsed.date)
          : formatAnnouncementDate(new Date());
      const restoredNote =
        parsed && typeof parsed === 'object' && typeof parsed.note === 'string'
          ? parsed.note
          : normalizeAnnouncementItems(parsed?.announcements)
              .map((announcement) => announcement.text.trimEnd())
              .filter((text) => text.length > 0)
              .join('\n');

      setDateText(restoredDate);
      setNoteText(restoredNote);
    } catch {
      // Ignore invalid session data and keep defaults.
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const textarea = noteTextareaRef.current;
      if (!textarea) return;

      textarea.focus();
      const cursorPosition = textarea.value.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let frame = 0;
    const syncRuleGap = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const editor = noteEditorRef.current;
        if (!editor) return;

        const nextGap = Math.max(
          ANNOUNCEMENT_MIN_RULE_GAP_PX,
          Math.round(editor.clientHeight / ANNOUNCEMENT_VISIBLE_LINES),
        );
        setNoteRuleGapPx((previous) => (previous === nextGap ? previous : nextGap));
      });
    };

    syncRuleGap();

    const editor = noteEditorRef.current;
    if (!editor || typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      syncRuleGap();
    });
    observer.observe(editor);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isOpen]);

  const pagePaddingClass = 'p-2 sm:p-3 lg:px-4 lg:pb-4 lg:pt-3 xl:px-5 xl:pb-5 xl:pt-3';
  const paperTopClass = 'px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4';
  const paperBodyClass = 'px-3 pb-3 pt-0 sm:px-5 sm:pb-4 sm:pt-0';
  const stageLayoutClass = 'h-full w-full max-w-[1160px] min-h-0 flex-col';
  const paperShellLayoutClass = 'flex min-h-0 flex-1 flex-col';
  const paperBodyLayoutClass = 'flex flex-1 min-h-0 flex-col';
  const paperBodyStyle = {
    '--announcement-rule-gap': `${noteRuleGapPx}px`,
    '--announcement-rule-offset': `${Math.round(noteRuleGapPx * -0.24)}px`,
    '--announcement-note-font-size': `${Math.max(42, Math.round(noteRuleGapPx * 0.42))}px`,
    '--announcement-note-gutter-width': `${Math.max(66, Math.round(noteRuleGapPx * 0.62))}px`,
    '--announcement-note-number-size': `${Math.max(30, Math.round(noteRuleGapPx * 0.34))}px`,
  } as React.CSSProperties;
  const hasNoteContent = noteText.length > 0;

  const focusNoteTextarea = () => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  };

  const syncNoteDisplayScroll = () => {
    const textarea = noteTextareaRef.current;
    const display = noteDisplayRef.current;
    if (!textarea || !display) return;

    display.scrollTop = textarea.scrollTop;
    display.scrollLeft = textarea.scrollLeft;
  };

  const insertSafetyPhrase = () => {
    const textarea = noteTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? noteText.length;
    const selectionEnd = textarea?.selectionEnd ?? noteText.length;
    const before = noteText.slice(0, selectionStart);
    const after = noteText.slice(selectionEnd);
    const insertPrefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const insertSuffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
    const insertedText = `${insertPrefix}${ANNOUNCEMENT_SAFETY_PHRASE}${insertSuffix}`;
    const nextText = `${before}${insertedText}${after}`;
    const cursorPosition = before.length + insertedText.length;

    setNoteText(nextText);
    void playAnnouncementSound('pop');

    window.requestAnimationFrame(() => {
      const nextTextarea = noteTextareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      nextTextarea.setSelectionRange(cursorPosition, cursorPosition);
      syncNoteDisplayScroll();
    });
  };

  const insertNoteLineBreak = () => {
    const textarea = noteTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? noteText.length;
    const selectionEnd = textarea?.selectionEnd ?? noteText.length;
    const nextText = `${noteText.slice(0, selectionStart)}\n${noteText.slice(selectionEnd)}`;
    const cursorPosition = selectionStart + 1;

    setNoteText(nextText);

    window.requestAnimationFrame(() => {
      const nextTextarea = noteTextareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      nextTextarea.setSelectionRange(cursorPosition, cursorPosition);
      syncNoteDisplayScroll();
    });
  };

  const handleNoteTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      insertSafetyPhrase();
      return;
    }

    if (event.key !== 'Enter') return;

    event.preventDefault();
    insertNoteLineBreak();
  };

  const clearAnnouncementContent = () => {
    if (!hasNoteContent) return;

    setNoteText('');
    void playAnnouncementSound('pop');

    window.requestAnimationFrame(() => {
      const textarea = noteTextareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(0, 0);
      textarea.scrollTop = 0;
      syncNoteDisplayScroll();
    });
  };

  const persistAnnouncementNote = (nextDate: string, nextNote: string) => {
    try {
      sessionStorage.setItem(
        ANNOUNCEMENT_STORAGE_KEY,
        JSON.stringify({
          date: nextDate,
          note: nextNote,
        }),
      );
    } catch {
      // Ignore session storage write errors.
    }
  };

  const getAnnouncementFontEmbedCssValue = async () => {
    const captureNode = noteCaptureRef.current;
    if (!captureNode) return undefined;

    if (announcementFontEmbedCssRef.current !== null) {
      return announcementFontEmbedCssRef.current;
    }

    if (!announcementFontEmbedCssPromiseRef.current) {
      announcementFontEmbedCssPromiseRef.current = getFontEmbedCSS(captureNode, {
        preferredFontFormat: 'woff2',
      })
        .then((cssText) => {
          announcementFontEmbedCssRef.current = cssText;
          return cssText;
        })
        .finally(() => {
          announcementFontEmbedCssPromiseRef.current = null;
        });
    }

    return announcementFontEmbedCssPromiseRef.current;
  };

  useEffect(() => {
    if (!hasHydrated) return;
    persistAnnouncementNote(dateText, noteText);
  }, [dateText, hasHydrated, noteText]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncNoteDisplayScroll();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, noteRuleGapPx, noteText]);

  useEffect(() => {
    if (!isOpen) return;

    const warmupTimer = window.setTimeout(() => {
      void getAnnouncementFontEmbedCssValue().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(warmupTimer);
  }, [isOpen]);

  const saveImage = async () => {
    if (isSavingImage) return;

    setIsSavingImage(true);

    try {
      await waitForNextPaint();

      const captureNode = noteCaptureRef.current;
      if (!captureNode) return;

      let fontEmbedCSS: string | undefined;
      try {
        fontEmbedCSS = await getAnnouncementFontEmbedCssValue();
      } catch {
        fontEmbedCSS = undefined;
      }

      const blob = await toBlob(captureNode, {
        backgroundColor: '#fffcf8',
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        preferredFontFormat: 'woff2',
        fontEmbedCSS,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.captureExclude === 'true'),
      });
      if (!blob) throw new Error('Failed to create announcement image blob.');

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = buildAnnouncementFilename(dateText);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      void playAnnouncementSound('pop');
    } catch {
      alert('이미지 저장에 실패했습니다.');
    } finally {
      setIsSavingImage(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleAnnouncementShortcuts = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.repeat) return;
        void saveImage();
      }
    };

    window.addEventListener('keydown', handleAnnouncementShortcuts);
    return () => window.removeEventListener('keydown', handleAnnouncementShortcuts);
  }, [isOpen, onClose, saveImage]);

  const handleClose = () => {
    void playAnnouncementSound('pop');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="announcement-overlay fixed inset-0 z-[60] p-2 sm:p-3 md:p-5">
      <div className="announcement-shell mascot-shell app-tone-calm relative mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-[1220px] flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]">
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className={`announcement-page flex min-h-0 flex-1 flex-col overflow-hidden ${pagePaddingClass}`}>
          <div className={`announcement-stage mx-auto flex ${stageLayoutClass}`}>
            <div
              ref={noteCaptureRef}
              className={`announcement-paper paper-card relative ${paperShellLayoutClass} overflow-hidden rounded-[2.6rem] border-2 border-[#E6D5C9] bg-[#fffcf8]`}
            >
              <div className={`announcement-paper-top shrink-0 border-b border-[#EADFD1] ${paperTopClass}`}>
                <button
                  onClick={handleClose}
                  className="announcement-close-button"
                  type="button"
                  title="돌아가기"
                  aria-label="돌아가기"
                  data-capture-exclude="true"
                >
                  <X size={20} />
                </button>
                <div className="announcement-date-row">
                  <NotebookOverlayTimerBadge liveTimer={liveTimer} captureStatic={isSavingImage} />
                  <input
                    value={dateText}
                    onChange={(event) => setDateText(event.target.value)}
                    onBlur={() => setDateText((prev) => normalizeAnnouncementDateText(prev))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setDateText((prev) => normalizeAnnouncementDateText(prev));
                        focusNoteTextarea();
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        focusNoteTextarea();
                      }
                    }}
                    placeholder="2026년 3월 17일"
                    className="announcement-date-input min-h-[5.8rem] min-w-[min(100%,19rem)] flex-1 rounded-[1.8rem] border border-[#dcc7ae] bg-[#fffdf8] px-8 py-[1.15rem] text-[clamp(1.95rem,3.4vw,2.9rem)] font-semibold text-[#2c1e16] outline-none transition-all placeholder:text-[#b19d86] focus:border-[#5C8D6D] focus:ring-4 focus:ring-[#5C8D6D]/10"
                    type="text"
                  />
                  <div className="announcement-date-actions" data-capture-exclude="true">
                    <button
                      onClick={clearAnnouncementContent}
                      className="announcement-date-action-reset announcement-chip-button inline-flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border border-[#dcc7ae] text-[#8A6347]"
                      type="button"
                      title="내용 초기화"
                      aria-label="내용 초기화"
                      disabled={!hasNoteContent}
                    >
                      <RotateCcw size={18} className="text-[#A67C52]" />
                    </button>
                    <button
                      onClick={saveImage}
                      className="announcement-date-action-save toolbar-button toolbar-button-green inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-bold text-[#466146]"
                      type="button"
                      title={isSavingImage ? '이미지 저장 진행 중' : '이미지 저장'}
                      aria-label={isSavingImage ? '이미지 저장 진행 중' : '이미지 저장'}
                      aria-busy={isSavingImage}
                      disabled={isSavingImage}
                    >
                      <ImageDown size={18} />
                      {isSavingImage ? '진행 중' : '이미지 저장'}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`announcement-paper-body relative ${paperBodyLayoutClass} ${paperBodyClass}`}
                style={paperBodyStyle}
              >
                <div className="announcement-hole-column absolute bottom-4 left-4 top-4 hidden flex-col justify-between sm:flex">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span key={index} className="announcement-hole h-5 w-5 rounded-full border border-[#e8e0d5] bg-[#fffdf9]" />
                  ))}
                </div>
                <div className="announcement-paper-spine absolute bottom-4 left-[2.2rem] top-4 hidden w-px bg-[#E6D5C9] sm:block" />

                <div
                  ref={noteEditorRef}
                  className="announcement-note-editor absolute inset-x-4 bottom-4 top-0 sm:bottom-5 sm:left-[4.7rem] sm:right-6"
                >
                  <div ref={noteDisplayRef} aria-hidden="true" className="announcement-note-display">
                    <div className="announcement-note-display-content">{renderAnnouncementNoteDisplay(noteText)}</div>
                  </div>
                  <textarea
                    ref={noteTextareaRef}
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    onKeyDown={handleNoteTextareaKeyDown}
                    onScroll={syncNoteDisplayScroll}
                    className="announcement-note-textarea"
                    placeholder={ANNOUNCEMENT_NOTE_PLACEHOLDER}
                    spellCheck={false}
                  />
                  <div className="announcement-note-inline-tools" data-capture-exclude="true">
                    <button
                      onClick={insertSafetyPhrase}
                      className="announcement-note-inline-action announcement-chip-button inline-flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border border-[#dcc7ae] text-[#8A6347]"
                      type="button"
                      title={ANNOUNCEMENT_SAFETY_PHRASE}
                      aria-label={`${ANNOUNCEMENT_SAFETY_PHRASE} 자동 입력`}
                    >
                      <Sparkles size={18} className="text-[#A67C52]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoNotebookOverlay({
  isOpen,
  onClose,
  liveTimer,
}: {
  isOpen: boolean;
  onClose: () => void;
  liveTimer: AnnouncementOverlayTimerState;
}) {
  const [memoHtml, setMemoHtml] = useState(() => {
    try {
      return sanitizeMemoHtml(localStorage.getItem(MEMO_NOTE_STORAGE_KEY) || '');
    } catch {
      return '';
    }
  });
  const [memoFontScale, setMemoFontScale] = useState(MEMO_NOTE_DEFAULT_FONT_SCALE);
  const memoEditorRef = useRef<HTMLDivElement>(null);
  const memoEditorStyle = {
    '--memo-note-font-size': `${getMemoFontSizeFromScale(memoFontScale)}px`,
  } as React.CSSProperties;
  const memoSliderStyle = {
    '--memo-slider-percent': `${clampMemoFontScale(memoFontScale)}%`,
  } as React.CSSProperties;
  const hasMemoContent = getPlainTextFromMemoHtml(memoHtml).length > 0;

  const focusMemoEditor = () => {
    const editor = memoEditorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const syncMemoHtmlFromEditor = (sanitizeEditorDom = false) => {
    const editor = memoEditorRef.current;
    if (!editor) return '';

    const sanitized = sanitizeMemoHtml(editor.innerHTML);
    if (sanitizeEditorDom && editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
    setMemoHtml(sanitized);
    return sanitized;
  };

  useEffect(() => {
    try {
      localStorage.setItem(MEMO_NOTE_STORAGE_KEY, sanitizeMemoHtml(memoHtml));
    } catch {
      // Ignore storage write errors.
    }
  }, [memoHtml]);

  useEffect(() => {
    if (!isOpen) return;

    setMemoFontScale(MEMO_NOTE_DEFAULT_FONT_SCALE);

    const frame = window.requestAnimationFrame(() => {
      const editor = memoEditorRef.current;
      if (!editor) return;

      editor.innerHTML = sanitizeMemoHtml(memoHtml);
      focusMemoEditor();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMemoShortcuts = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      syncMemoHtmlFromEditor(true);
      void playAnnouncementSound('pop');
      onClose();
    };

    window.addEventListener('keydown', handleMemoShortcuts);
    return () => window.removeEventListener('keydown', handleMemoShortcuts);
  }, [isOpen, onClose]);

  const clearMemo = () => {
    if (!hasMemoContent) return;

    setMemoHtml('');
    void playAnnouncementSound('pop');

    window.requestAnimationFrame(() => {
      const editor = memoEditorRef.current;
      if (!editor) return;

      editor.innerHTML = '';
      editor.scrollTop = 0;
      focusMemoEditor();
    });
  };

  const adjustMemoFontScale = (delta: number) => {
    setMemoFontScale((previous) => clampMemoFontScale(previous + delta));
  };

  const applyMemoTextColor = (colorId: MemoTextColorId) => {
    const editor = memoEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;
    if (commonNode !== editor && !editor.contains(commonNode)) return;

    const color = getMemoTextColorById(colorId);
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color.value);
    syncMemoHtmlFromEditor(false);
    editor.focus();
  };

  const handleMemoEditorInput = () => {
    syncMemoHtmlFromEditor(false);
  };

  const handleMemoEditorBlur = () => {
    syncMemoHtmlFromEditor(true);
  };

  const handleMemoPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text/plain');
    if (!pastedText) return;

    document.execCommand('insertText', false, pastedText);
    syncMemoHtmlFromEditor(false);
  };

  const handleClose = () => {
    syncMemoHtmlFromEditor(true);
    void playAnnouncementSound('pop');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="announcement-overlay fixed inset-0 z-[60] p-2 sm:p-3 md:p-5">
      <div className="memo-shell mascot-shell app-tone-calm relative mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-[1220px] flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]">
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className="memo-page flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 lg:p-4 xl:p-5">
          <div className="memo-stage mx-auto flex h-full w-full max-w-[1160px] min-h-0 flex-col">
            <div className="memo-paper paper-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.6rem] border-2 border-[#E6D5C9] bg-[#fffcf8]">
              <div className="memo-paper-inner flex min-h-0 flex-1 flex-col p-4 sm:p-5 lg:p-6">
                <div className="memo-toolbar" data-capture-exclude="true">
                  <NotebookOverlayTimerBadge liveTimer={liveTimer} />
                  <div className="memo-controls">
                    <button
                      onClick={() => adjustMemoFontScale(-MEMO_NOTE_FONT_SCALE_STEP)}
                      className="memo-control-button memo-size-button"
                      type="button"
                      title="글자 작게"
                      aria-label="글자 작게"
                    >
                      A-
                    </button>
                    <input
                      type="range"
                      min={MEMO_NOTE_MIN_FONT_SCALE}
                      max={MEMO_NOTE_MAX_FONT_SCALE}
                      step={MEMO_NOTE_FONT_SCALE_STEP}
                      value={memoFontScale}
                      onChange={(event) => setMemoFontScale(clampMemoFontScale(event.target.value))}
                      className="memo-size-slider"
                      title="글자 크기"
                      aria-label="글자 크기"
                      style={memoSliderStyle}
                    />
                    <button
                      onClick={() => adjustMemoFontScale(MEMO_NOTE_FONT_SCALE_STEP)}
                      className="memo-control-button memo-size-button"
                      type="button"
                      title="글자 크게"
                      aria-label="글자 크게"
                    >
                      A+
                    </button>
                    <div className="memo-color-group" role="group" aria-label="글자 색상">
                      {MEMO_NOTE_TEXT_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyMemoTextColor(color.id)}
                          className={`memo-control-button memo-control-icon memo-color-choice memo-color-choice-${color.id}`}
                          type="button"
                          title={`${color.label} 적용`}
                          aria-label={`${color.label} 적용`}
                        >
                          <span
                            aria-hidden="true"
                            className="memo-color-choice-swatch"
                            style={{ '--memo-color-choice': color.value } as React.CSSProperties}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={clearMemo}
                      className="memo-control-button memo-control-icon"
                      type="button"
                      title="메모 지우기"
                      aria-label="메모 지우기"
                      disabled={!hasMemoContent}
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>
                  <button
                    onClick={handleClose}
                    className="announcement-close-button memo-close-button"
                    type="button"
                    title="돌아가기"
                    aria-label="돌아가기"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div
                  ref={memoEditorRef}
                  className="memo-note-editor custom-scrollbar flex-1"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleMemoEditorInput}
                  onBlur={handleMemoEditorBlur}
                  onPaste={handleMemoPaste}
                  data-placeholder={MEMO_NOTE_PLACEHOLDER}
                  spellCheck={false}
                  style={memoEditorStyle}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimerPage() {
  const initialState = getInitialAppState();
  const [initialRandomDrawState] = useState(() => getInitialRandomDrawState());
  const [scheduleNotice, setScheduleNotice] = useState(() => localStorage.getItem('scheduleNotice') || '');
  const [isNoticeEnabled, setIsNoticeEnabled] = useState(() => {
    const saved = localStorage.getItem('scheduleNoticeEnabled');
    if (saved !== null) return saved === 'true';
    const legacy = localStorage.getItem('scheduleNoticeVisible');
    if (legacy !== null) return legacy === 'true';
    return (localStorage.getItem('scheduleNotice') || '').trim().length > 0;
  });
  const [noticeDraft, setNoticeDraft] = useState(() => localStorage.getItem('scheduleNotice') || '');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [isMusicAvailable, setIsMusicAvailable] = useState(true);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [scheduleClockOffsetSeconds, setScheduleClockOffsetSeconds] = useState(() => {
    const saved = localStorage.getItem('scheduleClockOffsetSeconds');
    return saved === null ? 0 : clampScheduleClockOffsetSeconds(saved);
  });
  const [activeDrawCaseId, setActiveDrawCaseId] = useState(initialRandomDrawState.activeCaseId);
  const [repeatPickEnabled, setRepeatPickEnabled] = useState(initialRandomDrawState.repeatPickEnabled);
  const [drawCases, setDrawCases] = useState<RandomDrawCaseState[]>(initialRandomDrawState.cases);
  const [drawSettingsCaseId, setDrawSettingsCaseId] = useState(initialRandomDrawState.activeCaseId);
  const [isDrawCaseMenuOpen, setIsDrawCaseMenuOpen] = useState(false);
  const [isDrawCaseSwitchNearby, setIsDrawCaseSwitchNearby] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  const [studentRosterBulkInput, setStudentRosterBulkInput] = useState('');
  const [hiddenDrawResultInput, setHiddenDrawResultInput] = useState('');
  const [isHiddenDrawSettingsVisible, setIsHiddenDrawSettingsVisible] = useState(false);
  const [rollingDrawNumber, setRollingDrawNumber] = useState<number | null>(null);
  const [isStudentDrawing, setIsStudentDrawing] = useState(false);
  const [drawOverlay, setDrawOverlay] = useState<DrawOverlayState | null>(null);
  const [isDrawWinVisible, setIsDrawWinVisible] = useState(false);
  const [isDrawRepeatVisible, setIsDrawRepeatVisible] = useState(false);
  const [isDrawResetVisible, setIsDrawResetVisible] = useState(false);
  const [isDrawAutoResetPending, setIsDrawAutoResetPending] = useState(false);

  const isEditingNoticeRef = useRef(isEditingNotice);
  useEffect(() => {
    isEditingNoticeRef.current = isEditingNotice;
  }, [isEditingNotice]);

  const prevSlotIdRef = useRef<string | null>(null);
  // Manual Timer State
  const [manualTotalTime, setManualTotalTime] = useState(initialState.manual.totalTime);
  const [manualTimeLeft, setManualTimeLeft] = useState(initialState.manual.timeLeft);
  const [manualIsRunning, setManualIsRunning] = useState(initialState.manual.isRunning);
  const [manualEndTime, setManualEndTime] = useState<number | null>(initialState.manual.endTime);
  const [isExtraTimerVisible, setIsExtraTimerVisible] = useState(initialState.manual.isVisible);

  // Schedule Timer State
  const [scheduleTotalTime, setScheduleTotalTime] = useState(0);
  const [scheduleTimeLeft, setScheduleTimeLeft] = useState(0);
  const [scheduleIsRunning, setScheduleIsRunning] = useState(false);
  const [currentSlotName, setCurrentSlotName] = useState<string>('');
  const [timerType, setTimerType] = useState<TimerType>('break');
  
  // Custom Time Input State
  const [customMinutes, setCustomMinutes] = useState(Math.floor(initialState.manual.totalTime / 60).toString());
  const [customSeconds, setCustomSeconds] = useState((initialState.manual.totalTime % 60).toString());
  
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() => {
    try {
      const saved = localStorage.getItem('weeklySchedule');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeWeeklySchedule(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse schedule from local storage", e);
    }
    return defaultWeeklySchedule;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>('schedule');
  const [editingDay, setEditingDay] = useState<number>(1);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [characterImageError, setCharacterImageError] = useState(false);
  const [scheduleFocusTick, setScheduleFocusTick] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeInputRef = useRef<HTMLTextAreaElement>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);
  const skipNoticeAutoSaveRef = useRef(false);
  const scheduleListRef = useRef<HTMLUListElement>(null);
  const scheduleSlotRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const drawCasesRef = useRef(drawCases);
  const repeatPickEnabledRef = useRef(repeatPickEnabled);
  const drawRollingTimeoutRef = useRef<number | null>(null);
  const drawResolveTimeoutRef = useRef<number | null>(null);
  const drawHideTimeoutRef = useRef<number | null>(null);
  const drawLaunchTokenRef = useRef(0);
  const queuedStudentDrawAfterResetRef = useRef(false);
  const rosterInputRefs = useRef(new Map<number, HTMLInputElement>());
  const drawCaseMenuRef = useRef<HTMLDivElement>(null);
  const manualTimerMenuRef = useRef<HTMLDivElement>(null);
  const activeDrawCase =
    drawCases.find((caseState) => caseState.id === activeDrawCaseId) ??
    drawCases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0));
  const resolvedActiveDrawCaseId = activeDrawCase.id;
  const selectedDrawSettingsCaseIndex = drawCases.findIndex((caseState) => caseState.id === drawSettingsCaseId);
  const selectedDrawSettingsCase =
    drawCases[selectedDrawSettingsCaseIndex] ??
    drawCases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0));
  const selectedDrawSettingsBounds = getCaseBounds(selectedDrawSettingsCase);
  const settingsStudentNumbers = Array.from(
    { length: selectedDrawSettingsBounds.totalCount },
    (_, index) => selectedDrawSettingsBounds.minNumber + index,
  );
  const assignedStudentNameCount = settingsStudentNumbers.filter(
    (studentNumber) => getStudentName(selectedDrawSettingsCase, studentNumber).length > 0,
  ).length;
  const syncedStudentRosterBulkInput = buildStudentRosterBulkInput(selectedDrawSettingsCase, settingsStudentNumbers);
  const selectedDrawSettingsCaseData = getCaseDrawData(selectedDrawSettingsCase, repeatPickEnabled);
  const selectedDrawHistoryEntries = selectedDrawSettingsCaseData.historyEntries;
  const reservedDrawCount = selectedDrawSettingsCase.hiddenNumberQueue.length;
  const editingDaySchedule = weeklySchedule[editingDay] || [];
  const activeWeekdayScheduleCount = WEEKDAYS.filter((day) => (weeklySchedule[day] || []).length > 0).length;
  const selectedDrawSettingsCaseLabel = normalizeCaseLabel(
    selectedDrawSettingsCase.label,
    getCaseLabelByIndex(Math.max(selectedDrawSettingsCaseIndex, 0)),
  );
  const activeDrawLabel = normalizeCaseLabel(activeDrawCase.label, '학생 추첨');
  const activeDrawCaseData = getCaseDrawData(activeDrawCase, repeatPickEnabled);
  const activeQueuedDrawInstruction = getHiddenQueueInstruction(
    activeDrawCase,
    activeDrawCaseData.historyEntries[0]?.kind !== 'repeat',
  );
  const shouldTriggerImmediateDrawReset =
    activeDrawCaseData.totalCount > 0 &&
    activeDrawCaseData.availableNumbers.length === 0 &&
    activeQueuedDrawInstruction === null &&
    (activeDrawCase.currentResult !== null || activeDrawCase.historyEntries.length > 0) &&
    !isStudentDrawing &&
    !isDrawResetVisible;
  const isDrawCaseSwitchVisible = isDrawCaseMenuOpen || isDrawCaseSwitchNearby;
  const isDrawLocked = isStudentDrawing || isDrawResetVisible || isDrawAutoResetPending;

  useEffect(() => {
    localStorage.setItem('weeklySchedule', JSON.stringify(weeklySchedule));
  }, [weeklySchedule]);

  useEffect(() => {
    localStorage.setItem('scheduleNotice', scheduleNotice);
  }, [scheduleNotice]);

  useEffect(() => {
    localStorage.setItem('scheduleNoticeEnabled', String(isNoticeEnabled));
  }, [isNoticeEnabled]);

  useEffect(() => {
    localStorage.setItem('scheduleClockOffsetSeconds', String(scheduleClockOffsetSeconds));
  }, [scheduleClockOffsetSeconds]);

  useEffect(() => {
    drawCasesRef.current = drawCases;
  }, [drawCases]);

  useEffect(() => {
    repeatPickEnabledRef.current = repeatPickEnabled;
  }, [repeatPickEnabled]);

  useEffect(() => {
    setStudentRosterBulkInput(syncedStudentRosterBulkInput);
  }, [selectedDrawSettingsCase.id, syncedStudentRosterBulkInput]);

  useEffect(() => {
    setHiddenDrawResultInput(buildHiddenDrawResultInput(selectedDrawSettingsCase.hiddenNumberQueue));
  }, [selectedDrawSettingsCase.id, selectedDrawSettingsCase.hiddenNumberQueue]);

  useEffect(() => {
    persistRandomDrawState({
      activeCaseId: resolvedActiveDrawCaseId,
      repeatPickEnabled,
      cases: drawCases,
    });
  }, [drawCases, repeatPickEnabled, resolvedActiveDrawCaseId]);

  useEffect(() => {
    if (activeDrawCaseId === resolvedActiveDrawCaseId) return;
    setActiveDrawCaseId(resolvedActiveDrawCaseId);
  }, [activeDrawCaseId, resolvedActiveDrawCaseId]);

  useEffect(() => {
    if (drawSettingsCaseId === selectedDrawSettingsCase.id) return;
    setDrawSettingsCaseId(selectedDrawSettingsCase.id);
  }, [drawSettingsCaseId, selectedDrawSettingsCase.id]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setDrawSettingsCaseId(resolvedActiveDrawCaseId);
  }, [isSettingsOpen, resolvedActiveDrawCaseId]);

  useEffect(() => {
    if (isSettingsOpen) return;
    setIsHiddenDrawSettingsVisible(false);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isEditingNotice) {
      setNoticeDraft(scheduleNotice);
    }
  }, [scheduleNotice, isEditingNotice]);

  useEffect(() => {
    if (!isEditingNotice) return;
    noticeInputRef.current?.focus();
    noticeInputRef.current?.select();
  }, [isEditingNotice]);

  useEffect(() => {
    if (!isEditingNotice) return;
    const textarea = noticeInputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [isEditingNotice, noticeDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setScheduleFocusTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist App State
  useEffect(() => {
    localStorage.setItem(TIMER_APP_STATE_STORAGE_KEY, JSON.stringify({
      manual: {
        totalTime: manualTotalTime,
        timeLeft: manualTimeLeft,
        isRunning: manualIsRunning,
        endTime: manualEndTime,
        isVisible: isExtraTimerVisible,
      }
    }));
  }, [manualTotalTime, manualTimeLeft, manualIsRunning, manualEndTime, isExtraTimerVisible]);

  // Manual Timer Logic
  useEffect(() => {
    let interval: number;
    if (manualIsRunning && manualEndTime) {
      interval = window.setInterval(() => {
        const remaining = Math.max(0, Math.floor((manualEndTime - Date.now()) / 1000));
        setManualTimeLeft(remaining);
        if (remaining === 0) {
          setManualIsRunning(false);
          setManualEndTime(null);
          playAlarm();
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [manualIsRunning, manualEndTime]);

  // Schedule Timer Logic
  useEffect(() => {
    const checkSchedule = () => {
      const { dayOfWeek, currentMinutes, currentSeconds } = getScheduleClockParts(
        Date.now(),
        scheduleClockOffsetSeconds,
      );

      const todaysSchedule = weeklySchedule[dayOfWeek] || [];
      const activeSlot = todaysSchedule.find(s => currentMinutes >= s.start && currentMinutes < s.end);
      const nextSlotId = activeSlot ? activeSlot.id : null;
      const didSlotChange = prevSlotIdRef.current !== null && prevSlotIdRef.current !== nextSlotId;

      if (didSlotChange) {
        clearAndCloseNotice();
      }

      prevSlotIdRef.current = nextSlotId;

      if (activeSlot) {
        const slotTotalSeconds = (activeSlot.end - activeSlot.start) * 60;
        const elapsedSeconds = (currentMinutes - activeSlot.start) * 60 + currentSeconds;
        setScheduleTotalTime(slotTotalSeconds);
        setScheduleTimeLeft(slotTotalSeconds - elapsedSeconds);
        setCurrentSlotName(activeSlot.name);
        setTimerType(activeSlot.type as TimerType);
        setScheduleIsRunning(true);
      } else {
        setScheduleTotalTime(0);
        setScheduleTimeLeft(0);
        setCurrentSlotName('일정 없음');
        setTimerType('none');
        setScheduleIsRunning(false);
      }
    };

    checkSchedule();
    const interval = window.setInterval(checkSchedule, 250);

    return () => clearInterval(interval);
  }, [weeklySchedule, scheduleClockOffsetSeconds]);

  const setManualTimerDuration = (totalSeconds: number) => {
    if (totalSeconds <= 0) return;

    setManualTotalTime(totalSeconds);
    setManualTimeLeft(totalSeconds);
    setManualIsRunning(false);
    setManualEndTime(null);
  };

  const clampManualInputValue = (value: string, max: number) => {
    if (value === '') return '';
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return '';
    return Math.min(Math.max(0, numeric), max).toString();
  };

  const syncManualTimerFromInputs = (minutesValue: string, secondsValue: string) => {
    const minutes = Number.parseInt(minutesValue, 10) || 0;
    const seconds = Number.parseInt(secondsValue, 10) || 0;
    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds > 0) {
      setManualTimerDuration(totalSeconds);
      setIsExtraTimerVisible(true);
    }
  };

  const applyManualPreset = (totalSeconds: number) => {
    setCustomMinutes(Math.floor(totalSeconds / 60).toString());
    setCustomSeconds((totalSeconds % 60).toString());
    setManualTimerDuration(totalSeconds);
    setIsExtraTimerVisible(true);
  };

  const handleCustomMinutesChange = (value: string) => {
    const nextValue = clampManualInputValue(value, 999);
    setCustomMinutes(nextValue);
    syncManualTimerFromInputs(nextValue, customSeconds);
  };

  const handleCustomSecondsChange = (value: string) => {
    const nextValue = clampManualInputValue(value, 59);
    setCustomSeconds(nextValue);
    syncManualTimerFromInputs(customMinutes, nextValue);
  };

  const toggleTimer = () => {
    if (manualIsRunning) {
      setManualIsRunning(false);
      setManualEndTime(null);
    } else {
      if (manualTimeLeft > 0) {
        setManualIsRunning(true);
        setManualEndTime(Date.now() + manualTimeLeft * 1000);
      }
    }
  };

  const resetTimer = () => {
    setManualTimeLeft(manualTotalTime);
    setManualIsRunning(false);
    setManualEndTime(null);
  };

  const updateDrawCaseState = (
    caseId: string,
    updater: (previousCase: RandomDrawCaseState) => RandomDrawCaseState,
  ) => {
    setDrawCases((previousCases) =>
      previousCases.map((caseState) => (caseState.id === caseId ? updater(caseState) : caseState)),
    );
  };

  const clearDrawAnimationTimers = () => {
    if (drawRollingTimeoutRef.current !== null) {
      window.clearTimeout(drawRollingTimeoutRef.current);
      drawRollingTimeoutRef.current = null;
    }

    if (drawResolveTimeoutRef.current !== null) {
      window.clearTimeout(drawResolveTimeoutRef.current);
      drawResolveTimeoutRef.current = null;
    }
  };

  const clearDrawHideTimer = () => {
    if (drawHideTimeoutRef.current !== null) {
      window.clearTimeout(drawHideTimeoutRef.current);
      drawHideTimeoutRef.current = null;
    }
  };

  const clearDrawFeedback = () => {
    clearDrawHideTimer();
    setDrawOverlay(null);
    setIsDrawWinVisible(false);
    setIsDrawRepeatVisible(false);
    setIsDrawResetVisible(false);
    setIsDrawAutoResetPending(false);
  };

  const stopStudentDraw = () => {
    drawLaunchTokenRef.current += 1;
    clearDrawAnimationTimers();
    setIsStudentDrawing(false);
    setRollingDrawNumber(null);
  };

  const performDrawCaseReset = (caseId: string, animate = true) => {
    drawLaunchTokenRef.current += 1;
    clearDrawAnimationTimers();
    clearDrawHideTimer();
    setIsStudentDrawing(false);
    setRollingDrawNumber(null);
    updateDrawCaseState(caseId, (previousCase) => ({
      ...previousCase,
      currentResult: null,
      historyEntries: [],
    }));

    if (!animate) {
      setDrawOverlay(null);
      setIsDrawWinVisible(false);
      setIsDrawRepeatVisible(false);
      setIsDrawResetVisible(false);
      setIsDrawAutoResetPending(false);
      return;
    }

    setDrawOverlay({
      caseId,
      displayText: DRAW_RESET_MESSAGE,
      kind: 'reset',
      number: null,
    });
    setIsDrawWinVisible(false);
    setIsDrawRepeatVisible(false);
    setIsDrawResetVisible(true);
    setIsDrawAutoResetPending(false);
    void playRandomDrawSound('reset');

    drawHideTimeoutRef.current = window.setTimeout(() => {
      drawHideTimeoutRef.current = null;
      setDrawOverlay(null);
      setIsDrawResetVisible(false);
    }, DRAW_RESET_EFFECT_DURATION_MS);
  };

  const showDrawOverlayTemporarily = (
    nextOverlay: DrawOverlayState,
    options?: { autoResetCaseId?: string },
  ) => {
    clearDrawHideTimer();
    setDrawOverlay(nextOverlay);
    setIsDrawWinVisible(nextOverlay.kind === 'normal');
    setIsDrawRepeatVisible(nextOverlay.kind === 'repeat');
    setIsDrawResetVisible(nextOverlay.kind === 'reset');
    setIsDrawAutoResetPending(Boolean(options?.autoResetCaseId));

    drawHideTimeoutRef.current = window.setTimeout(() => {
      drawHideTimeoutRef.current = null;
      if (options?.autoResetCaseId) {
        performDrawCaseReset(options.autoResetCaseId, true);
        return;
      }

      setDrawOverlay(null);
      setIsDrawWinVisible(false);
      setIsDrawRepeatVisible(false);
      setIsDrawResetVisible(false);
      setIsDrawAutoResetPending(false);
    }, RANDOM_DRAW_RESULT_DISPLAY_MS);
  };

  const getDrawCaseSnapshot = (caseId: string) =>
    drawCasesRef.current.find((caseState) => caseState.id === caseId) ??
    createDefaultCaseState(getCaseLabelByIndex(0));

  const finalizeNormalDraw = (caseId: string, finalNumber: number, hiddenQueueIndex?: number) => {
    const caseSnapshot = getDrawCaseSnapshot(caseId);
    const nextHiddenNumberQueue =
      hiddenQueueIndex === undefined
        ? caseSnapshot.hiddenNumberQueue
        : removeHiddenNumberQueueItem(caseSnapshot.hiddenNumberQueue, hiddenQueueIndex);
    const nextHistoryEntries = [createHistoryEntry(finalNumber, 'normal'), ...caseSnapshot.historyEntries].slice(
      0,
      MAX_HISTORY_LENGTH,
    );
    const shouldAutoReset =
      getCaseDrawData(
        {
          ...caseSnapshot,
          currentResult: finalNumber,
          hiddenNumberQueue: nextHiddenNumberQueue,
          historyEntries: nextHistoryEntries,
        },
        repeatPickEnabledRef.current,
      ).availableNumbers.length === 0;
    const displayText = getStudentDisplayText(caseSnapshot, finalNumber);

    updateDrawCaseState(caseId, (previousCase) => ({
      ...previousCase,
      currentResult: finalNumber,
      hiddenNumberQueue: nextHiddenNumberQueue,
      historyEntries: nextHistoryEntries,
    }));
    setIsStudentDrawing(false);
    setRollingDrawNumber(null);
    showDrawOverlayTemporarily(
      {
        caseId,
        displayText,
        kind: 'normal',
        number: finalNumber,
      },
      shouldAutoReset ? { autoResetCaseId: caseId } : undefined,
    );
    void playRandomDrawSound('pop');
  };

  const finalizeRepeatDraw = (caseId: string, repeatedEntry: RandomDrawHistoryEntry, hiddenQueueIndex?: number) => {
    const caseSnapshot = getDrawCaseSnapshot(caseId);
    const nextHiddenNumberQueue =
      hiddenQueueIndex === undefined
        ? caseSnapshot.hiddenNumberQueue
        : removeHiddenNumberQueueItem(caseSnapshot.hiddenNumberQueue, hiddenQueueIndex);
    const nextHistoryEntries = [
      createHistoryEntry(repeatedEntry.number, 'repeat', repeatedEntry.id),
      ...caseSnapshot.historyEntries,
    ].slice(0, MAX_HISTORY_LENGTH);
    const shouldAutoReset =
      getCaseDrawData(
        {
          ...caseSnapshot,
          currentResult: repeatedEntry.number,
          hiddenNumberQueue: nextHiddenNumberQueue,
          historyEntries: nextHistoryEntries,
        },
        repeatPickEnabledRef.current,
      ).availableNumbers.length === 0;
    const displayText = getStudentDisplayText(caseSnapshot, repeatedEntry.number);

    updateDrawCaseState(caseId, (previousCase) => ({
      ...previousCase,
      currentResult: repeatedEntry.number,
      hiddenNumberQueue: nextHiddenNumberQueue,
      historyEntries: nextHistoryEntries,
    }));
    setIsStudentDrawing(false);
    setRollingDrawNumber(null);
    showDrawOverlayTemporarily(
      {
        caseId,
        displayText,
        kind: 'repeat',
        number: repeatedEntry.number,
      },
      shouldAutoReset ? { autoResetCaseId: caseId } : undefined,
    );
    void playRandomDrawSound('repeat');
  };

  const showEmptyDrawNotice = (caseId: string) => {
    stopStudentDraw();
    showDrawOverlayTemporarily({
      caseId,
      displayText: DRAW_EMPTY_MESSAGE,
      kind: 'empty',
      number: null,
    });
    void playRandomDrawSound('empty');
  };

  const startStudentDraw = () => {
    if (isDrawLocked) return;

    const targetCaseId = resolvedActiveDrawCaseId;
    const initialCase = getDrawCaseSnapshot(targetCaseId);
    const initialDrawData = getCaseDrawData(initialCase, repeatPickEnabledRef.current);
    const initialQueuedInstruction = getHiddenQueueInstruction(
      initialCase,
      initialDrawData.historyEntries[0]?.kind !== 'repeat',
    );
    const plannedRepeatEntry: RandomDrawHistoryEntry | null = null;
    const rollingPool = Array.from(
      { length: initialDrawData.totalCount },
      (_, index) => initialDrawData.minNumber + index,
    );

    if (rollingPool.length === 0) {
      showEmptyDrawNotice(targetCaseId);
      return;
    }

    if (initialDrawData.availableNumbers.length === 0 && initialQueuedInstruction === null) {
      performDrawCaseReset(targetCaseId, true);
      return;
    }

    drawLaunchTokenRef.current += 1;
    const drawLaunchToken = drawLaunchTokenRef.current;

    clearDrawAnimationTimers();
    clearDrawFeedback();
    setIsStudentDrawing(true);
    setRollingDrawNumber(null);
    const startedAt = performance.now();

    const rollStep = () => {
      if (drawLaunchTokenRef.current !== drawLaunchToken) return;

      const nextValue = sampleOne(rollingPool);
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(elapsed / RANDOM_DRAW_DURATION_MS, 1);
      const nextDelay = Math.round(104 - (104 - 34) * progress);

      setRollingDrawNumber(nextValue);
      void playRandomDrawSound('tick');

      if (elapsed < RANDOM_DRAW_DURATION_MS - nextDelay) {
        drawRollingTimeoutRef.current = window.setTimeout(rollStep, nextDelay);
      }
    };

    rollStep();

    drawResolveTimeoutRef.current = window.setTimeout(() => {
      if (drawLaunchTokenRef.current !== drawLaunchToken) return;

      clearDrawAnimationTimers();
      const nextCase = getDrawCaseSnapshot(targetCaseId);
      const nextDrawData = getCaseDrawData(nextCase, repeatPickEnabledRef.current);
      const nextCanTriggerRepeatAnimation = nextDrawData.historyEntries[0]?.kind !== 'repeat';
      const queuedInstruction = getHiddenQueueInstruction(nextCase, nextCanTriggerRepeatAnimation);

      if (queuedInstruction) {
        if (queuedInstruction.kind === 'repeat' && queuedInstruction.sourceEntry) {
          finalizeRepeatDraw(targetCaseId, queuedInstruction.sourceEntry, queuedInstruction.index);
          return;
        }

        finalizeNormalDraw(targetCaseId, queuedInstruction.number, queuedInstruction.index);
        return;
      }

      const shouldRepeat =
        repeatPickEnabledRef.current &&
        nextCanTriggerRepeatAnimation &&
        nextDrawData.availableNumbers.length > 0 &&
        nextDrawData.repeatableEntries.length > 0 &&
        Math.random() < REPEAT_PICK_PROBABILITY;

      if (shouldRepeat) {
        finalizeRepeatDraw(targetCaseId, sampleOne(nextDrawData.repeatableEntries));
        return;
      }

      if (nextDrawData.availableNumbers.length === 0) {
        performDrawCaseReset(targetCaseId, true);
        return;
      }

      finalizeNormalDraw(targetCaseId, sampleOne(nextDrawData.availableNumbers));
    }, RANDOM_DRAW_DURATION_MS);
  };

  const resetActiveDrawCase = () => {
    performDrawCaseReset(resolvedActiveDrawCaseId, true);
  };

  const updateDrawCaseLabel = (caseId: string, rawValue: string) => {
    updateDrawCaseState(caseId, (previousCase) => ({
      ...previousCase,
      label: rawValue,
    }));
  };

  const updateDrawCaseRange = (
    caseId: string,
    field: 'rangeStart' | 'rangeEnd',
    rawValue: string,
    fallback: number,
  ) => {
    const nextValue = clampDrawNumberInput(rawValue, fallback);

    updateDrawCaseState(caseId, (previousCase) => {
      if (previousCase[field] === nextValue) {
        return previousCase;
      }

      const nextRangeStart = field === 'rangeStart' ? nextValue : previousCase.rangeStart;
      const nextRangeEnd = field === 'rangeEnd' ? nextValue : previousCase.rangeEnd;
      const nextMinNumber = Math.min(nextRangeStart, nextRangeEnd);
      const nextMaxNumber = Math.max(nextRangeStart, nextRangeEnd);
      const nextStudentNames = Object.fromEntries(
        Object.entries(previousCase.studentNames).filter(([key]) => {
          const studentNumber = Number(key);
          return Number.isFinite(studentNumber) && studentNumber >= nextMinNumber && studentNumber <= nextMaxNumber;
        }),
      );

      return {
        ...previousCase,
        [field]: nextValue,
        currentResult: null,
        historyEntries: [],
        studentNames: nextStudentNames,
        hiddenNumberQueue: previousCase.hiddenNumberQueue.filter(
          (number) => number >= nextMinNumber && number <= nextMaxNumber,
        ),
      };
    });

    if (caseId === resolvedActiveDrawCaseId) {
      stopStudentDraw();
      clearDrawFeedback();
    }
  };

  const updateDrawStudentName = (caseId: string, studentNumber: number, rawValue: string) => {
    const nextName = rawValue.trim();

    updateDrawCaseState(caseId, (previousCase) => {
      const currentName = getStudentName(previousCase, studentNumber);
      if (currentName === nextName) {
        return previousCase;
      }

      const nextStudentNames = {
        ...previousCase.studentNames,
      };

      if (nextName.length > 0) {
        nextStudentNames[String(studentNumber)] = nextName;
      } else {
        delete nextStudentNames[String(studentNumber)];
      }

      return {
        ...previousCase,
        studentNames: nextStudentNames,
      };
    });
  };

  const applyBulkStudentRoster = () => {
    const nextStudentNamesInRange = parseStudentRosterBulkInput(studentRosterBulkInput, settingsStudentNumbers);

    updateDrawCaseState(selectedDrawSettingsCase.id, (previousCase) => {
      const nextStudentNames = {
        ...previousCase.studentNames,
      };

      settingsStudentNumbers.forEach((studentNumber) => {
        delete nextStudentNames[String(studentNumber)];
      });

      Object.entries(nextStudentNamesInRange).forEach(([studentNumber, studentName]) => {
        nextStudentNames[studentNumber] = studentName;
      });

      return {
        ...previousCase,
        studentNames: nextStudentNames,
      };
    });
  };

  const applyHiddenDrawResult = () => {
    const nextQueue = parseHiddenDrawResultInput(
      hiddenDrawResultInput,
      selectedDrawSettingsBounds.minNumber,
      selectedDrawSettingsBounds.maxNumber,
    );

    updateDrawCaseState(selectedDrawSettingsCase.id, (previousCase) => ({
      ...previousCase,
      hiddenNumberQueue: nextQueue,
    }));
  };

  const clearHiddenDrawResult = () => {
    setHiddenDrawResultInput('');
    updateDrawCaseState(selectedDrawSettingsCase.id, (previousCase) => ({
      ...previousCase,
      hiddenNumberQueue: [],
    }));
  };

  const setRosterInputRef = (studentNumber: number, node: HTMLInputElement | null) => {
    if (node) {
      rosterInputRefs.current.set(studentNumber, node);
      return;
    }

    rosterInputRefs.current.delete(studentNumber);
  };

  const handleRosterInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (event.key !== 'Tab') return;

    const nextIndex = currentIndex + (event.shiftKey ? -1 : 1);
    const nextStudentNumber = settingsStudentNumbers[nextIndex];
    if (nextStudentNumber === undefined) return;

    event.preventDefault();
    const nextInput = rosterInputRefs.current.get(nextStudentNumber);
    nextInput?.focus();
    nextInput?.select();
  };

  const addDrawSettingsCase = () => {
    const nextCase = createDefaultCaseState(createUniqueCaseLabel(drawCases));

    setDrawCases((previousCases) => [...previousCases, nextCase]);
    setDrawSettingsCaseId(nextCase.id);
  };

  const removeDrawSettingsCase = (caseId: string) => {
    if (drawCases.length <= 1) return;

    const caseIndex = drawCases.findIndex((caseState) => caseState.id === caseId);
    const nextCases = drawCases.filter((caseState) => caseState.id !== caseId);
    const fallbackCase = nextCases[Math.min(caseIndex, nextCases.length - 1)] ?? nextCases[0];

    if (resolvedActiveDrawCaseId === caseId) {
      stopStudentDraw();
      clearDrawFeedback();
    }

    setDrawCases(nextCases);
    if (resolvedActiveDrawCaseId === caseId && fallbackCase) {
      setActiveDrawCaseId(fallbackCase.id);
    }
    if (drawSettingsCaseId === caseId && fallbackCase) {
      setDrawSettingsCaseId(fallbackCase.id);
    }
  };

  const selectActiveDrawCase = (caseId: string) => {
    if (resolvedActiveDrawCaseId === caseId) {
      setIsDrawCaseMenuOpen(false);
      return;
    }

    stopStudentDraw();
    clearDrawFeedback();
    setActiveDrawCaseId(caseId);
    setIsDrawCaseMenuOpen(false);
  };

  useEffect(() => {
    const handleStudentDrawShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        isSettingsOpen ||
        isMemoOpen ||
        isAnnouncementOpen ||
        isDictionaryOpen ||
        isEditingNotice ||
        isEditableShortcutTarget(event.target) ||
        event.repeat
      ) {
        return;
      }

      event.preventDefault();
      if (isDrawResetVisible) {
        queuedStudentDrawAfterResetRef.current = true;
        return;
      }

      if (shouldTriggerImmediateDrawReset) {
        queuedStudentDrawAfterResetRef.current = true;
        performDrawCaseReset(resolvedActiveDrawCaseId, true);
        return;
      }

      void prepareRandomDrawAudio();
      startStudentDraw();
    };

    window.addEventListener('keydown', handleStudentDrawShortcut);

    return () => {
      window.removeEventListener('keydown', handleStudentDrawShortcut);
    };
  }, [
    isAnnouncementOpen,
    isDictionaryOpen,
    isDrawResetVisible,
    isEditingNotice,
    isMemoOpen,
    isSettingsOpen,
    drawCases,
    repeatPickEnabled,
    resolvedActiveDrawCaseId,
    shouldTriggerImmediateDrawReset,
  ]);

  useEffect(() => {
    if (
      isDrawResetVisible ||
      isSettingsOpen ||
      isMemoOpen ||
      isAnnouncementOpen ||
      isDictionaryOpen ||
      isEditingNotice
    ) {
      return;
    }
    if (!queuedStudentDrawAfterResetRef.current) return;

    queuedStudentDrawAfterResetRef.current = false;
    startStudentDraw();
  }, [
    isAnnouncementOpen,
    isDictionaryOpen,
    isDrawResetVisible,
    isEditingNotice,
    isMemoOpen,
    isSettingsOpen,
    drawCases,
    repeatPickEnabled,
    resolvedActiveDrawCaseId,
  ]);

  useEffect(() => {
    return () => {
      clearDrawAnimationTimers();
      clearDrawHideTimer();
    };
  }, []);

  useEffect(() => {
    if (!isDrawCaseMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const menuNode = drawCaseMenuRef.current;
      if (!menuNode) return;
      if (menuNode.contains(event.target as Node)) return;
      setIsDrawCaseMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsDrawCaseMenuOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isDrawCaseMenuOpen]);

  useEffect(() => {
    if (isDrawCaseMenuOpen) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const menuNode = drawCaseMenuRef.current;
    if (!menuNode) {
      setIsDrawCaseSwitchNearby(false);
      return;
    }

    const isPointerClose = menuNode.matches(':hover');
    const isFocusInside = menuNode.contains(document.activeElement);

    if (!isPointerClose && !isFocusInside) {
      setIsDrawCaseSwitchNearby(false);
    }
  }, [isDrawCaseMenuOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setIsDrawCaseMenuOpen(false);
  }, [isSettingsOpen]);

  const updateSlot = (day: number, id: string, field: keyof ScheduleSlot, value: any) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const slotIndex = daySchedule.findIndex(s => s.id === id);
      if (slotIndex > -1) {
        const nextSlot = { ...daySchedule[slotIndex], [field]: value } as ScheduleSlot;

        if (field === 'type' || field === 'start') {
          const fixedDuration = getFixedDurationByType(nextSlot.type);
          if (fixedDuration !== null) {
            nextSlot.end = nextSlot.start + fixedDuration;
          }
        }

        if (field === 'end' && nextSlot.end <= nextSlot.start) {
          nextSlot.end = nextSlot.start + 1;
        }

        if (isMorningSlot(nextSlot)) {
          nextSlot.type = 'morning';
          nextSlot.name = MORNING_ACTIVITY_LABEL;
        }

        daySchedule[slotIndex] = nextSlot;
      }
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const addSlot = (day: number) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const lastSlot = daySchedule[daySchedule.length - 1];
      const start = lastSlot ? lastSlot.end : 540;
      daySchedule.push({
        id: createSlotId(),
        name: '새 일정',
        type: 'class',
        start: start,
        end: start + CLASS_DURATION
      });
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const removeSlot = (day: number, id: string) => {
    setWeeklySchedule(prev => {
      const targetSlot = (prev[day] || []).find((s) => s.id === id);
      if (targetSlot && isMorningSlot(targetSlot)) {
        return prev;
      }
      const daySchedule = (prev[day] || []).filter(s => s.id !== id);
      return { ...prev, [day]: normalizeDaySchedule(daySchedule) };
    });
  };

  const exportSchedule = () => {
    const exportPayload = {
      weeklySchedule,
      scheduleNotice,
      scheduleNoticeEnabled: isNoticeEnabled,
      scheduleClockOffsetSeconds,
      randomDraw: {
        activeCaseId: resolvedActiveDrawCaseId,
        repeatPickEnabled,
        cases: drawCases,
      },
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "timer_schedule.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importSchedule = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          const nextSchedule = parsed.weeklySchedule && typeof parsed.weeklySchedule === 'object'
            ? parsed.weeklySchedule
            : parsed;
          const nextNotice = typeof parsed.scheduleNotice === 'string' ? parsed.scheduleNotice : '';
          const nextNoticeEnabled = typeof parsed.scheduleNoticeEnabled === 'boolean'
            ? parsed.scheduleNoticeEnabled
            : nextNotice.trim().length > 0;
          const nextClockOffsetSeconds = clampScheduleClockOffsetSeconds(parsed.scheduleClockOffsetSeconds);
          const nextRandomDraw =
            parsed.randomDraw && typeof parsed.randomDraw === 'object'
              ? normalizeSavedRandomDrawState(parsed.randomDraw)
              : null;
          stopStudentDraw();
          clearDrawFeedback();
          setWeeklySchedule(normalizeWeeklySchedule(nextSchedule));
          setScheduleNotice(nextNotice);
          setIsNoticeEnabled(nextNoticeEnabled);
          setScheduleClockOffsetSeconds(nextClockOffsetSeconds);
          if (nextRandomDraw) {
            setDrawCases(nextRandomDraw.cases);
            setActiveDrawCaseId(nextRandomDraw.activeCaseId);
            setDrawSettingsCaseId(nextRandomDraw.activeCaseId);
            setRepeatPickEnabled(nextRandomDraw.repeatPickEnabled);
          }
          alert('시간표를 성공적으로 불러왔습니다.');
        } else {
          alert('잘못된 파일 형식입니다.');
        }
      } catch (error) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const startNoticeEdit = () => {
    skipNoticeAutoSaveRef.current = false;
    setNoticeDraft(scheduleNotice);
    setIsEditingNotice(true);
  };

  const openNoticePanel = () => {
    if ((scheduleNotice || '').trim().length > 0) {
      setIsNoticeEnabled(true);
      return;
    }
    startNoticeEdit();
  };

  const saveNotice = () => {
    skipNoticeAutoSaveRef.current = false;
    const nextNotice = noticeDraft.trim();
    setScheduleNotice(nextNotice);
    if (nextNotice.length > 0) {
      setIsNoticeEnabled(true);
    }
    setIsEditingNotice(false);
  };

  const cancelNoticeEdit = () => {
    skipNoticeAutoSaveRef.current = true;
    setNoticeDraft(scheduleNotice);
    setIsEditingNotice(false);
  };

  const clearAndCloseNotice = () => {
    skipNoticeAutoSaveRef.current = isEditingNoticeRef.current;
    setScheduleNotice('');
    setNoticeDraft('');
    setIsNoticeEnabled(false);
    setIsEditingNotice(false);
  };

  const handleNoticeBlur = () => {
    if (skipNoticeAutoSaveRef.current) {
      skipNoticeAutoSaveRef.current = false;
      return;
    }
    saveNotice();
  };

  const toggleBackgroundMusic = async () => {
    const audio = backgroundMusicRef.current;
    if (!audio || isMusicLoading) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setIsMusicLoading(true);
      setIsMusicAvailable(true);
      if (audio.error || audio.readyState === 0) {
        audio.load();
      }
      audio.volume = BACKGROUND_MUSIC_VOLUME;
      await audio.play();
    } catch (error) {
      console.error('Background music playback failed', error);
      setIsMusicAvailable(false);
    } finally {
      setIsMusicLoading(false);
    }
  };

  // Visual calculations
  const displayTotalTime = scheduleTotalTime;
  const displayTimeLeft = scheduleTimeLeft;
  const displayIsRunning = scheduleIsRunning;

  const percentage = displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0;
  const warningThreshold = 0.5;
  const urgentThreshold = 0.2;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = -(circumference - percentage * circumference);

  let colorClass = "text-[#587052]";
  let strokeColor = "#587052";
  let pulseClass = "";
  let bgClass = "app-tone-calm";

  let characterMessage = "";
  let showCharacter = false;
  let characterMotionStyle: React.CSSProperties = {};
  let speechBubbleSizeClass = "px-7 py-4 md:px-10 md:py-6";
  let speechTextSizeClass = "text-2xl md:text-4xl";
  let characterWrapSizeClass = "w-48 h-48 md:w-64 md:h-64";
  let characterImageScaleClass = "scale-[1.15] md:scale-[1.25]";
  const isScheduleBreak = timerType === 'break';
  const isScheduleLunch = timerType === 'lunch';
  const shouldShowTimedMessage = isScheduleBreak || isScheduleLunch;
  const scheduleTypeLabel =
    timerType === 'class'
      ? "\uC218\uC5C5\uC2DC\uAC04"
      : timerType === 'break'
        ? "\uC26C\uB294\uC2DC\uAC04"
        : timerType === 'morning'
          ? MORNING_ACTIVITY_LABEL
        : timerType === 'lunch'
          ? "\uC810\uC2EC\uC2DC\uAC04"
          : "\uC77C\uC815 \uC5C6\uC74C";
  const scheduleTypeBadgeClass =
    timerType === 'class'
      ? 'bg-[#EEF5EA] text-[#466146] border-[#CADABD]'
      : timerType === 'break'
        ? 'bg-[#F7FBF4] text-[#5C7A4B] border-[#D5E6CA]'
        : timerType === 'morning'
          ? 'bg-[#FFF7E3] text-[#8D6C37] border-[#EBCF93]'
          : timerType === 'lunch'
            ? 'bg-[#FFF0E3] text-[#A46943] border-[#EDC7A8]'
            : 'bg-[#F7F0E9] text-[#8A6347]/70 border-[#E8D7C5]';
  const shouldShowCurrentSlotChip =
    currentSlotName.length > 0 &&
    currentSlotName !== '일정 없음' &&
    currentSlotName.replace(/\s+/g, '') !== scheduleTypeLabel.replace(/\s+/g, '');

  const getCharacterMessage = (stage: 'warning' | 'urgent' | 'end') => {
    if (isScheduleBreak) {
      if (stage === 'warning') return "\uC26C\uB294 \uC2DC\uAC04\uC774 \uB05D\uB098\uAC00\uC694. \uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uACF3 \uC218\uC5C5\uC774 \uC2DC\uC791\uD574\uC694. \uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC26C\uB294 \uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    if (isScheduleLunch) {
      if (stage === 'warning') return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB098\uAC00\uC694. \uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uC815\uB9AC\uD560 \uC2DC\uAC04\uC774\uC5D0\uC694. \uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    return "";
  };

  if (displayTotalTime === 0) {
    colorClass = "text-[#CEBFA8]";
    strokeColor = "#CEBFA8";
    bgClass = "app-tone-idle";
  } else if (shouldShowTimedMessage && displayTimeLeft === 0) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-finished";
    characterMessage = getCharacterMessage('end');
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
  } else if (shouldShowTimedMessage && percentage <= urgentThreshold) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-urgent";
    speechBubbleSizeClass = "px-8 py-5 md:px-12 md:py-7";
    speechTextSizeClass = "text-3xl md:text-5xl";
    characterWrapSizeClass = "w-56 h-56 md:w-80 md:h-80";
    characterImageScaleClass = "scale-125 md:scale-[1.45]";
    characterMessage = getCharacterMessage('urgent');
    if (displayIsRunning) {
      pulseClass = "mascot-alert-pulse";
    }
  } else if (shouldShowTimedMessage && percentage <= warningThreshold) {
    colorClass = "text-[#C58747]";
    strokeColor = "#C58747";
    showCharacter = true;
    bgClass = "app-tone-warning";
    speechBubbleSizeClass = "px-7 py-4 md:px-10 md:py-6";
    speechTextSizeClass = "text-2xl md:text-4xl";
    characterWrapSizeClass = "w-48 h-48 md:w-64 md:h-64";
    characterImageScaleClass = "scale-[1.15] md:scale-[1.25]";
    characterMessage = getCharacterMessage('warning');
  }

  if (showCharacter && displayIsRunning) {
    const bobOffset = Math.sin((displayTimeLeft || 0) * 0.8) * 10;
    const tilt = Math.sin((displayTimeLeft || 0) * 1.3) * (percentage <= urgentThreshold ? 6 : 3);
    characterMotionStyle = {
      transform: `translateY(${bobOffset}px) rotate(${tilt}deg)`,
      transition: "transform 220ms ease-out",
    };
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatMinutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const manualProgress = manualTotalTime > 0 ? Math.max(0, Math.min(1, manualTimeLeft / manualTotalTime)) : 0;
  const isManualFinished = manualTotalTime > 0 && manualTimeLeft === 0;
  const manualClockClass = manualIsRunning
    ? 'text-[#5C8D5D]'
    : isManualFinished
      ? 'text-[#B55E4C]'
      : 'text-[#8A6347]';
  const drawOverlayCaseId = isStudentDrawing
    ? resolvedActiveDrawCaseId
    : drawOverlay?.caseId ?? resolvedActiveDrawCaseId;
  const drawOverlayCase =
    drawCases.find((caseState) => caseState.id === drawOverlayCaseId) ?? activeDrawCase;
  const drawOverlayNumber = isStudentDrawing ? rollingDrawNumber : drawOverlay?.number ?? null;
  const drawOverlayText =
    isStudentDrawing && rollingDrawNumber !== null
      ? getStudentDisplayText(drawOverlayCase, rollingDrawNumber)
      : drawOverlay?.displayText ?? '';
  const isDrawOverlayVisible = isStudentDrawing || drawOverlay !== null;
  const isDrawOverlayEmpty = !isStudentDrawing && drawOverlay?.kind === 'empty';
  const isDrawOverlayReset = !isStudentDrawing && drawOverlay?.kind === 'reset';
  const isDrawOverlayStudentName =
    drawOverlayNumber !== null && getStudentName(drawOverlayCase, drawOverlayNumber).length > 0;
  const drawOverlayBoardClass = `random-board ${
    isStudentDrawing ? 'random-board-drawing' : ''
  }${isDrawOverlayEmpty ? ' random-board-empty-state' : ''}${
    isDrawWinVisible ? ' random-board-win-impact' : ''
  }${isDrawRepeatVisible ? ' random-board-repeat-impact' : ''}${
    isDrawResetVisible ? ' random-board-reset-impact' : ''
  }`;
  const drawOverlayNumberClass = `random-board-number${
    isDrawOverlayVisible ? ' random-board-number-active' : ''
  }${isDrawOverlayStudentName || isDrawOverlayReset ? ' random-board-display-name' : ''}${
    isDrawOverlayReset ? ' random-board-reset-label' : ''
  }${
    isDrawOverlayEmpty ? ' random-board-empty-text' : ''
  }${isDrawRepeatVisible ? ' random-board-number-repeat-accent' : ''}${
    isDrawWinVisible ? ' random-board-number-win-punch' : ''
  }${isDrawResetVisible ? ' random-board-number-reset-accent' : ''
  }`;

  const adjustedScheduleNow = getAdjustedScheduleDate(scheduleFocusTick, scheduleClockOffsetSeconds);
  const today = adjustedScheduleNow.getDay();
  const currentDaySchedule = weeklySchedule[today] || [];
  const currentMinsForScheduleView = adjustedScheduleNow.getHours() * 60 + adjustedScheduleNow.getMinutes();
  const activeSlotIndex = currentDaySchedule.findIndex(
    (slot) => currentMinsForScheduleView >= slot.start && currentMinsForScheduleView < slot.end
  );
  const nextSlotIndex = currentDaySchedule.findIndex((slot) => currentMinsForScheduleView < slot.start);
  const focusSlotIndex =
    activeSlotIndex !== -1
      ? activeSlotIndex
      : nextSlotIndex !== -1
        ? nextSlotIndex
        : currentDaySchedule.length - 1;

  useEffect(() => {
    if (focusSlotIndex < 0) return;
    const focusSlot = currentDaySchedule[focusSlotIndex];
    if (!focusSlot) return;
    const node = scheduleSlotRefs.current[focusSlot.id];
    const list = scheduleListRef.current;
    if (!node || !list) return;

    const nodeTop = node.offsetTop;
    const nodeBottom = nodeTop + node.offsetHeight;
    const viewportTop = list.scrollTop;
    const viewportBottom = viewportTop + list.clientHeight;
    const isVisible = nodeTop >= viewportTop && nodeBottom <= viewportBottom;

    if (!isVisible) {
      const targetTop = nodeTop - (list.clientHeight - node.offsetHeight) / 2;
      const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTo({
        top: Math.min(Math.max(0, targetTop), maxTop),
        behavior: 'smooth',
      });
    }
  }, [today, currentSlotName, weeklySchedule, focusSlotIndex, currentDaySchedule, scheduleFocusTick]);

  const trimmedNotice = scheduleNotice.trim();
  const hasScheduleNotice = trimmedNotice.length > 0;
  const getNoticeTextClass = (text: string) => {
    const length = text.replace(/\s+/g, '').length;
    if (length <= 6) return 'text-[clamp(2.9rem,6.6vw,3.6rem)] leading-[1.08] tracking-[-0.02em]';
    if (length <= 10) return 'text-[clamp(2.45rem,5.7vw,3rem)] leading-[1.14] tracking-[-0.018em]';
    if (length <= 16) return 'text-[clamp(2.05rem,4.8vw,2.45rem)] leading-[1.24] tracking-[-0.012em]';
    if (length <= 24) return 'text-[clamp(1.78rem,3.95vw,2.08rem)] leading-[1.36] tracking-[-0.01em]';
    return 'text-[clamp(1.48rem,3vw,1.72rem)] leading-[1.48] tracking-[0em]';
  };
  const studentNoticeTextClass = getNoticeTextClass(trimmedNotice);
  const draftNoticeTextClass = getNoticeTextClass(noticeDraft);
  const shouldCenterNoticeText = trimmedNotice.replace(/\s+/g, '').length <= 12;
  const shouldCenterNoticeDraft = noticeDraft.trim().length > 0 && noticeDraft.replace(/\s+/g, '').length <= 12;
  const shouldShowNoticeCard = isEditingNotice || (isNoticeEnabled && hasScheduleNotice);
  const shouldShowNoticeHandle = !shouldShowNoticeCard;
  const noticeCardStyle = isEditingNotice
    ? { animation: 'noticeFadeIn 220ms ease-out' }
    : undefined;
  const noticeHandleToneClass = shouldShowNoticeCard ? 'notice-toggle-open' : 'notice-toggle-closed';
  const noticeHandleButtonClass = `notice-toggle ${noticeHandleToneClass} group relative inline-flex h-8 min-w-[3.2rem] items-center justify-center rounded-[1rem] border-2 px-2.5 transition-all hover:-translate-y-px active:translate-y-0`;
  const noticeHandleIconClass = `inline-flex h-5 min-w-[1.85rem] items-center justify-center rounded-full border ${shouldShowNoticeCard ? 'notice-toggle-icon-open' : 'notice-toggle-icon-closed'}`;
  const noticeHandleLineClass = `pointer-events-none absolute inset-x-1.5 top-[3px] h-px rounded-full ${shouldShowNoticeCard ? 'notice-toggle-line-open' : 'notice-toggle-line-closed'}`;
  const musicButtonLabel = isMusicPlaying ? '배경 음악 끄기' : '배경 음악 켜기';
  const scheduleSettingsPanel = (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <aside className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
        <section className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/80">
            Schedule
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-title text-[1.2rem] font-extrabold text-[#3F2B20]">요일 선택</h3>
            <div className="rounded-full border border-[#E6D5C9] bg-white px-3 py-1.5 text-[0.82rem] font-extrabold text-[#8A6347]">
              {activeWeekdayScheduleCount} / {WEEKDAYS.length}일 사용
            </div>
          </div>
          <p className="mt-2 text-[0.88rem] font-bold leading-6 text-[#8A6347]">
            편집할 요일을 먼저 고르면 오른쪽에서 바로 일정을 바꿀 수 있습니다.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-2">
            {[1, 2, 3, 4, 5].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setEditingDay(day)}
                className={`rounded-[1.1rem] px-3 py-3 text-center text-[0.95rem] font-extrabold transition-all ${
                  editingDay === day
                    ? 'bg-[#688772] text-white shadow-[0_12px_20px_rgba(82,107,73,0.2)]'
                    : 'border border-[#E6D5C9] bg-white text-[#8A6347] hover:border-[#CBB39D] hover:bg-[#FFF9F2]'
                }`}
              >
                {DAYS[day]}요일
              </button>
            ))}
          </div>

        </section>

        <section className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
          <h3 className="section-title text-[1.1rem] font-extrabold text-[#3F2B20]">학교 시계 보정</h3>
          <p className="mt-2 text-[0.88rem] font-bold leading-6 text-[#8A6347]">
            학교 종이 빠르면 `+`, 웹 시계가 빠르면 `-` 값을 넣습니다.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              type="number"
              min={-SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS}
              max={SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS}
              step={1}
              value={scheduleClockOffsetSeconds}
              onChange={(e) => setScheduleClockOffsetSeconds(clampScheduleClockOffsetSeconds(e.target.value))}
              className="slot-time-input w-24 rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-3 py-2 text-right font-mono text-base font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363]"
            />
            <span className="text-sm font-bold text-[#8A6347]">초</span>
          </label>
          <p className="mt-3 text-[0.82rem] font-bold leading-6 text-[#5C7A4B]">
            예: 학교 종이 10초 빠르면 <span className="font-mono font-bold">10</span>
          </p>
        </section>

        <section className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <h3 className="section-title text-[1.1rem] font-extrabold text-[#3F2B20]">빠른 작업</h3>
          <p className="mt-2 text-[0.88rem] font-bold leading-6 text-[#8A6347]">
            현재 요일 일정을 다른 평일로 한 번에 복사할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setShowCopyConfirm(true)}
            className="toolbar-button toolbar-button-green mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-[#5C8D5D] transition-colors"
          >
            다른 요일로 복사
          </button>
        </section>
      </aside>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/80">
                Editing
              </p>
              <h3 className="section-title mt-2 text-[1.35rem] font-extrabold text-[#3F2B20]">
                {DAYS[editingDay]}요일 일정
              </h3>
              <p className="mt-2 text-[0.9rem] font-bold leading-6 text-[#8A6347]">
                수업, 쉬는 시간, 점심시간 흐름을 이곳에서 정리합니다.
              </p>
            </div>
          </div>
        </div>

        {showCopyConfirm && (
          <div className="confirm-box flex flex-col items-center justify-between gap-4 rounded-xl border border-[#C65D47]/30 bg-[#FFF5F3] p-4 sm:flex-row">
            <span className="text-[#C65D47] font-bold text-sm">
              현재 요일의 일정을 다른 모든 평일(월~금)에 덮어쓰시겠습니까?
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowCopyConfirm(false)}
                className="toolbar-button toolbar-button-neutral rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347]"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setWeeklySchedule(prev => {
                    const current = prev[editingDay] || [];
                    const createCopy = () => normalizeDaySchedule(current.map(slot => ({ ...slot, id: createSlotId() })));
                    return {
                      ...prev,
                      1: editingDay === 1 ? current : createCopy(),
                      2: editingDay === 2 ? current : createCopy(),
                      3: editingDay === 3 ? current : createCopy(),
                      4: editingDay === 4 ? current : createCopy(),
                      5: editingDay === 5 ? current : createCopy(),
                    };
                  });
                  setShowCopyConfirm(false);
                }}
                className="toolbar-button toolbar-button-danger rounded-lg px-3 py-1.5 text-sm font-bold text-white"
              >
                복사하기
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5">
          <div className="space-y-3">
            {editingDaySchedule.length === 0 ? (
              <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-10 text-center font-medium text-[#8A6347]/60">
                일정이 없습니다.
              </div>
            ) : (
              editingDaySchedule.map((slot, index) => {
                const isMorningRow = index === 0;
                const isFixedDurationRow = !isMorningRow && (slot.type === 'class' || slot.type === 'break');
                return (
                  <div key={slot.id} className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-all hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
                    <input
                      type="text"
                      value={slot.name}
                      readOnly={isMorningRow}
                      onChange={(e) => updateSlot(editingDay, slot.id, 'name', e.target.value)}
                      className="slot-name-input -ml-2 min-w-[120px] flex-1 rounded-lg border-none bg-transparent px-2 py-1 text-base font-bold text-[#8A6347] outline-none focus:ring-2 focus:ring-[#5C8D5D]/20 md:text-lg"
                      placeholder="일정 이름"
                    />
                    <div className="mt-2 flex w-full items-center justify-between gap-2 lg:mt-0 lg:w-auto lg:justify-end">
                      <select
                        value={isMorningRow ? 'morning' : slot.type}
                        disabled={isMorningRow}
                        onChange={(e) => updateSlot(editingDay, slot.id, 'type', e.target.value)}
                        className="slot-select cursor-pointer rounded-xl border-none bg-[#F0F5F0] px-2 py-2 text-sm font-bold text-[#3A5A3B] outline-none transition-colors hover:bg-[#E2EFE2] md:px-3 md:text-base"
                      >
                        {isMorningRow && <option value="morning">{MORNING_ACTIVITY_LABEL}</option>}
                        <option value="class">수업</option>
                        <option value="break">쉬는시간</option>
                        <option value="lunch">점심시간</option>
                        <option value="none">기타</option>
                      </select>
                      <div className="flex shrink-0 items-center gap-1 md:gap-2">
                        <input
                          type="time"
                          value={formatMinutesToTime(slot.start)}
                          onChange={(e) => updateSlot(editingDay, slot.id, 'start', parseTimeToMinutes(e.target.value))}
                          className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                        />
                        <span className="text-[#8A6347] font-bold">-</span>
                        <input
                          type="time"
                          value={formatMinutesToTime(slot.end)}
                          disabled={isFixedDurationRow}
                          onChange={(e) => updateSlot(editingDay, slot.id, 'end', parseTimeToMinutes(e.target.value))}
                          className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                        />
                      </div>
                      <button
                        disabled={isMorningRow}
                        onClick={() => removeSlot(editingDay, slot.id)}
                        className="slot-delete shrink-0 rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="일정 삭제"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => addSlot(editingDay)}
            className="add-slot-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5C8D5D] py-4 text-lg font-bold text-[#5C8D5D] transition-all hover:bg-[#5C8D5D] hover:text-white"
          >
            <Plus size={24} />
            일정 추가
          </button>
        </div>
      </section>
    </div>
  );
  const drawSettingsPanel = (
    <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
      <section className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF5EE] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5 lg:sticky lg:top-0 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/80">
              Cases
            </p>
            <h3 className="section-title mt-2 text-[1.18rem] font-extrabold text-[#3F2B20]">상황 목록</h3>
          </div>
          <button
            type="button"
            onClick={addDrawSettingsCase}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#6F8A65] px-4 py-2.5 text-[0.92rem] font-bold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)]"
          >
            <Plus size={18} />
            추가
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {drawCases.map((caseState, index) => {
            const isSelected = caseState.id === selectedDrawSettingsCase.id;
            const displayLabel = normalizeCaseLabel(caseState.label, getCaseLabelByIndex(index));

            return (
              <article
                key={caseState.id}
                className={`rounded-[1.45rem] border-2 p-3 transition-colors ${
                  isSelected
                    ? 'border-[#B58363] bg-white shadow-[0_10px_20px_rgba(181,131,99,0.12)]'
                    : 'border-[#E8DCCD] bg-[rgba(255,252,247,0.88)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawSettingsCaseId(caseState.id)}
                    className="block flex-1 text-left"
                  >
                    <div className="text-[1rem] font-extrabold text-[#3F2B20] md:text-[1.08rem]">
                      {displayLabel}
                    </div>
                    <div className="mt-1.5 text-[0.88rem] font-bold leading-6 text-[#B58363]">
                      {getCaseSummaryLabel(caseState)}
                    </div>
                  </button>

                  {drawCases.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeDrawSettingsCase(caseState.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#B58363] transition-colors hover:bg-[#FFF6ED] hover:text-[#8A6347]"
                      aria-label={`${displayLabel} 삭제`}
                      title={`${displayLabel} 삭제`}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/80">
                Editing
              </p>
              <h3 className="section-title mt-2 text-[1.35rem] font-extrabold text-[#3F2B20]">
                {selectedDrawSettingsCaseLabel}
              </h3>
              <p className="mt-2 text-[0.9rem] font-bold leading-6 text-[#8A6347]">
                {getCaseSummaryLabel(selectedDrawSettingsCase)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetActiveDrawCase}
                disabled={isDrawLocked}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#DCCBB8] bg-white px-4 py-2 text-sm font-bold text-[#8A6347] transition-colors hover:border-[#CBB39D] hover:bg-[#FFF9F2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={15} />
                {activeDrawLabel} 초기화
              </button>
              <button
                type="button"
                onClick={() => setIsHiddenDrawSettingsVisible((previous) => !previous)}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  isHiddenDrawSettingsVisible || reservedDrawCount > 0
                    ? 'border-[#D5C0AB] bg-[#FFF3E5] text-[#8A6347] hover:border-[#C4AB93] hover:bg-[#FFECD7]'
                    : 'border-[#DCCBB8] bg-white text-[#8A6347] hover:border-[#CBB39D] hover:bg-[#FFF9F2]'
                }`}
                aria-pressed={isHiddenDrawSettingsVisible}
                aria-label={SECRET_DRAW_BUTTON_LABEL}
                title={SECRET_DRAW_BUTTON_LABEL}
              >
                <Sparkles size={15} />
                {SECRET_DRAW_BUTTON_LABEL}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                Range
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {selectedDrawSettingsBounds.minNumber} - {selectedDrawSettingsBounds.maxNumber}
              </div>
            </div>
            <div className="rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                Roster
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {assignedStudentNameCount} / {settingsStudentNumbers.length}
              </div>
            </div>
            <div className="rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                History
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {selectedDrawHistoryEntries.length} / {selectedDrawSettingsCaseData.totalCount}
              </div>
            </div>
            <div className="rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                Reserved
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {reservedDrawCount > 0 ? `${reservedDrawCount}개` : SECRET_DRAW_EMPTY_LABEL}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)]">
          <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
            <div className="grid gap-4">
              <label className="flex flex-col gap-2">
                <span className="section-title text-[0.95rem] font-bold text-[#B58363]">이름</span>
                <input
                  type="text"
                  value={selectedDrawSettingsCase.label}
                  onChange={(event) => updateDrawCaseLabel(selectedDrawSettingsCase.id, event.target.value)}
                  className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                  placeholder={getCaseLabelByIndex(Math.max(selectedDrawSettingsCaseIndex, 0))}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="section-title text-[0.95rem] font-bold text-[#B58363]">시작</span>
                  <input
                    type="number"
                    min={MIN_DRAW_NUMBER}
                    max={MAX_DRAW_NUMBER}
                    value={selectedDrawSettingsCase.rangeStart}
                    onChange={(event) =>
                      updateDrawCaseRange(
                        selectedDrawSettingsCase.id,
                        'rangeStart',
                        event.target.value,
                        selectedDrawSettingsCase.rangeStart,
                      )
                    }
                    className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-left font-mono text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="section-title text-[0.95rem] font-bold text-[#B58363]">끝</span>
                  <input
                    type="number"
                    min={MIN_DRAW_NUMBER}
                    max={MAX_DRAW_NUMBER}
                    value={selectedDrawSettingsCase.rangeEnd}
                    onChange={(event) =>
                      updateDrawCaseRange(
                        selectedDrawSettingsCase.id,
                        'rangeEnd',
                        event.target.value,
                        selectedDrawSettingsCase.rangeEnd,
                      )
                    }
                    className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-left font-mono text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="flex items-start justify-between gap-3">
              <div className="max-w-[32rem]">
                <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">재등장 연출</h4>
                <p className="mt-2 text-[0.92rem] font-bold leading-7 text-[#B58363]">
                  이미 뽑힌 번호를 1회 다시 등장시키는 연출을 켜거나 끕니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRepeatPickEnabled((previous) => !previous)}
                className={`relative inline-flex h-11 w-20 shrink-0 rounded-full transition-colors ${
                  repeatPickEnabled ? 'bg-[#6F9A58]' : 'bg-[#E6D5C9]'
                }`}
                aria-pressed={repeatPickEnabled}
                aria-label="재등장 연출"
              >
                <span
                  className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-all ${
                    repeatPickEnabled ? 'left-[2.55rem]' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3.5">
              <div className="text-[0.82rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                바로 추첨
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                키보드로 바로 추첨할 수 있습니다.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="max-w-[32rem]">
              <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">학생 명단</h4>
              <p className="mt-2 text-[0.92rem] font-bold leading-6 text-[#B58363]">
                줄바꿈 또는 번호 이름
              </p>
            </div>

            <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
              {assignedStudentNameCount} / {settingsStudentNumbers.length}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(15rem,18.5rem)_minmax(0,1fr)]">
            <div className="rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <label className="flex flex-col gap-2.5">
                <span className="section-title text-[0.92rem] font-bold text-[#B58363]">일괄 입력</span>
                <textarea
                  value={studentRosterBulkInput}
                  onChange={(event) => setStudentRosterBulkInput(event.target.value)}
                  className="min-h-[8.5rem] resize-y rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.92rem] font-bold leading-7 text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                  placeholder={`김민서\n이서연\n3 박도윤`}
                />
              </label>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
                <p className="text-[0.82rem] font-bold leading-6 text-[#B58363]/80">
                  범위 밖 번호 제외
                </p>
                <button
                  type="button"
                  onClick={applyBulkStudentRoster}
                  className="inline-flex items-center justify-center rounded-full bg-[#6F8A65] px-4 py-2 text-[0.88rem] font-extrabold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  반영
                </button>
              </div>
            </div>

            <div className="min-h-0">
              <div className="flex items-center justify-between gap-3">
                <h5 className="section-title text-[0.92rem] font-bold text-[#B58363]">개별 수정</h5>
                <span className="text-xs font-bold text-[#B58363]/70">Tab</span>
              </div>

              <div className="custom-scrollbar mt-3 max-h-[22rem] overflow-y-auto pr-1">
                <div className="grid gap-2.5">
                  {settingsStudentNumbers.map((studentNumber, index) => (
                    <label
                      key={studentNumber}
                      className="grid grid-cols-[4.2rem_minmax(0,1fr)] items-center gap-2 rounded-[1.05rem] border border-[#E6D5C9] bg-white/90 px-3 py-2.5"
                    >
                      <span className="inline-flex items-center justify-center rounded-full bg-[#F7E8D7] px-2 py-2 text-center font-mono text-sm font-extrabold text-[#8A6347]">
                        {studentNumber}
                      </span>
                      <input
                        ref={(node) => setRosterInputRef(studentNumber, node)}
                        type="text"
                        value={selectedDrawSettingsCase.studentNames[String(studentNumber)] ?? ''}
                        onChange={(event) =>
                          updateDrawStudentName(selectedDrawSettingsCase.id, studentNumber, event.target.value)
                        }
                        onKeyDown={(event) => handleRosterInputKeyDown(event, index)}
                        className="rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.95rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                        placeholder="학생 이름"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`grid gap-4 ${
            isHiddenDrawSettingsVisible ? 'xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)]' : ''
          }`}
        >
          <div className="random-history-panel rounded-[1.7rem] border border-[#EEE4D6] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="max-w-[32rem]">
                <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
                  {DRAWN_BALLS_SECTION_LABEL}
                </h4>
                <p className="mt-2 text-[0.92rem] font-bold leading-6 text-[#B58363]">
                  {DRAWN_BALLS_SECTION_DESCRIPTION}
                </p>
              </div>

              <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                {selectedDrawHistoryEntries.length} / {selectedDrawSettingsCaseData.totalCount}
              </div>
            </div>

            <div className="custom-scrollbar random-history-scroll mt-4 max-h-[17rem] overflow-y-auto pr-1">
              {selectedDrawHistoryEntries.length > 0 ? (
                <div className="random-history-grid">
                  {selectedDrawHistoryEntries.map((entry) => {
                    const isRepeatEntry = entry.kind === 'repeat';
                    const studentName = getStudentName(selectedDrawSettingsCase, entry.number);
                    const chipTitle =
                      studentName.length > 0
                        ? `${entry.number} ${studentName}${isRepeatEntry ? ' 재등장' : ''}`
                        : `${entry.number}${isRepeatEntry ? ' 재등장' : ''}`;

                    return (
                      <span
                        key={entry.id}
                        className={`random-history-chip${isRepeatEntry ? ' random-history-chip-repeat' : ''}`}
                        title={chipTitle}
                      >
                        <span className="random-history-chip-number">{entry.number}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-slot-state flex min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-[#E6D5C9] bg-white/60 text-center font-medium text-[#8A6347]/60">
                  {DRAWN_BALLS_EMPTY_LABEL}
                </div>
              )}
            </div>
          </div>

          {isHiddenDrawSettingsVisible ? (
            <div className="rounded-[1.7rem] border border-[#E6D8C9] bg-[#FBF2E9] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-[32rem]">
                  <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
                    {SECRET_DRAW_SECTION_LABEL}
                  </h4>
                  <p className="mt-2 text-[0.92rem] font-bold leading-7 text-[#B58363]">
                    {SECRET_DRAW_SECTION_DESCRIPTION}
                  </p>
                </div>

                <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                  {reservedDrawCount > 0 ? `${reservedDrawCount}개 예약` : SECRET_DRAW_EMPTY_LABEL}
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                <label className="flex flex-col gap-2.5">
                  <span className="section-title text-[0.92rem] font-bold text-[#B58363]">
                    {SECRET_DRAW_INPUT_LABEL}
                  </span>
                  <input
                    type="text"
                    value={hiddenDrawResultInput}
                    onChange={(event) => setHiddenDrawResultInput(event.target.value)}
                    className="rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.95rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                    placeholder="7, 12, 18"
                  />
                </label>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
                  <p className="text-[0.82rem] font-bold leading-6 text-[#B58363]/80">
                    {SECRET_DRAW_HINT}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={clearHiddenDrawResult}
                      className="inline-flex items-center justify-center rounded-full border border-[#D9C8B6] bg-[#FFF7EC] px-4 py-2 text-[0.84rem] font-extrabold text-[#8A6347] transition-colors hover:border-[#C9B19A] hover:bg-[#FFF2E3]"
                    >
                      {SECRET_DRAW_CLEAR_LABEL}
                    </button>
                    <button
                      type="button"
                      onClick={applyHiddenDrawResult}
                      className="inline-flex items-center justify-center rounded-full bg-[#6F8A65] px-4 py-2 text-[0.88rem] font-extrabold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {SECRET_DRAW_APPLY_LABEL}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <audio
        ref={backgroundMusicRef}
        src="/background_music.mp3"
        loop
        preload="auto"
        className="hidden"
        onCanPlay={() => setIsMusicAvailable(true)}
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
        onError={() => {
          setIsMusicAvailable(false);
          setIsMusicPlaying(false);
          setIsMusicLoading(false);
        }}
      />
      <div className={`mascot-shell editorial-main-shell relative flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] shadow-2xl transition-colors duration-1000 md:rounded-[3rem] ${bgClass}`}>
        <style>{`
          @keyframes noticeFadeIn {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
          @keyframes studentNoticeWobble {
            0%, 68%, 100% {
              transform: translate3d(0, 0, 0) rotate(-0.75deg);
            }
            74%, 78% {
              transform: translate3d(1px, -0.08px, 0) rotate(0.82deg);
            }
            82%, 86% {
              transform: translate3d(-1.3px, 0.1px, 0) rotate(-1.52deg);
            }
            90%, 94% {
              transform: translate3d(0.7px, -0.04px, 0) rotate(0.42deg);
            }
          }
          @keyframes drawOverlayFloat {
            0% {
              opacity: 0;
              transform: translate(-50%, -10px) scale(0.96);
            }
            100% {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
          }
          @keyframes drawOverlayPulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.02);
            }
          }
        `}</style>
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />
        <div className="editorial-home-layout flex-1 flex min-h-0 flex-col lg:grid lg:grid-cols-[minmax(0,1.36fr)_minmax(22.75rem,28rem)] xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,29.5rem)] 2xl:grid-cols-[minmax(0,1.56fr)_minmax(24.5rem,30rem)]">
          {/* Left: Timer Display */}
          <div className="timer-pane editorial-timer-pane relative flex h-full min-h-0 flex-col items-center justify-center p-4 md:p-6 lg:px-6 lg:py-7 xl:px-8 xl:py-8">
            <div className="absolute inset-x-4 top-4 z-40 flex items-start justify-between sm:inset-x-5 sm:top-5 md:inset-x-6 md:top-6">
              <button
                onClick={toggleBackgroundMusic}
                disabled={isMusicLoading}
                className={`sound-toggle timer-toolbar-button inline-flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center rounded-[1.45rem] transition-all sm:h-[3.55rem] sm:w-[3.55rem] sm:rounded-2xl ${
                  isMusicPlaying ? 'sound-toggle-active' : 'sound-toggle-inactive'
                } ${isMusicLoading ? 'cursor-not-allowed opacity-45' : ''}`}
                title={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
                aria-label={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
                type="button"
              >
                {isMusicPlaying ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawCaseMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="icon-button timer-toolbar-button inline-flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-[1.45rem] border border-[#E6D5C9] bg-white/92 text-[#8A6347]/70 shadow-[0_10px_20px_rgba(95,71,50,0.1)] backdrop-blur-sm transition-all hover:bg-white hover:text-[#8A6347] sm:h-[3.55rem] sm:w-[3.55rem] sm:rounded-2xl"
                title="설정"
                aria-label="설정"
              >
                <Settings size={21} />
              </button>
            </div>
            <div className={`timer-ring-stage editorial-ring-stage relative flex min-h-0 w-full flex-1 items-center justify-center ${pulseClass}`}>
              {isDrawOverlayVisible ? (
                <div
                  className="editorial-random-legacy-font pointer-events-none absolute inset-0 z-30"
                >
                  <div className="random-stage-shell flex h-full w-full items-center justify-center">
                    <div
                      className={`random-board-stage relative flex h-full w-full items-center justify-center${
                        isDrawOverlayEmpty ? ' random-board-stage-empty' : ''
                      }`}
                    >
                      {isDrawWinVisible ? <div aria-hidden="true" className="random-stage-win-flash" /> : null}
                      {isDrawRepeatVisible ? <div aria-hidden="true" className="random-stage-repeat-flash" /> : null}
                      {isDrawResetVisible ? <div aria-hidden="true" className="random-stage-reset-flash" /> : null}
                      <div className={drawOverlayBoardClass}>
                        {isDrawOverlayEmpty ? <div aria-hidden="true" className="random-board-empty-echo" /> : null}
                        {isDrawWinVisible ? <div aria-hidden="true" className="random-board-win-backflash" /> : null}
                        {isDrawWinVisible ? <div aria-hidden="true" className="random-board-win-glow" /> : null}
                        {isDrawWinVisible ? <div aria-hidden="true" className="random-board-win-shockwave" /> : null}
                        {isDrawWinVisible ? (
                          <div aria-hidden="true" className="random-board-win-shockwave random-board-win-shockwave-secondary" />
                        ) : null}
                        {isDrawWinVisible ? (
                          <div aria-hidden="true" className="random-board-win-shockwave random-board-win-shockwave-tertiary" />
                        ) : null}
                        {isDrawWinVisible ? (
                          <div aria-hidden="true" className="random-board-win-rays">
                            {Array.from({ length: 10 }, (_, index) => (
                              <span
                                key={`timer-draw-win-ray-${index}`}
                                className="random-board-win-ray"
                                style={{ '--win-ray-angle': `${index * 36}deg` } as React.CSSProperties}
                              />
                            ))}
                          </div>
                        ) : null}
                        {isDrawWinVisible ? (
                          <div aria-hidden="true" className="random-board-win-particles">
                            {NORMAL_WIN_PARTICLES.map((particle, index) => (
                              <span
                                key={`timer-draw-particle-${index}`}
                                className="random-board-win-particle"
                                style={
                                  {
                                    '--win-particle-angle': particle.angle,
                                    '--win-particle-distance': particle.distance,
                                    '--win-particle-size': particle.size,
                                    '--win-particle-delay': particle.delay,
                                  } as React.CSSProperties
                                }
                              />
                            ))}
                          </div>
                        ) : null}
                        {isDrawRepeatVisible ? <div aria-hidden="true" className="random-board-repeat-backflash" /> : null}
                        {isDrawRepeatVisible ? <div aria-hidden="true" className="random-board-repeat-glow" /> : null}
                        {isDrawRepeatVisible ? <div aria-hidden="true" className="random-board-shockwave" /> : null}
                        {isDrawRepeatVisible ? (
                          <div aria-hidden="true" className="random-board-shockwave random-board-shockwave-secondary" />
                        ) : null}
                        {isDrawRepeatVisible ? (
                          <div aria-hidden="true" className="random-board-shockwave random-board-shockwave-tertiary" />
                        ) : null}
                        {isDrawRepeatVisible ? <div aria-hidden="true" className="random-board-repeat-ring" /> : null}
                        {isDrawRepeatVisible ? (
                          <div aria-hidden="true" className="random-board-repeat-rays">
                            {Array.from({ length: 12 }, (_, index) => (
                              <span
                                key={`timer-draw-repeat-ray-${index}`}
                                className="random-board-repeat-ray"
                                style={{ '--repeat-ray-angle': `${index * 30}deg` } as React.CSSProperties}
                              />
                            ))}
                          </div>
                        ) : null}
                        {isDrawRepeatVisible ? (
                          <div aria-hidden="true" className="random-board-repeat-particles">
                            {NORMAL_WIN_PARTICLES.map((particle, index) => (
                              <span
                                key={`timer-draw-repeat-particle-${index}`}
                                className="random-board-repeat-particle"
                                style={
                                  {
                                    '--repeat-particle-angle': particle.angle,
                                    '--repeat-particle-distance': particle.distance,
                                    '--repeat-particle-size': particle.size,
                                    '--repeat-particle-delay': particle.delay,
                                  } as React.CSSProperties
                                }
                              />
                            ))}
                          </div>
                        ) : null}
                        {isDrawRepeatVisible ? (
                          <div aria-hidden="true" className="random-board-sparks">
                            {Array.from({ length: 8 }, (_, index) => (
                              <span
                                key={`timer-draw-spark-${index}`}
                                className="random-board-spark"
                                style={{ '--spark-angle': `${index * 45}deg` } as React.CSSProperties}
                              />
                            ))}
                          </div>
                        ) : null}
                        {isDrawResetVisible ? (
                          <div aria-hidden="true" className="random-board-reset-progress">
                            <svg viewBox="0 0 100 100" className="random-board-reset-progress-svg">
                              <circle className="random-board-reset-progress-track" cx="50" cy="50" r="46" />
                              <circle className="random-board-reset-progress-fill" cx="50" cy="50" r="46" />
                            </svg>
                          </div>
                        ) : null}
                        {isDrawResetVisible ? <div aria-hidden="true" className="random-board-reset-sweep" /> : null}
                        {isDrawResetVisible ? <div aria-hidden="true" className="random-board-reset-ring" /> : null}
                        {isDrawResetVisible ? (
                          <div aria-hidden="true" className="random-board-reset-particles">
                            {NORMAL_WIN_PARTICLES.map((particle, index) => (
                              <span
                                key={`timer-draw-reset-particle-${index}`}
                                className="random-board-reset-particle"
                                style={
                                  {
                                    '--reset-particle-angle': particle.angle,
                                    '--reset-particle-distance': particle.distance,
                                    '--reset-particle-size': particle.size,
                                    '--reset-particle-delay': particle.delay,
                                  } as React.CSSProperties
                                }
                              />
                            ))}
                          </div>
                        ) : null}
                        <span className={drawOverlayNumberClass}>
                          {drawOverlayText}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <svg viewBox="0 0 200 200" className="timer-ring-svg editorial-ring-svg aspect-square h-auto w-full max-h-full max-w-[45rem] -rotate-90 transform rounded-full xl:max-w-[54rem] 2xl:max-w-[58rem]">
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="#E6D5C9"
                  strokeWidth="100"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="100"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              {/* Character Notification Overlay (kept within the ring stage so it does not cover the timer text) */}
              <div className={`absolute inset-x-0 top-0 z-20 flex h-full items-center justify-center px-4 pb-6 pt-3 transition-all duration-500 md:pb-8 md:pt-4 ${showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                <div className="pointer-events-none flex flex-col items-center">
                  {/* Speech Bubble */}
                  <div className={`speech-card relative mb-4 max-w-[min(92vw,56rem)] rounded-3xl border-4 border-[#E6D5C9] bg-white text-center shadow-xl md:mb-6 ${speechBubbleSizeClass}`} style={characterMotionStyle}>
                    <p className={`font-bold whitespace-normal break-keep text-center ${speechTextSizeClass} ${colorClass}`}>{characterMessage}</p>
                    {/* Bubble Tail (pointing down) */}
                    <div className="speech-tail-fill absolute -bottom-[14px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-x-transparent border-t-[14px] border-t-white"></div>
                    <div className="speech-tail-outline absolute -bottom-[19px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[15px] border-x-transparent border-t-[17px] border-t-[#E6D5C9]"></div>
                  </div>

                  {/* Character Image or Placeholder */}
                  <div className={`mascot-figure-stage relative shrink-0 ${characterWrapSizeClass}`} style={characterMotionStyle}>
                    {characterImageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#8A6347]/40 bg-[#8A6347]/10 text-[#8A6347]/60">
                        <span className="mb-2 text-5xl md:text-7xl">?</span>
                        <span className="text-center text-sm font-bold leading-tight md:text-base">Character<br/>Area</span>
                      </div>
                    )}
                    <img
                      src="/character.png?v=20260301"
                      alt="character notification"
                      className={`absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl ${characterImageScaleClass}`}
                      referrerPolicy="no-referrer"
                      onLoad={() => setCharacterImageError(false)}
                      onError={(e) => {
                        // Fallback if image is not found
                        setCharacterImageError(true);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={`clock-display editorial-clock-display mt-2 shrink-0 text-[clamp(3.7rem,8.5vw,9.8rem)] leading-none font-bold tracking-tight transition-colors duration-1000 md:mt-3 xl:text-[clamp(4.1rem,7.8vw,10.2rem)] lg:mt-4 ${colorClass}`}>
              {formatTime(displayTimeLeft)}
            </div>
            <div className="timer-status-row relative z-10 mt-3 flex w-full max-w-[40rem] flex-wrap items-center justify-center gap-3 md:mt-4 xl:max-w-[45rem]">
              <div
                className={`status-medallion timer-primary-chip inline-flex min-h-[4.3rem] min-w-[13rem] items-center justify-center gap-3 rounded-full border-2 px-5 py-3 text-[clamp(1.2rem,2.8vw,1.85rem)] font-extrabold leading-none tracking-[-0.01em] ${scheduleTypeBadgeClass}`}
              >
                {timerType === 'break' ? <Coffee size={30} strokeWidth={2.3} /> : timerType === 'lunch' ? <Utensils size={30} strokeWidth={2.3} /> : timerType === 'class' || timerType === 'morning' ? <CalendarClock size={30} strokeWidth={2.3} /> : <Timer size={30} strokeWidth={2.3} />}
                <span className="min-w-0 truncate">{scheduleTypeLabel}</span>
              </div>
              {shouldShowCurrentSlotChip ? (
                <div className="timer-secondary-chip inline-flex min-h-[3.5rem] items-center justify-center rounded-full border border-[#E6D5C9] bg-white/86 px-4 py-2 text-base font-bold text-[#8A6347] shadow-[0_12px_24px_rgba(95,71,50,0.08)] backdrop-blur-sm">
                  {currentSlotName}
                </div>
              ) : null}
            </div>
            <div
              ref={drawCaseMenuRef}
              onPointerEnter={() => setIsDrawCaseSwitchNearby(true)}
              onPointerLeave={() => {
                if (!isDrawCaseMenuOpen) {
                  setIsDrawCaseSwitchNearby(false);
                }
              }}
              onFocusCapture={() => setIsDrawCaseSwitchNearby(true)}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                const menuNode = drawCaseMenuRef.current;
                if (menuNode?.contains(nextTarget)) return;
                if (!isDrawCaseMenuOpen) {
                  setIsDrawCaseSwitchNearby(false);
                }
              }}
              className="timer-draw-switch-shell absolute bottom-3 left-3 z-40 h-[5.4rem] w-[min(12rem,calc(100%-1.5rem))] overflow-visible sm:bottom-4 sm:left-4 sm:h-[5.7rem] md:bottom-5 md:left-5"
            >
              <div className="absolute bottom-0 left-0 w-[min(9.5rem,calc(100%-2rem))]">
                <button
                  type="button"
                  onClick={() => {
                    if (drawCases.length <= 1) return;
                    setIsDrawCaseMenuOpen((previous) => !previous);
                  }}
                  className={`timer-draw-switch inline-flex w-full items-center justify-between gap-1.5 rounded-[1rem] border border-[#E6D5C9] bg-white/90 px-2.5 py-2 text-left text-[0.74rem] font-extrabold text-[#8A6347] shadow-[0_8px_16px_rgba(95,71,50,0.07)] backdrop-blur-sm transition-all duration-200 ${
                    drawCases.length > 1 ? 'hover:border-[#D3BEA9] hover:bg-white' : 'cursor-default'
                  } ${
                    isDrawCaseSwitchVisible
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-2 opacity-0'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={drawCases.length > 1 ? isDrawCaseMenuOpen : undefined}
                  title="추첨 상황 선택"
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Sparkles size={12} className="shrink-0 text-[#A67C52]" />
                    <span className="truncate">{activeDrawLabel}</span>
                  </span>
                  {drawCases.length > 1 ? (
                    <ChevronDown
                      size={11}
                      className={`shrink-0 transition-transform ${isDrawCaseMenuOpen ? 'rotate-180' : ''}`}
                    />
                  ) : null}
                </button>

                {isDrawCaseMenuOpen ? (
                  <div
                    role="menu"
                    className="timer-draw-menu absolute bottom-[calc(100%+0.35rem)] left-0 right-0 rounded-[0.9rem] border border-[#E6D5C9] bg-white/96 p-1 shadow-[0_16px_30px_rgba(95,71,50,0.14)] backdrop-blur-sm"
                  >
                    {drawCases.map((caseState, index) => {
                      const caseLabel = normalizeCaseLabel(caseState.label, getCaseLabelByIndex(index));
                      const isActive = resolvedActiveDrawCaseId === caseState.id;

                      return (
                        <button
                          key={caseState.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActive}
                          onClick={() => selectActiveDrawCase(caseState.id)}
                          className={`timer-draw-menu-item flex w-full items-center justify-between rounded-[0.72rem] px-2 py-1.5 text-left text-[0.74rem] font-bold transition-colors ${
                            isActive ? 'bg-[#5C8D5D] text-white' : 'text-[#8A6347] hover:bg-[#FFF7EE]'
                          }`}
                        >
                          <span>{caseLabel}</span>
                          {isActive ? <Sparkles size={10} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          {/* Right: Controls & Presets */}
          <div className="control-pane editorial-control-pane relative flex min-h-0 w-full flex-col gap-4 overflow-hidden border-t border-[#E6D5C9]/50 p-5 sm:p-6 lg:w-auto lg:border-l lg:border-t-0 lg:px-7 lg:py-7 xl:px-8 xl:py-8">
            {shouldShowNoticeCard ? (
              <div
                className={`notice-card relative z-30 w-full overflow-visible rounded-[2.2rem] border-2 border-[#4F6B47] bg-[#FFFBF6] px-2.5 pb-2.5 pt-2.5 text-left shadow-[0_16px_30px_rgba(82,107,73,0.16)] ${isEditingNotice ? 'notice-card-editing' : 'notice-card-reading mb-[-3rem] sm:mb-[-3.55rem]'}`}
                style={noticeCardStyle}
              >
                {isEditingNotice ? (
                  <div className="notice-editor flex min-h-[8.2rem] items-center rounded-[1.8rem] border border-[#8FA384] bg-[#FFFDF8] px-2.5 py-2.5 transition-colors focus-within:border-[#5D7654] focus-within:ring-2 focus-within:ring-[#5D7654]/20 sm:min-h-[8.9rem]">
                    <textarea
                      ref={noticeInputRef}
                      value={noticeDraft}
                      onChange={(e) => setNoticeDraft(e.target.value)}
                      onBlur={handleNoticeBlur}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          saveNotice();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelNoticeEdit();
                        }
                      }}
                      rows={1}
                      maxLength={160}
                      className={`notice-draft-body block w-full resize-none overflow-hidden bg-transparent p-0 break-keep font-bold text-[#3E2D20] outline-none placeholder:text-[#6E8265]/72 ${shouldCenterNoticeDraft ? 'text-center' : 'text-left'} ${draftNoticeTextClass}`}
                    />
                  </div>
                ) : (
                  <>
                    <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[42%] flex-col items-center">
                      <button
                        onClick={() => setIsNoticeEnabled(false)}
                        className={noticeHandleButtonClass}
                        title="공지 닫기"
                        aria-label="공지 닫기"
                        type="button"
                      >
                        <span aria-hidden="true" className={noticeHandleLineClass} />
                        <span aria-hidden="true" className={noticeHandleIconClass}>
                          <ChevronDown size={10} strokeWidth={2.7} className="rotate-180" />
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={startNoticeEdit}
                      className="notice-content flex min-h-[8.2rem] w-full items-center rounded-[1.8rem] border border-[#8FA384] bg-[#FFFDF8] px-2.5 py-2.5 text-left transition-colors hover:bg-white sm:min-h-[8.9rem]"
                      title="공지 수정"
                      type="button"
                    >
                      <p className={`notice-text-body w-full break-keep whitespace-pre-line font-bold text-[#3E2D20] ${shouldCenterNoticeText ? 'text-center' : 'text-left'} ${studentNoticeTextClass}`}>
                        {trimmedNotice}
                      </p>
                    </button>
                  </>
                )}
              </div>
            ) : shouldShowNoticeHandle ? (
              <div className="relative h-0 w-full overflow-visible">
                <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[42%]">
                  <button
                    onClick={openNoticePanel}
                    className={noticeHandleButtonClass}
                    title={hasScheduleNotice ? '공지 열기' : '공지 편집 열기'}
                    aria-label={hasScheduleNotice ? '공지 열기' : '공지 편집 열기'}
                    type="button"
                  >
                    <span aria-hidden="true" className={noticeHandleLineClass} />
                    <span aria-hidden="true" className={noticeHandleIconClass}>
                      <ChevronDown size={10} strokeWidth={2.7} />
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`schedule-board schedule-board-compact editorial-schedule-board flex w-full min-h-[23rem] flex-1 flex-col rounded-[2.35rem] border-2 border-[#E6D5C9] bg-[#FDFBF7] p-4 text-left shadow-sm sm:min-h-[27rem] sm:p-5 lg:min-h-0 ${shouldShowNoticeCard && !isEditingNotice ? 'schedule-board-muted pt-14 sm:pt-16' : ''}`}>
                    {currentDaySchedule.length === 0 ? (
                      <div className="schedule-empty-state my-1 flex min-h-[15.5rem] flex-1 flex-col items-center justify-center gap-3 rounded-[1.9rem] border border-dashed border-[#D8C7B4] bg-white/62 px-5 py-8 text-center text-[#8A6347]/74 sm:min-h-[18rem]">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F8F1] text-[#6B8B63] shadow-inner shadow-[#E8F0E4]">
                          <CalendarClock size={26} />
                        </div>
                        <p className="text-[1.55rem] font-bold leading-tight text-[#B89E87] sm:text-[1.8rem]">일정이 없습니다.</p>
                      </div>
                    ) : (
                      <ul ref={scheduleListRef} className="schedule-scroll schedule-scroll-stack custom-scrollbar min-h-[15rem] flex-1 overflow-y-auto pr-2 text-base text-[#8A6347]/90 sm:min-h-[18rem] lg:min-h-0 lg:text-lg">
                        {currentDaySchedule.map((s) => {
                          const isThisSlot = currentMinsForScheduleView >= s.start && currentMinsForScheduleView < s.end;

                          return (
                            <li
                              key={s.id}
                              ref={(el) => {
                                scheduleSlotRefs.current[s.id] = el;
                              }}
                              className={`schedule-row schedule-row-spacious flex items-center justify-between rounded-xl transition-colors ${isThisSlot ? 'schedule-row-active font-bold text-white shadow-md' : 'schedule-row-idle'}`}
                            >
                              <span className="schedule-row-title font-semibold">{s.name}</span>
                              <span className="schedule-row-time font-mono">{formatMinutesToTime(s.start)} - {formatMinutesToTime(s.end)}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
            </div>

            <div className="schedule-quick-actions editorial-quick-actions grid w-full shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <div ref={manualTimerMenuRef} className="relative min-w-0">
                {isExtraTimerVisible ? (
                  <div className="absolute bottom-full left-0 z-30 mb-3 w-[20rem] max-w-[calc(100vw-2.5rem)] rounded-[1.6rem] border border-[#E6D5C9] bg-[#FFFCF7]/96 p-4 shadow-[0_22px_44px_rgba(95,71,50,0.16)] backdrop-blur-sm sm:w-[22rem] md:w-[24rem]">
                    <div className="rounded-[1.45rem] border border-[#E6D5C9] bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <div className="flex items-end justify-between gap-3">
                        <div className={`font-mono text-[clamp(2.1rem,5vw,3rem)] font-bold leading-none tracking-tight ${manualClockClass}`}>
                          {formatTime(manualTimeLeft)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleTimer}
                            className={`round-action flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95 ${
                              manualIsRunning ? 'round-action-pause' : 'round-action-play'
                            }`}
                            type="button"
                            title={manualIsRunning ? '보조 타이머 일시정지' : '보조 타이머 시작'}
                          >
                            {manualIsRunning ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                          </button>
                          <button
                            onClick={resetTimer}
                            className="round-action round-action-reset flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8A6347] shadow-md transition-transform hover:scale-105 active:scale-95"
                            type="button"
                            title="보조 타이머 초기화"
                          >
                            <RotateCcw size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EDE2D7]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${manualIsRunning ? 'bg-[#7DA36C]' : isManualFinished ? 'bg-[#D37C68]' : 'bg-[#B68A67]'}`}
                          style={{ width: `${manualProgress * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {MANUAL_TIMER_PRESETS.map((preset) => (
                        <button
                          key={preset.seconds}
                          onClick={() => applyManualPreset(preset.seconds)}
                          className="rounded-2xl border border-[#E6D5C9] bg-white px-3 py-2 text-sm font-bold text-[#8A6347] transition-colors hover:border-[#D5C0AD] hover:bg-[#FFF9F2]"
                          type="button"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-3">
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          value={customMinutes}
                          onChange={(e) => handleCustomMinutesChange(e.target.value)}
                          className="time-input w-20 rounded-xl border border-[#E6D5C9] bg-white px-2 py-3 text-center font-mono text-2xl font-bold text-[#8A6347] outline-none transition-all focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
                          min="0"
                          max="999"
                        />
                        <span className="mt-1 text-sm font-bold text-[#8A6347]/70">분</span>
                      </div>
                      <span className="mb-6 text-2xl font-bold text-[#8A6347]">:</span>
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          value={customSeconds}
                          onChange={(e) => handleCustomSecondsChange(e.target.value)}
                          className="time-input w-20 rounded-xl border border-[#E6D5C9] bg-white px-2 py-3 text-center font-mono text-2xl font-bold text-[#8A6347] outline-none transition-all focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
                          min="0"
                          max="59"
                        />
                        <span className="mt-1 text-sm font-bold text-[#8A6347]/70">초</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setIsDrawCaseMenuOpen(false);
                    setIsExtraTimerVisible((previous) => !previous);
                  }}
                  className={`manual-timer-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] border p-3 text-center text-[#8A6347] shadow-[0_14px_28px_rgba(95,71,50,0.1)] transition-all ${
                    manualIsRunning
                      ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]'
                      : 'border-[#E6D5C9] bg-white/96 hover:border-[#D3BEA9] hover:bg-white'
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={isExtraTimerVisible}
                  aria-label="보조 타이머"
                  title="보조 타이머"
                >
                  <span className="announcement-launch-icon manual-timer-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                    <Timer size={22} className={manualClockClass} />
                  </span>
                </button>
              </div>
              <button
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsMemoOpen(true);
                }}
                className="announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all"
                aria-label="메모장"
                title="메모장"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <StickyNote size={22} />
                </div>
              </button>
              <button
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsDictionaryOpen(true);
                }}
                className="announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all"
                aria-label="낱말 사전"
                title="낱말 사전"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <Search size={22} />
                </div>
              </button>
              <button
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsAnnouncementOpen(true);
                }}
                className="announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all"
                aria-label="알림장"
                title="알림장"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <NotebookText size={22} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-8">
          <div className="settings-dialog editorial-settings-dialog flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-[#E6D5C9] bg-[#FDFBF7] shadow-2xl">
            <div className="settings-header flex shrink-0 items-center justify-between border-b border-[#E6D5C9] bg-white p-5 md:p-6">
              <h2 className="section-title flex items-center gap-2 text-xl font-bold text-[#8A6347] md:text-2xl">
                <Settings size={24} className="md:w-7 md:h-7" />
                시간표/추첨 설정
              </h2>
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={exportSchedule}
                  className="toolbar-button toolbar-button-green flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-[#5C8D5D] transition-colors"
                  title="시간표 내보내기"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">백업</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="toolbar-button toolbar-button-neutral flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347] transition-colors"
                  title="시간표 불러오기"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">복구</span>
                </button>
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  onChange={importSchedule} 
                  className="hidden" 
                />

                <div className="w-px h-6 bg-[#E6D5C9] mx-1"></div>
                
                <button onClick={() => setIsSettingsOpen(false)} className="icon-button rounded-full p-2 text-[#8A6347]/60 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347]">
                  <X size={24} className="md:w-7 md:h-7" />
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-[#E6D5C9] bg-white/80 px-4 py-3 md:px-6">
              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSettingsPanel('schedule')}
                  className={`rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'schedule'
                      ? 'border-[#6F9A58] bg-[#ECF5E9] shadow-[0_12px_24px_rgba(95,125,102,0.12)]'
                      : 'border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'schedule'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <CalendarClock size={18} className={settingsPanel === 'schedule' ? 'text-[#476152]' : 'text-[#8A6347]'} />
                    시간표
                  </div>
                  <p className="mt-1.5 text-[0.86rem] font-bold leading-6 text-[#8A6347]">
                    요일별 일정과 학교 시계 보정을 편집합니다.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsPanel('draw')}
                  className={`rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'draw'
                      ? 'border-[#B58363] bg-[#FBF0E4] shadow-[0_12px_24px_rgba(181,131,99,0.12)]'
                      : 'border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'draw'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <Sparkles size={18} className={settingsPanel === 'draw' ? 'text-[#B58363]' : 'text-[#8A6347]'} />
                    추첨
                  </div>
                  <p className="mt-1.5 text-[0.86rem] font-bold leading-6 text-[#8A6347]">
                    상황, 번호 범위, 명단과 예약 결과를 관리합니다.
                  </p>
                </button>
              </div>
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
              {settingsPanel === 'schedule' ? scheduleSettingsPanel : drawSettingsPanel}
            </div>
             
            {false && (
              <>
                <div className="tab-strip custom-scrollbar flex shrink-0 overflow-x-auto border-b border-[#E6D5C9] bg-white">
              {[1, 2, 3, 4, 5].map(day => (
                <button
                  key={day}
                  onClick={() => setEditingDay(day)}
                  className={`day-tab min-w-[80px] flex-1 py-3 text-base font-bold transition-colors md:py-4 md:text-lg ${
                    editingDay === day ? 'day-tab-active text-white' : 'day-tab-inactive text-[#8A6347]'
                  }`}
                >
                  {DAYS[day]}요일
                </button>
              ))}
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
              <div className="mb-5 rounded-2xl border border-[#E6D5C9] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="section-title text-lg font-bold text-[#8A6347]">학교 시계 보정</h3>
                    <p className="mt-1 text-sm text-[#8A6347]/70">
                      학교 종이 빠르면 +, 웹이 빠르면 -
                    </p>
                  </div>
                  <label className="flex items-center gap-2 self-start md:self-auto">
                    <input
                      type="number"
                      min={-SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS}
                      max={SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS}
                      step={1}
                      value={scheduleClockOffsetSeconds}
                      onChange={(e) => setScheduleClockOffsetSeconds(clampScheduleClockOffsetSeconds(e.target.value))}
                      className="slot-time-input w-24 rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-3 py-2 text-right font-mono text-base font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363]"
                    />
                    <span className="text-sm font-bold text-[#8A6347]">초</span>
                  </label>
                </div>
                <p className="mt-3 text-sm text-[#5C7A4B]">
                  예: 학교 종이 10초 빠르면 <span className="font-mono font-bold">10</span>
                </p>
              </div>

              <div className="flex justify-between items-center mb-4">
                <h3 className="section-title text-lg font-bold text-[#8A6347]">{DAYS[editingDay]}요일 일정</h3>
                <button 
                  onClick={() => setShowCopyConfirm(true)}
                  className="toolbar-button toolbar-button-green rounded-lg px-3 py-1.5 text-sm font-bold text-[#5C8D5D] transition-colors"
                >
                  다른 요일로 복사
                </button>
              </div>

              {showCopyConfirm && (
                <div className="confirm-box mb-4 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#C65D47]/30 bg-[#FFF5F3] p-4 sm:flex-row">
                  <span className="text-[#C65D47] font-bold text-sm">
                    현재 요일의 일정을 다른 모든 평일(월~금)에 덮어쓰시겠습니까?
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => setShowCopyConfirm(false)}
                      className="toolbar-button toolbar-button-neutral rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347]"
                    >
                      취소
                    </button>
                    <button 
                      onClick={() => {
                        setWeeklySchedule(prev => {
                          const current = prev[editingDay] || [];
                          const createCopy = () => normalizeDaySchedule(current.map(slot => ({ ...slot, id: createSlotId() })));
                          return {
                            ...prev,
                            1: editingDay === 1 ? current : createCopy(),
                            2: editingDay === 2 ? current : createCopy(),
                            3: editingDay === 3 ? current : createCopy(),
                            4: editingDay === 4 ? current : createCopy(),
                            5: editingDay === 5 ? current : createCopy(),
                          };
                        });
                        setShowCopyConfirm(false);
                      }}
                      className="toolbar-button toolbar-button-danger rounded-lg px-3 py-1.5 text-sm font-bold text-white"
                    >
                      복사하기
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(weeklySchedule[editingDay] || []).length === 0 ? (
                  <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-10 text-center font-medium text-[#8A6347]/60">
                    일정이 없습니다.
                  </div>
                ) : (
                  (weeklySchedule[editingDay] || []).map((slot, index) => {
                    const isMorningRow = index === 0;
                    const isFixedDurationRow = !isMorningRow && (slot.type === 'class' || slot.type === 'break');
                    return (
                    <div key={slot.id} className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-all hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
                      <input
                        type="text"
                        value={slot.name}
                        readOnly={isMorningRow}
                        onChange={(e) => updateSlot(editingDay, slot.id, 'name', e.target.value)}
                        className="slot-name-input -ml-2 min-w-[120px] flex-1 rounded-lg border-none bg-transparent px-2 py-1 text-base font-bold text-[#8A6347] outline-none focus:ring-2 focus:ring-[#5C8D5D]/20 md:text-lg"
                        placeholder="일정 이름"
                      />
                      <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end mt-2 lg:mt-0">
                        <select
                          value={isMorningRow ? 'morning' : slot.type}
                          disabled={isMorningRow}
                          onChange={(e) => updateSlot(editingDay, slot.id, 'type', e.target.value)}
                          className="slot-select cursor-pointer rounded-xl border-none bg-[#F0F5F0] px-2 py-2 text-sm font-bold text-[#3A5A3B] outline-none transition-colors hover:bg-[#E2EFE2] md:px-3 md:text-base"
                        >
                          {isMorningRow && <option value="morning">{MORNING_ACTIVITY_LABEL}</option>}
                          <option value="class">수업</option>
                          <option value="break">쉬는시간</option>
                          <option value="lunch">점심시간</option>
                          <option value="none">기타</option>
                        </select>
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                          <input
                            type="time"
                            value={formatMinutesToTime(slot.start)}
                            onChange={(e) => updateSlot(editingDay, slot.id, 'start', parseTimeToMinutes(e.target.value))}
                            className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                          />
                          <span className="text-[#8A6347] font-bold">-</span>
                          <input
                            type="time"
                            value={formatMinutesToTime(slot.end)}
                            disabled={isFixedDurationRow}
                            onChange={(e) => updateSlot(editingDay, slot.id, 'end', parseTimeToMinutes(e.target.value))}
                            className="slot-time-input cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-2 py-2 font-mono text-sm font-bold text-[#8A6347] outline-none transition-colors hover:border-[#B58363] md:px-3 md:text-base"
                          />
                        </div>
                        <button
                          disabled={isMorningRow}
                          onClick={() => removeSlot(editingDay, slot.id)}
                          className="slot-delete shrink-0 rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                          title="일정 삭제"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )})
                )}
              </div>
              
              <button
                onClick={() => addSlot(editingDay)}
                className="add-slot-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5C8D5D] py-4 text-lg font-bold text-[#5C8D5D] transition-all hover:bg-[#5C8D5D] hover:text-white"
              >
                <Plus size={24} />
                일정 추가
              </button>

              <div className="mt-8 border-t border-[#E6D5C9] pt-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="section-title text-xl font-bold text-[#8A6347]">추첨 설정</h3>
                    <p className="mt-1 text-sm text-[#8A6347]/70">
                      상황, 범위, 명단
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resetActiveDrawCase}
                      disabled={isDrawLocked}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#DCCBB8] bg-white px-4 py-2 text-sm font-bold text-[#8A6347] transition-colors hover:border-[#CBB39D] hover:bg-[#FFF9F2] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw size={15} />
                      {activeDrawLabel} 초기화
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHiddenDrawSettingsVisible((previous) => !previous)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                        isHiddenDrawSettingsVisible || reservedDrawCount > 0
                          ? 'border-[#D5C0AB] bg-[#FFF3E5] text-[#8A6347] hover:border-[#C4AB93] hover:bg-[#FFECD7]'
                          : 'border-[#DCCBB8] bg-white text-[#8A6347] hover:border-[#CBB39D] hover:bg-[#FFF9F2]'
                      }`}
                      aria-pressed={isHiddenDrawSettingsVisible}
                      aria-label={SECRET_DRAW_BUTTON_LABEL}
                      title={SECRET_DRAW_BUTTON_LABEL}
                    >
                      <Sparkles size={15} />
                      {SECRET_DRAW_BUTTON_LABEL}
                    </button>
                    <div className="inline-flex items-center justify-center rounded-full border border-[#DCCBB8] bg-white px-4 py-2 text-sm font-bold text-[#8A6347]">
                      {DRAW_SHORTCUT_LABEL}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
                  <section className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF5EE] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">상황</h4>
                      <button
                        type="button"
                        onClick={addDrawSettingsCase}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#6F8A65] px-4 py-2.5 text-[0.92rem] font-bold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)]"
                      >
                        <Plus size={18} />
                        추가
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {drawCases.map((caseState, index) => {
                        const isSelected = caseState.id === selectedDrawSettingsCase.id;
                        const displayLabel = normalizeCaseLabel(caseState.label, getCaseLabelByIndex(index));

                        return (
                          <article
                            key={caseState.id}
                            className={`rounded-[1.45rem] border-2 p-3 transition-colors ${
                              isSelected
                                ? 'border-[#B58363] bg-white shadow-[0_10px_20px_rgba(181,131,99,0.12)]'
                                : 'border-[#E8DCCD] bg-[rgba(255,252,247,0.88)]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => setDrawSettingsCaseId(caseState.id)}
                                className="block flex-1 text-left"
                              >
                                <div className="text-[1rem] font-extrabold text-[#3F2B20] md:text-[1.08rem]">
                                  {displayLabel}
                                </div>
                                <div className="mt-1.5 text-[0.88rem] font-bold leading-6 text-[#B58363]">
                                  {getCaseSummaryLabel(caseState)}
                                </div>
                              </button>

                              {drawCases.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeDrawSettingsCase(caseState.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#B58363] transition-colors hover:bg-[#FFF6ED] hover:text-[#8A6347]"
                                  aria-label={`${displayLabel} 삭제`}
                                  title={`${displayLabel} 삭제`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="flex flex-col gap-4">
                    <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
                      <div className="grid gap-4">
                        <label className="flex flex-col gap-2">
                          <span className="section-title text-[0.95rem] font-bold text-[#B58363]">이름</span>
                          <input
                            type="text"
                            value={selectedDrawSettingsCase.label}
                            onChange={(event) => updateDrawCaseLabel(selectedDrawSettingsCase.id, event.target.value)}
                            className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                            placeholder={getCaseLabelByIndex(Math.max(selectedDrawSettingsCaseIndex, 0))}
                          />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="section-title text-[0.95rem] font-bold text-[#B58363]">시작</span>
                            <input
                              type="number"
                              min={MIN_DRAW_NUMBER}
                              max={MAX_DRAW_NUMBER}
                              value={selectedDrawSettingsCase.rangeStart}
                              onChange={(event) =>
                                updateDrawCaseRange(
                                  selectedDrawSettingsCase.id,
                                  'rangeStart',
                                  event.target.value,
                                  selectedDrawSettingsCase.rangeStart,
                                )
                              }
                              className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-left font-mono text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                            />
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="section-title text-[0.95rem] font-bold text-[#B58363]">끝</span>
                            <input
                              type="number"
                              min={MIN_DRAW_NUMBER}
                              max={MAX_DRAW_NUMBER}
                              value={selectedDrawSettingsCase.rangeEnd}
                              onChange={(event) =>
                                updateDrawCaseRange(
                                  selectedDrawSettingsCase.id,
                                  'rangeEnd',
                                  event.target.value,
                                  selectedDrawSettingsCase.rangeEnd,
                                )
                              }
                              className="rounded-[1.1rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3.5 text-left font-mono text-[1rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="max-w-[32rem]">
                          <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">학생 명단</h4>
                          <p className="mt-2 text-[0.92rem] font-bold leading-6 text-[#B58363]">
                            줄바꿈 또는 번호 이름
                          </p>
                        </div>

                        <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                          {assignedStudentNameCount} / {settingsStudentNumbers.length}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(15rem,18.5rem)_minmax(0,1fr)]">
                        <div className="rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                          <label className="flex flex-col gap-2.5">
                            <span className="section-title text-[0.92rem] font-bold text-[#B58363]">일괄 입력</span>
                            <textarea
                              value={studentRosterBulkInput}
                              onChange={(event) => setStudentRosterBulkInput(event.target.value)}
                              className="min-h-[8.5rem] resize-y rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.92rem] font-bold leading-7 text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                              placeholder={`김민서\n이서연\n3 박도윤`}
                            />
                          </label>
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
                            <p className="text-[0.82rem] font-bold leading-6 text-[#B58363]/80">
                              범위 밖 번호 제외
                            </p>
                            <button
                              type="button"
                              onClick={applyBulkStudentRoster}
                              className="inline-flex items-center justify-center rounded-full bg-[#6F8A65] px-4 py-2 text-[0.88rem] font-extrabold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                              반영
                            </button>
                          </div>
                        </div>

                        <div className="min-h-0">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="section-title text-[0.92rem] font-bold text-[#B58363]">개별 수정</h5>
                            <span className="text-xs font-bold text-[#B58363]/70">Tab</span>
                          </div>

                          <div className="custom-scrollbar mt-3 max-h-[22rem] overflow-y-auto pr-1">
                            <div className="grid gap-2.5">
                              {settingsStudentNumbers.map((studentNumber, index) => (
                                <label
                                  key={studentNumber}
                                  className="grid grid-cols-[4.2rem_minmax(0,1fr)] items-center gap-2 rounded-[1.05rem] border border-[#E6D5C9] bg-white/90 px-3 py-2.5"
                                >
                                  <span className="inline-flex items-center justify-center rounded-full bg-[#F7E8D7] px-2 py-2 text-center font-mono text-sm font-extrabold text-[#8A6347]">
                                    {studentNumber}
                                  </span>
                                  <input
                                    ref={(node) => setRosterInputRef(studentNumber, node)}
                                    type="text"
                                    value={selectedDrawSettingsCase.studentNames[String(studentNumber)] ?? ''}
                                    onChange={(event) =>
                                      updateDrawStudentName(selectedDrawSettingsCase.id, studentNumber, event.target.value)
                                    }
                                    onKeyDown={(event) => handleRosterInputKeyDown(event, index)}
                                    className="rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.95rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                                    placeholder="학생 이름"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="random-history-panel rounded-[1.7rem] border border-[#EEE4D6] p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="max-w-[32rem]">
                          <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
                            {DRAWN_BALLS_SECTION_LABEL}
                          </h4>
                          <p className="mt-2 text-[0.92rem] font-bold leading-6 text-[#B58363]">
                            {DRAWN_BALLS_SECTION_DESCRIPTION}
                          </p>
                        </div>

                        <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                          {selectedDrawHistoryEntries.length} / {selectedDrawSettingsCaseData.totalCount}
                        </div>
                      </div>

                      <div className="custom-scrollbar random-history-scroll mt-4 max-h-[17rem] overflow-y-auto pr-1">
                        {selectedDrawHistoryEntries.length > 0 ? (
                          <div className="random-history-grid">
                            {selectedDrawHistoryEntries.map((entry) => {
                              const isRepeatEntry = entry.kind === 'repeat';
                              const studentName = getStudentName(selectedDrawSettingsCase, entry.number);
                              const chipTitle =
                                studentName.length > 0
                                  ? `${entry.number} ${studentName}${isRepeatEntry ? ' 재등장' : ''}`
                                  : `${entry.number}${isRepeatEntry ? ' 재등장' : ''}`;

                              return (
                                <span
                                  key={entry.id}
                                  className={`random-history-chip${isRepeatEntry ? ' random-history-chip-repeat' : ''}`}
                                  title={chipTitle}
                                >
                                  <span className="random-history-chip-number">{entry.number}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="empty-slot-state flex min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-[#E6D5C9] bg-white/60 text-center font-medium text-[#8A6347]/60">
                            {DRAWN_BALLS_EMPTY_LABEL}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="max-w-[32rem]">
                          <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">재등장</h4>
                          <p className="mt-2 text-[0.92rem] font-bold leading-7 text-[#B58363]">
                            이미 뽑힌 번호 1회 재등장
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setRepeatPickEnabled((previous) => !previous)}
                          className={`relative inline-flex h-11 w-20 shrink-0 rounded-full transition-colors ${
                            repeatPickEnabled ? 'bg-[#6F9A58]' : 'bg-[#E6D5C9]'
                          }`}
                          aria-pressed={repeatPickEnabled}
                          aria-label="재등장 연출"
                        >
                          <span
                            className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-all ${
                              repeatPickEnabled ? 'left-[2.55rem]' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {isHiddenDrawSettingsVisible ? (
                      <div className="rounded-[1.7rem] border border-[#E6D8C9] bg-[#FBF2E9] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-[32rem]">
                            <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
                              {SECRET_DRAW_SECTION_LABEL}
                            </h4>
                            <p className="mt-2 text-[0.92rem] font-bold leading-7 text-[#B58363]">
                              {SECRET_DRAW_SECTION_DESCRIPTION}
                            </p>
                          </div>

                          <div className="rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                            {reservedDrawCount > 0 ? `${reservedDrawCount}개 예약` : SECRET_DRAW_EMPTY_LABEL}
                          </div>
                        </div>

                        <div className="mt-4 rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                          <label className="flex flex-col gap-2.5">
                            <span className="section-title text-[0.92rem] font-bold text-[#B58363]">
                              {SECRET_DRAW_INPUT_LABEL}
                            </span>
                            <input
                              type="text"
                              value={hiddenDrawResultInput}
                              onChange={(event) => setHiddenDrawResultInput(event.target.value)}
                              className="rounded-[1.05rem] border-2 border-[#E4D9CB] bg-[#FCF8F1] px-4 py-3 text-[0.95rem] font-extrabold text-[#3F2B20] outline-none transition-colors hover:border-[#CFB8A1] focus:border-[#B58363]"
                              placeholder="7, 12, 18"
                            />
                          </label>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
                            <p className="text-[0.82rem] font-bold leading-6 text-[#B58363]/80">
                              {SECRET_DRAW_HINT}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={clearHiddenDrawResult}
                                className="inline-flex items-center justify-center rounded-full border border-[#D9C8B6] bg-[#FFF7EC] px-4 py-2 text-[0.84rem] font-extrabold text-[#8A6347] transition-colors hover:border-[#C9B19A] hover:bg-[#FFF2E3]"
                              >
                                {SECRET_DRAW_CLEAR_LABEL}
                              </button>
                              <button
                                type="button"
                                onClick={applyHiddenDrawResult}
                                className="inline-flex items-center justify-center rounded-full bg-[#6F8A65] px-4 py-2 text-[0.88rem] font-extrabold text-white shadow-[0_10px_18px_rgba(95,133,79,0.16)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                              >
                                {SECRET_DRAW_APPLY_LABEL}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>
              </div>

                </div>
              </>
            )}
          </div>
        </div>
      )}
      <AnnouncementNotebookOverlay
        isOpen={isAnnouncementOpen}
        onClose={() => setIsAnnouncementOpen(false)}
        liveTimer={{
          isVisible: true,
          timeText: formatTime(displayTimeLeft),
          progress: displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0,
          timerType,
          timerTypeLabel: scheduleTypeLabel,
          currentSlotName,
        }}
      />
      <MemoNotebookOverlay
        isOpen={isMemoOpen}
        onClose={() => setIsMemoOpen(false)}
        liveTimer={{
          isVisible: true,
          timeText: formatTime(displayTimeLeft),
          progress: displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0,
          timerType,
          timerTypeLabel: scheduleTypeLabel,
          currentSlotName,
        }}
      />
      <DictionaryNotebookOverlay
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
        liveTimer={{
          isVisible: true,
          timeText: formatTime(displayTimeLeft),
          progress: displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0,
          timerType,
          timerTypeLabel: scheduleTypeLabel,
          currentSlotName,
        }}
      />
    </div>
  );
}


