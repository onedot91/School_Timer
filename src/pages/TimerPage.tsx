import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowUp, BookOpen, CalendarClock, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Coffee, Coins, Copy, Download, Gamepad2, GripVertical, Hammer, HeartHandshake, HeartPulse, LetterText, Lock, Mail, MessageCircleQuestion, Music, NotebookText, Package, Pause, PersonStanding, Play, Plus, Reply, RotateCcw, Search, Send, Settings, Sparkles, Star, StickyNote, Timer, Trash2, Trophy, Upload, Users, Utensils, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';
import { animate as animateMotion, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
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
  isStudentDrawShortcutKey,
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
  type SavedRandomDrawState,
} from '../lib/randomDraw';
import {
  type AnnouncementNoteRecord,
  isSupabaseSettingsEnabled,
  loadAnnouncementNote,
  loadAnnouncementNoteHistory,
  loadSharedSettingsRow,
  saveAnnouncementNote,
  updateSharedSettings,
} from '../lib/supabaseSettings';
import {
  getAuctionAwardKeys,
  getWeeklyMissionRewardIds,
  mergeConcurrentCurrencyUpdatesIntoSettings,
} from '../lib/weeklyMission';
import { playAuctionSound } from '../lib/auctionAudio';
import {
  normalizeClassDonationSettings,
  type ClassDonationSettings,
} from '../lib/classDonation';
import { useModalFocus } from '../lib/useModalFocus';
import {
  STUDENT_EMOTION_ZONES,
  getKoreanLocalDateKey,
  getStudentEmotion,
  getStudentEmotionEntries,
  getTodayStudentEmotionEntry,
  loadStoredStudentEmotionHistory,
  normalizeStudentEmotionHistory,
  storeStudentEmotionHistory,
  type StudentEmotionEntry,
  type StudentEmotionHistory,
  type StudentEmotionZoneId,
} from '../lib/studentEmotion';
import {
  loadStoredStudentPetSnapshot,
  normalizeStudentPetStates,
  storeStudentPetSnapshot,
  type StudentPetStates,
} from '../lib/studentPet';
import {
  STUDENT_CHARACTER_PRIZES,
  STUDENT_HOUSE_DESIGNS,
  STUDENT_STOCKS,
  loadStoredStudentShopCatalog,
  loadStoredStudentStockMarket,
  normalizeStudentEconomyStates,
  normalizeStudentInvestmentSettings,
  normalizeStudentShopCatalog,
  normalizeStudentStockMarket,
  storeStudentStockMarket,
  storeStudentShopCatalog,
  upsertStudentStockMarketEntry,
  updateStudentInvestmentSettings,
  getInvestmentStagePresentation,
  getInvestmentStageFromPercent,
  getInvestmentWeekDateKeys,
  investmentMultiplierToPercent,
  type StudentEconomyStates,
  type StudentShopCatalogItem,
  type StudentStockId,
  type StudentStockMarket,
  type StudentInvestmentRounding,
} from '../lib/studentEconomy';
import { FAILURE_PROFILE_OPTIONS } from '../lib/failureExhibition';

import {
  ALL_STUDENTS_LETTER_RECIPIENT,
  createStudentLetter,
  createStudentLetters,
  getTeacherLetterRecipients,
  getTeacherLetters,
  getUnreadTeacherLetterCount,
  loadStoredStudentLifeState,
  markTeacherLetterRead,
  normalizeStudentLifeState,
  storeStudentLifeState,
  type StudentLifeState,
} from '../lib/studentLife';
import {
  createEmptyFeaturedWriting,
  loadStoredBookstoreSettings,
  moveFeaturedWriting,
  normalizeBookstoreSettings,
  storeBookstoreSettings,
  type BookstoreSettings,
  type FeaturedWriting,
} from '../lib/bookstore';
import { StudentEmotionOrbVisual } from '../components/student/StudentEmotionOrb';
import { MissionRewardInput } from '../components/teacher/MissionRewardInput';
import TeacherWritingSettings from '../components/teacher/TeacherWritingSettings';
import TeacherClasswordPanel from '../components/teacher/TeacherClasswordPanel';
import TeacherTodayFriendPanel from '../components/teacher/TeacherTodayFriendPanel';
import {
  loadQuestionSubmissionStatuses,
  type QuestionSubmissionStatus,
} from '../lib/questionSubmissionStatus';
import {
  getStudentCharacterRoster,
  STUDENT_CHARACTERS,
  STUDENT_CHARACTER_WALK_SECONDS,
  type StudentCharacter,
} from '../lib/studentCharacters';
import {
  cancelDailyWritingRewardInSettings,
  claimDailyWritingRewardInSettings,
  getDailyWritingAssignedDateKeys,
  hasDailyWritingReward,
  isDailyWritingWeekday,
  loadStoredDailyWritingState,
  markDailyWritingStudentRewarded,
  normalizeDailyWritingState,
  publishDailyWritingAssignment,
  storeDailyWritingState,
  type DailyWritingState,
  unmarkDailyWritingStudentRewarded,
} from '../lib/dailyWriting';

type StockMarketDraft = {
  returnPercent: number | '';
  comment: string;
};

type StockMarketWeekDrafts = Record<string, Record<StudentStockId, StockMarketDraft>>;
import {
  AUCTION_DAY_ACCENTS,
  AUCTION_ITEM_IDS,
  AUCTION_MAX_ITEMS_PER_DAY,
  AUCTION_MAX_ITEM_COUNT,
  AUCTION_MISSION_MAX_COUNT,
  AUCTION_MISSIONS_STORAGE_KEY,
  AUCTION_WEEKDAY_LABELS,
  adjustCurrencyBalancesForStudents,
  createAuctionItemTemplate,
  CURRENCY_BALANCE_MAX,
  CURRENCY_BALANCE_STEP,
  CURRENCY_STUDENT_NUMBERS,
  DEFAULT_CURRENCY_BALANCE,
  finalizeAuctionAwardInSettings,
  appendCurrencyHistoryEntry,
  clampCurrencyBalance,
  collectCurrencyTax,
  createDefaultCurrencyBalances,
  createDefaultCurrencyHistory,
  formatCurrencyAmount,
  formatCurrency,
  getAuctionAwardsForDay,
  getAuctionItemDisplayName,
  getAuctionVisibleDayCount,
  getStudentLabelStyle,
  grantWeeklyCurrencyAllowance,
  normalizeAuctionAwards,
  normalizeAuctionBidHistory,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeAuctionMissions,
  pickAvailableAuctionMissionIllustrationIndex,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyHistory,
  type CurrencyHistoryReason,
  type AuctionMission,
  type AuctionMissionRewardAmount,
  type AuctionAward,
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionBidHistoryEntry,
  type AuctionBids,
  type AuctionItem,
  type CurrencyBalances,
} from '../lib/currency';
import {
  getClassroomRoleAssignments,
  getClassroomRoleMissionBalanceDelta,
  getTodayClassroomRoleDateKey,
  loadStoredClassroomRoleMissionSettings,
  normalizeClassroomRoleMissionSettings,
  setClassroomRoleMissionResult,
  setClassroomRoleMissionStartForDate,
  storeClassroomRoleMissionSettings,
  type ClassroomRoleMissionResult,
  type ClassroomRoleMissionSettings,
} from '../lib/classroomRoleMission';
import {
  loadStoredStudentMissionVisibility,
  normalizeStudentMissionVisibility,
  storeStudentMissionVisibility,
  STUDENT_MISSION_VISIBILITY_GROUPS,
  type StudentMissionVisibility,
} from '../lib/studentMissionVisibility';

type TimerType = 'break' | 'lunch' | 'class' | 'morning' | 'none';
type SettingsPanel = 'schedule' | 'subjects' | 'draw' | 'auction' | 'donation' | 'missions' | 'shop' | 'stocks' | 'emotion' | 'mail' | 'writing' | 'classword' | 'today-friend' | 'bookstore';
type TeacherShopTab = 'items' | 'skins' | 'houses' | 'characters';
type SettingsNavigationGroup = {
  readonly label: string;
  readonly showHeading?: boolean;
  readonly items: readonly {
    readonly panel: SettingsPanel;
    readonly label: string;
    readonly icon: LucideIcon;
  }[];
};
type WatchFaceGlance = 'center' | 'left' | 'right' | 'up';
type AuctionManagementAction = 'weeklyClose' | 'currency';
type CurrencyAdjustmentTarget = 'student' | 'group' | 'all';
type CurrencyAdjustmentSummary = {
  readonly target: CurrencyAdjustmentTarget;
  readonly delta: number;
};
type EmotionCalendarDay = {
  readonly date: Date;
  readonly dateKey: string;
  readonly isCurrentMonth: boolean;
};

const SETTINGS_NAVIGATION_GROUPS: readonly SettingsNavigationGroup[] = [
  {
    label: '수업 운영',
    items: [
      { panel: 'schedule', label: '시간표', icon: CalendarClock },
      { panel: 'subjects', label: '과목', icon: BookOpen },
      { panel: 'draw', label: '추첨', icon: Sparkles },
    ],
  },
  {
    label: '학생 생활',
    items: [
      { panel: 'emotion', label: '감정', icon: HeartPulse },
      { panel: 'mail', label: '편지', icon: Mail },
      { panel: 'writing', label: '글쓰기', icon: NotebookText },
      { panel: 'classword', label: '낱말판', icon: StickyNote },
      { panel: 'today-friend', label: '오늘의 친구', icon: HeartHandshake },
      { panel: 'missions', label: '미션', icon: ClipboardCheck },
    ],
  },
  {
    label: '고마 경제',
    items: [
      { panel: 'auction', label: '경매', icon: Coins },
      { panel: 'stocks', label: '증권', icon: Star },
      { panel: 'donation', label: '기부', icon: HeartPulse },
    ],
  },
  {
    label: '기타 설정',
    showHeading: false,
    items: [
      { panel: 'shop', label: '기타', icon: Package },
    ],
  },
] as const;
const SETTINGS_NAVIGATION_ITEMS = SETTINGS_NAVIGATION_GROUPS.flatMap((group) => group.items);
const AUCTION_MISSION_RECOMMENDED_LENGTH = 18;

const EMOTION_CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const emotionCalendarMonthFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
});
const emotionCalendarDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const teacherLetterDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatTeacherLetterDate = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '날짜 확인 불가' : teacherLetterDateFormatter.format(date);
};

const formatCurrencyAdjustmentSummary = ({ delta }: CurrencyAdjustmentSummary) => {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta)}`;
};

const getEmotionCalendarDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getEmotionCalendarDays = (visibleMonth: Date): EmotionCalendarDay[] => {
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
interface ScheduleSlot {
  id: string;
  name: string;
  subject?: string;
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

interface TimerAppState {
  manual: ManualTimerState;
}

interface SharedSchoolTimerSettings {
  version: 1;
  weeklySchedule: WeeklySchedule;
  weeklySubjects?: WeeklySubjectSchedule;
  subjectCatalog?: SubjectCatalog;
  scheduleNotice: string;
  scheduleNoticeHighlights?: NoticeHighlightRange[];
  isNoticeEnabled: boolean;
  scheduleClockOffsetSeconds: number;
  scheduleYoutubeUrls: string[];
  scheduleYoutubeFavorites: ScheduleYoutubeFavorite[];
  isScheduleYoutubeVisible: boolean;
  randomDraw: SavedRandomDrawState;
  manualTimer: {
    totalTime: number;
    isVisible: boolean;
  };
  currencyBalances: CurrencyBalances;
  currencyHistory: CurrencyHistory;
  auctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  auctionBidHistory: AuctionBidHistory;
  auctionAwards: AuctionAwards;
  auctionMissions: AuctionMission[];
  classroomRoleMission: ClassroomRoleMissionSettings;
  studentMissionVisibility: StudentMissionVisibility;
  classDonation: ClassDonationSettings;
  studentEmotionHistory: StudentEmotionHistory;
  studentPets: StudentPetStates;
  studentLife: StudentLifeState;
  dailyWriting: DailyWritingState;
  bookstoreSettings: BookstoreSettings;
  studentEconomy?: StudentEconomyStates;
  studentShopCatalog: StudentShopCatalogItem[];
  studentStockMarket: StudentStockMarket;
}

interface NoticeHighlightRange {
  start: number;
  end: number;
  color: NoticeHighlightColorId;
}

interface DrawOverlayState {
  caseId: string;
  displayText: string;
  kind: 'normal' | 'repeat' | 'empty' | 'reset';
  number: number | null;
}

interface ScheduleYoutubeFavorite {
  id: string;
  name: string;
  urls: string[];
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
}

interface ScheduleYoutubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

interface ScheduleYoutubeMetadata {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

const getUniqueDrawHistoryEntries = (historyEntries: RandomDrawHistoryEntry[]) => {
  const repeatedNumberSet = new Set(
    historyEntries.filter((entry) => entry.kind === 'repeat').map((entry) => entry.number),
  );
  const visibleNumberSet = new Set<number>();
  const orphanRepeatEntries: RandomDrawHistoryEntry[] = [];
  const visibleEntries: RandomDrawHistoryEntry[] = [];

  historyEntries.forEach((entry) => {
    if (visibleNumberSet.has(entry.number)) {
      return;
    }

    if (entry.kind === 'repeat') {
      orphanRepeatEntries.push(entry);
      return;
    }

    visibleNumberSet.add(entry.number);
    visibleEntries.push(
      repeatedNumberSet.has(entry.number)
        ? {
          ...entry,
          kind: 'repeat',
          sourceEntryId: entry.id,
        }
        : entry,
    );
  });

  orphanRepeatEntries.forEach((entry) => {
    if (visibleNumberSet.has(entry.number)) {
      return;
    }

    visibleNumberSet.add(entry.number);
    visibleEntries.push(entry);
  });

  return visibleEntries;
};

type WeeklySchedule = {
  [key: number]: ScheduleSlot[]; // 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri
};
type WeeklySubjectSchedule = Record<string, Record<number, Record<string, string>>>;
type SubjectCatalog = string[];

const MORNING_ACTIVITY_LABEL = '\uC544\uCE68\uD65C\uB3D9';
const MORNING_DEFAULT_DURATION = 15;
const CLASS_DURATION = 40;
const BREAK_DURATION = 10;
const BACKGROUND_MUSIC_VOLUME = 0.24;
const BACKGROUND_MUSIC_SRC = '/background_music.mp3';
const SCHEDULE_CLOCK_OFFSET_LIMIT_SECONDS = 59;
const WEEKDAYS = [1, 2, 3, 4, 5];
const ANNOUNCEMENT_MIN_VISIBLE_LINES = 6;
const ANNOUNCEMENT_MAX_VISIBLE_LINES = 14;
const ANNOUNCEMENT_MIN_RULE_GAP_PX = 52;
const ANNOUNCEMENT_SAFETY_PHRASE = '차 조심, 낯선 사람 조심!';
const ANNOUNCEMENT_NOTE_PLACEHOLDER = '알림장을 입력하세요';
const ANNOUNCEMENT_NOTE_HIGHLIGHTS_STORAGE_KEY = 'announcementNoteHighlights-v1';
const AUCTION_AWARD_QUEUE_ADVANCE_DELAY_MS = 1400;
const getAuctionAwardStepDelayMs = (stepCount: number) => {
  if (stepCount >= 12) return 260;
  if (stepCount >= 8) return 380;
  if (stepCount >= 5) return 520;
  return 720;
};

const getAuctionAwardSpeed = (stepCount: number) => (
  stepCount >= 12 ? 'fast' : stepCount >= 8 ? 'quick' : stepCount >= 5 ? 'brisk' : 'normal'
);
const QUESTION_SUBMISSION_AUTO_REFRESH_MS = 15_000;
const WEEKLY_SUBJECTS_STORAGE_KEY = 'weeklySubjects-v1';
const SUBJECT_CATALOG_STORAGE_KEY = 'subjectCatalog-v1';
const SCHEDULE_NOTICE_HIGHLIGHTS_STORAGE_KEY = 'scheduleNoticeHighlights-v1';
const MEMO_NOTE_STORAGE_KEY = 'school-memo-note-v1';
const MEMO_NOTE_PLACEHOLDER = '메모 입력';
const MEMO_NOTE_MIN_FONT_SCALE = 0;
const MEMO_NOTE_MAX_FONT_SCALE = 100;
const MEMO_NOTE_DEFAULT_FONT_SCALE = 50;
const MEMO_NOTE_FONT_SCALE_STEP = 5;
const MEMO_NOTE_MIN_FONT_SIZE = 40;
const MEMO_NOTE_MAX_FONT_SIZE = 168;
const SCHEDULE_YOUTUBE_URLS_STORAGE_KEY = 'scheduleYoutubeUrls-v2';
const SCHEDULE_YOUTUBE_METADATA_STORAGE_KEY = 'scheduleYoutubeMetadata-v1';
const DRAW_OVERLAY_DISMISS_DURATION_MS = 260;
const DEFAULT_SUBJECT_CATALOG: SubjectCatalog = [
  '국어',
  '수학',
  '사회',
  '과학',
  '영어',
  '체육',
  '음악',
  '미술',
  '실과',
  '도덕',
];
const MAX_SUBJECT_NAME_LENGTH = 24;
const SUBJECT_UNSET_LABEL = '과목';
const SUBJECT_CATALOG_DATALIST_ID = 'subject-catalog-options';
const SUBJECT_WEEK_CHOICES = [
  { offset: -1, label: '지난주' },
  { offset: 0, label: '이번주' },
  { offset: 1, label: '다음주' },
  { offset: 2, label: '다다음주' },
] as const;

let sharedBackgroundMusicAudio: HTMLAudioElement | null = null;

const getSharedBackgroundMusicAudio = () => {
  if (typeof window === 'undefined') return null;

  if (!sharedBackgroundMusicAudio) {
    sharedBackgroundMusicAudio = new Audio(BACKGROUND_MUSIC_SRC);
    sharedBackgroundMusicAudio.loop = true;
    sharedBackgroundMusicAudio.preload = 'auto';
  }

  sharedBackgroundMusicAudio.volume = BACKGROUND_MUSIC_VOLUME;
  sharedBackgroundMusicAudio.loop = true;

  return sharedBackgroundMusicAudio;
};
const SCHEDULE_YOUTUBE_LEGACY_URL_STORAGE_KEY = 'scheduleYoutubeUrl-v1';
const SCHEDULE_YOUTUBE_VISIBLE_STORAGE_KEY = 'scheduleYoutubeVisible-v1';
const SCHEDULE_YOUTUBE_FAVORITES_STORAGE_KEY = 'scheduleYoutubeFavorites-v1';
const TIMER_APP_STATE_STORAGE_KEY = 'timerAppStateV3';
const LEGACY_TIMER_APP_STATE_STORAGE_KEY = 'timerAppStateV2';
const MEMO_NOTE_TEXT_COLORS = [
  { id: 'black', label: '검정', value: '#2c1e16' },
  { id: 'red', label: '빨강', value: '#c7684a' },
  { id: 'blue', label: '파랑', value: '#2d63b8' },
] as const;
const NOTICE_HIGHLIGHT_COLORS = [
  { id: 'coral', label: '코랄', value: '#c95f49' },
] as const;
type NoticeHighlightColorId = (typeof NOTICE_HIGHLIGHT_COLORS)[number]['id'];
const DRAW_EMPTY_MESSAGE = '완료';
const DRAW_RESET_MESSAGE = '섞는 중';
const DRAW_SHORTCUT_LABEL = '→ / Enter';
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
  totalTime: 300,
  timeLeft: 300,
  isRunning: false,
  endTime: null,
  isVisible: false,
};

const MANUAL_TIMER_PRESETS = [
  { label: '+1분', seconds: 60 },
  { label: '+3분', seconds: 180 },
  { label: '+5분', seconds: 300 },
] as const;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
const YOUTUBE_SEARCH_API_SRC = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_SEARCH_MAX_RESULTS = 6;
const YOUTUBE_PLAYER_STATE_ENDED = 0;
const YOUTUBE_PLAYER_STATE_PLAYING = 1;
const YOUTUBE_END_DETECTION_SECONDS = 0.6;

const YOUTUBE_SEARCH_API_KEY =
  typeof import.meta.env.VITE_YOUTUBE_API_KEY === 'string'
    ? import.meta.env.VITE_YOUTUBE_API_KEY.trim()
    : '';

interface YoutubePlayerInstance {
  cueVideoById: (videoId: string | { videoId: string; startSeconds?: number }) => void;
  loadVideoById: (videoId: string | { videoId: string; startSeconds?: number }) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData?: () => {
    title?: string;
    author?: string;
  };
  mute: () => void;
  unMute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  destroy: () => void;
}

interface YoutubePlayerEvent {
  target: YoutubePlayerInstance;
}

interface YoutubePlayerStateChangeEvent extends YoutubePlayerEvent {
  data: number;
}

interface YoutubeIframeApi {
  Player: new (
    element: HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: YoutubePlayerEvent) => void;
        onAutoplayBlocked?: (event: YoutubePlayerEvent) => void;
        onStateChange?: (event: YoutubePlayerStateChangeEvent) => void;
      };
    },
  ) => YoutubePlayerInstance;
}

interface YoutubeSearchApiResponse {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
  }>;
  error?: {
    message?: string;
  };
}

declare global {
  interface Window {
    YT?: YoutubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
    __schoolTimerYoutubeIframeApiPromise?: Promise<YoutubeIframeApi>;
  }
}

type MemoTextColorId = (typeof MEMO_NOTE_TEXT_COLORS)[number]['id'];

const createSlotId = () => Math.random().toString(36).slice(2, 11);

const getFixedDurationByType = (type: TimerType) => {
  if (type === 'class') return CLASS_DURATION;
  if (type === 'break') return BREAK_DURATION;
  return null;
};

const getFixedScheduleNameByType = (type: TimerType) => {
  if (type === 'break') return '쉬는 시간';
  if (type === 'lunch') return '점심시간';
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

const normalizeNoticeHighlightRanges = (value: unknown, text: string): NoticeHighlightRange[] => {
  if (!Array.isArray(value) || text.length === 0) return [];
  const validColorIds = new Set<NoticeHighlightColorId>(NOTICE_HIGHLIGHT_COLORS.map((color) => color.id));

  const ranges = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const range = entry as Partial<NoticeHighlightRange>;
      const start = Math.max(0, Math.min(text.length, Math.trunc(Number(range.start))));
      const end = Math.max(0, Math.min(text.length, Math.trunc(Number(range.end))));
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const normalizedStart = Math.min(start, end);
      const normalizedEnd = Math.max(start, end);
      const color = validColorIds.has(range.color as NoticeHighlightColorId)
        ? (range.color as NoticeHighlightColorId)
        : NOTICE_HIGHLIGHT_COLORS[0].id;
      return normalizedEnd > normalizedStart ? { start: normalizedStart, end: normalizedEnd, color } : null;
    })
    .filter((range): range is NoticeHighlightRange => range !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  return ranges.reduce<NoticeHighlightRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end || previous.color !== range.color) {
      merged.push(range);
      return merged;
    }
    previous.end = Math.max(previous.end, range.end);
    return merged;
  }, []);
};

const removeNoticeHighlightRange = (
  ranges: NoticeHighlightRange[],
  target: NoticeHighlightRange,
  text: string,
) => {
  const nextRanges = ranges.flatMap<NoticeHighlightRange>((range) => {
    if (target.end <= range.start || target.start >= range.end) {
      return [range];
    }

    const splitRanges: NoticeHighlightRange[] = [];
    if (target.start > range.start) {
      splitRanges.push({ start: range.start, end: target.start, color: range.color });
    }
    if (target.end < range.end) {
      splitRanges.push({ start: target.end, end: range.end, color: range.color });
    }
    return splitRanges;
  });

  return normalizeNoticeHighlightRanges(nextRanges, text);
};

const getAnnouncementNoteHighlightStorageKey = (dateKey: string) =>
  `${ANNOUNCEMENT_NOTE_HIGHLIGHTS_STORAGE_KEY}:${dateKey}`;

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

const getStoredScheduleYoutubeVisibility = () => {
  try {
    const saved = localStorage.getItem(SCHEDULE_YOUTUBE_VISIBLE_STORAGE_KEY);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
};

const extractYoutubeVideoId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalizedValue = YOUTUBE_VIDEO_ID_PATTERN.test(trimmed)
    ? `https://youtu.be/${trimmed}`
    : /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

  try {
    const url = new URL(normalizedValue);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    let candidate = '';

    if (hostname === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      candidate = url.searchParams.get('v') || '';
      if (!candidate) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(pathParts[0] || '')) {
          candidate = pathParts[1] || '';
        }
      }
    }

    const cleanedCandidate = candidate.replace(/[^A-Za-z0-9_-]/g, '');
    return YOUTUBE_VIDEO_ID_PATTERN.test(cleanedCandidate) ? cleanedCandidate : null;
  } catch {
    return null;
  }
};

const buildScheduleYoutubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const createScheduleYoutubeFavoriteId = () => `youtube-favorite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildScheduleYoutubeLyricsQuery = (query: string) => {
  const normalizedQuery = query.trim();
  if (/(^|\s)(가사|lyrics?|lyric\s+video)(\s|$)/i.test(normalizedQuery)) {
    return normalizedQuery;
  }
  return `${normalizedQuery} 가사`;
};

const normalizeScheduleYoutubeUrls = (values: unknown) => {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => (typeof value === 'string' ? value : ''))
    .map((value) => extractYoutubeVideoId(value))
    .filter((videoId): videoId is string => videoId !== null)
    .map((videoId) => buildScheduleYoutubeWatchUrl(videoId));
};

const normalizeScheduleYoutubeFavorites = (values: unknown): ScheduleYoutubeFavorite[] => {
  if (!Array.isArray(values)) return [];

  return values.reduce<ScheduleYoutubeFavorite[]>((favorites, value, index) => {
    if (!value || typeof value !== 'object') return favorites;

    const favorite = value as Partial<ScheduleYoutubeFavorite>;
    const urls = normalizeScheduleYoutubeUrls(favorite.urls).slice(0, 1);
    if (urls.length === 0) return favorites;

    favorites.push({
      id:
        typeof favorite.id === 'string' && favorite.id.trim().length > 0
          ? favorite.id
          : `youtube-favorite-${index + 1}`,
      name:
        typeof favorite.name === 'string' && favorite.name.trim().length > 0
          ? favorite.name.trim()
          : `즐겨찾기 ${index + 1}`,
      urls,
      title: typeof favorite.title === 'string' ? favorite.title.trim() : undefined,
      channelTitle: typeof favorite.channelTitle === 'string' ? favorite.channelTitle.trim() : undefined,
      thumbnailUrl: typeof favorite.thumbnailUrl === 'string' ? favorite.thumbnailUrl.trim() : undefined,
    });
    return favorites;
  }, []);
};

const normalizeScheduleYoutubeMetadataMap = (value: unknown): Record<string, ScheduleYoutubeMetadata> => {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, ScheduleYoutubeMetadata>>(
    (metadataMap, [url, metadata]) => {
      if (!metadata || typeof metadata !== 'object') return metadataMap;

      const parsed = metadata as Partial<ScheduleYoutubeMetadata>;
      const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
      if (!title) return metadataMap;

      metadataMap[url] = {
        title,
        channelTitle: typeof parsed.channelTitle === 'string' ? parsed.channelTitle.trim() : '',
        thumbnailUrl: typeof parsed.thumbnailUrl === 'string' ? parsed.thumbnailUrl.trim() : '',
      };
      return metadataMap;
    },
    {},
  );
};

const getStoredScheduleYoutubeMetadataMap = () => {
  try {
    const savedMetadata = localStorage.getItem(SCHEDULE_YOUTUBE_METADATA_STORAGE_KEY);
    if (!savedMetadata) return {};
    return normalizeScheduleYoutubeMetadataMap(JSON.parse(savedMetadata));
  } catch {
    return {};
  }
};

const getStoredScheduleYoutubeUrls = () => {
  try {
    const savedUrls = localStorage.getItem(SCHEDULE_YOUTUBE_URLS_STORAGE_KEY);
    if (savedUrls) {
      const parsed = JSON.parse(savedUrls);
      if (Array.isArray(parsed)) {
        return normalizeScheduleYoutubeUrls(parsed);
      }
      if (typeof parsed === 'string') {
        return normalizeScheduleYoutubeUrls([parsed]);
      }
    }
  } catch {
    // Ignore malformed data and fall back to legacy storage.
  }

  try {
    return normalizeScheduleYoutubeUrls([
      localStorage.getItem(SCHEDULE_YOUTUBE_LEGACY_URL_STORAGE_KEY) || '',
    ]);
  } catch {
    return [];
  }
};

const mergeScheduleYoutubeUrls = (currentUrls: string[], nextUrls: string[]) => {
  const mergedUrls = [...currentUrls];
  const seenUrls = new Set(currentUrls);

  nextUrls.forEach((url) => {
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    mergedUrls.push(url);
  });

  return mergedUrls;
};

const loadYoutubeIframeApi = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube iframe API is unavailable on the server.'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__schoolTimerYoutubeIframeApiPromise) {
    return window.__schoolTimerYoutubeIframeApiPromise;
  }

  window.__schoolTimerYoutubeIframeApiPromise = new Promise<YoutubeIframeApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      reject(new Error('YouTube iframe API loaded without a Player constructor.'));
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = YOUTUBE_IFRAME_API_SRC;
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load the YouTube iframe API.'));
      document.head.appendChild(script);
      return;
    }

    existingScript.addEventListener(
      'error',
      () => reject(new Error('Failed to load the YouTube iframe API.')),
      { once: true },
    );
  }).catch((error) => {
    window.__schoolTimerYoutubeIframeApiPromise = undefined;
    throw error;
  });

  return window.__schoolTimerYoutubeIframeApiPromise;
};

const getInitialScheduleYoutubeState = () => {
  const storedUrls = getStoredScheduleYoutubeUrls();
  return {
    appliedUrls: storedUrls,
    inputValue: '',
    isVisible: storedUrls.length > 0 ? getStoredScheduleYoutubeVisibility() : false,
  };
};

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

const isTextEntryShortcutTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;

  const tagName = element.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const isComposingKeyboardEvent = (event: KeyboardEvent | React.KeyboardEvent<HTMLElement>) => {
  const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
  return nativeEvent.isComposing;
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

const getCurrentScheduleWeekday = (offsetSeconds: number) => {
  const currentDay = getAdjustedScheduleDate(Date.now(), offsetSeconds).getDay();
  return WEEKDAYS.includes(currentDay) ? currentDay : WEEKDAYS[0];
};

const renderAnnouncementSafetySegments = (text: string, keyPrefix: string) => {
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

const renderAnnouncementNoteLine = (
  text: string,
  keyPrefix: string,
  lineStart: number,
  highlightRanges: NoticeHighlightRange[] = [],
) => {
  const sourceText = text.length > 0 ? text : '\u200b';
  const ranges = highlightRanges
    .map((range) => ({
      ...range,
      start: Math.max(0, Math.min(sourceText.length, range.start - lineStart)),
      end: Math.max(0, Math.min(sourceText.length, range.end - lineStart)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (ranges.length === 0) {
    return renderAnnouncementSafetySegments(sourceText, keyPrefix);
  }

  const segments: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push(...renderAnnouncementSafetySegments(sourceText.slice(cursor, range.start), `${keyPrefix}-plain-${index}`));
    }

    segments.push(
      <span
        key={`${keyPrefix}-highlight-${index}`}
        className={`announcement-note-highlight-text announcement-note-highlight-text-${range.color || NOTICE_HIGHLIGHT_COLORS[0].id}`}
      >
        {sourceText.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  });

  if (cursor < sourceText.length) {
    segments.push(...renderAnnouncementSafetySegments(sourceText.slice(cursor), `${keyPrefix}-plain-end`));
  }

  return segments;
};

const renderAnnouncementNoteDisplay = (text: string, highlightRanges: NoticeHighlightRange[] = []) => {
  const lines = text.length > 0 ? text.split('\n') : [''];
  const isPlaceholderVisible = text.length === 0;
  let lineStart = 0;

  return lines.map((line, index) => {
    const currentLineStart = lineStart;
    lineStart += line.length + 1;

    return (
      <div key={`announcement-note-line-${index}`} className="announcement-note-display-line">
        <span className="announcement-note-display-marker">{index + 1}.</span>
        <span
          className={`announcement-note-display-line-text${isPlaceholderVisible ? ' announcement-note-display-line-text-placeholder' : ''}`}
        >
          {isPlaceholderVisible
            ? ANNOUNCEMENT_NOTE_PLACEHOLDER
            : renderAnnouncementNoteLine(
                line,
                `announcement-note-line-${index}`,
                currentLineStart,
                highlightRanges,
              )}
        </span>
      </div>
    );
  });
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

const getSchedulePeriodNumber = (slot: Pick<ScheduleSlot, 'name' | 'type'>) => {
  if (slot.type !== 'class') return null;
  const match = slot.name.trim().match(/^(\d+)\s*교시$/);
  return match ? match[1] : null;
};

const getScheduleSlotSubject = (slot: Pick<ScheduleSlot, 'subject'>) =>
  typeof slot.subject === 'string' ? slot.subject.trim() : '';

const getScheduleSubjectKey = (slot: ScheduleSlot) => getSchedulePeriodNumber(slot) ?? slot.name.trim();

const isSubjectEditableClassSlot = (slot: ScheduleSlot) =>
  slot.type === 'class' && getSchedulePeriodNumber(slot) !== null;

const getWeekStartDate = (date: Date) => {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + offset);
  return weekStart;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekKeyForDate = (date: Date) => formatDateKey(getWeekStartDate(date));

const getDefaultSubjectWeekKeyForDate = (date: Date) => {
  const targetDate = new Date(date);
  const day = targetDate.getDay();
  if (day === 0 || day === 6) {
    targetDate.setDate(targetDate.getDate() + 7);
  }
  return getWeekKeyForDate(targetDate);
};

const getWeekOfMonthByMonday = (weekStart: Date) => {
  const firstDayOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const firstMonday = getWeekStartDate(firstDayOfMonth);
  if (firstMonday.getMonth() !== weekStart.getMonth()) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  return Math.max(1, Math.floor((weekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1);
};

const getWeekOptionLabel = (weekKey: string) => {
  const weekStart = new Date(`${weekKey}T00:00:00`);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const month = weekStart.getMonth() + 1;
  const weekOfMonth = getWeekOfMonthByMonday(weekStart);
  return `${weekStart.getFullYear()}년 ${month}월 ${weekOfMonth}주 (${month}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()})`;
};

const buildSubjectWeekOptions = (centerDate: Date) => {
  const centerWeekStart = getWeekStartDate(centerDate);
  return SUBJECT_WEEK_CHOICES.map(({ offset, label }) => {
    const weekStart = new Date(centerWeekStart);
    weekStart.setDate(centerWeekStart.getDate() + offset * 7);
    const key = formatDateKey(weekStart);
    const dateLabel = getWeekOptionLabel(key);
    return { key, label: `${label} · ${dateLabel}`, dateLabel };
  });
};

const normalizeWeeklySubjects = (value: unknown): WeeklySubjectSchedule => {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<WeeklySubjectSchedule>((weeks, [weekKey, weekValue]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !weekValue || typeof weekValue !== 'object') return weeks;

    const normalizedDays = Object.entries(weekValue as Record<string, unknown>).reduce<Record<number, Record<string, string>>>(
      (days, [dayKey, dayValue]) => {
        const day = Number(dayKey);
        if (!WEEKDAYS.includes(day) || !dayValue || typeof dayValue !== 'object') return days;

        const normalizedSubjects = Object.entries(dayValue as Record<string, unknown>).reduce<Record<string, string>>(
          (subjects, [subjectKey, subjectValue]) => {
            const key = subjectKey.trim();
            const subject = typeof subjectValue === 'string' ? subjectValue.trim() : '';
            if (key.length > 0 && subject.length > 0 && subject !== SUBJECT_UNSET_LABEL) {
              subjects[key] = subject;
            }
            return subjects;
          },
          {},
        );

        if (Object.keys(normalizedSubjects).length > 0) {
          days[day] = normalizedSubjects;
        }
        return days;
      },
      {},
    );

    if (Object.keys(normalizedDays).length > 0) {
      weeks[weekKey] = normalizedDays;
    }
    return weeks;
  }, {});
};

const normalizeSubjectName = (value: unknown) => (
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_SUBJECT_NAME_LENGTH)
    : ''
);

const normalizeAssignedSubjectName = (value: unknown) => {
  const subject = normalizeSubjectName(value);
  return subject === SUBJECT_UNSET_LABEL ? '' : subject;
};

const getSubjectInputState = (value: string) => {
  const subject = normalizeAssignedSubjectName(value);
  if (!subject) return 'empty';
  return subject === '영어' || subject === '체육' ? 'sky' : 'configured';
};

const normalizeSubjectCatalog = (value: unknown, fallback: SubjectCatalog = DEFAULT_SUBJECT_CATALOG): SubjectCatalog => {
  if (!Array.isArray(value)) {
    return normalizeSubjectCatalog(fallback, []);
  }

  const subjects = value.reduce<SubjectCatalog>((items, item) => {
    const subject = normalizeSubjectName(item);
    if (subject.length > 0 && !items.includes(subject)) {
      items.push(subject);
    }
    return items;
  }, []);

  return subjects;
};

const getWeeklySubject = (
  weeklySubjects: WeeklySubjectSchedule,
  weekKey: string,
  day: number,
  slot: ScheduleSlot,
) => {
  if (!isSubjectEditableClassSlot(slot)) return '';
  const subjectKey = getScheduleSubjectKey(slot);
  return normalizeAssignedSubjectName(weeklySubjects[weekKey]?.[day]?.[subjectKey] ?? '');
};

const buildWeeklySubjectsFromSchedule = (
  schedule: WeeklySchedule,
  weekKey: string,
): WeeklySubjectSchedule => {
  const weekSubjects = WEEKDAYS.reduce<Record<number, Record<string, string>>>((days, day) => {
    const daySubjects = (schedule[day] || []).reduce<Record<string, string>>((subjects, slot) => {
      if (!isSubjectEditableClassSlot(slot)) return subjects;
      const subject = getScheduleSlotSubject(slot);
      if (subject.length > 0) {
        subjects[getScheduleSubjectKey(slot)] = subject;
      }
      return subjects;
    }, {});

    if (Object.keys(daySubjects).length > 0) {
      days[day] = daySubjects;
    }
    return days;
  }, {});

  return Object.keys(weekSubjects).length > 0 ? { [weekKey]: weekSubjects } : {};
};

const getScheduleSlotDisplayTitle = (slot: ScheduleSlot, subject = getScheduleSlotSubject(slot)) => {
  if (slot.type !== 'class') return slot.name;
  const periodNumber = getSchedulePeriodNumber(slot);
  const baseLabel = periodNumber ? `${periodNumber}교시` : slot.name;
  return subject ? `${baseLabel} ${subject}` : baseLabel;
};

const getScheduleSlotTimerLabel = (slot: ScheduleSlot, subject = getScheduleSlotSubject(slot)) => {
  if (slot.type !== 'class') return slot.name;
  return subject || slot.name;
};

const getNextClassPeriodName = (daySchedule: ScheduleSlot[]) => {
  const periodNumbers = daySchedule
    .filter((slot) => slot.type === 'class')
    .map((slot) => Number(getSchedulePeriodNumber(slot)))
    .filter((periodNumber) => Number.isFinite(periodNumber) && periodNumber > 0);
  const nextPeriodNumber = periodNumbers.length > 0 ? Math.max(...periodNumbers) + 1 : 1;
  return `${nextPeriodNumber}교시`;
};

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
      const fixedScheduleName = getFixedScheduleNameByType(slot.type);
      const fixedDuration = getFixedDurationByType(slot.type);
      if (fixedDuration !== null) {
        return {
          ...slot,
          name: fixedScheduleName ?? slot.name,
          end: slot.start + fixedDuration,
        };
      }
      if (slot.end <= slot.start) {
        return {
          ...slot,
          name: fixedScheduleName ?? slot.name,
          end: slot.start + 1,
        };
      }
      return fixedScheduleName ? { ...slot, name: fixedScheduleName } : slot;
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
    normalized.push({
      ...slot,
      subject: slot.type === 'class' ? getScheduleSlotSubject(slot) : '',
      start,
      end: start + duration,
    });
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

const normalizeSharedSchoolTimerSettings = (value: unknown): SharedSchoolTimerSettings | null => {
  if (!value || typeof value !== 'object') return null;

  const parsed = value as Partial<SharedSchoolTimerSettings>;
  const manualTimer =
    parsed.manualTimer && typeof parsed.manualTimer === 'object'
      ? (parsed.manualTimer as Partial<SharedSchoolTimerSettings['manualTimer']>)
      : {};
  const weeklySchedule = normalizeWeeklySchedule((parsed.weeklySchedule || defaultWeeklySchedule) as WeeklySchedule);
  const hasStoredWeeklySubjects = Object.prototype.hasOwnProperty.call(parsed, 'weeklySubjects');
  const weeklySubjects = normalizeWeeklySubjects(parsed.weeklySubjects);
  const subjectCatalog = normalizeSubjectCatalog(parsed.subjectCatalog);

  return {
    version: 1,
    weeklySchedule,
    weeklySubjects: hasStoredWeeklySubjects
      ? weeklySubjects
      : buildWeeklySubjectsFromSchedule(weeklySchedule, getWeekKeyForDate(new Date())),
    subjectCatalog,
    scheduleNotice: typeof parsed.scheduleNotice === 'string' ? parsed.scheduleNotice : '',
    scheduleNoticeHighlights: normalizeNoticeHighlightRanges(
      parsed.scheduleNoticeHighlights,
      typeof parsed.scheduleNotice === 'string' ? parsed.scheduleNotice : '',
    ),
    isNoticeEnabled: parsed.isNoticeEnabled === true,
    scheduleClockOffsetSeconds: clampScheduleClockOffsetSeconds(parsed.scheduleClockOffsetSeconds),
    scheduleYoutubeUrls: normalizeScheduleYoutubeUrls(parsed.scheduleYoutubeUrls),
    scheduleYoutubeFavorites: normalizeScheduleYoutubeFavorites(parsed.scheduleYoutubeFavorites),
    isScheduleYoutubeVisible: parsed.isScheduleYoutubeVisible === true,
    randomDraw: normalizeSavedRandomDrawState(parsed.randomDraw),
    manualTimer: {
      totalTime:
        typeof manualTimer.totalTime === 'number' && manualTimer.totalTime > 0
          ? Math.floor(manualTimer.totalTime)
          : DEFAULT_MANUAL_TIMER_STATE.totalTime,
      isVisible: manualTimer.isVisible === true,
    },
    currencyBalances: normalizeCurrencyBalances(parsed.currencyBalances),
    currencyHistory: normalizeCurrencyHistory(parsed.currencyHistory),
    auctionItems: normalizeAuctionItems(parsed.auctionItems),
    auctionBids: normalizeAuctionBids(parsed.auctionBids, AUCTION_ITEM_IDS),
    auctionBidHistory: normalizeAuctionBidHistory(parsed.auctionBidHistory, AUCTION_ITEM_IDS),
    auctionAwards: normalizeAuctionAwards(parsed.auctionAwards, AUCTION_ITEM_IDS),
    auctionMissions: normalizeAuctionMissions(parsed.auctionMissions),
    classroomRoleMission: normalizeClassroomRoleMissionSettings(parsed.classroomRoleMission),
    studentMissionVisibility: normalizeStudentMissionVisibility(parsed.studentMissionVisibility),
    classDonation: normalizeClassDonationSettings(parsed.classDonation),
    studentEmotionHistory: normalizeStudentEmotionHistory(parsed.studentEmotionHistory),
    studentPets: normalizeStudentPetStates(parsed.studentPets),
    studentLife: normalizeStudentLifeState(parsed.studentLife),
    dailyWriting: normalizeDailyWritingState(parsed.dailyWriting),
    bookstoreSettings: normalizeBookstoreSettings(parsed.bookstoreSettings),
    studentEconomy: normalizeStudentEconomyStates(parsed.studentEconomy),
    studentShopCatalog: normalizeStudentShopCatalog(parsed.studentShopCatalog),
    studentStockMarket: normalizeStudentStockMarket(parsed.studentStockMarket),
  };
};

const getStoredAuctionMissions = (): AuctionMission[] => {
  try {
    const saved = localStorage.getItem(AUCTION_MISSIONS_STORAGE_KEY);
    return saved ? normalizeAuctionMissions(JSON.parse(saved)) : [];
  } catch (error) {
    if (error instanceof Error) return [];
    throw error;
  }
};

const hasBlankAuctionMissionDraft = (missions: AuctionMission[]) =>
  missions.some((mission) => mission.content.trim().length === 0);

const DAYS = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];
const ANNOUNCEMENT_STORAGE_KEY = 'school-announcements-v4';
const ANNOUNCEMENT_CLOSING_MESSAGE = '차 조심, 낯선 사람 조심!';
const ANNOUNCEMENT_WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const MANUAL_TIMER_ALARM_VOLUME_MULTIPLIER = 2.8;
const CLASS_END_IMAGE_DURATION_SECONDS = 120;
const CLASS_END_IMAGE_MESSAGES = ['우유 가져가!', '우유 갖다 놔!'];

let announcementAudioContext: AudioContext | null = null;
let announcementAudioPreparePromise: Promise<AudioContext | null> | null = null;

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

const prepareAnnouncementAudio = () => {
  if (!announcementAudioPreparePromise) {
    announcementAudioPreparePromise = (async () => {
      try {
        const ctx = getAnnouncementAudioContext();
        if (!ctx) return null;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        return ctx;
      } catch {
        return null;
      } finally {
        announcementAudioPreparePromise = null;
      }
    })();
  }

  return announcementAudioPreparePromise;
};

const playAnnouncementSound = async (kind: 'pop' | 'tada') => {
  try {
    const ctx = await prepareAnnouncementAudio();
    if (!ctx) return;

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

const getAnnouncementDateKey = (value: string) => {
  const parsed = parseAnnouncementDate(value) ?? new Date();
  const year = parsed.getFullYear().toString();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAnnouncementAuctionDayIndex = (value: string) => {
  const day = (parseAnnouncementDate(value) ?? new Date()).getDay();
  if (day < 1 || day > AUCTION_WEEKDAY_LABELS.length) return null;
  return day - 1;
};

const formatAnnouncementUpdatedAt = (value?: string) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getTodayAnnouncementDateText = () => formatAnnouncementDate(new Date());
const getTodayAnnouncementDateKey = () => getAnnouncementDateKey(getTodayAnnouncementDateText());

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
  void (async () => {
    try {
      const ctx = await prepareAnnouncementAudio();
      if (!ctx) return;

      const playBellLayer = (
        frequency: number,
        startTime: number,
        duration: number,
        type: OscillatorType,
        peakVolume: number,
        endFrequency = frequency,
      ) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const sustainMidpoint = startTime + duration * 0.34;
        const endTime = startTime + duration;
        const adjustedPeakVolume = Math.min(peakVolume * MANUAL_TIMER_ALARM_VOLUME_MULTIPLIER, 0.35);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(120, endFrequency), endTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(adjustedPeakVolume, startTime + Math.min(0.04, duration * 0.16));
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, adjustedPeakVolume * 0.42), sustainMidpoint);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(endTime + 0.04);
      };

      const playBellStrike = (
        frequency: number,
        startOffset: number,
        duration: number,
        peakVolume: number,
      ) => {
        const startTime = ctx.currentTime + startOffset;

        // Stack a few bright bell partials so the finish sound carries longer and reads clearly.
        playBellLayer(frequency, startTime, duration, 'triangle', peakVolume, frequency * 1.016);
        playBellLayer(frequency * 2, startTime + 0.012, duration * 0.78, 'sine', peakVolume * 0.42, frequency * 2.012);
        playBellLayer(frequency * 0.5, startTime, duration * 0.96, 'sine', peakVolume * 0.22, frequency * 0.503);
      };

      playBellStrike(523.25, 0, 0.74, 0.09);
      playBellStrike(659.25, 0.5, 0.8, 0.1);
      playBellStrike(783.99, 1.02, 0.92, 0.11);
      playBellStrike(1046.5, 1.58, 1.52, 0.125);
      playBellStrike(523.25, 1.58, 1.22, 0.04);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  })();
};

const getInitialAppState = (): TimerAppState => {
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
  return {
    manual: DEFAULT_MANUAL_TIMER_STATE,
  };
};

const getStoredScheduleYoutubeFavorites = () => {
  try {
    const savedFavorites = localStorage.getItem(SCHEDULE_YOUTUBE_FAVORITES_STORAGE_KEY);
    if (!savedFavorites) return [];
    return normalizeScheduleYoutubeFavorites(JSON.parse(savedFavorites));
  } catch {
    return [];
  }
};

function AnnouncementNotebookOverlay({
  isOpen,
  onClose,
  liveTimer,
  auctionItems,
  auctionAwards,
  awardableAuctionItems,
  auctionBids,
  onOpenAwardConfirm,
  onStartAwardQueue,
}: {
  isOpen: boolean;
  onClose: () => void;
  liveTimer: AnnouncementOverlayTimerState;
  auctionItems: AuctionItem[];
  auctionAwards: AuctionAwards;
  awardableAuctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  onOpenAwardConfirm: (item: AuctionItem) => void;
  onStartAwardQueue: (items: AuctionItem[]) => void;
}) {
  const [dateText, setDateText] = useState(() => getTodayAnnouncementDateText());
  const [noteText, setNoteText] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isViewingHistoryRecord, setIsViewingHistoryRecord] = useState(false);
  const [isAwardQueueConfirmOpen, setIsAwardQueueConfirmOpen] = useState(false);
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementNoteRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [todayAnnouncementDateKey, setTodayAnnouncementDateKey] = useState(() => getTodayAnnouncementDateKey());
  const [noteHighlightRanges, setNoteHighlightRanges] = useState<NoticeHighlightRange[]>([]);
  const [pendingNoteHighlightRange, setPendingNoteHighlightRange] = useState<NoticeHighlightRange | null>(null);
  const [noteHighlightPopoverPosition, setNoteHighlightPopoverPosition] = useState({ x: 0, y: 0 });
  const [announcementSaveState, setAnnouncementSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    isSupabaseSettingsEnabled ? 'idle' : 'saved',
  );
  const [remoteLoadedDateKey, setRemoteLoadedDateKey] = useState<string | null>(
    isSupabaseSettingsEnabled ? null : getTodayAnnouncementDateKey(),
  );
  const [isAwardMenuOpen, setIsAwardMenuOpen] = useState(false);

  const noteEditorRef = useRef<HTMLDivElement>(null);
  const notePaperBodyRef = useRef<HTMLDivElement>(null);
  const noteDisplayRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const announcementDialogRef = useRef<HTMLDivElement>(null);
  const announcementHistoryTriggerRef = useRef<HTMLButtonElement>(null);
  const hasRestoredRef = useRef(false);
  const hasEditedNoteTextRef = useRef(false);
  const remoteLoadTokenRef = useRef(0);
  const remoteSaveTimeoutRef = useRef<number | null>(null);
  const [noteRuleGapPx, setNoteRuleGapPx] = useState(104);

  useModalFocus({
    dialogRef: announcementDialogRef,
    isOpen,
    onDismiss: onClose,
    initialFocusRef: noteTextareaRef,
    isDismissible: !isHistoryOpen,
  });

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
          : getTodayAnnouncementDateText();
      const restoredDateKey = getAnnouncementDateKey(restoredDate);
      if (restoredDateKey !== getTodayAnnouncementDateKey()) {
        sessionStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY);
        return;
      }
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

        const hardLineCount = Math.max(1, noteText.split('\n').length);
        const visibleLineTarget = Math.min(
          ANNOUNCEMENT_MAX_VISIBLE_LINES,
          Math.max(ANNOUNCEMENT_MIN_VISIBLE_LINES, hardLineCount + 1),
        );
        const nextGap = Math.max(ANNOUNCEMENT_MIN_RULE_GAP_PX, Math.round(editor.clientHeight / visibleLineTarget));
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
  }, [isOpen, noteText]);

  const pagePaddingClass = 'p-2 sm:p-3 lg:px-4 lg:pb-4 lg:pt-3 xl:px-5 xl:pb-5 xl:pt-3';
  const paperTopClass = 'px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4';
  const paperBodyClass = 'px-3 pb-3 pt-0 sm:px-5 sm:pb-4 sm:pt-0';
  const stageLayoutClass = 'h-full w-full max-w-[1160px] min-h-0 flex-col';
  const paperShellLayoutClass = 'flex min-h-0 flex-1 flex-col';
  const paperBodyLayoutClass = 'flex flex-1 min-h-0 flex-col';
  const paperBodyStyle = {
    '--announcement-rule-gap': `${noteRuleGapPx}px`,
    '--announcement-rule-offset': `${Math.round(noteRuleGapPx * -0.24)}px`,
    '--announcement-note-font-size': `${Math.max(30, Math.min(42, Math.round(noteRuleGapPx * 0.39)))}px`,
    '--announcement-note-gutter-width': `${Math.max(42, Math.round(noteRuleGapPx * 0.5))}px`,
    '--announcement-note-number-size': `${Math.max(24, Math.min(34, Math.round(noteRuleGapPx * 0.32)))}px`,
  } as React.CSSProperties;
  const currentAnnouncementDateKey = getAnnouncementDateKey(dateText);
  const saveStateLabel =
    announcementSaveState === 'saving'
      ? '저장 중'
      : announcementSaveState === 'error'
        ? '저장 실패'
        : '저장됨';
  const announcementAuctionDayIndex = getAnnouncementAuctionDayIndex(dateText);
  const announcementDayAwardableAuctionItems = announcementAuctionDayIndex === null
    ? []
    : awardableAuctionItems.filter((item) => item.dayIndex === announcementAuctionDayIndex);
  const hasAwardableAuctionItems = announcementDayAwardableAuctionItems.length > 0;
  const announcementDayAwardedAuctionItems = announcementAuctionDayIndex === null
    ? []
    : getAuctionAwardsForDay(auctionItems, auctionAwards, announcementAuctionDayIndex);

  const focusNoteTextarea = () => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  };

  const handleNoteTextChange = (nextText: string) => {
    hasEditedNoteTextRef.current = true;
    setPendingNoteHighlightRange(null);
    setNoteText(nextText);
  };

  const syncNoteDisplayScroll = () => {
    const textarea = noteTextareaRef.current;
    const display = noteDisplayRef.current;
    const paperBody = notePaperBodyRef.current;
    if (!textarea || !display) return;

    display.scrollTop = textarea.scrollTop;
    display.scrollLeft = textarea.scrollLeft;
    paperBody?.style.setProperty('--announcement-note-scroll-y', `${textarea.scrollTop}px`);
  };

  const getNoteHighlightPopoverPosition = (selectionEnd: number) => {
    const textarea = noteTextareaRef.current;
    const editor = noteEditorRef.current;
    if (!textarea || !editor) return { x: 16, y: 16 };

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || noteRuleGapPx;
    const fontSize = Number.parseFloat(computedStyle.fontSize) || 36;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
    const textBeforeSelection = noteText.slice(0, selectionEnd);
    const linesBeforeSelection = textBeforeSelection.split('\n');
    const lineIndex = Math.max(0, linesBeforeSelection.length - 1);
    const lineText = linesBeforeSelection[lineIndex] || '';
    const estimatedTextX = Math.min(lineText.length * fontSize * 0.52, Math.max(0, editor.clientWidth - paddingLeft - 190));
    const x = Math.max(12, Math.min(editor.clientWidth - 168, paddingLeft + estimatedTextX - textarea.scrollLeft));
    const y = Math.max(
      12,
      Math.min(
        editor.clientHeight - 64,
        paddingTop + lineIndex * lineHeight + lineHeight * 0.56 - textarea.scrollTop,
      ),
    );

    return { x, y };
  };

  const applyNoteSelectionHighlight = () => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd);
    if (end <= start) {
      setPendingNoteHighlightRange(null);
      return;
    }

    setNoteHighlightPopoverPosition(getNoteHighlightPopoverPosition(end));
    setPendingNoteHighlightRange({ start, end, color: NOTICE_HIGHLIGHT_COLORS[0].id });
  };

  const applyPendingNoteHighlight = () => {
    if (!pendingNoteHighlightRange) return;
    const selectionEnd = pendingNoteHighlightRange.end;

    setNoteHighlightRanges((previous) =>
      normalizeNoticeHighlightRanges(
        [...previous, { ...pendingNoteHighlightRange, color: NOTICE_HIGHLIGHT_COLORS[0].id }],
        noteText,
      ),
    );
    setPendingNoteHighlightRange(null);
    const textarea = noteTextareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(selectionEnd, selectionEnd);
  };

  const cancelPendingNoteHighlight = () => {
    const selectionEnd = pendingNoteHighlightRange?.end ?? null;
    if (pendingNoteHighlightRange) {
      setNoteHighlightRanges((previous) =>
        removeNoticeHighlightRange(previous, pendingNoteHighlightRange, noteText),
      );
    }
    setPendingNoteHighlightRange(null);
    const textarea = noteTextareaRef.current;
    textarea?.focus();
    if (selectionEnd !== null) {
      textarea?.setSelectionRange(selectionEnd, selectionEnd);
    }
  };

  const insertSafetyPhrase = () => {
    const textarea = noteTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? noteText.length;
    const selectionEnd = textarea?.selectionEnd ?? noteText.length;
    const before = noteText.slice(0, selectionStart);
    const after = noteText.slice(selectionEnd);
    const nextText = `${before}${ANNOUNCEMENT_SAFETY_PHRASE}${after}`;
    const cursorPosition = before.length + ANNOUNCEMENT_SAFETY_PHRASE.length;

    hasEditedNoteTextRef.current = true;
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

    hasEditedNoteTextRef.current = true;
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

  const refreshAnnouncementHistory = async () => {
    if (!isSupabaseSettingsEnabled) return;

    setIsHistoryLoading(true);
    try {
      setAnnouncementHistory(await loadAnnouncementNoteHistory());
    } catch (error) {
      console.error('Failed to load announcement note history from Supabase.', error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openAnnouncementHistory = () => {
    setIsHistoryOpen(true);
    setIsAwardMenuOpen(false);
    void refreshAnnouncementHistory();
    void playAnnouncementSound('pop');
  };

  const openAwardConfirmFromAnnouncement = (item: AuctionItem) => {
    setIsAwardMenuOpen(false);
    onOpenAwardConfirm(item);
  };

  const startAnnouncementDayAwards = () => {
    if (announcementDayAwardableAuctionItems.length === 0) {
      setIsAwardMenuOpen(false);
      return;
    }

    setIsAwardMenuOpen(false);
    onStartAwardQueue(announcementDayAwardableAuctionItems);
  };

  const selectAnnouncementHistoryRecord = (record: AnnouncementNoteRecord) => {
    const nextDateText = normalizeAnnouncementDateText(record.date_text || record.date_key);
    hasEditedNoteTextRef.current = false;
    setDateText(nextDateText);
    setNoteText(record.note);
    setRemoteLoadedDateKey(record.date_key);
    setIsViewingHistoryRecord(true);
    setIsHistoryOpen(false);
    setAnnouncementSaveState('saved');
    void playAnnouncementSound('pop');

    window.requestAnimationFrame(() => {
      focusNoteTextarea();
      syncNoteDisplayScroll();
    });
  };

  useEffect(() => {
    if (!hasHydrated) return;
    persistAnnouncementNote(dateText, noteText);
  }, [dateText, hasHydrated, noteText]);

  useEffect(() => {
    if (!hasHydrated) return;

    try {
      const savedHighlights = localStorage.getItem(getAnnouncementNoteHighlightStorageKey(currentAnnouncementDateKey));
      setNoteHighlightRanges(normalizeNoticeHighlightRanges(JSON.parse(savedHighlights || '[]'), noteText));
    } catch {
      setNoteHighlightRanges([]);
    }
    setPendingNoteHighlightRange(null);
  }, [currentAnnouncementDateKey, hasHydrated]);

  useEffect(() => {
    setNoteHighlightRanges((previous) => {
      const normalized = normalizeNoticeHighlightRanges(previous, noteText);
      return JSON.stringify(previous) === JSON.stringify(normalized) ? previous : normalized;
    });
  }, [noteText]);

  useEffect(() => {
    if (!hasHydrated) return;

    try {
      const normalized = normalizeNoticeHighlightRanges(noteHighlightRanges, noteText);
      localStorage.setItem(
        getAnnouncementNoteHighlightStorageKey(currentAnnouncementDateKey),
        JSON.stringify(normalized),
      );
    } catch {
      // Ignore local storage write errors.
    }
  }, [currentAnnouncementDateKey, hasHydrated, noteHighlightRanges, noteText]);

  useEffect(() => {
    const updateTodayKey = () => {
      const nextTodayKey = getTodayAnnouncementDateKey();
      setTodayAnnouncementDateKey((previous) => (previous === nextTodayKey ? previous : nextTodayKey));
    };

    updateTodayKey();
    const intervalId = window.setInterval(updateTodayKey, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isOpen || isViewingHistoryRecord) return;
    if (currentAnnouncementDateKey === todayAnnouncementDateKey) return;

    setDateText(getTodayAnnouncementDateText());
    hasEditedNoteTextRef.current = false;
    setNoteText('');
    setRemoteLoadedDateKey(isSupabaseSettingsEnabled ? null : todayAnnouncementDateKey);
    setAnnouncementSaveState(isSupabaseSettingsEnabled ? 'idle' : 'saved');

    try {
      sessionStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY);
    } catch {
      // Ignore session storage errors.
    }
  }, [currentAnnouncementDateKey, isOpen, isViewingHistoryRecord, todayAnnouncementDateKey]);

  useEffect(() => {
    if (!isOpen || !hasHydrated || !isSupabaseSettingsEnabled) return;

    const dateKey = getAnnouncementDateKey(dateText);
    if (remoteLoadedDateKey === dateKey) return;

    const loadToken = remoteLoadTokenRef.current + 1;
    remoteLoadTokenRef.current = loadToken;
    setAnnouncementSaveState('idle');

    void loadAnnouncementNote(dateKey)
      .then((record) => {
        if (remoteLoadTokenRef.current !== loadToken) return;

        if (record) {
          const nextDateText = normalizeAnnouncementDateText(record.date_text || record.date_key);
          setDateText(nextDateText);
          if (!hasEditedNoteTextRef.current) {
            setNoteText(record.note);
          }
        }

        setRemoteLoadedDateKey(dateKey);
        setAnnouncementSaveState('saved');
      })
      .catch((error) => {
        if (remoteLoadTokenRef.current !== loadToken) return;
        console.error('Failed to load announcement note from Supabase.', error);
        setRemoteLoadedDateKey(dateKey);
        setAnnouncementSaveState('error');
      });
  }, [dateText, hasHydrated, isOpen, remoteLoadedDateKey]);

  useEffect(() => {
    if (!hasHydrated || !isSupabaseSettingsEnabled) return;
    if (remoteLoadedDateKey !== currentAnnouncementDateKey) return;

    if (noteText.trim().length === 0) {
      setAnnouncementSaveState('saved');
      return;
    }

    if (remoteSaveTimeoutRef.current !== null) {
      window.clearTimeout(remoteSaveTimeoutRef.current);
    }

    setAnnouncementSaveState('saving');
    remoteSaveTimeoutRef.current = window.setTimeout(() => {
      remoteSaveTimeoutRef.current = null;
      void saveAnnouncementNote({
        date_key: currentAnnouncementDateKey,
        date_text: normalizeAnnouncementDateText(dateText),
        note: noteText,
      })
        .then(() => {
          setAnnouncementSaveState('saved');
          if (isHistoryOpen) {
            void refreshAnnouncementHistory();
          }
        })
        .catch((error) => {
          console.error('Failed to save announcement note to Supabase.', error);
          setAnnouncementSaveState('error');
        });
    }, 700);

    return () => {
      if (remoteSaveTimeoutRef.current !== null) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
        remoteSaveTimeoutRef.current = null;
      }
    };
  }, [currentAnnouncementDateKey, dateText, hasHydrated, isHistoryOpen, noteText, remoteLoadedDateKey]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncNoteDisplayScroll();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, noteRuleGapPx, noteText]);

  useEffect(() => {
    if (!isOpen) return;

    const handleAnnouncementShortcuts = (event: KeyboardEvent) => {
      if (isComposingKeyboardEvent(event)) return;
      if (event.key !== 'Escape' || !isHistoryOpen) return;

      event.preventDefault();
      event.stopPropagation();
      setIsHistoryOpen(false);
      announcementHistoryTriggerRef.current?.focus({ preventScroll: true });
    };

    window.addEventListener('keydown', handleAnnouncementShortcuts);
    return () => window.removeEventListener('keydown', handleAnnouncementShortcuts);
  }, [isHistoryOpen, isOpen]);

  useEffect(() => {
    if (!isOpen || awardableAuctionItems.length === 0) {
      setIsAwardMenuOpen(false);
      setIsAwardQueueConfirmOpen(false);
    }
  }, [awardableAuctionItems.length, isOpen]);

  const handleClose = () => {
    void playAnnouncementSound('pop');
    setIsViewingHistoryRecord(false);
    setIsHistoryOpen(false);
    setIsAwardMenuOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="announcement-overlay fixed inset-0 z-[60] p-2 sm:p-3 md:p-5">
      <div
        ref={announcementDialogRef}
        className="apple-material-layer announcement-shell mascot-shell app-tone-calm relative mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-[1220px] flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]"
        role="dialog"
        aria-modal="true"
        aria-label="알림장"
        tabIndex={-1}
      >
        <div aria-hidden="true" className="mascot-orb mascot-orb-one" />
        <div aria-hidden="true" className="mascot-orb mascot-orb-two" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-one" />
        <div aria-hidden="true" className="mascot-leaf mascot-leaf-two" />

        <div className={`announcement-page flex min-h-0 flex-1 flex-col overflow-hidden ${pagePaddingClass}`}>
          <div className={`announcement-stage mx-auto flex ${stageLayoutClass}`}>
            <div className={`announcement-paper paper-card relative ${paperShellLayoutClass} overflow-hidden rounded-[2.6rem] border-2 border-[#E6D5C9] bg-[#fffcf8]`}>
              <div className="announcement-paper-top announcement-paper-top-clean shrink-0 border-b border-[#EADFD1] px-3 py-3 sm:px-5 md:px-6 md:py-4">
                <div className="announcement-date-row announcement-date-row-clean">
                  <NotebookOverlayTimerBadge liveTimer={liveTimer} />
                  <input
                    value={dateText}
                    onChange={(event) => {
                      setIsViewingHistoryRecord(false);
                      setDateText(event.target.value);
                    }}
                    onBlur={() => {
                      setIsViewingHistoryRecord(false);
                      setDateText((prev) => normalizeAnnouncementDateText(prev));
                    }}
                    onKeyDown={(event) => {
                      if (isComposingKeyboardEvent(event)) return;
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setIsViewingHistoryRecord(false);
                        setDateText((prev) => normalizeAnnouncementDateText(prev));
                        focusNoteTextarea();
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        focusNoteTextarea();
                      }
                    }}
                    placeholder="2026년 3월 17일"
                    className="announcement-date-input announcement-date-input-clean"
                    type="text"
                  />
                  <div className="announcement-date-actions announcement-date-actions-clean" data-capture-exclude="true">
                    <span
                      className={`announcement-save-badge inline-flex items-center rounded-full border px-3 text-sm font-extrabold ${
                        announcementSaveState === 'error'
                          ? 'border-[#E5B8AA] bg-[#FFF4F0] text-[#B55E4C]'
                          : 'border-[#D7E2D1] bg-[#F5FAF2] text-[#5C8D6D]'
                      }`}
                    >
                      {saveStateLabel}
                    </span>
                    <button
                      ref={announcementHistoryTriggerRef}
                      onClick={openAnnouncementHistory}
                      className="announcement-date-action-history announcement-chip-button announcement-action-button inline-flex items-center justify-center rounded-full border border-[#dcc7ae] text-[#8A6347]"
                      type="button"
                      title="알림장 기록"
                      aria-label="알림장 기록"
                    >
                      <BookOpen size={18} />
                    </button>
                    <button
                      onClick={handleClose}
                      className="announcement-close-button announcement-close-button-clean"
                      type="button"
                      title="돌아가기"
                      aria-label="돌아가기"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={notePaperBodyRef}
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
                  <div ref={noteDisplayRef} aria-hidden="true" className="announcement-note-display" lang="ko">
                    <div className="announcement-note-display-content">
                      {renderAnnouncementNoteDisplay(
                        noteText,
                        normalizeNoticeHighlightRanges(noteHighlightRanges, noteText),
                      )}
                    </div>
                  </div>
                  <textarea
                    ref={noteTextareaRef}
                    value={noteText}
                    onChange={(event) => handleNoteTextChange(event.target.value)}
                    onKeyDown={handleNoteTextareaKeyDown}
                    onKeyUp={(event) => {
                      if (!event.nativeEvent.isComposing) {
                        applyNoteSelectionHighlight();
                      }
                    }}
                    onMouseUp={applyNoteSelectionHighlight}
                    onTouchEnd={applyNoteSelectionHighlight}
                    onScroll={syncNoteDisplayScroll}
                    className="announcement-note-textarea"
                    placeholder={ANNOUNCEMENT_NOTE_PLACEHOLDER}
                    spellCheck={false}
                    lang="ko"
                  />
                  {pendingNoteHighlightRange ? (
                    <div
                      className="announcement-note-highlight-popover absolute z-[5] inline-flex items-center gap-2 rounded-full border bg-white/95 p-2 shadow-[0_12px_22px_rgba(56,37,26,0.16)] backdrop-blur"
                      style={{
                        left: noteHighlightPopoverPosition.x,
                        top: noteHighlightPopoverPosition.y,
                      }}
                      data-capture-exclude="true"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={applyPendingNoteHighlight}
                        className="announcement-note-highlight-apply-button rounded-full px-4 py-2 text-[0.95rem] font-extrabold text-white"
                      >
                        강조
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={cancelPendingNoteHighlight}
                        className="rounded-full px-3 py-2 text-[0.95rem] font-extrabold text-[#3b241d] transition-colors hover:bg-[#f6eee8]"
                      >
                        취소
                      </button>
                    </div>
                  ) : null}
                  <div className="announcement-note-inline-tools gap-2" data-capture-exclude="true">
                    {announcementDayAwardedAuctionItems.length > 0 ? (
                      <div className="pointer-events-auto w-[min(22rem,calc(100vw-8rem))] rounded-[1rem] border border-[#D7E6DE] bg-white/95 p-2.5 shadow-[0_8px_18px_rgba(31,24,18,0.1)] backdrop-blur">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[0.78rem] font-black text-[#006241]">오늘 낙찰</span>
                          <span className="rounded-full bg-[#EEF7F2] px-2 py-0.5 text-[0.68rem] font-black text-[#006241]">
                            {announcementDayAwardedAuctionItems.length}건
                          </span>
                        </div>
                        <div className="grid max-h-[8.75rem] gap-1 overflow-y-auto pr-0.5">
                          {announcementDayAwardedAuctionItems.map(({ item, award }) => (
                            <div
                              key={award.itemId}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[0.65rem] bg-[#F5FAF7] px-2 py-1.5 text-[0.72rem] font-black text-[#46534B]"
                            >
                              <span className="min-w-0 truncate">{getAuctionItemDisplayName(item.name, item.dayIndex)}</span>
                              <span className="shrink-0 font-mono text-[#006241]">{award.winner}번 · {formatCurrency(award.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {isAwardQueueConfirmOpen ? (
                      <div
                        className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
                        role="presentation"
                        onClick={() => setIsAwardQueueConfirmOpen(false)}
                      >
                        <div
                          className="apple-material-layer w-full max-w-[24rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.24)]"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="announcement-award-confirm-title"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <h3 id="announcement-award-confirm-title" className="section-title text-[1.35rem] font-extrabold text-[#2F241D]">
                            낙찰 처리할까요?
                          </h3>
                          <p className="mt-2 text-[0.95rem] font-extrabold leading-6 text-[#6E5139]">
                            {announcementDayAwardableAuctionItems.length}개 물품의 최고 입찰자를 확정하고 낙찰가를 차감합니다.
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setIsAwardQueueConfirmOpen(false)}
                              className="inline-flex h-11 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white px-4 text-[0.95rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={startAnnouncementDayAwards}
                              className="inline-flex h-11 items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
                            >
                              낙찰 시작
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {isAwardMenuOpen ? (
                      <div
                        className="pointer-events-auto absolute bottom-[4.2rem] right-0 z-[6] w-[min(21rem,calc(100vw-2.4rem))] rounded-[1.2rem] border border-[#D7E6DE] bg-white/95 p-2.5 shadow-[0_18px_34px_rgba(31,24,18,0.18)] backdrop-blur"
                        role="menu"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <span className="section-title text-[0.9rem] font-black text-[#006241]">낙찰 대기</span>
                          <span className="shrink-0 rounded-full bg-[#EEF7F2] px-2 py-1 text-[0.72rem] font-black text-[#00754A]">
                            {announcementDayAwardableAuctionItems.length}개
                          </span>
                        </div>
                        <div className="custom-scrollbar grid max-h-[15rem] gap-1.5 overflow-y-auto pr-0.5">
                          {announcementDayAwardableAuctionItems.map((item) => {
                            const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
                            const weekdayLabel = AUCTION_WEEKDAY_LABELS[item.dayIndex] ?? `${item.dayIndex + 1}`;
                            const itemDisplayName = getAuctionItemDisplayName(item.name, item.dayIndex);

                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => openAwardConfirmFromAnnouncement(item)}
                                className="flex min-h-[3.75rem] w-full items-center justify-between gap-2 rounded-[0.95rem] border border-[#DCEBE4] bg-[#FCFFFC] px-3 py-2 text-left transition-colors hover:border-[#8DBEA8] hover:bg-[#F3FAF6]"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-[0.95rem] font-black text-[#243832]">
                                    {itemDisplayName}
                                  </span>
                                  <span className="mt-1 block text-[0.74rem] font-extrabold text-[#6E8078]">
                                    {weekdayLabel}요일
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  <span
                                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[0.74rem] font-black text-white"
                                    style={getStudentLabelStyle(currentBid.bidder ?? 0)}
                                  >
                                    {currentBid.bidder ?? '-'}번
                                  </span>
                                  <span className="rounded-full border border-[#CDE8DD] bg-white px-2.5 py-1 text-[0.78rem] font-black text-[#00754A]">
                                    {formatCurrency(currentBid.amount)}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    <button
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setIsAwardQueueConfirmOpen(true)}
                      disabled={!hasAwardableAuctionItems}
                      className={`announcement-note-inline-action announcement-chip-button inline-flex h-[3.35rem] items-center justify-center gap-2 rounded-full border px-4 font-black ${
                        hasAwardableAuctionItems
                          ? 'border-[#00754A] bg-[#00754A] text-white'
                          : 'border-[#D9E4DE] text-[#8A7A6B]'
                      }`}
                      style={hasAwardableAuctionItems ? { background: '#00754A', borderColor: '#00754A', color: '#FFFFFF' } : undefined}
                      type="button"
                      title={hasAwardableAuctionItems ? '해당 날짜 낙찰 발표' : '해당 날짜 낙찰 대기 물품 없음'}
                      aria-label={hasAwardableAuctionItems ? `해당 날짜 낙찰 발표 ${announcementDayAwardableAuctionItems.length}건` : '해당 날짜 낙찰 대기 물품 없음'}
                    >
                      <Trophy size={18} className={hasAwardableAuctionItems ? 'text-white' : 'text-[#8A7A6B]'} />
                      <span className="hidden text-[0.86rem] sm:inline">낙찰</span>
                      {hasAwardableAuctionItems ? (
                        <span className="rounded-full bg-white/18 px-1.5 text-[0.72rem]">{announcementDayAwardableAuctionItems.length}</span>
                      ) : null}
                    </button>
                    <button
                      onMouseDown={(event) => event.preventDefault()}
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
        {isHistoryOpen ? (
          <div className="announcement-history-overlay absolute inset-0 z-40 flex justify-end bg-black/25 p-2 backdrop-blur-sm sm:p-4" data-capture-exclude="true">
            <aside className="announcement-history-panel flex h-full w-full max-w-[38rem] flex-col overflow-hidden rounded-[1.5rem] border border-[#D7E2D1] bg-[#FCFFFC] shadow-2xl">
              <div className="announcement-history-header flex shrink-0 items-center justify-between border-b border-[#D7E2D1] px-5 py-4">
                <div>
                  <h3 className="announcement-history-title section-title text-xl font-extrabold text-[#006241]">알림장 기록</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    void playAnnouncementSound('pop');
                    window.requestAnimationFrame(() => announcementHistoryTriggerRef.current?.focus({ preventScroll: true }));
                  }}
                  className="icon-button rounded-full p-2 text-[#8A6347]/70 transition-colors hover:bg-[#F7F0E7] hover:text-[#8A6347]"
                  title="기록 닫기"
                  aria-label="기록 닫기"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
                {isHistoryLoading ? (
                  <div className="flex min-h-[14rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#E6D5C9] bg-white/70 text-center text-sm font-extrabold text-[#8A6347]/65">
                    불러오는 중
                  </div>
                ) : announcementHistory.length > 0 ? (
                  <div className="space-y-4">
                    {announcementHistory.map((record) => {
                      const isCurrentRecord = record.date_key === currentAnnouncementDateKey;
                      const notePreview = record.note.trim();
                      const updatedAt = formatAnnouncementUpdatedAt(record.updated_at);

                      return (
                        <button
                          key={record.date_key}
                          type="button"
                          onClick={() => selectAnnouncementHistoryRecord(record)}
                          className={`announcement-history-card block w-full rounded-[1.15rem] border p-4 text-left transition-colors ${
                            isCurrentRecord
                              ? 'border-[#8DBEA8] bg-[#F3FAF6]'
                              : 'border-[#D7E2D1] bg-white hover:border-[#8DBEA8] hover:bg-[#F8FCF9]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[1.05rem] font-extrabold text-[#243832]">
                              {normalizeAnnouncementDateText(record.date_text || record.date_key)}
                            </span>
                            {updatedAt ? (
                              <span className="shrink-0 rounded-full bg-[#EDF5F0] px-2.5 py-1 text-[0.72rem] font-extrabold text-[#006241]">
                                {updatedAt}
                              </span>
                            ) : null}
                          </div>
                          <div className="announcement-history-note mt-3 whitespace-pre-wrap break-keep rounded-[0.9rem] border border-[#E5EEE9] bg-[#FAFCFA] px-3.5 py-3 text-[0.95rem] font-bold leading-7 text-[#43534D]">
                            {notePreview || '내용 없음'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[14rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#E6D5C9] bg-white/70 text-center text-sm font-extrabold text-[#8A6347]/65">
                    저장된 알림장이 없습니다.
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : null}
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
  const memoDialogRef = useRef<HTMLDivElement>(null);
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

  const clearMemo = () => {
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

  useModalFocus({
    dialogRef: memoDialogRef,
    isOpen,
    onDismiss: handleClose,
    initialFocusRef: memoEditorRef,
  });

  if (!isOpen) return null;

  return (
    <div className="announcement-overlay fixed inset-0 z-[60] p-2 sm:p-3 md:p-5">
      <div
        ref={memoDialogRef}
        className="apple-material-layer memo-shell mascot-shell app-tone-calm relative mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-[1220px] flex-col overflow-hidden rounded-[2rem] md:rounded-[3rem]"
        role="dialog"
        aria-modal="true"
        aria-label="메모"
        tabIndex={-1}
      >
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

function ScheduleYoutubePlayer({
  videoIds,
  shouldAutoplay,
  selectedIndex,
  selectionRequestId,
  onActiveIndexChange,
  onVideoMetadataChange,
}: {
  videoIds: string[];
  shouldAutoplay: boolean;
  selectedIndex: number;
  selectionRequestId: number;
  onActiveIndexChange: (index: number) => void;
  onVideoMetadataChange: (index: number, metadata: ScheduleYoutubeMetadata) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubePlayerInstance | null>(null);
  const autoplayRetryRef = useRef(false);
  const shouldAutoplayRef = useRef(shouldAutoplay);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const onVideoMetadataChangeRef = useRef(onVideoMetadataChange);
  const queuedVideoIdsRef = useRef(videoIds);
  const selectedIndexRef = useRef(selectedIndex);
  const activeVideoIdRef = useRef(videoIds[0] || '');
  const activeIndexRef = useRef(0);
  const hasReachedQueueEndRef = useRef(false);
  const playlistKey = videoIds.join(',');

  queuedVideoIdsRef.current = videoIds;
  shouldAutoplayRef.current = shouldAutoplay;
  onActiveIndexChangeRef.current = onActiveIndexChange;
  onVideoMetadataChangeRef.current = onVideoMetadataChange;
  selectedIndexRef.current = selectedIndex;

  const captureVideoMetadata = (player: YoutubePlayerInstance, index: number) => {
    const videoData = player.getVideoData?.();
    const title = (videoData?.title || '').trim();
    if (!title) return;

    onVideoMetadataChangeRef.current(index, {
      title,
      channelTitle: (videoData?.author || '').trim(),
      thumbnailUrl: '',
    });
  };

  const scheduleVideoMetadataCapture = (player: YoutubePlayerInstance, index: number) => {
    captureVideoMetadata(player, index);
    window.setTimeout(() => captureVideoMetadata(player, index), 600);
    window.setTimeout(() => captureVideoMetadata(player, index), 1600);
  };

  const playVideoAtIndex = (player: YoutubePlayerInstance, index: number, muted = false) => {
    const nextVideoId = queuedVideoIdsRef.current[index];
    if (!nextVideoId) return;

    activeIndexRef.current = index;
    activeVideoIdRef.current = nextVideoId;
    hasReachedQueueEndRef.current = false;
    onActiveIndexChangeRef.current(index);

    if (muted) {
      player.mute();
    } else {
      player.unMute();
    }

    player.loadVideoById(nextVideoId);
    player.playVideo();
    scheduleVideoMetadataCapture(player, index);
  };

  const cueVideoAtIndex = (player: YoutubePlayerInstance, index: number) => {
    const nextVideoId = queuedVideoIdsRef.current[index];
    if (!nextVideoId) return;

    activeIndexRef.current = index;
    activeVideoIdRef.current = nextVideoId;
    hasReachedQueueEndRef.current = false;
    onActiveIndexChangeRef.current(index);
    player.cueVideoById(nextVideoId);
    scheduleVideoMetadataCapture(player, index);
  };

  const playNextVideo = (player: YoutubePlayerInstance) => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex >= queuedVideoIdsRef.current.length) {
      hasReachedQueueEndRef.current = true;
      return;
    }

    autoplayRetryRef.current = false;
    playVideoAtIndex(player, nextIndex);
  };

  const isCurrentVideoNearEnd = (player: YoutubePlayerInstance) => {
    const duration = player.getDuration();
    const currentTime = player.getCurrentTime();

    return (
      Number.isFinite(duration) &&
      Number.isFinite(currentTime) &&
      duration > 0 &&
      currentTime >= duration - YOUTUBE_END_DETECTION_SECONDS
    );
  };

  useEffect(() => {
    if (videoIds.length === 0 || playerRef.current) return;

    let isCancelled = false;
    autoplayRetryRef.current = false;

    void loadYoutubeIframeApi()
      .then((YT) => {
        if (isCancelled || !containerRef.current || playerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          width: '100%',
          height: '100%',
          videoId: videoIds[0],
          playerVars: {
            autoplay: shouldAutoplay ? 1 : 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (shouldAutoplayRef.current) {
                playVideoAtIndex(event.target, 0);
              } else {
                cueVideoAtIndex(event.target, 0);
              }
            },
            onAutoplayBlocked: (event) => {
              if (!shouldAutoplayRef.current) return;
              if (autoplayRetryRef.current) return;
              autoplayRetryRef.current = true;
              cueVideoAtIndex(event.target, activeIndexRef.current);
            },
            onStateChange: (event) => {
              scheduleVideoMetadataCapture(event.target, activeIndexRef.current);
              if (event.data !== YOUTUBE_PLAYER_STATE_ENDED) return;
              playNextVideo(event.target);
            },
          },
        });
      })
      .catch((error) => {
        console.error('Failed to initialize the schedule YouTube player.', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [videoIds.length, shouldAutoplay]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || videoIds.length === 0) return;

    const currentIndex = activeVideoIdRef.current ? videoIds.indexOf(activeVideoIdRef.current) : -1;
    if (currentIndex >= 0) {
      activeIndexRef.current = currentIndex;

      if (shouldAutoplay && hasReachedQueueEndRef.current && currentIndex < videoIds.length - 1) {
        autoplayRetryRef.current = false;
        playVideoAtIndex(player, currentIndex + 1);
      }
      return;
    }

    autoplayRetryRef.current = false;
    if (shouldAutoplay) {
      playVideoAtIndex(player, 0);
    } else {
      cueVideoAtIndex(player, 0);
    }
  }, [playlistKey, shouldAutoplay]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || queuedVideoIdsRef.current.length === 0 || selectionRequestId === 0) return;

    const nextIndex = Math.max(0, Math.min(selectedIndexRef.current, queuedVideoIdsRef.current.length - 1));
    autoplayRetryRef.current = false;
    playVideoAtIndex(player, nextIndex);
  }, [selectionRequestId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || hasReachedQueueEndRef.current) return;
      if (queuedVideoIdsRef.current.length <= 1) return;

      const playerState = player.getPlayerState();
      if (
        playerState === YOUTUBE_PLAYER_STATE_ENDED ||
        (playerState === YOUTUBE_PLAYER_STATE_PLAYING && isCurrentVideoNearEnd(player))
      ) {
        playNextVideo(player);
      }
    }, 800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}

const STUDENT_CHARACTER_WALK_PATHS = [
  {
    startTop: '82vh',
    midTopA: '80vh',
    midTopB: '78vh',
    endTop: '80vh',
    size: 'min(27vw, 29vh, 14rem)',
    scale: '0.94',
    bobDuration: '1720ms',
    bobLift: '-0.36rem',
    bobTilt: '0.7deg',
    easing: 'linear',
    zIndex: 27,
    depthStart: 82000,
    depthMidA: 80000,
    depthMidB: 78000,
    depthEnd: 80000,
  },
  {
    startTop: '80vh',
    midTopA: '81vh',
    midTopB: '83vh',
    endTop: '82vh',
    size: 'min(31vw, 33vh, 16rem)',
    scale: '1',
    bobDuration: '1600ms',
    bobLift: '-0.52rem',
    bobTilt: '0.45deg',
    easing: 'linear',
    zIndex: 30,
    depthStart: 80000,
    depthMidA: 81000,
    depthMidB: 83000,
    depthEnd: 82000,
  },
  {
    startTop: '81vh',
    midTopA: '78vh',
    midTopB: '80vh',
    endTop: '84vh',
    size: 'min(29vw, 31vh, 15rem)',
    scale: '0.98',
    bobDuration: '1880ms',
    bobLift: '-0.3rem',
    bobTilt: '0.9deg',
    easing: 'linear',
    zIndex: 32,
    depthStart: 81000,
    depthMidA: 78000,
    depthMidB: 80000,
    depthEnd: 84000,
  },
  {
    startTop: '78vh',
    midTopA: '80vh',
    midTopB: '82vh',
    endTop: '81vh',
    size: 'min(25vw, 28vh, 13.5rem)',
    scale: '0.9',
    bobDuration: '1660ms',
    bobLift: '-0.42rem',
    bobTilt: '0.6deg',
    easing: 'linear',
    zIndex: 24,
    depthStart: 78000,
    depthMidA: 80000,
    depthMidB: 82000,
    depthEnd: 81000,
  },
  {
    startTop: '83vh',
    midTopA: '84vh',
    midTopB: '81vh',
    endTop: '79vh',
    size: 'min(32vw, 34vh, 16.5rem)',
    scale: '1.04',
    bobDuration: '1740ms',
    bobLift: '-0.46rem',
    bobTilt: '0.5deg',
    easing: 'linear',
    zIndex: 34,
    depthStart: 83000,
    depthMidA: 84000,
    depthMidB: 81000,
    depthEnd: 79000,
  },
] as const;

interface StudentCharacterWalker {
  renderKey: string;
  character: StudentCharacter;
  direction: 'left' | 'right';
  path: (typeof STUDENT_CHARACTER_WALK_PATHS)[number];
  animationDelaySeconds: number;
  spawnScale: number;
  shouldSpeak: boolean;
}

const STUDENT_CHARACTER_SPAWN_SCALES = [0.85, 0.9, 0.95, 0.95, 1, 1, 1, 1.05, 1.05, 1.1, 1.15] as const;

const shouldStudentCharacterSpeak = (spawnOrder: number, characterIndex: number, streamIndex: number) => {
  const seed = (spawnOrder + 7) * 37 + (characterIndex + 3) * 19 + streamIndex * 11;
  return seed % 17 === 0 || seed % 23 === 5 || seed % 29 === 9;
};

const getStableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getStudentCharacterSpawnScale = (seedValue: string) =>
  STUDENT_CHARACTER_SPAWN_SCALES[getStableHash(seedValue) % STUDENT_CHARACTER_SPAWN_SCALES.length];

const getSeededRandom = (seedValue: string) => {
  let seed = getStableHash(seedValue) || 1;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const getShuffledStudentCharacters = (characters: StudentCharacter[], seedValue: string) => {
  if (characters.length <= 1) return characters;

  const shuffled = [...characters];
  const random = getSeededRandom(seedValue);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

function StudentCharacterShowcase({
  character,
  timerType,
  direction,
  path,
  animationDelaySeconds,
  spawnScale,
  shouldSpeak,
  onImageError,
}: {
  character: StudentCharacter;
  timerType: TimerType;
  direction: 'left' | 'right';
  path: (typeof STUDENT_CHARACTER_WALK_PATHS)[number];
  animationDelaySeconds: number;
  spawnScale: number;
  shouldSpeak: boolean;
  onImageError: (characterId: string) => void;
}) {
  const [initialAnimationDelaySeconds] = useState(animationDelaySeconds);
  const modeLabel =
    timerType === 'lunch'
      ? '점심시간'
      : timerType === 'break'
        ? '쉬는시간'
        : '일정 없음';
  const shouldUseSpeechImage = shouldSpeak && Boolean(character.speechImageSrc);
  const characterImageSrc = shouldUseSpeechImage ? character.speechImageSrc || character.imageSrc : character.imageSrc;
  const characterImageAlt =
    shouldUseSpeechImage && character.speechImageAlt ? character.speechImageAlt : character.alt;
  const imageTransform = character.walkTransform?.[direction] || (direction === 'left' ? 'scaleX(-1)' : 'none');
  const frameStyle = {
    '--student-character-accent': character.themeColor || '#7AA160',
    '--student-character-walk-start-top': path.startTop,
    '--student-character-walk-mid-top-a': path.midTopA,
    '--student-character-walk-mid-top-b': path.midTopB,
    '--student-character-walk-end-top': path.endTop,
    '--student-character-route-start-top': path.startTop,
    '--student-character-route-mid-top-a': path.midTopA,
    '--student-character-route-mid-top-b': path.midTopB,
    '--student-character-route-end-top': path.endTop,
    '--student-character-walk-size': path.size,
    '--student-character-walk-scale': path.scale,
    '--student-character-walk-duration': `${STUDENT_CHARACTER_WALK_SECONDS}s`,
    '--student-character-walk-delay': `${initialAnimationDelaySeconds}s`,
    '--student-character-spawn-scale': spawnScale,
    '--student-character-walk-easing': path.easing,
    '--student-character-bob-duration': path.bobDuration,
    '--student-character-bob-lift': path.bobLift,
    '--student-character-bob-tilt': path.bobTilt,
    '--student-character-depth-z': path.zIndex,
    '--student-character-depth-start': path.depthStart,
    '--student-character-depth-mid-a': path.depthMidA,
    '--student-character-depth-mid-b': path.depthMidB,
    '--student-character-depth-end': path.depthEnd,
    '--student-character-image-transform': imageTransform,
    '--student-character-speech-top': character.speechTop || '-0.65rem',
  } as React.CSSProperties;

  return (
    <div
      key={character.id}
      className={`student-character-showcase student-character-walk-${direction}`}
      aria-label={`${modeLabel} 자캐`}
      style={frameStyle}
    >
      <div className="student-character-path">
        <div className="student-character-scale">
          <div className="student-character-spawn-scale">
            <div className="student-character-frame">
              {shouldSpeak && character.speech && !shouldUseSpeechImage ? (
                <div className="student-character-speech" aria-hidden="true">
                  {character.speech}
                </div>
              ) : null}
              <img
                src={characterImageSrc}
                alt={characterImageAlt}
                className="student-character-image"
                draggable={false}
                onError={() => onImageError(character.id)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimerPage() {
  const shouldReduceMotion = useReducedMotion();
  const initialState = getInitialAppState();
  const [initialRandomDrawState] = useState(() => getInitialRandomDrawState());
  const [initialScheduleYoutubeState] = useState(() => getInitialScheduleYoutubeState());
  const [scheduleNotice, setScheduleNotice] = useState(() => localStorage.getItem('scheduleNotice') || '');
  const [scheduleNoticeHighlights, setScheduleNoticeHighlights] = useState<NoticeHighlightRange[]>(() => {
    const savedNotice = localStorage.getItem('scheduleNotice') || '';
    try {
      return normalizeNoticeHighlightRanges(
        JSON.parse(localStorage.getItem(SCHEDULE_NOTICE_HIGHLIGHTS_STORAGE_KEY) || '[]'),
        savedNotice,
      );
    } catch {
      return [];
    }
  });
  const [pendingNoticeHighlightRange, setPendingNoticeHighlightRange] = useState<NoticeHighlightRange | null>(null);
  const [noticeHighlightPopoverPosition, setNoticeHighlightPopoverPosition] = useState({ x: 0, y: 0 });
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
  const [isYoutubePanelOpen, setIsYoutubePanelOpen] = useState(false);
  const [isClasswordPanelOpen, setIsClasswordPanelOpen] = useState(false);
  const [isCurrencyPanelOpen, setIsCurrencyPanelOpen] = useState(false);
  const [isQuestionSubmissionPanelOpen, setIsQuestionSubmissionPanelOpen] = useState(false);
  const [selectedEmotionStudentNumber, setSelectedEmotionStudentNumber] = useState(1);
  const [emotionCalendarMonth, setEmotionCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedEmotionHistoryDateKey, setSelectedEmotionHistoryDateKey] = useState('');
  const [questionSubmissionStatuses, setQuestionSubmissionStatuses] = useState<QuestionSubmissionStatus[]>([]);
  const [isQuestionSubmissionLoading, setIsQuestionSubmissionLoading] = useState(false);
  const [questionSubmissionError, setQuestionSubmissionError] = useState('');
  const isQuestionSubmissionRefreshInFlightRef = useRef(false);
  const [editingCurrencyNumber, setEditingCurrencyNumber] = useState<number | null>(null);
  const [currencyAdjustmentTarget, setCurrencyAdjustmentTarget] = useState<CurrencyAdjustmentTarget>('student');
  const [currencyAdjustmentSummary, setCurrencyAdjustmentSummary] = useState<CurrencyAdjustmentSummary | null>(null);
  const [currencyStudentNumberInput, setCurrencyStudentNumberInput] = useState('');
  const [currencyBalanceInput, setCurrencyBalanceInput] = useState('');
  const [isCurrencyDirectInputVisible, setIsCurrencyDirectInputVisible] = useState(false);
  const [currencyGroupStudentNumbers, setCurrencyGroupStudentNumbers] = useState<number[]>([]);
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => (
    isSupabaseSettingsEnabled
      ? createDefaultCurrencyBalances()
      : loadStoredStudentPetSnapshot().currencyBalances
  ));
  const [currencyHistory, setCurrencyHistory] = useState<CurrencyHistory>(() => (
    isSupabaseSettingsEnabled
      ? createDefaultCurrencyHistory()
      : loadStoredStudentPetSnapshot().currencyHistory
  ));
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [auctionBidHistory, setAuctionBidHistory] = useState<AuctionBidHistory>(() => normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
  const [auctionAwards, setAuctionAwards] = useState<AuctionAwards>(() => normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
  const [classroomRoleMission, setClassroomRoleMission] = useState<ClassroomRoleMissionSettings>(
    loadStoredClassroomRoleMissionSettings,
  );
  const [studentMissionVisibility, setStudentMissionVisibility] = useState<StudentMissionVisibility>(
    loadStoredStudentMissionVisibility,
  );
  const [classDonation, setClassDonation] = useState<ClassDonationSettings>(() => normalizeClassDonationSettings(null));
  const [studentEmotionHistory, setStudentEmotionHistory] = useState<StudentEmotionHistory>(
    loadStoredStudentEmotionHistory,
  );
  useEffect(() => {
    const latestEntry = getStudentEmotionEntries(
      studentEmotionHistory,
      selectedEmotionStudentNumber,
    )[0];
    const dateKey = latestEntry?.dateKey ?? getKoreanLocalDateKey();
    const date = getEmotionCalendarDate(dateKey);
    setEmotionCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedEmotionHistoryDateKey(dateKey);
  }, [selectedEmotionStudentNumber, studentEmotionHistory]);
  const [studentPetStates, setStudentPetStates] = useState<StudentPetStates>({});
  const [studentEconomyStates, setStudentEconomyStates] = useState<StudentEconomyStates>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentPetSnapshot().studentEconomy
  ));
  const [studentShopCatalog, setStudentShopCatalog] = useState<StudentShopCatalogItem[]>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentShopCatalog(undefined) : loadStoredStudentShopCatalog()
  ));
  const [studentStockMarket, setStudentStockMarket] = useState<StudentStockMarket>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentStockMarket(undefined) : loadStoredStudentStockMarket()
  ));
  const [stockMarketDateKey, setStockMarketDateKey] = useState(getKoreanLocalDateKey);
  const [stockMarketWeekDrafts, setStockMarketWeekDrafts] = useState<StockMarketWeekDrafts>({});
  const [stockMarketSaveStatus, setStockMarketSaveStatus] = useState('');
  const stockMarketWeekStartDateKey = getInvestmentWeekDateKeys(stockMarketDateKey)[0];
  useEffect(() => {
    const settings = normalizeStudentInvestmentSettings(studentStockMarket.settings);
    setStockMarketWeekDrafts(getInvestmentWeekDateKeys(stockMarketWeekStartDateKey).reduce<StockMarketWeekDrafts>((weekDrafts, dateKey) => {
      weekDrafts[dateKey] = STUDENT_STOCKS.reduce<Record<StudentStockId, StockMarketDraft>>((dayDrafts, stock) => {
        const entry = studentStockMarket[stock.id]?.find((item) => item.dateKey === dateKey);
        dayDrafts[stock.id] = {
          returnPercent: entry ? entry.returnPercent ?? investmentMultiplierToPercent(settings.multipliers[entry.stage]) : '',
          comment: entry?.comment ?? '',
        };
        return dayDrafts;
      }, {} as Record<StudentStockId, StockMarketDraft>);
      return weekDrafts;
    }, {}));
    setStockMarketSaveStatus('');
  }, [stockMarketWeekStartDateKey, studentStockMarket]);
  const [teacherShopTab, setTeacherShopTab] = useState<TeacherShopTab>('items');
  const [studentLife, setStudentLife] = useState<StudentLifeState>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentLifeState(null) : loadStoredStudentLifeState()
  ));
  const [dailyWriting, setDailyWriting] = useState<DailyWritingState>(() => (
    isSupabaseSettingsEnabled ? normalizeDailyWritingState(null) : loadStoredDailyWritingState()
  ));
  const [isWritingPublishing, setIsWritingPublishing] = useState(false);
  const [rewardingWritingStudentNumber, setRewardingWritingStudentNumber] = useState<number | null>(null);
  const [writingStatus, setWritingStatus] = useState('');
  const [bookstoreSettings, setBookstoreSettings] = useState<BookstoreSettings>(() => (
    isSupabaseSettingsEnabled ? normalizeBookstoreSettings(null) : loadStoredBookstoreSettings()
  ));
  const isEditingBookstoreRef = useRef(false);
  const [mailRecipient, setMailRecipient] = useState(1);
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [mailReplyToId, setMailReplyToId] = useState<string | undefined>();
  const [selectedTeacherLetterId, setSelectedTeacherLetterId] = useState('');
  const teacherLetterReadInFlightRef = useRef<Set<string>>(new Set());
  const [isMailSending, setIsMailSending] = useState(false);
  const [mailStatus, setMailStatus] = useState('');
  const [auctionItemEditCommitVersion, setAuctionItemEditCommitVersion] = useState(0);
  const isEditingAuctionItemRef = useRef(false);
  const [auctionMissions, setAuctionMissions] = useState<AuctionMission[]>(getStoredAuctionMissions);
  const [auctionMissionEditCommitVersion, setAuctionMissionEditCommitVersion] = useState(0);
  const hasBlankAuctionMissionDraftRef = useRef(false);
  const isEditingAuctionMissionRef = useRef(false);
  const lastPersistedAuctionMissionsRef = useRef<AuctionMission[]>(auctionMissions);
  const finalizedAwardPresentationKeysRef = useRef<Set<string>>(new Set());
  const [scheduleYoutubeUrls, setScheduleYoutubeUrls] = useState<string[]>(initialScheduleYoutubeState.appliedUrls);
  const [scheduleYoutubeFavorites, setScheduleYoutubeFavorites] = useState<ScheduleYoutubeFavorite[]>(() =>
    getStoredScheduleYoutubeFavorites(),
  );
  const [scheduleYoutubeMetadataMap, setScheduleYoutubeMetadataMap] = useState<Record<string, ScheduleYoutubeMetadata>>(
    () => getStoredScheduleYoutubeMetadataMap(),
  );
  const [youtubeSearchInput, setYoutubeSearchInput] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<ScheduleYoutubeSearchResult[]>([]);
  const [isYoutubeSearching, setIsYoutubeSearching] = useState(false);
  const [youtubeSearchError, setYoutubeSearchError] = useState('');
  const [isScheduleYoutubeVisible, setIsScheduleYoutubeVisible] = useState(initialScheduleYoutubeState.isVisible);
  const [hasMountedScheduleYoutubePlayer, setHasMountedScheduleYoutubePlayer] = useState(
    () => initialScheduleYoutubeState.isVisible && initialScheduleYoutubeState.appliedUrls.length > 0,
  );
  const [shouldAutoplayScheduleYoutube, setShouldAutoplayScheduleYoutube] = useState(false);
  const [activeScheduleYoutubeIndex, setActiveScheduleYoutubeIndex] = useState(0);
  const [scheduleYoutubeSelectionRequestId, setScheduleYoutubeSelectionRequestId] = useState(0);
  const [isScheduleYoutubePlaylistOpen, setIsScheduleYoutubePlaylistOpen] = useState(false);
  const [isScheduleYoutubeFavoritesEditing, setIsScheduleYoutubeFavoritesEditing] = useState(false);
  const [draggingScheduleYoutubeFavoriteId, setDraggingScheduleYoutubeFavoriteId] = useState<string | null>(null);
  const [scheduleClockOffsetSeconds, setScheduleClockOffsetSeconds] = useState(() => {
    const saved = localStorage.getItem('scheduleClockOffsetSeconds');
    return saved === null ? 0 : clampScheduleClockOffsetSeconds(saved);
  });
  const [activeDrawCaseId, setActiveDrawCaseId] = useState(initialRandomDrawState.activeCaseId);
  const [repeatPickEnabled, setRepeatPickEnabled] = useState(initialRandomDrawState.repeatPickEnabled);
  const [drawCases, setDrawCases] = useState<RandomDrawCaseState[]>(initialRandomDrawState.cases);
  const [drawSettingsCaseId, setDrawSettingsCaseId] = useState(initialRandomDrawState.activeCaseId);
  const [isDrawCaseMenuOpen, setIsDrawCaseMenuOpen] = useState(false);
  const [isDrawCaseSwitchNearby, setIsDrawCaseSwitchNearby] = useState(false);
  const [studentRosterBulkInput, setStudentRosterBulkInput] = useState('');
  const [hiddenDrawResultInput, setHiddenDrawResultInput] = useState('');
  const [isHiddenDrawSettingsVisible, setIsHiddenDrawSettingsVisible] = useState(false);
  const [rollingDrawNumber, setRollingDrawNumber] = useState<number | null>(null);
  const [isStudentDrawing, setIsStudentDrawing] = useState(false);
  const [drawOverlay, setDrawOverlay] = useState<DrawOverlayState | null>(null);
  const [isDrawOverlayDismissing, setIsDrawOverlayDismissing] = useState(false);
  const [isDrawWinVisible, setIsDrawWinVisible] = useState(false);
  const [isDrawRepeatVisible, setIsDrawRepeatVisible] = useState(false);
  const [isDrawResetVisible, setIsDrawResetVisible] = useState(false);
  const [isDrawAutoResetPending, setIsDrawAutoResetPending] = useState(false);
  const [watchFaceGlance, setWatchFaceGlance] = useState<WatchFaceGlance>('center');
  const [isWatchFaceBlinking, setIsWatchFaceBlinking] = useState(false);
  const [isWatchFaceReacting, setIsWatchFaceReacting] = useState(false);
  const [failedStudentCharacterIds, setFailedStudentCharacterIds] = useState<Set<string>>(() => new Set());
  const [studentCharacterShuffleNonce, setStudentCharacterShuffleNonce] = useState(() =>
    Math.random().toString(36).slice(2, 11),
  );

  const isEditingNoticeRef = useRef(isEditingNotice);
  const skipNextNoticeTextClickRef = useRef(false);
  useEffect(() => {
    isEditingNoticeRef.current = isEditingNotice;
  }, [isEditingNotice]);

  const refreshQuestionSubmissionStatuses = useCallback(async () => {
    if (isQuestionSubmissionRefreshInFlightRef.current) return;

    isQuestionSubmissionRefreshInFlightRef.current = true;
    setIsQuestionSubmissionLoading(true);
    setQuestionSubmissionError('');

    try {
      const records = await loadQuestionSubmissionStatuses();
      setQuestionSubmissionStatuses(records);
    } catch (error) {
      if (error instanceof Error) {
        setQuestionSubmissionError(
          error.message.startsWith('QUESTION_SUBMISSION_STATUS')
            ? 'question-news 제출 현황을 불러오지 못했습니다.'
            : error.message,
        );
        return;
      }

      setQuestionSubmissionError('question-news 제출 현황을 불러오지 못했습니다.');
    } finally {
      isQuestionSubmissionRefreshInFlightRef.current = false;
      setIsQuestionSubmissionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isQuestionSubmissionPanelOpen) return;

    void refreshQuestionSubmissionStatuses();

    const intervalId = window.setInterval(() => {
      void refreshQuestionSubmissionStatuses();
    }, QUESTION_SUBMISSION_AUTO_REFRESH_MS);

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshQuestionSubmissionStatuses();
    };

    const refreshWhenFocused = () => {
      void refreshQuestionSubmissionStatuses();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenFocused);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenFocused);
    };
  }, [isQuestionSubmissionPanelOpen, refreshQuestionSubmissionStatuses]);

  const prevSlotIdRef = useRef<string | null>(null);
  const previousWatchFaceRunningRef = useRef<boolean | null>(null);
  const previousWatchFaceFinishedRef = useRef(false);
  // Manual Timer State
  const [manualTotalTime, setManualTotalTime] = useState(initialState.manual.totalTime);
  const [manualTimeLeft, setManualTimeLeft] = useState(initialState.manual.timeLeft);
  const [manualIsRunning, setManualIsRunning] = useState(initialState.manual.isRunning);
  const [manualEndTime, setManualEndTime] = useState<number | null>(initialState.manual.endTime);
  const [isExtraTimerVisible, setIsExtraTimerVisible] = useState(initialState.manual.isVisible);
  const manualTimerStateRef = useRef({
    totalTime: initialState.manual.totalTime,
    timeLeft: initialState.manual.timeLeft,
    isRunning: initialState.manual.isRunning,
  });
  manualTimerStateRef.current = {
    totalTime: manualTotalTime,
    timeLeft: manualTimeLeft,
    isRunning: manualIsRunning,
  };

  // Schedule Timer State
  const [scheduleTotalTime, setScheduleTotalTime] = useState(0);
  const [scheduleTimeLeft, setScheduleTimeLeft] = useState(0);
  const [scheduleIsRunning, setScheduleIsRunning] = useState(false);
  const [currentSlotName, setCurrentSlotName] = useState<string>('');
  const [timerType, setTimerType] = useState<TimerType>('break');
  
  const [manualMinutesInputValue, setManualMinutesInputValue] = useState('');
  const [manualSecondsInputValue, setManualSecondsInputValue] = useState('');
  const [isManualTimeEditing, setIsManualTimeEditing] = useState(false);
  const [manualEditingPart, setManualEditingPart] = useState<'minutes' | 'seconds' | null>(null);
  const skipManualTimeCommitRef = useRef(false);
  
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
  const [weeklySubjects, setWeeklySubjects] = useState<WeeklySubjectSchedule>(() => {
    try {
      const savedSubjects = localStorage.getItem(WEEKLY_SUBJECTS_STORAGE_KEY);
      if (savedSubjects !== null) {
        return normalizeWeeklySubjects(JSON.parse(savedSubjects));
      }
    } catch {
      // Fall through to migrate legacy slot subjects for the current week.
    }
    return buildWeeklySubjectsFromSchedule(
      weeklySchedule,
      getDefaultSubjectWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds)),
    );
  });
  const weeklySubjectsRef = useRef(weeklySubjects);
  weeklySubjectsRef.current = weeklySubjects;
  const hasUnsavedWeeklySubjectsRef = useRef(false);
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalog>(() => {
    try {
      return normalizeSubjectCatalog(JSON.parse(localStorage.getItem(SUBJECT_CATALOG_STORAGE_KEY) || 'null'));
    } catch {
      return [...DEFAULT_SUBJECT_CATALOG];
    }
  });
  const subjectCatalogRef = useRef(subjectCatalog);
  subjectCatalogRef.current = subjectCatalog;
  const hasUnsavedSubjectCatalogRef = useRef(false);
  const [subjectCatalogEditCommitVersion, setSubjectCatalogEditCommitVersion] = useState(0);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSubjectWeekKey, setSelectedSubjectWeekKey] = useState(() =>
    getDefaultSubjectWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds)),
  );
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsMaterialMounted, setIsSettingsMaterialMounted] = useState(false);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const settingsMaterialProgress = useMotionValue(0);
  const settingsMaterialScale = useTransform(settingsMaterialProgress, [0, 1], [0.965, 1]);
  const settingsMaterialFilter = useTransform(
    settingsMaterialProgress,
    (progress) => `blur(${(1 - progress) * 10}px) saturate(${0.92 + progress * 0.08})`,
  );
  isSettingsOpenRef.current = isSettingsOpen;
  useEffect(() => {
    if (isSettingsOpen) setIsSettingsMaterialMounted(true);
  }, [isSettingsOpen]);
  useEffect(() => {
    if (!isSettingsMaterialMounted) return;
    const target = isSettingsOpen ? 1 : 0;
    const controls = animateMotion(settingsMaterialProgress, target, {
      duration: shouldReduceMotion ? 0.16 : 0.34,
      ease: shouldReduceMotion ? 'easeOut' : [0.2, 0.8, 0.2, 1],
      onComplete: () => {
        if (target === 0 && !isSettingsOpenRef.current) {
          setIsSettingsMaterialMounted(false);
        }
      },
    });
    return () => controls.stop();
  }, [animateMotion, isSettingsMaterialMounted, isSettingsOpen, settingsMaterialProgress, shouldReduceMotion]);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>('subjects');
  const currentSettingsNavigationItem = SETTINGS_NAVIGATION_ITEMS.find((item) => item.panel === settingsPanel);
  const handleSettingsNavigationKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const navigationButtons: HTMLButtonElement[] = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-settings-nav-item]'),
    ];
    const currentIndex = navigationButtons.findIndex((button) => button === document.activeElement);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % navigationButtons.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + navigationButtons.length) % navigationButtons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = navigationButtons.length - 1;
    } else {
      return;
    }

    const nextButton = navigationButtons[nextIndex];
    const nextItem = SETTINGS_NAVIGATION_ITEMS[nextIndex];
    if (!nextButton || !nextItem) return;
    event.preventDefault();
    nextButton.focus();
    setSettingsPanel(nextItem.panel);
  }, []);
  const [editingDay, setEditingDay] = useState<number>(() => getCurrentScheduleWeekday(scheduleClockOffsetSeconds));
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<Set<number>>(() => new Set());
  const [pendingAuctionAction, setPendingAuctionAction] = useState<AuctionManagementAction | null>(null);
  const [isCurrencyResetDangerVisible, setIsCurrencyResetDangerVisible] = useState(false);
  const [pendingAwardItemId, setPendingAwardItemId] = useState<string | null>(null);
  const [queuedAwardItems, setQueuedAwardItems] = useState<AuctionItem[]>([]);
  const [temporaryVisibleAuctionItemIds, setTemporaryVisibleAuctionItemIds] = useState<Set<string>>(() => new Set());
  const [awardPresentation, setAwardPresentation] = useState<{
    item: AuctionItem;
    weekdayLabel: string;
    steps: AuctionBidHistoryEntry[];
    award: AuctionAward;
    currentIndex: number;
    isComplete: boolean;
    hasFinalized: boolean;
  } | null>(null);
  const [characterImageError, setCharacterImageError] = useState(false);
  const [scheduleFocusTick, setScheduleFocusTick] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const awardConfirmDialogRef = useRef<HTMLDivElement>(null);
  const awardPresentationDialogRef = useRef<HTMLDivElement>(null);
  const awardReturnFocusRef = useRef<HTMLElement>(null);
  const auctionActionDialogRef = useRef<HTMLDivElement>(null);
  const auctionActionReturnFocusRef = useRef<HTMLButtonElement>(null);
  const announcementLaunchButtonRef = useRef<HTMLButtonElement>(null);
  const currencyPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const youtubePanelTriggerRef = useRef<HTMLButtonElement>(null);
  const classwordPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const questionPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const noticeInputRef = useRef<HTMLTextAreaElement>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);
  const awardSoundPlaybackRef = useRef({
    presentationKey: '',
    stepIndex: -1,
    finalPlayed: false,
  });
  const isMusicLoadingRef = useRef(false);
  const skipNoticeAutoSaveRef = useRef(false);
  const scheduleListRef = useRef<HTMLUListElement>(null);
  const scheduleSlotRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const drawCasesRef = useRef(drawCases);
  const hasSettingsChildModal = pendingAwardItemId !== null
    || pendingAuctionAction !== null
    || awardPresentation !== null;

  useModalFocus({
    dialogRef: settingsDialogRef,
    isOpen: isSettingsMaterialMounted,
    onDismiss: () => setIsSettingsOpen(false),
    isDismissible: !hasSettingsChildModal,
    returnFocusRef: settingsTriggerRef,
  });
  useModalFocus({
    dialogRef: awardConfirmDialogRef,
    isOpen: pendingAwardItemId !== null,
    onDismiss: () => setPendingAwardItemId(null),
    returnFocusRef: awardReturnFocusRef,
  });
  useModalFocus({
    dialogRef: auctionActionDialogRef,
    isOpen: pendingAuctionAction !== null,
    onDismiss: () => setPendingAuctionAction(null),
    returnFocusRef: auctionActionReturnFocusRef,
  });
  useModalFocus({
    dialogRef: awardPresentationDialogRef,
    isOpen: awardPresentation !== null,
    onDismiss: () => setAwardPresentation(null),
    isDismissible: awardPresentation?.isComplete === true && queuedAwardItems.length === 0,
    returnFocusRef: awardReturnFocusRef,
  });
  const repeatPickEnabledRef = useRef(repeatPickEnabled);
  const drawRollingTimeoutRef = useRef<number | null>(null);
  const drawResolveTimeoutRef = useRef<number | null>(null);
  const drawHideTimeoutRef = useRef<number | null>(null);
  const drawLaunchTokenRef = useRef(0);
  const queuedStudentDrawAfterResetRef = useRef(false);
  const drawCaseSwitchKeyboardTimeoutRef = useRef<number | null>(null);
  const rosterInputRefs = useRef(new Map<number, HTMLInputElement>());
  const drawCaseMenuRef = useRef<HTMLDivElement>(null);
  const youtubeSearchInputRef = useRef<HTMLInputElement>(null);
  const currencyStudentNumberInputRef = useRef<HTMLInputElement>(null);
  const youtubeFavoriteLongPressTimeoutRef = useRef<number | null>(null);
  const skipNextYoutubeFavoriteClickRef = useRef(false);
  const sharedSettingsHydratedRef = useRef(!isSupabaseSettingsEnabled);
  const sharedSettingsSaveTimeoutRef = useRef<number | null>(null);
  const lastSharedSettingsUpdatedAtRef = useRef<string | null>(null);
  const knownWeeklyMissionRewardIdsRef = useRef<Set<string>>(new Set());
  const knownAuctionAwardKeysRef = useRef<Set<string>>(new Set());
  const currencyResetGenerationRef = useRef(0);
  const skipNextSharedSettingsSaveRef = useRef(false);
  const isSharedSettingsSavePendingRef = useRef(false);
  const currencyBalancesRef = useRef(currencyBalances);
  const currencyHistoryRef = useRef(currencyHistory);
  const auctionAwardsRef = useRef(auctionAwards);
  const isEditingSubjectCatalogRef = useRef(false);
  useEffect(() => {
    if (!isSettingsOpen && isEditingSubjectCatalogRef.current) {
      isEditingSubjectCatalogRef.current = false;
      setSubjectCatalogEditCommitVersion((previous) => previous + 1);
    }
  }, [isSettingsOpen]);
  const activeDrawCase =
    drawCases.find((caseState) => caseState.id === activeDrawCaseId) ??
    drawCases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0));

  currencyBalancesRef.current = currencyBalances;
  currencyHistoryRef.current = currencyHistory;
  auctionAwardsRef.current = auctionAwards;

  useEffect(() => {
    if (!isCurrencyPanelOpen) {
      setCurrencyStudentNumberInput('');
      setCurrencyBalanceInput('');
      setIsCurrencyDirectInputVisible(false);
      setEditingCurrencyNumber(null);
      setCurrencyAdjustmentTarget('student');
      setCurrencyAdjustmentSummary(null);
      setCurrencyGroupStudentNumbers([]);
      return;
    }

    if (currencyAdjustmentTarget !== 'student') return;

    const focusTimeoutId = window.setTimeout(() => {
      currencyStudentNumberInputRef.current?.focus();
      currencyStudentNumberInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(focusTimeoutId);
  }, [currencyAdjustmentTarget, isCurrencyPanelOpen]);

  useEffect(() => {
    const audio = getSharedBackgroundMusicAudio();
    if (!audio) return;

    backgroundMusicRef.current = audio;

    const markAvailable = () => setIsMusicAvailable(true);
    const markPlaying = () => {
      isMusicLoadingRef.current = false;
      setIsMusicPlaying(true);
      setIsMusicLoading(false);
    };
    const markPaused = () => {
      isMusicLoadingRef.current = false;
      setIsMusicPlaying(false);
      setIsMusicLoading(false);
    };
    const markLoading = () => {
      if (!audio.paused) {
        setIsMusicLoading(true);
      }
    };
    const markUnavailable = () => {
      isMusicLoadingRef.current = false;
      setIsMusicAvailable(false);
      setIsMusicPlaying(false);
      setIsMusicLoading(false);
    };

    setIsMusicAvailable(!audio.error);
    setIsMusicPlaying(!audio.paused);
    setIsMusicLoading(false);

    audio.addEventListener('canplay', markAvailable);
    audio.addEventListener('play', markPlaying);
    audio.addEventListener('playing', markPlaying);
    audio.addEventListener('pause', markPaused);
    audio.addEventListener('waiting', markLoading);
    audio.addEventListener('stalled', markLoading);
    audio.addEventListener('error', markUnavailable);

    return () => {
      audio.removeEventListener('canplay', markAvailable);
      audio.removeEventListener('play', markPlaying);
      audio.removeEventListener('playing', markPlaying);
      audio.removeEventListener('pause', markPaused);
      audio.removeEventListener('waiting', markLoading);
      audio.removeEventListener('stalled', markLoading);
      audio.removeEventListener('error', markUnavailable);
      if (backgroundMusicRef.current === audio) {
        backgroundMusicRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isSettingsOpen && settingsPanel === 'auction') return;
    setTemporaryVisibleAuctionItemIds((previous) => (
      previous.size > 0 ? new Set() : previous
    ));
  }, [isSettingsOpen, settingsPanel]);

  useEffect(() => {
    if (!isSettingsOpen || settingsPanel !== 'subjects') return;
    setSelectedSubjectWeekKey(
      getDefaultSubjectWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds)),
    );
  }, [isSettingsOpen, settingsPanel, scheduleClockOffsetSeconds]);

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
  const selectedDrawHistoryDisplayEntries = getUniqueDrawHistoryEntries(selectedDrawHistoryEntries);
  const reservedDrawCount = selectedDrawSettingsCase.hiddenNumberQueue.length;
  const editingDaySchedule = weeklySchedule[editingDay] || [];
  const activeWeekdayScheduleCount = WEEKDAYS.filter((day) => (weeklySchedule[day] || []).length > 0).length;
  const subjectWeekOptions = buildSubjectWeekOptions(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds));
  const selectedSubjectWeekLabel =
    subjectWeekOptions.find((option) => option.key === selectedSubjectWeekKey)?.dateLabel ??
    getWeekOptionLabel(selectedSubjectWeekKey);
  const subjectClassSlotsByDay = WEEKDAYS.reduce<Record<number, ScheduleSlot[]>>((slotsByDay, day) => {
    slotsByDay[day] = (weeklySchedule[day] || []).filter(isSubjectEditableClassSlot);
    return slotsByDay;
  }, {});
  const subjectPeriodKeys = Array.from(
    new Set(
      WEEKDAYS.flatMap((day) => subjectClassSlotsByDay[day].map((slot) => getScheduleSubjectKey(slot))),
    ),
  ).sort((a, b) => {
    const numericA = Number(a);
    const numericB = Number(b);
    if (Number.isFinite(numericA) && Number.isFinite(numericB)) return numericA - numericB;
    return a.localeCompare(b, 'ko');
  });
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
  const isDrawLocked = isStudentDrawing || isDrawResetVisible || isDrawAutoResetPending;
  const scheduleYoutubeVideoIds = scheduleYoutubeUrls
    .map((url) => extractYoutubeVideoId(url))
    .filter((videoId): videoId is string => videoId !== null);
  const scheduleYoutubeCount = scheduleYoutubeUrls.length;
  const boundedActiveScheduleYoutubeIndex =
    scheduleYoutubeCount > 0
      ? Math.max(0, Math.min(activeScheduleYoutubeIndex, scheduleYoutubeCount - 1))
      : 0;
  const scheduleYoutubePlaylistItems = scheduleYoutubeUrls.map((url, index) => {
    const metadata = scheduleYoutubeMetadataMap[url];
    return {
      url,
      number: index + 1,
      title: metadata?.title || `영상 ${index + 1}`,
      channelTitle: metadata?.channelTitle || '',
      isActive: index === boundedActiveScheduleYoutubeIndex,
    };
  });
  const activeScheduleYoutubeItem = scheduleYoutubePlaylistItems[boundedActiveScheduleYoutubeIndex] ?? null;
  const hasScheduleYoutubePlaylist = scheduleYoutubeCount > 0;
  const hasScheduleYoutubeFavorites = scheduleYoutubeFavorites.length > 0;

  const getPersistableAuctionMissions = () =>
    hasBlankAuctionMissionDraft(auctionMissions)
      ? lastPersistedAuctionMissionsRef.current
      : normalizeAuctionMissions(auctionMissions);
  const todayClassroomRoleDateKey = getTodayClassroomRoleDateKey();
  const todayClassroomRoleAssignments = getClassroomRoleAssignments(
    { ...classroomRoleMission, enabled: true },
    todayClassroomRoleDateKey,
  );

  const buildSharedSettingsSnapshot = (): SharedSchoolTimerSettings => ({
    version: 1,
    weeklySchedule,
    weeklySubjects,
    subjectCatalog,
    scheduleNotice,
    scheduleNoticeHighlights,
    isNoticeEnabled,
    scheduleClockOffsetSeconds,
    scheduleYoutubeUrls,
    scheduleYoutubeFavorites,
    isScheduleYoutubeVisible,
    randomDraw: {
      activeCaseId: resolvedActiveDrawCaseId,
      repeatPickEnabled,
      cases: drawCases,
    },
    manualTimer: {
      totalTime: manualTotalTime,
      isVisible: isExtraTimerVisible,
    },
    currencyBalances,
    currencyHistory,
    auctionItems,
    auctionBids,
    auctionBidHistory,
    auctionAwards,
    auctionMissions: getPersistableAuctionMissions(),
    classroomRoleMission,
    studentMissionVisibility,
    classDonation,
    studentEmotionHistory,
    studentPets: studentPetStates,
    studentLife,
    dailyWriting,
    bookstoreSettings: normalizeBookstoreSettings(bookstoreSettings),
    studentEconomy: studentEconomyStates,
    studentShopCatalog,
    studentStockMarket,
  });

  const applySharedSettingsSnapshot = (
    remoteSettings: SharedSchoolTimerSettings,
    options: { applyManualTimer: boolean },
  ) => {
    skipNextSharedSettingsSaveRef.current = true;
    setWeeklySchedule(remoteSettings.weeklySchedule);
    if (!hasUnsavedWeeklySubjectsRef.current) {
      const nextWeeklySubjects = normalizeWeeklySubjects(remoteSettings.weeklySubjects);
      weeklySubjectsRef.current = nextWeeklySubjects;
      setWeeklySubjects(nextWeeklySubjects);
    }
    if (!hasUnsavedSubjectCatalogRef.current && !isEditingSubjectCatalogRef.current) {
      setSubjectCatalog(normalizeSubjectCatalog(remoteSettings.subjectCatalog));
    }
    if (!isEditingNoticeRef.current) {
      setScheduleNotice(remoteSettings.scheduleNotice);
      setScheduleNoticeHighlights(remoteSettings.scheduleNoticeHighlights || []);
      setNoticeDraft(remoteSettings.scheduleNotice);
      setIsNoticeEnabled(remoteSettings.isNoticeEnabled);
    }
    setScheduleClockOffsetSeconds(remoteSettings.scheduleClockOffsetSeconds);
    setScheduleYoutubeUrls(remoteSettings.scheduleYoutubeUrls);
    setScheduleYoutubeFavorites(remoteSettings.scheduleYoutubeFavorites);
    setIsScheduleYoutubeVisible(
      remoteSettings.scheduleYoutubeUrls.length > 0 && remoteSettings.isScheduleYoutubeVisible,
    );
    setHasMountedScheduleYoutubePlayer(
      remoteSettings.scheduleYoutubeUrls.length > 0 && remoteSettings.isScheduleYoutubeVisible,
    );
    setShouldAutoplayScheduleYoutube(false);
    setActiveDrawCaseId(remoteSettings.randomDraw.activeCaseId);
    setRepeatPickEnabled(remoteSettings.randomDraw.repeatPickEnabled);
    setDrawCases(remoteSettings.randomDraw.cases);
    setDrawSettingsCaseId(remoteSettings.randomDraw.activeCaseId);
    const remoteBalances = normalizeCurrencyBalances(remoteSettings.currencyBalances);
    const remoteHistory = normalizeCurrencyHistory(remoteSettings.currencyHistory);
    knownWeeklyMissionRewardIdsRef.current = getWeeklyMissionRewardIds(remoteHistory);
    knownAuctionAwardKeysRef.current = getAuctionAwardKeys(remoteSettings.auctionAwards);
    setCurrencyBalances(remoteBalances);
    setCurrencyHistory(remoteHistory);
    if (!isEditingAuctionItemRef.current) {
      setAuctionItems(normalizeAuctionItems(remoteSettings.auctionItems));
    }
    setAuctionBids(normalizeAuctionBids(remoteSettings.auctionBids, AUCTION_ITEM_IDS));
    setAuctionBidHistory(normalizeAuctionBidHistory(remoteSettings.auctionBidHistory, AUCTION_ITEM_IDS));
    setAuctionAwards(normalizeAuctionAwards(remoteSettings.auctionAwards, AUCTION_ITEM_IDS));
    setClassroomRoleMission(normalizeClassroomRoleMissionSettings(remoteSettings.classroomRoleMission));
    setStudentMissionVisibility(normalizeStudentMissionVisibility(remoteSettings.studentMissionVisibility));
    setClassDonation(normalizeClassDonationSettings(remoteSettings.classDonation));
    setStudentEmotionHistory(normalizeStudentEmotionHistory(remoteSettings.studentEmotionHistory));
    setStudentPetStates(normalizeStudentPetStates(remoteSettings.studentPets));
    setStudentLife(normalizeStudentLifeState(remoteSettings.studentLife));
    setDailyWriting(normalizeDailyWritingState(remoteSettings.dailyWriting));
    if (!isEditingBookstoreRef.current) {
      setBookstoreSettings(normalizeBookstoreSettings(remoteSettings.bookstoreSettings));
    }
    setStudentEconomyStates(normalizeStudentEconomyStates(remoteSettings.studentEconomy));
    setStudentShopCatalog(normalizeStudentShopCatalog(remoteSettings.studentShopCatalog));
    setStudentStockMarket(normalizeStudentStockMarket(remoteSettings.studentStockMarket));
    if (!isEditingAuctionMissionRef.current && !hasBlankAuctionMissionDraftRef.current) {
      const remoteAuctionMissions = normalizeAuctionMissions(remoteSettings.auctionMissions);
      lastPersistedAuctionMissionsRef.current = remoteAuctionMissions;
      setAuctionMissions(remoteAuctionMissions);
    }
    const canApplyManualTimer =
      options.applyManualTimer &&
      !manualTimerStateRef.current.isRunning &&
      manualTimerStateRef.current.timeLeft === manualTimerStateRef.current.totalTime;

    if (canApplyManualTimer) {
      setManualTotalTime(remoteSettings.manualTimer.totalTime);
      setManualTimeLeft(remoteSettings.manualTimer.totalTime);
      setManualIsRunning(false);
      setManualEndTime(null);
      setIsExtraTimerVisible(remoteSettings.manualTimer.isVisible);
    }
  };

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) return;

    let isCancelled = false;

    void loadSharedSettingsRow()
      .then((remoteRow) => {
        if (isCancelled) return;

        lastSharedSettingsUpdatedAtRef.current = remoteRow?.updated_at ?? null;
        const remoteSettings = normalizeSharedSchoolTimerSettings(remoteRow?.value);
        if (remoteSettings) {
          applySharedSettingsSnapshot(remoteSettings, { applyManualTimer: true });
        } else {
          const initialSnapshot = buildSharedSettingsSnapshot();
          void updateSharedSettings((currentValue) => (
            currentValue === null
              ? initialSnapshot
              : mergeConcurrentCurrencyUpdatesIntoSettings(
                currentValue,
                initialSnapshot,
                new Set(),
                new Set(),
              )
          )).catch((error) => {
            console.error('Failed to initialize shared settings in Supabase.', error);
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load shared settings from Supabase.', error);
      })
      .finally(() => {
        if (!isCancelled) {
          sharedSettingsHydratedRef.current = true;
          if (hasUnsavedWeeklySubjectsRef.current || hasUnsavedSubjectCatalogRef.current) {
            setSubjectCatalogEditCommitVersion((previous) => previous + 1);
          }
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('weeklySchedule', JSON.stringify(weeklySchedule));
  }, [weeklySchedule]);

  useEffect(() => {
    const normalizedSubjects = normalizeWeeklySubjects(weeklySubjects);
    if (Object.keys(normalizedSubjects).length > 0) {
      localStorage.setItem(WEEKLY_SUBJECTS_STORAGE_KEY, JSON.stringify(normalizedSubjects));
      return;
    }
    localStorage.removeItem(WEEKLY_SUBJECTS_STORAGE_KEY);
  }, [weeklySubjects]);

  useEffect(() => {
    localStorage.setItem(SUBJECT_CATALOG_STORAGE_KEY, JSON.stringify(normalizeSubjectCatalog(subjectCatalog, [])));
  }, [subjectCatalog]);

  useEffect(() => {
    localStorage.setItem('scheduleNotice', scheduleNotice);
  }, [scheduleNotice]);

  useEffect(() => {
    const normalizedHighlights = normalizeNoticeHighlightRanges(scheduleNoticeHighlights, scheduleNotice);
    if (normalizedHighlights.length > 0) {
      localStorage.setItem(SCHEDULE_NOTICE_HIGHLIGHTS_STORAGE_KEY, JSON.stringify(normalizedHighlights));
      return;
    }
    localStorage.removeItem(SCHEDULE_NOTICE_HIGHLIGHTS_STORAGE_KEY);
  }, [scheduleNoticeHighlights, scheduleNotice]);

  useEffect(() => {
    localStorage.setItem('scheduleNoticeEnabled', String(isNoticeEnabled));
  }, [isNoticeEnabled]);

  useEffect(() => {
    localStorage.setItem('scheduleClockOffsetSeconds', String(scheduleClockOffsetSeconds));
  }, [scheduleClockOffsetSeconds]);

  useEffect(() => {
    if (scheduleYoutubeUrls.length > 0) {
      localStorage.setItem(SCHEDULE_YOUTUBE_URLS_STORAGE_KEY, JSON.stringify(scheduleYoutubeUrls));
      localStorage.removeItem(SCHEDULE_YOUTUBE_LEGACY_URL_STORAGE_KEY);
      return;
    }
    localStorage.removeItem(SCHEDULE_YOUTUBE_URLS_STORAGE_KEY);
    localStorage.removeItem(SCHEDULE_YOUTUBE_LEGACY_URL_STORAGE_KEY);
  }, [scheduleYoutubeUrls]);

  useEffect(() => {
    if (scheduleYoutubeFavorites.length > 0) {
      localStorage.setItem(SCHEDULE_YOUTUBE_FAVORITES_STORAGE_KEY, JSON.stringify(scheduleYoutubeFavorites));
      return;
    }
    localStorage.removeItem(SCHEDULE_YOUTUBE_FAVORITES_STORAGE_KEY);
  }, [scheduleYoutubeFavorites]);

  useEffect(() => {
    if (Object.keys(scheduleYoutubeMetadataMap).length > 0) {
      localStorage.setItem(SCHEDULE_YOUTUBE_METADATA_STORAGE_KEY, JSON.stringify(scheduleYoutubeMetadataMap));
      return;
    }
    localStorage.removeItem(SCHEDULE_YOUTUBE_METADATA_STORAGE_KEY);
  }, [scheduleYoutubeMetadataMap]);

  useEffect(() => {
    if (scheduleYoutubeUrls.length > 0) {
      localStorage.setItem(SCHEDULE_YOUTUBE_VISIBLE_STORAGE_KEY, String(isScheduleYoutubeVisible));
      return;
    }
    localStorage.removeItem(SCHEDULE_YOUTUBE_VISIBLE_STORAGE_KEY);
  }, [isScheduleYoutubeVisible, scheduleYoutubeUrls]);

  useEffect(() => {
    storeStudentEmotionHistory(studentEmotionHistory);
  }, [studentEmotionHistory]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) storeStudentShopCatalog(studentShopCatalog);
  }, [studentShopCatalog]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) storeStudentStockMarket(studentStockMarket);
  }, [studentStockMarket]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) storeBookstoreSettings(bookstoreSettings);
  }, [bookstoreSettings]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) storeDailyWritingState(dailyWriting);
  }, [dailyWriting]);

  useEffect(() => {
    const hasBlankDraft = hasBlankAuctionMissionDraft(auctionMissions);
    hasBlankAuctionMissionDraftRef.current = hasBlankDraft;
    if (hasBlankDraft) return;

    const normalizedMissions = normalizeAuctionMissions(auctionMissions);
    lastPersistedAuctionMissionsRef.current = normalizedMissions;
    if (normalizedMissions.length > 0) {
      localStorage.setItem(AUCTION_MISSIONS_STORAGE_KEY, JSON.stringify(normalizedMissions));
      return;
    }
    localStorage.removeItem(AUCTION_MISSIONS_STORAGE_KEY);
  }, [auctionMissions]);

  useEffect(() => {
    storeClassroomRoleMissionSettings(classroomRoleMission);
  }, [classroomRoleMission]);

  useEffect(() => {
    storeStudentMissionVisibility(studentMissionVisibility);
  }, [studentMissionVisibility]);

  useEffect(() => {
    if (scheduleYoutubeVideoIds.length === 0) {
      setHasMountedScheduleYoutubePlayer(false);
      setShouldAutoplayScheduleYoutube(false);
      return;
    }

    if (isScheduleYoutubeVisible) {
      setHasMountedScheduleYoutubePlayer(true);
    }
  }, [isScheduleYoutubeVisible, scheduleYoutubeVideoIds.length]);

  useEffect(() => {
    if (scheduleYoutubeCount === 0) {
      setActiveScheduleYoutubeIndex(0);
      setIsScheduleYoutubePlaylistOpen(false);
      return;
    }
    setActiveScheduleYoutubeIndex((previous) => Math.max(0, Math.min(previous, scheduleYoutubeCount - 1)));
  }, [scheduleYoutubeCount]);

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
    if (!isSupabaseSettingsEnabled || !sharedSettingsHydratedRef.current) return;

    if (
      skipNextSharedSettingsSaveRef.current &&
      !hasUnsavedWeeklySubjectsRef.current &&
      !hasUnsavedSubjectCatalogRef.current
    ) {
      skipNextSharedSettingsSaveRef.current = false;
      return;
    }
    skipNextSharedSettingsSaveRef.current = false;

    if (
      isEditingSubjectCatalogRef.current ||
      isEditingAuctionItemRef.current ||
      isEditingAuctionMissionRef.current
    ) return;

    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
    }

    isSharedSettingsSavePendingRef.current = true;
    sharedSettingsSaveTimeoutRef.current = window.setTimeout(() => {
      sharedSettingsSaveTimeoutRef.current = null;
      const snapshot = buildSharedSettingsSnapshot();
      const savedCurrencyInput = JSON.stringify({
        balances: normalizeCurrencyBalances(snapshot.currencyBalances),
        history: normalizeCurrencyHistory(snapshot.currencyHistory),
        awards: normalizeAuctionAwards(snapshot.auctionAwards, AUCTION_ITEM_IDS),
      });
      const resetGenerationAtSave = currencyResetGenerationRef.current;
      let savedSnapshot: Record<string, unknown> = { ...snapshot };
      void updateSharedSettings((currentValue) => {
        savedSnapshot = mergeConcurrentCurrencyUpdatesIntoSettings(
          currentValue,
          snapshot,
          knownWeeklyMissionRewardIdsRef.current,
          knownAuctionAwardKeysRef.current,
        );
        return savedSnapshot;
      })
        .then((updatedAt) => {
          lastSharedSettingsUpdatedAtRef.current = updatedAt;
          const savedWeeklySubjects = normalizeWeeklySubjects(savedSnapshot.weeklySubjects);
          if (JSON.stringify(savedWeeklySubjects) === JSON.stringify(weeklySubjectsRef.current)) {
            hasUnsavedWeeklySubjectsRef.current = false;
          }
          const savedSubjectCatalog = normalizeSubjectCatalog(savedSnapshot.subjectCatalog, []);
          if (JSON.stringify(savedSubjectCatalog) === JSON.stringify(subjectCatalogRef.current)) {
            hasUnsavedSubjectCatalogRef.current = false;
          }
          const currentCurrencyInput = JSON.stringify({
            balances: currencyBalancesRef.current,
            history: currencyHistoryRef.current,
            awards: auctionAwardsRef.current,
          });
          if (currentCurrencyInput !== savedCurrencyInput) {
            if (currencyResetGenerationRef.current !== resetGenerationAtSave) {
              knownWeeklyMissionRewardIdsRef.current = getWeeklyMissionRewardIds(savedSnapshot.currencyHistory);
              knownAuctionAwardKeysRef.current = getAuctionAwardKeys(savedSnapshot.auctionAwards);
            }
            return;
          }
          knownWeeklyMissionRewardIdsRef.current = getWeeklyMissionRewardIds(savedSnapshot.currencyHistory);
          knownAuctionAwardKeysRef.current = getAuctionAwardKeys(savedSnapshot.auctionAwards);
          const savedBalances = normalizeCurrencyBalances(savedSnapshot.currencyBalances);
          const savedHistory = normalizeCurrencyHistory(savedSnapshot.currencyHistory);
          if (
            JSON.stringify(savedBalances) !== JSON.stringify(currencyBalancesRef.current) ||
            JSON.stringify(savedHistory) !== JSON.stringify(currencyHistoryRef.current)
          ) {
            commitCurrencyState(savedBalances, savedHistory);
          }
          const savedAwards = normalizeAuctionAwards(savedSnapshot.auctionAwards, AUCTION_ITEM_IDS);
          if (JSON.stringify(savedAwards) !== JSON.stringify(auctionAwards)) {
            setAuctionAwards(savedAwards);
          }
          const savedBids = normalizeAuctionBids(savedSnapshot.auctionBids, AUCTION_ITEM_IDS);
          if (JSON.stringify(savedBids) !== JSON.stringify(auctionBids)) {
            setAuctionBids(savedBids);
          }
          const savedBidHistory = normalizeAuctionBidHistory(
            savedSnapshot.auctionBidHistory,
            AUCTION_ITEM_IDS,
          );
          if (JSON.stringify(savedBidHistory) !== JSON.stringify(auctionBidHistory)) {
            setAuctionBidHistory(savedBidHistory);
          }
        })
        .catch((error) => {
          console.error('Failed to save shared settings to Supabase.', error);
        })
        .finally(() => {
          isSharedSettingsSavePendingRef.current = false;
        });
    }, 700);

    return () => {
      if (sharedSettingsSaveTimeoutRef.current !== null) {
        window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
        sharedSettingsSaveTimeoutRef.current = null;
      }
      isSharedSettingsSavePendingRef.current = false;
    };
  }, [
    weeklySchedule,
    weeklySubjects,
    subjectCatalog,
    scheduleNotice,
    scheduleNoticeHighlights,
    isNoticeEnabled,
    scheduleClockOffsetSeconds,
    scheduleYoutubeUrls,
    scheduleYoutubeFavorites,
    isScheduleYoutubeVisible,
    drawCases,
    repeatPickEnabled,
    resolvedActiveDrawCaseId,
    manualTotalTime,
    isExtraTimerVisible,
    currencyBalances,
    currencyHistory,
    auctionItems,
    auctionBids,
    auctionBidHistory,
    auctionAwards,
    auctionMissions,
    classroomRoleMission,
    studentMissionVisibility,
    classDonation,
    studentEmotionHistory,
    studentPetStates,
    studentLife,
    dailyWriting,
    bookstoreSettings,
    studentEconomyStates,
    studentShopCatalog,
    studentStockMarket,
    subjectCatalogEditCommitVersion,
    auctionItemEditCommitVersion,
    auctionMissionEditCommitVersion,
  ]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) return;

    let isCancelled = false;
    let isChecking = false;

    const syncSharedSettingsFromRemote = async () => {
      if (
        !sharedSettingsHydratedRef.current ||
        isChecking ||
        isSharedSettingsSavePendingRef.current ||
        hasUnsavedWeeklySubjectsRef.current ||
        hasUnsavedSubjectCatalogRef.current ||
        isEditingNoticeRef.current ||
        isEditingSubjectCatalogRef.current ||
        isEditingAuctionItemRef.current ||
        isEditingBookstoreRef.current
      ) return;
      isChecking = true;

      try {
        const remoteRow = await loadSharedSettingsRow();
        if (isCancelled || isSharedSettingsSavePendingRef.current || !remoteRow?.updated_at) return;
        if (remoteRow.updated_at === lastSharedSettingsUpdatedAtRef.current) return;

        const remoteSettings = normalizeSharedSchoolTimerSettings(remoteRow.value);
        if (!remoteSettings) return;

        lastSharedSettingsUpdatedAtRef.current = remoteRow.updated_at;
        applySharedSettingsSnapshot(remoteSettings, { applyManualTimer: false });
      } catch (error) {
        console.error('Failed to refresh shared settings from Supabase.', error);
      } finally {
        isChecking = false;
      }
    };

    const intervalId = window.setInterval(syncSharedSettingsFromRemote, 5000);
    window.addEventListener('focus', syncSharedSettingsFromRemote);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncSharedSettingsFromRemote);
    };
  }, []);

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
    if (!isSettingsOpen) return;
    setIsYoutubePanelOpen(false);
    setIsClasswordPanelOpen(false);
    setIsCurrencyPanelOpen(false);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isEditingNotice) {
      setNoticeDraft(scheduleNotice);
    }
  }, [scheduleNotice, isEditingNotice]);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let blinkStartTimer: number | undefined;
    let blinkEndTimer: number | undefined;

    const scheduleBlink = () => {
      const delay = 32000 + Math.random() * 30000;
      blinkStartTimer = window.setTimeout(() => {
        setIsWatchFaceBlinking(true);
        blinkEndTimer = window.setTimeout(() => {
          setIsWatchFaceBlinking(false);
          scheduleBlink();
        }, 340);
      }, delay);
    };

    scheduleBlink();

    return () => {
      window.clearTimeout(blinkStartTimer);
      window.clearTimeout(blinkEndTimer);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let glanceStartTimer: number | undefined;
    let glanceEndTimer: number | undefined;
    const glances: Exclude<WatchFaceGlance, 'center'>[] = ['left', 'right', 'up'];

    const scheduleGlance = () => {
      const delay = 26000 + Math.random() * 32000;
      glanceStartTimer = window.setTimeout(() => {
        setWatchFaceGlance(glances[Math.floor(Math.random() * glances.length)]);
        glanceEndTimer = window.setTimeout(() => {
          setWatchFaceGlance('center');
          scheduleGlance();
        }, 1200 + Math.random() * 700);
      }, delay);
    };

    scheduleGlance();

    return () => {
      window.clearTimeout(glanceStartTimer);
      window.clearTimeout(glanceEndTimer);
    };
  }, []);

  useEffect(() => {
    if (!isEditingNotice) return;
    noticeInputRef.current?.focus();
    noticeInputRef.current?.select();
  }, [isEditingNotice]);

  useEffect(() => {
    if (!isYoutubePanelOpen) return;
    youtubeSearchInputRef.current?.focus();
    youtubeSearchInputRef.current?.select();
  }, [isYoutubePanelOpen]);

  useEffect(() => {
    if (!isScheduleYoutubeFavoritesEditing) return;

    const handleYoutubeFavoritesEditKeyDown = (event: KeyboardEvent) => {
      if (isComposingKeyboardEvent(event)) return;
      if (event.key !== 'Escape') return;
      setDraggingScheduleYoutubeFavoriteId(null);
      setIsScheduleYoutubeFavoritesEditing(false);
    };

    window.addEventListener('keydown', handleYoutubeFavoritesEditKeyDown);

    return () => {
      window.removeEventListener('keydown', handleYoutubeFavoritesEditKeyDown);
    };
  }, [isScheduleYoutubeFavoritesEditing]);

  useEffect(() => {
    return () => {
      clearYoutubeFavoriteLongPress();
    };
  }, []);

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
      },
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
      const currentWeekKey = getWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds));
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
        setCurrentSlotName(
          getScheduleSlotTimerLabel(
            activeSlot,
            getWeeklySubject(weeklySubjects, currentWeekKey, dayOfWeek, activeSlot),
          ),
        );
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
  }, [weeklySchedule, weeklySubjects, scheduleClockOffsetSeconds]);

  const setManualTimerDuration = (totalSeconds: number) => {
    if (totalSeconds < 0) return;

    setManualTotalTime(totalSeconds);
    setManualTimeLeft(totalSeconds);
    setManualIsRunning(false);
    setManualEndTime(null);
  };

  const commitManualTimeInput = (part: 'minutes' | 'seconds') => {
    if (skipManualTimeCommitRef.current) {
      skipManualTimeCommitRef.current = false;
      setIsManualTimeEditing(false);
      setManualEditingPart(null);
      setManualMinutesInputValue('');
      setManualSecondsInputValue('');
      return;
    }

    const currentMinutes = Math.floor(manualTimeLeft / 60);
    const currentSeconds = manualTimeLeft % 60;
    const inputMinutes = Number.parseInt(manualMinutesInputValue, 10);
    const inputSeconds = Number.parseInt(manualSecondsInputValue, 10);
    const minutes = part === 'minutes'
      ? (Number.isFinite(inputMinutes) ? Math.max(0, Math.min(999, inputMinutes)) : 0)
      : currentMinutes;
    const seconds = part === 'seconds'
      ? (Number.isFinite(inputSeconds) ? Math.max(0, Math.min(59, inputSeconds)) : 0)
      : currentSeconds;
    const totalSeconds = minutes * 60 + seconds;

    setIsManualTimeEditing(false);
    setManualEditingPart(null);
    setManualTimerDuration(totalSeconds);
    setIsExtraTimerVisible(true);
    setManualMinutesInputValue('');
    setManualSecondsInputValue('');
  };

  const addManualPreset = (additionalSeconds: number) => {
    if (additionalSeconds <= 0) return;

    const nextTimeLeft = manualTimeLeft + additionalSeconds;

    setManualTotalTime(nextTimeLeft);
    setManualTimeLeft(nextTimeLeft);
    setManualEndTime(manualIsRunning ? Date.now() + nextTimeLeft * 1000 : null);
    setIsExtraTimerVisible(true);
  };

  const toggleTimer = () => {
    if (manualIsRunning) {
      setManualIsRunning(false);
      setManualEndTime(null);
    } else {
      if (manualTimeLeft > 0) {
        void prepareAnnouncementAudio();
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

  const clearManualTimer = () => {
    setManualTotalTime(0);
    setManualTimeLeft(0);
    setManualIsRunning(false);
    setManualEndTime(null);
    setManualMinutesInputValue('');
    setManualSecondsInputValue('');
    setIsManualTimeEditing(false);
    setManualEditingPart(null);
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
    setIsDrawOverlayDismissing(false);
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
      setIsDrawOverlayDismissing(false);
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
    setIsDrawOverlayDismissing(false);
    setIsDrawWinVisible(false);
    setIsDrawRepeatVisible(false);
    setIsDrawResetVisible(true);
    setIsDrawAutoResetPending(false);
    void playRandomDrawSound('reset');

    drawHideTimeoutRef.current = window.setTimeout(() => {
      setIsDrawOverlayDismissing(true);
      drawHideTimeoutRef.current = window.setTimeout(() => {
        drawHideTimeoutRef.current = null;
        setDrawOverlay(null);
        setIsDrawOverlayDismissing(false);
        setIsDrawResetVisible(false);
      }, DRAW_OVERLAY_DISMISS_DURATION_MS);
    }, Math.max(0, DRAW_RESET_EFFECT_DURATION_MS - DRAW_OVERLAY_DISMISS_DURATION_MS));
  };

  const showDrawOverlayTemporarily = (
    nextOverlay: DrawOverlayState,
    options?: { autoResetCaseId?: string },
  ) => {
    clearDrawHideTimer();
    setDrawOverlay(nextOverlay);
    setIsDrawOverlayDismissing(false);
    setIsDrawWinVisible(nextOverlay.kind === 'normal');
    setIsDrawRepeatVisible(nextOverlay.kind === 'repeat');
    setIsDrawResetVisible(nextOverlay.kind === 'reset');
    setIsDrawAutoResetPending(Boolean(options?.autoResetCaseId));

    drawHideTimeoutRef.current = window.setTimeout(() => {
      setIsDrawOverlayDismissing(true);
      drawHideTimeoutRef.current = window.setTimeout(() => {
        drawHideTimeoutRef.current = null;
        if (options?.autoResetCaseId) {
          setIsDrawOverlayDismissing(false);
          performDrawCaseReset(options.autoResetCaseId, true);
          return;
        }

        setDrawOverlay(null);
        setIsDrawOverlayDismissing(false);
        setIsDrawWinVisible(false);
        setIsDrawRepeatVisible(false);
        setIsDrawResetVisible(false);
        setIsDrawAutoResetPending(false);
      }, DRAW_OVERLAY_DISMISS_DURATION_MS);
    }, Math.max(0, RANDOM_DRAW_RESULT_DISPLAY_MS - DRAW_OVERLAY_DISMISS_DURATION_MS));
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

  const selectAdjacentActiveDrawCase = (direction: -1 | 1) => {
    if (drawCases.length <= 1) return;

    const currentIndex = drawCases.findIndex((caseState) => caseState.id === resolvedActiveDrawCaseId);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeCurrentIndex + direction + drawCases.length) % drawCases.length;
    const nextCase = drawCases[nextIndex];

    if (nextCase) {
      selectActiveDrawCase(nextCase.id);
    }
  };

  const revealDrawCaseSwitchTemporarily = () => {
    if (drawCaseSwitchKeyboardTimeoutRef.current !== null) {
      window.clearTimeout(drawCaseSwitchKeyboardTimeoutRef.current);
    }

    setIsDrawCaseSwitchNearby(true);
    drawCaseSwitchKeyboardTimeoutRef.current = window.setTimeout(() => {
      const switchNode = drawCaseMenuRef.current;
      const isPointerClose = switchNode?.matches(':hover') ?? false;
      const isFocusInside = switchNode?.contains(document.activeElement) ?? false;

      if (!isPointerClose && !isFocusInside) {
        setIsDrawCaseSwitchNearby(false);
      }

      drawCaseSwitchKeyboardTimeoutRef.current = null;
    }, 1800);
  };

  useEffect(() => {
    const handleDrawCaseArrowShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.code !== 'ArrowLeft') return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        isSettingsOpen ||
        isMemoOpen ||
        isAnnouncementOpen ||
        isYoutubePanelOpen ||
        isCurrencyPanelOpen ||
        isClasswordPanelOpen ||
        isEditingNotice ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      revealDrawCaseSwitchTemporarily();
      selectAdjacentActiveDrawCase(-1);
    };

    window.addEventListener('keydown', handleDrawCaseArrowShortcut);

    return () => {
      window.removeEventListener('keydown', handleDrawCaseArrowShortcut);
    };
  }, [
    drawCases,
    isAnnouncementOpen,
    isCurrencyPanelOpen,
    isEditingNotice,
    isClasswordPanelOpen,
    isMemoOpen,
    isSettingsOpen,
    isYoutubePanelOpen,
    resolvedActiveDrawCaseId,
  ]);

  useEffect(() => {
    return () => {
      if (drawCaseSwitchKeyboardTimeoutRef.current !== null) {
        window.clearTimeout(drawCaseSwitchKeyboardTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleStudentDrawShortcut = (event: KeyboardEvent) => {
      if (!isStudentDrawShortcutKey(event)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        isSettingsOpen ||
        isMemoOpen ||
        isAnnouncementOpen ||
        isYoutubePanelOpen ||
        isCurrencyPanelOpen ||
        isClasswordPanelOpen ||
        isEditingNotice ||
        isTextEntryShortcutTarget(event.target) ||
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
    isCurrencyPanelOpen,
    isDrawResetVisible,
    isEditingNotice,
    isClasswordPanelOpen,
    isMemoOpen,
    isSettingsOpen,
    isYoutubePanelOpen,
    drawCases,
    repeatPickEnabled,
    resolvedActiveDrawCaseId,
    shouldTriggerImmediateDrawReset,
  ]);

  useEffect(() => {
    if (!isCurrencyPanelOpen && !isYoutubePanelOpen && !isClasswordPanelOpen && !isQuestionSubmissionPanelOpen) return;

    const handleUtilityPaneEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const activeTrigger = isCurrencyPanelOpen
        ? currencyPanelTriggerRef.current
        : isYoutubePanelOpen
          ? youtubePanelTriggerRef.current
          : isClasswordPanelOpen
            ? classwordPanelTriggerRef.current
            : questionPanelTriggerRef.current;
      event.preventDefault();
      setIsCurrencyPanelOpen(false);
      setIsYoutubePanelOpen(false);
      setIsClasswordPanelOpen(false);
      setIsQuestionSubmissionPanelOpen(false);
      window.requestAnimationFrame(() => activeTrigger?.focus({ preventScroll: true }));
    };

    window.addEventListener('keydown', handleUtilityPaneEscape);
    return () => window.removeEventListener('keydown', handleUtilityPaneEscape);
  }, [isClasswordPanelOpen, isCurrencyPanelOpen, isQuestionSubmissionPanelOpen, isYoutubePanelOpen]);

  useEffect(() => {
    if (
      isDrawResetVisible ||
      isSettingsOpen ||
      isMemoOpen ||
      isAnnouncementOpen ||
      isYoutubePanelOpen ||
      isCurrencyPanelOpen ||
      isClasswordPanelOpen ||
      isEditingNotice
    ) {
      return;
    }
    if (!queuedStudentDrawAfterResetRef.current) return;

    queuedStudentDrawAfterResetRef.current = false;
    startStudentDraw();
  }, [
    isAnnouncementOpen,
    isCurrencyPanelOpen,
    isDrawResetVisible,
    isEditingNotice,
    isClasswordPanelOpen,
    isMemoOpen,
    isSettingsOpen,
    isYoutubePanelOpen,
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

        const fixedScheduleName = getFixedScheduleNameByType(nextSlot.type);
        if (fixedScheduleName) {
          nextSlot.name = fixedScheduleName;
        }

        if (field === 'type' && nextSlot.type === 'class' && !getSchedulePeriodNumber(nextSlot)) {
          nextSlot.name = getNextClassPeriodName(daySchedule.filter((slot) => slot.id !== id));
        }

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

  const updateWeeklySubject = (weekKey: string, day: number, slot: ScheduleSlot, value: string) => {
    if (!isSubjectEditableClassSlot(slot)) return;
    const subjectKey = getScheduleSubjectKey(slot);
    const subject = normalizeAssignedSubjectName(value);
    if (!subjectKey) return;

    if (isSupabaseSettingsEnabled) {
      hasUnsavedWeeklySubjectsRef.current = true;
      if (sharedSettingsHydratedRef.current) isSharedSettingsSavePendingRef.current = true;
    }

    setWeeklySubjects((previous) => {
      const next: WeeklySubjectSchedule = { ...previous };
      const nextWeek = { ...(next[weekKey] || {}) };
      const nextDay = { ...(nextWeek[day] || {}) };

      if (subject.length > 0) {
        nextDay[subjectKey] = subject;
      } else {
        delete nextDay[subjectKey];
      }

      if (Object.keys(nextDay).length > 0) {
        nextWeek[day] = nextDay;
      } else {
        delete nextWeek[day];
      }

      if (Object.keys(nextWeek).length > 0) {
        next[weekKey] = nextWeek;
      } else {
        delete next[weekKey];
      }

      const normalizedNext = normalizeWeeklySubjects(next);
      weeklySubjectsRef.current = normalizedNext;
      return normalizedNext;
    });
  };

  const replaceWeeklySubjectName = (previousName: string, nextName: string) => {
    if (!previousName || !nextName || previousName === nextName) return;

    setWeeklySubjects((previous) => {
      let didChange = false;
      const next = Object.entries(previous).reduce<WeeklySubjectSchedule>((weeks, [weekKey, weekValue]) => {
        nextWeekLoop:
        for (const dayValue of Object.values(weekValue)) {
          if (Object.values(dayValue).includes(previousName)) {
            didChange = true;
            break nextWeekLoop;
          }
        }

        weeks[weekKey] = Object.entries(weekValue).reduce<Record<number, Record<string, string>>>(
          (days, [dayKey, dayValue]) => {
            days[Number(dayKey)] = Object.entries(dayValue).reduce<Record<string, string>>(
              (subjects, [subjectKey, subjectValue]) => {
                const subject = typeof subjectValue === 'string' ? subjectValue : '';
                subjects[subjectKey] = subject === previousName ? nextName : subject;
                return subjects;
              },
              {},
            );
            return days;
          },
          {},
        );
        return weeks;
      }, {});

      return didChange ? next : previous;
    });
  };

  const addSubjectCatalogItem = () => {
    const subject = normalizeSubjectName(newSubjectName);
    if (!subject) return;
    if (subjectCatalog.includes(subject)) return;

    if (isSupabaseSettingsEnabled) hasUnsavedSubjectCatalogRef.current = true;
    setSubjectCatalog((previous) => {
      if (previous.includes(subject)) return previous;
      return [...previous, subject];
    });
    setNewSubjectName('');
  };

  const beginSubjectCatalogEdit = () => {
    isEditingSubjectCatalogRef.current = true;
    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
      sharedSettingsSaveTimeoutRef.current = null;
    }
  };

  const endSubjectCatalogEdit = () => {
    if (!isEditingSubjectCatalogRef.current) return;
    isEditingSubjectCatalogRef.current = false;
    setSubjectCatalogEditCommitVersion((previous) => previous + 1);
  };

  const updateSubjectCatalogItem = (index: number, value: string) => {
    const nextSubject = normalizeSubjectName(value);
    const previousSubject = subjectCatalog[index];
    if (previousSubject === undefined) return;
    if (!nextSubject || subjectCatalog.some((subject, subjectIndex) => subjectIndex !== index && subject === nextSubject)) {
      return;
    }

    if (isSupabaseSettingsEnabled) hasUnsavedSubjectCatalogRef.current = true;
    const next = [...subjectCatalog];
    next[index] = nextSubject;
    setSubjectCatalog(next);
    replaceWeeklySubjectName(previousSubject, nextSubject);
  };

  const removeSubjectCatalogItem = (index: number) => {
    if (isSupabaseSettingsEnabled) hasUnsavedSubjectCatalogRef.current = true;
    setSubjectCatalog((previous) => previous.filter((_, subjectIndex) => subjectIndex !== index));
  };

  const addSlot = (day: number, afterIndex?: number) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const insertionIndex = afterIndex === undefined
        ? daySchedule.length
        : Math.max(0, Math.min(afterIndex + 1, daySchedule.length));
      const previousSlot = daySchedule[insertionIndex - 1];
      const nextSlot = daySchedule[insertionIndex];
      const start = previousSlot?.end ?? Math.max(0, (nextSlot?.start ?? 580) - CLASS_DURATION);
      const end = start + CLASS_DURATION;
      const followingShift = nextSlot ? Math.max(0, end - nextSlot.start) : 0;

      if (followingShift > 0) {
        for (let index = insertionIndex; index < daySchedule.length; index += 1) {
          daySchedule[index] = {
            ...daySchedule[index],
            start: daySchedule[index].start + followingShift,
            end: daySchedule[index].end + followingShift,
          };
        }
      }

      daySchedule.splice(insertionIndex, 0, {
        id: createSlotId(),
        name: getNextClassPeriodName(daySchedule),
        subject: '',
        type: 'class',
        start,
        end,
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

  const closeScheduleCopy = () => {
    setShowCopyConfirm(false);
    setCopyTargetDays(new Set());
  };

  const openScheduleCopy = () => {
    setCopyTargetDays(new Set());
    setShowCopyConfirm(true);
  };

  const selectEditingDay = (day: number) => {
    closeScheduleCopy();
    setEditingDay(day);
  };

  const toggleScheduleCopyTarget = (day: number) => {
    if (day === editingDay) return;

    setCopyTargetDays((previous) => {
      const next = new Set(previous);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const confirmScheduleCopy = () => {
    if (copyTargetDays.size === 0) return;

    setWeeklySchedule((previous) => {
      const sourceSchedule = previous[editingDay] || [];
      const nextSchedule = { ...previous };

      copyTargetDays.forEach((day) => {
        if (day === editingDay) return;
        nextSchedule[day] = normalizeDaySchedule(
          sourceSchedule.map((slot) => ({ ...slot, id: createSlotId() })),
        );
      });

      return nextSchedule;
    });
    closeScheduleCopy();
  };

  const exportSchedule = () => {
    const exportPayload = {
      weeklySchedule,
      weeklySubjects,
      subjectCatalog,
      scheduleNotice,
      scheduleNoticeHighlights,
      scheduleNoticeEnabled: isNoticeEnabled,
      scheduleYoutubeUrl: scheduleYoutubeUrls[0] || '',
      scheduleYoutubeUrls,
      scheduleYoutubeVisible: isScheduleYoutubeVisible,
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
          const nextWeeklySubjects = normalizeWeeklySubjects(parsed.weeklySubjects);
          const nextSubjectCatalog = normalizeSubjectCatalog(parsed.subjectCatalog);
          const nextNotice = typeof parsed.scheduleNotice === 'string' ? parsed.scheduleNotice : '';
          const nextNoticeHighlights = normalizeNoticeHighlightRanges(parsed.scheduleNoticeHighlights, nextNotice);
          const nextNoticeEnabled = typeof parsed.scheduleNoticeEnabled === 'boolean'
            ? parsed.scheduleNoticeEnabled
            : nextNotice.trim().length > 0;
          const nextYoutubeUrls = normalizeScheduleYoutubeUrls(
            Array.isArray(parsed.scheduleYoutubeUrls)
              ? parsed.scheduleYoutubeUrls
              : typeof parsed.scheduleYoutubeUrl === 'string'
                ? [parsed.scheduleYoutubeUrl]
                : [],
          );
          const nextYoutubeVisible =
            typeof parsed.scheduleYoutubeVisible === 'boolean'
              ? parsed.scheduleYoutubeVisible
              : nextYoutubeUrls.length > 0;
          const nextClockOffsetSeconds = clampScheduleClockOffsetSeconds(parsed.scheduleClockOffsetSeconds);
          const nextRandomDraw =
            parsed.randomDraw && typeof parsed.randomDraw === 'object'
              ? normalizeSavedRandomDrawState(parsed.randomDraw)
              : null;
          stopStudentDraw();
          clearDrawFeedback();
          setWeeklySchedule(normalizeWeeklySchedule(nextSchedule));
          setWeeklySubjects(nextWeeklySubjects);
          setSubjectCatalog(nextSubjectCatalog);
          setScheduleNotice(nextNotice);
          setScheduleNoticeHighlights(nextNoticeHighlights);
          setIsNoticeEnabled(nextNoticeEnabled);
          setScheduleYoutubeUrls(nextYoutubeUrls);
          setIsScheduleYoutubeVisible(nextYoutubeVisible);
          setShouldAutoplayScheduleYoutube(false);
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

  const toggleNoticeFromTimerCenter = () => {
    void playAnnouncementSound('pop');
    setIsYoutubePanelOpen(false);
    setIsClasswordPanelOpen(false);
    setIsCurrencyPanelOpen(false);
    setIsExtraTimerVisible(false);
    setIsWatchFaceReacting(true);

    if (isEditingNoticeRef.current) {
      closeNoticeEdit();
      setIsNoticeEnabled(false);
    } else if (isNoticeEnabled && hasScheduleNotice) {
      setIsNoticeEnabled(false);
    } else {
      startNoticeEdit();
    }

    window.setTimeout(() => {
      setIsWatchFaceReacting(false);
    }, 720);
  };

  const addScheduleYoutubeFavoriteToPlaylist = (favorite: ScheduleYoutubeFavorite) => {
    const nextUrls = mergeScheduleYoutubeUrls(scheduleYoutubeUrls, favorite.urls);

    if (nextUrls.length === scheduleYoutubeUrls.length) {
      setYoutubeSearchError('이미 추가된 영상입니다.');
      return;
    }

    const favoriteUrl = favorite.urls[0];
    if (favoriteUrl) {
      setScheduleYoutubeMetadataMap((previous) => ({
        ...previous,
        [favoriteUrl]: {
          title: favorite.title || favorite.name,
          channelTitle: favorite.channelTitle || '',
          thumbnailUrl: favorite.thumbnailUrl || '',
        },
      }));
    }
    setScheduleYoutubeUrls(nextUrls);
    setIsScheduleYoutubeVisible(true);
    setShouldAutoplayScheduleYoutube(true);
    setYoutubeSearchError('');
  };

  const searchScheduleYoutubeVideos = async () => {
    const query = youtubeSearchInput.trim();

    if (query.length === 0) {
      setYoutubeSearchError('검색어를 입력하세요.');
      return;
    }

    if (!YOUTUBE_SEARCH_API_KEY) {
      setYoutubeSearchError('YouTube 검색 API 키가 필요합니다. VITE_YOUTUBE_API_KEY를 설정하세요.');
      return;
    }

    try {
      setIsYoutubeSearching(true);
      setYoutubeSearchError('');

      const lyricsQuery = buildScheduleYoutubeLyricsQuery(query);
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: String(YOUTUBE_SEARCH_MAX_RESULTS),
        q: lyricsQuery,
        key: YOUTUBE_SEARCH_API_KEY,
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        safeSearch: 'strict',
      });
      const response = await fetch(`${YOUTUBE_SEARCH_API_SRC}?${params.toString()}`);
      const data = (await response.json()) as YoutubeSearchApiResponse;

      if (!response.ok) {
        throw new Error(data.error?.message || 'YouTube 검색에 실패했습니다.');
      }

      const results = (data.items || []).reduce<ScheduleYoutubeSearchResult[]>((items, item) => {
        const videoId = item.id?.videoId || '';
        if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return items;

        items.push({
          id: videoId,
          title: item.snippet?.title || '제목 없음',
          channelTitle: item.snippet?.channelTitle || '채널 정보 없음',
          thumbnailUrl:
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.default?.url ||
            '',
        });
        return items;
      }, []);

      setYoutubeSearchResults(results);
      if (results.length === 0) {
        setYoutubeSearchError('검색 결과가 없습니다.');
      }
    } catch (error) {
      console.error('YouTube search failed', error);
      setYoutubeSearchResults([]);
      setYoutubeSearchError(error instanceof Error ? error.message : 'YouTube 검색에 실패했습니다.');
    } finally {
      setIsYoutubeSearching(false);
    }
  };

  const closeScheduleYoutubeSearch = () => {
    setYoutubeSearchInput('');
    setYoutubeSearchResults([]);
    setYoutubeSearchError('');
  };

  const clearYoutubeFavoriteLongPress = () => {
    if (youtubeFavoriteLongPressTimeoutRef.current !== null) {
      window.clearTimeout(youtubeFavoriteLongPressTimeoutRef.current);
      youtubeFavoriteLongPressTimeoutRef.current = null;
    }
  };

  const startYoutubeFavoriteLongPress = () => {
    if (isScheduleYoutubeFavoritesEditing) return;

    clearYoutubeFavoriteLongPress();
    skipNextYoutubeFavoriteClickRef.current = false;
    youtubeFavoriteLongPressTimeoutRef.current = window.setTimeout(() => {
      setIsScheduleYoutubeFavoritesEditing(true);
      skipNextYoutubeFavoriteClickRef.current = true;
      youtubeFavoriteLongPressTimeoutRef.current = null;
    }, 520);
  };

  const addScheduleYoutubeSearchResult = (result: ScheduleYoutubeSearchResult) => {
    const nextUrl = buildScheduleYoutubeWatchUrl(result.id);
    const nextUrls = mergeScheduleYoutubeUrls(scheduleYoutubeUrls, [nextUrl]);

    if (nextUrls.length === scheduleYoutubeUrls.length) {
      setYoutubeSearchError('이미 추가된 영상입니다.');
      return;
    }

    setScheduleYoutubeMetadataMap((previous) => ({
      ...previous,
      [nextUrl]: {
        title: result.title,
        channelTitle: result.channelTitle,
        thumbnailUrl: result.thumbnailUrl,
      },
    }));
    setScheduleYoutubeUrls(nextUrls);
    setIsScheduleYoutubeVisible(true);
    setShouldAutoplayScheduleYoutube(true);
    setYoutubeSearchError('');
  };

  const addScheduleYoutubeSearchResultToFavorites = (result: ScheduleYoutubeSearchResult) => {
    const nextUrl = buildScheduleYoutubeWatchUrl(result.id);
    const hasSameFavorite = scheduleYoutubeFavorites.some((favorite) => favorite.urls.includes(nextUrl));

    if (hasSameFavorite) {
      setYoutubeSearchError('이미 즐겨찾기에 저장된 영상입니다.');
      return;
    }

    setScheduleYoutubeFavorites((previous) => [
      ...previous,
      {
        id: createScheduleYoutubeFavoriteId(),
        name: result.title,
        title: result.title,
        channelTitle: result.channelTitle,
        thumbnailUrl: result.thumbnailUrl,
        urls: [nextUrl],
      },
    ]);
    setYoutubeSearchError('');
  };

  const removeScheduleYoutubeFavorite = (favoriteId: string) => {
    setScheduleYoutubeFavorites((previous) => {
      const nextFavorites = previous.filter((favorite) => favorite.id !== favoriteId);
      if (nextFavorites.length === 0) {
        setIsScheduleYoutubeFavoritesEditing(false);
      }
      return nextFavorites;
    });
  };

  const reorderScheduleYoutubeFavorite = (favoriteId: string, targetIndex: number) => {
    setScheduleYoutubeFavorites((previous) => {
      const currentIndex = previous.findIndex((favorite) => favorite.id === favoriteId);

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previous.length || currentIndex === targetIndex) {
        return previous;
      }

      const nextFavorites = [...previous];
      const [movingFavorite] = nextFavorites.splice(currentIndex, 1);
      nextFavorites.splice(targetIndex, 0, movingFavorite);
      return nextFavorites;
    });
  };

  const updateScheduleYoutubeFavoriteName = (favoriteId: string, nextName: string) => {
    setScheduleYoutubeFavorites((previous) =>
      previous.map((favorite) =>
        favorite.id === favoriteId
          ? {
              ...favorite,
              name: nextName,
            }
          : favorite,
      ),
    );
  };

  const normalizeScheduleYoutubeFavoriteName = (favoriteId: string) => {
    setScheduleYoutubeFavorites((previous) =>
      previous.map((favorite, index) => {
        if (favorite.id !== favoriteId) return favorite;
        const fallbackName = favorite.title || `즐겨찾기 ${index + 1}`;
        const nextName = favorite.name.trim() || fallbackName;
        return favorite.name === nextName ? favorite : { ...favorite, name: nextName };
      }),
    );
  };

  const playScheduleYoutubePlaylistItem = (index: number) => {
    setActiveScheduleYoutubeIndex(index);
    setShouldAutoplayScheduleYoutube(true);
    setScheduleYoutubeSelectionRequestId((previous) => previous + 1);
  };

  const updateScheduleYoutubeMetadataFromPlayer = (index: number, metadata: ScheduleYoutubeMetadata) => {
    const url = scheduleYoutubeUrls[index];
    if (!url) return;

    setScheduleYoutubeMetadataMap((previous) => {
      const previousMetadata = previous[url];
      if (
        previousMetadata?.title === metadata.title &&
        previousMetadata.channelTitle === metadata.channelTitle &&
        previousMetadata.thumbnailUrl === metadata.thumbnailUrl
      ) {
        return previous;
      }

      return {
        ...previous,
        [url]: {
          title: metadata.title,
          channelTitle: metadata.channelTitle,
          thumbnailUrl: previousMetadata?.thumbnailUrl || metadata.thumbnailUrl,
        },
      };
    });
  };

  const clearScheduleYoutubeUrl = () => {
    setScheduleYoutubeUrls([]);
    setIsScheduleYoutubeVisible(false);
    setShouldAutoplayScheduleYoutube(false);
    setIsScheduleYoutubePlaylistOpen(false);
  };

  const appendCurrencyChangesToHistory = (
    history: CurrencyHistory,
    previousBalances: CurrencyBalances,
    nextBalances: CurrencyBalances,
    reason: CurrencyHistoryReason,
    createdAt: string,
  ) =>
    CURRENCY_STUDENT_NUMBERS.reduce<CurrencyHistory>((nextHistory, studentNumber) => {
      const key = String(studentNumber);
      return appendCurrencyHistoryEntry(nextHistory, {
        studentNumber,
        before: previousBalances[key] ?? DEFAULT_CURRENCY_BALANCE,
        after: nextBalances[key] ?? DEFAULT_CURRENCY_BALANCE,
        reason,
        createdAt,
      });
    }, history);

  const recordCurrencyChanges = (
    previousBalances: CurrencyBalances,
    nextBalances: CurrencyBalances,
    reason: CurrencyHistoryReason,
  ) => {
    const createdAt = new Date().toISOString();
    const nextHistory = appendCurrencyChangesToHistory(
      currencyHistoryRef.current,
      previousBalances,
      nextBalances,
      reason,
      createdAt,
    );
    currencyHistoryRef.current = nextHistory;
    setCurrencyHistory(nextHistory);
  };

  const commitCurrencyState = (nextBalances: CurrencyBalances, nextHistory: CurrencyHistory) => {
    currencyBalancesRef.current = nextBalances;
    currencyHistoryRef.current = nextHistory;
    setCurrencyBalances(nextBalances);
    setCurrencyHistory(nextHistory);
  };

  const recordCurrencyAdjustment = (target: CurrencyAdjustmentTarget, delta: number) => {
    setCurrencyAdjustmentSummary((previousSummary) => (
      previousSummary?.target === target
        ? {
            ...previousSummary,
            delta: previousSummary.delta + delta,
          }
        : { target, delta }
    ));
  };

  const commitCurrencyAdjustment = (
    nextBalances: CurrencyBalances,
    nextHistory: CurrencyHistory,
    target: CurrencyAdjustmentTarget,
    delta: number,
  ) => {
    if (!isSupabaseSettingsEnabled) {
      const snapshot = loadStoredStudentPetSnapshot();
      const stored = storeStudentPetSnapshot({
        ...snapshot,
        currencyBalances: nextBalances,
        currencyHistory: nextHistory,
      });
      if (!stored) return;
    }
    currencyBalancesRef.current = nextBalances;
    currencyHistoryRef.current = nextHistory;
    if (isSupabaseSettingsEnabled && sharedSettingsHydratedRef.current) {
      isSharedSettingsSavePendingRef.current = true;
    }
    flushSync(() => {
      setCurrencyBalances(nextBalances);
      setCurrencyHistory(nextHistory);
      recordCurrencyAdjustment(target, delta);
    });
  };

  const handleCurrencyStudentNumberInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextInput = event.target.value.replace(/\D/g, '').slice(0, 2);
    setCurrencyStudentNumberInput(nextInput);
    setCurrencyAdjustmentSummary(null);
    setIsCurrencyDirectInputVisible(false);

    const nextStudentNumber = Number(nextInput);
    if (CURRENCY_STUDENT_NUMBERS.includes(nextStudentNumber)) {
      setEditingCurrencyNumber(nextStudentNumber);
      setCurrencyBalanceInput(String(currencyBalancesRef.current[String(nextStudentNumber)] ?? DEFAULT_CURRENCY_BALANCE));
      return;
    }

    setCurrencyBalanceInput('');
    setEditingCurrencyNumber(null);
  };

  const setCurrencyBalanceExactly = (studentNumber: number, amount: number) => {
    const key = String(studentNumber);
    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const before = previousBalances[key] ?? DEFAULT_CURRENCY_BALANCE;
    const after = clampCurrencyBalance(amount);
    const nextBalances = { ...previousBalances, [key]: after };
    const nextHistory = appendCurrencyHistoryEntry(currencyHistoryRef.current, {
      studentNumber,
      before,
      after,
      reason: 'manual',
    });
    commitCurrencyAdjustment(nextBalances, nextHistory, 'student', after - before);
    setCurrencyBalanceInput(String(after));
  };

  const adjustCurrencyBalance = (studentNumber: number, delta: number) => {
    const key = String(studentNumber);
    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const before = previousBalances[key] ?? DEFAULT_CURRENCY_BALANCE;
    const after = clampCurrencyBalance(before + delta);
    const nextBalances = {
      ...previousBalances,
      [key]: after,
    };
    const nextHistory = appendCurrencyHistoryEntry(currencyHistoryRef.current, {
      studentNumber,
      before,
      after,
      reason: 'manual',
    });
    commitCurrencyAdjustment(nextBalances, nextHistory, 'student', delta);
  };

  const adjustAllCurrencyBalances = (delta: number) => {
    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const nextBalances = CURRENCY_STUDENT_NUMBERS.reduce<CurrencyBalances>((balances, studentNumber) => {
      const key = String(studentNumber);
      const before = previousBalances[key] ?? DEFAULT_CURRENCY_BALANCE;
      balances[key] = clampCurrencyBalance(before + delta);
      return balances;
    }, {});
    const createdAt = new Date().toISOString();
    const nextHistory = appendCurrencyChangesToHistory(
      currencyHistoryRef.current,
      previousBalances,
      nextBalances,
      'bulk_adjust',
      createdAt,
    );
    commitCurrencyAdjustment(nextBalances, nextHistory, 'all', delta);
  };

  const toggleCurrencyGroupStudentNumber = (studentNumber: number) => {
    setCurrencyAdjustmentSummary(null);
    setCurrencyGroupStudentNumbers((previousStudentNumbers) => (
      previousStudentNumbers.includes(studentNumber)
        ? previousStudentNumbers.filter((number) => number !== studentNumber)
        : [...previousStudentNumbers, studentNumber]
    ));
  };

  const adjustGroupCurrencyBalances = (delta: number) => {
    const selectedStudentNumbers = CURRENCY_STUDENT_NUMBERS.filter((studentNumber) =>
      currencyGroupStudentNumbers.includes(studentNumber),
    );
    if (selectedStudentNumbers.length === 0) return;

    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const nextBalances = adjustCurrencyBalancesForStudents(previousBalances, selectedStudentNumbers, delta);
    const nextHistory = appendCurrencyChangesToHistory(
      currencyHistoryRef.current,
      previousBalances,
      nextBalances,
      'bulk_adjust',
      new Date().toISOString(),
    );
    commitCurrencyAdjustment(nextBalances, nextHistory, 'group', delta);
  };

  const resetCurrencyBalances = () => {
    currencyResetGenerationRef.current += 1;
    const normalizedPrevious = normalizeCurrencyBalances(currencyBalancesRef.current);
    const nextBalances = createDefaultCurrencyBalances();
    recordCurrencyChanges(normalizedPrevious, nextBalances, 'reset');
    setCurrencyBalances(nextBalances);
    currencyBalancesRef.current = nextBalances;
    setEditingCurrencyNumber(null);
    setCurrencyStudentNumberInput('');
  };

  const addAuctionItem = (dayIndex: number) => {
    const normalizedItems = normalizeAuctionItems(auctionItems);
    if (normalizedItems.length >= AUCTION_MAX_ITEM_COUNT) return;
    const sameDayItemCount = normalizedItems.filter((item) => item.dayIndex === dayIndex).length;
    if (sameDayItemCount >= AUCTION_MAX_ITEMS_PER_DAY) return;

    const nextTemplate = createAuctionItemTemplate(dayIndex, sameDayItemCount);
    const addedItemId = nextTemplate.id;
    setAuctionItems(normalizeAuctionItems([...normalizedItems, nextTemplate]));
    setAuctionBids((previous) => ({
      ...previous,
      [addedItemId]: { amount: 0, bidder: null },
    }));
    setAuctionBidHistory((previous) => ({
      ...previous,
      [addedItemId]: [],
    }));
    setAuctionAwards((previous) => ({
      ...previous,
      [addedItemId]: null,
    }));
    setPendingAwardItemId((previous) => (previous === addedItemId ? null : previous));
    setAwardPresentation((previous) => (previous?.item.id === addedItemId ? null : previous));
  };

  const removeAuctionItem = (itemId: string) => {
    setAuctionItems((previous) => {
      const normalizedPrevious = normalizeAuctionItems(previous);
      if (normalizedPrevious.length <= 1) return normalizedPrevious;
      return normalizeAuctionItems(normalizedPrevious.filter((item) => item.id !== itemId));
    });
    setAuctionBids((previous) => ({
      ...previous,
      [itemId]: { amount: 0, bidder: null },
    }));
    setAuctionBidHistory((previous) => ({
      ...previous,
      [itemId]: [],
    }));
    setAuctionAwards((previous) => ({
      ...previous,
      [itemId]: null,
    }));
    setTemporaryVisibleAuctionItemIds((previous) => {
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
    setPendingAwardItemId((previous) => (previous === itemId ? null : previous));
    setAwardPresentation((previous) => (previous?.item.id === itemId ? null : previous));
  };

  const completeWeeklyAuctionCycle = () => {
    const nextAuctionItems = normalizeAuctionItems(null);
    const emptyAuctionBids = normalizeAuctionBids(null, AUCTION_ITEM_IDS);
    const emptyAuctionBidHistory = normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS);
    const emptyAuctionAwards = normalizeAuctionAwards(null, AUCTION_ITEM_IDS);
    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const taxResult = collectCurrencyTax(previousBalances, studentEconomyStates);
    const taxedBalances = taxResult.balances;
    const taxedStudentEconomyStates = taxResult.economy;
    const nextBalances = grantWeeklyCurrencyAllowance(taxedBalances);
    const taxHistoryCreatedAt = new Date().toISOString();
    const allowanceHistoryCreatedAt = new Date().toISOString();
    const historyAfterTax = appendCurrencyChangesToHistory(
      currencyHistoryRef.current,
      previousBalances,
      taxedBalances,
      'tax',
      taxHistoryCreatedAt,
    );
    const nextHistory = appendCurrencyChangesToHistory(
      historyAfterTax,
      taxedBalances,
      nextBalances,
      'allowance',
      allowanceHistoryCreatedAt,
    );

    setAuctionItems(nextAuctionItems);
    setTemporaryVisibleAuctionItemIds(new Set());
    setAuctionBids(emptyAuctionBids);
    setAuctionBidHistory(emptyAuctionBidHistory);
    setAuctionAwards(emptyAuctionAwards);
    setPendingAwardItemId(null);
    setAwardPresentation(null);
    setStudentEconomyStates(taxedStudentEconomyStates);
    commitCurrencyState(nextBalances, nextHistory);

    if (!isSupabaseSettingsEnabled || !sharedSettingsHydratedRef.current) return;

    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
      sharedSettingsSaveTimeoutRef.current = null;
    }

    isSharedSettingsSavePendingRef.current = true;
    const snapshot = {
      ...buildSharedSettingsSnapshot(),
      currencyBalances: nextBalances,
      currencyHistory: nextHistory,
      studentEconomy: taxedStudentEconomyStates,
      auctionItems: nextAuctionItems,
      auctionBids: emptyAuctionBids,
      auctionBidHistory: emptyAuctionBidHistory,
      auctionAwards: emptyAuctionAwards,
    };
    let savedSnapshot: Record<string, unknown> = { ...snapshot };
    void updateSharedSettings((currentValue) => {
      savedSnapshot = mergeConcurrentCurrencyUpdatesIntoSettings(
        currentValue,
        snapshot,
        knownWeeklyMissionRewardIdsRef.current,
        knownAuctionAwardKeysRef.current,
        false,
      );
      return savedSnapshot;
    })
      .then((updatedAt) => {
        lastSharedSettingsUpdatedAtRef.current = updatedAt;
        knownWeeklyMissionRewardIdsRef.current = getWeeklyMissionRewardIds(savedSnapshot.currencyHistory);
        knownAuctionAwardKeysRef.current = getAuctionAwardKeys(savedSnapshot.auctionAwards);
        commitCurrencyState(
          normalizeCurrencyBalances(savedSnapshot.currencyBalances),
          normalizeCurrencyHistory(savedSnapshot.currencyHistory),
        );
        const savedAwards = normalizeAuctionAwards(savedSnapshot.auctionAwards, AUCTION_ITEM_IDS);
        if (JSON.stringify(savedAwards) !== JSON.stringify(auctionAwards)) {
          setAuctionAwards(savedAwards);
        }
      })
      .catch((error) => {
        console.error('Failed to complete weekly auction cycle in Supabase.', error);
      })
      .finally(() => {
        isSharedSettingsSavePendingRef.current = false;
      });
  };

  const addAuctionMission = () => {
    setAuctionMissions((previous) => {
      if (previous.length >= AUCTION_MISSION_MAX_COUNT) return previous;
      const illustrationIndex = pickAvailableAuctionMissionIllustrationIndex(previous, Math.random());
      if (illustrationIndex === null) return previous;

      return [
        ...previous,
        {
        id: `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        content: `새 미션 ${previous.length + 1}`,
        rewardAmount: 0,
        illustrationIndex,
      },
      ];
    });
  };

  const beginAuctionMissionEdit = () => {
    isEditingAuctionMissionRef.current = true;
    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
      sharedSettingsSaveTimeoutRef.current = null;
    }
  };

  const endAuctionMissionEdit = () => {
    if (!isEditingAuctionMissionRef.current) return;
    isEditingAuctionMissionRef.current = false;
    setAuctionMissionEditCommitVersion((previous) => previous + 1);
  };

  const updateAuctionMissionContent = (missionId: string, nextContent: string) => {
    setAuctionMissions((previous) =>
      previous.map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              content: nextContent,
            }
          : mission,
      ),
    );
  };

  const updateAuctionMissionRewardAmount = (missionId: string, nextRewardAmount: AuctionMissionRewardAmount) => {
    setAuctionMissions((previous) =>
      previous.map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              rewardAmount: nextRewardAmount,
            }
          : mission,
      ),
    );
  };

  const removeAuctionMission = (missionId: string) => {
    setAuctionMissions((previous) => previous.filter((mission) => mission.id !== missionId));
  };

  const updateTodayClassroomRoleStart = (studentNumber: number) => {
    setClassroomRoleMission((previous) => setClassroomRoleMissionStartForDate(
      previous,
      studentNumber,
      getTodayClassroomRoleDateKey(),
    ));
  };

  const updateClassroomRoleMissionResult = (
    studentNumber: number,
    result: ClassroomRoleMissionResult,
  ) => {
    const dateKey = getTodayClassroomRoleDateKey();
    const currentSettings = normalizeClassroomRoleMissionSettings(classroomRoleMission, dateKey);
    const previousResult = currentSettings.results[dateKey]?.[String(studentNumber)];
    const nextResult = previousResult === result ? undefined : result;

    const delta = getClassroomRoleMissionBalanceDelta(previousResult, nextResult);
    const studentKey = String(studentNumber);
    const previousBalances = normalizeCurrencyBalances(currencyBalancesRef.current);
    const before = previousBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
    const after = clampCurrencyBalance(before + delta);
    const nextBalances = { ...previousBalances, [studentKey]: after };
    const nextHistory = appendCurrencyHistoryEntry(currencyHistoryRef.current, {
      studentNumber,
      before,
      after,
      reason: 'classroom_role',
    });
    commitCurrencyAdjustment(nextBalances, nextHistory, 'student', after - before);
    setClassroomRoleMission(setClassroomRoleMissionResult(currentSettings, studentNumber, nextResult, dateKey));
  };

  const getAwardSteps = (item: AuctionItem) => {
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const recordedSteps = (auctionBidHistory[item.id] ?? []).filter((entry) => entry.amount > 0);
    if (recordedSteps.length > 0) return recordedSteps;
    if (!currentBid.bidder || currentBid.amount <= 0) return [];
    return [{
      itemId: item.id,
      bidder: currentBid.bidder,
      amount: currentBid.amount,
      createdAt: new Date().toISOString(),
    }];
  };

  const openAwardConfirm = (item: AuctionItem, trigger?: HTMLElement) => {
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id] || !currentBid.bidder || currentBid.amount <= 0) return;
    awardReturnFocusRef.current = trigger
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setQueuedAwardItems([]);
    setPendingAwardItemId(item.id);
  };

  const startAwardPresentationForItem = (item: AuctionItem) => {
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id] || !currentBid.bidder || currentBid.amount <= 0) return false;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = getAwardSteps(item);
    const award = {
      itemId: item.id,
      winner: currentBid.bidder,
      amount: currentBid.amount,
      awardedAt: new Date().toISOString(),
    };

    void playAuctionSound('start');
    setPendingAwardItemId(null);
    setAwardPresentation({
      item,
      weekdayLabel: AUCTION_WEEKDAY_LABELS[item.dayIndex] ?? String(item.dayIndex + 1),
      steps,
      award,
      currentIndex: prefersReducedMotion ? Math.max(steps.length - 1, 0) : 0,
      isComplete: prefersReducedMotion || steps.length <= 1,
      hasFinalized: false,
    });
    return true;
  };

  const startAwardPresentation = () => {
    if (!pendingAwardItemId) return;
    const item = auctionItems.find((auctionItem) => auctionItem.id === pendingAwardItemId);
    if (!item) {
      setPendingAwardItemId(null);
      return;
    }

    if (!startAwardPresentationForItem(item)) {
      setPendingAwardItemId(null);
    }
  };

  const startAwardPresentationQueue = (items: AuctionItem[]) => {
    const eligibleItems = items.filter((item) => {
      const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
      return !auctionAwards[item.id] && currentBid.bidder !== null && currentBid.amount > 0;
    });
    const [firstItem, ...remainingItems] = eligibleItems;
    if (!firstItem) return;

    awardReturnFocusRef.current = announcementLaunchButtonRef.current;
    setPendingAwardItemId(null);
    setQueuedAwardItems(remainingItems);
    startAwardPresentationForItem(firstItem);
  };

  const confirmAuctionManagementAction = () => {
    if (pendingAuctionAction === 'weeklyClose') {
      completeWeeklyAuctionCycle();
    } else if (pendingAuctionAction === 'currency') {
      resetCurrencyBalances();
    }

    setPendingAuctionAction(null);
  };

  const beginAuctionItemEdit = () => {
    isEditingAuctionItemRef.current = true;
    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
      sharedSettingsSaveTimeoutRef.current = null;
    }
  };

  const endAuctionItemEdit = () => {
    if (!isEditingAuctionItemRef.current) return;
    isEditingAuctionItemRef.current = false;
    setAuctionItemEditCommitVersion((previous) => previous + 1);
  };

  const updateAuctionItem = (itemId: string, patch: Pick<AuctionItem, 'name'>) => {
    setAuctionItems((previous) => previous.map((item) => (
      item.id === itemId
        ? {
            ...item,
            name: patch.name.slice(0, 24),
          }
        : item
    )));
  };

  useEffect(() => {
    if (!awardPresentation) {
      awardSoundPlaybackRef.current = {
        presentationKey: '',
        stepIndex: -1,
        finalPlayed: false,
      };
      return;
    }

    const presentationKey = awardPresentation.award.awardedAt;
    if (awardSoundPlaybackRef.current.presentationKey !== presentationKey) {
      awardSoundPlaybackRef.current = {
        presentationKey,
        stepIndex: -1,
        finalPlayed: false,
      };
    }

    if (awardPresentation.isComplete) {
      if (!awardSoundPlaybackRef.current.finalPlayed) {
        awardSoundPlaybackRef.current.finalPlayed = true;
        void playAuctionSound('final', awardPresentation.currentIndex);
      }
      return;
    }

    if (awardSoundPlaybackRef.current.stepIndex !== awardPresentation.currentIndex) {
      awardSoundPlaybackRef.current.stepIndex = awardPresentation.currentIndex;
      void playAuctionSound('bid', awardPresentation.currentIndex);
    }
  }, [awardPresentation]);

  useEffect(() => {
    if (!awardPresentation || awardPresentation.isComplete) return;

    const timeoutId = window.setTimeout(() => {
      setAwardPresentation((previous) => {
        if (!previous || previous.isComplete) return previous;
        const nextIndex = previous.currentIndex + 1;
        if (nextIndex >= previous.steps.length) {
          return {
            ...previous,
            currentIndex: Math.max(previous.steps.length - 1, 0),
            isComplete: true,
          };
        }

        return {
          ...previous,
          currentIndex: nextIndex,
        };
      });
    }, getAuctionAwardStepDelayMs(awardPresentation.steps.length));

    return () => window.clearTimeout(timeoutId);
  }, [awardPresentation]);

  useEffect(() => {
    if (!awardPresentation?.isComplete || awardPresentation.hasFinalized) return;
    const awardPresentationKey = `${awardPresentation.award.itemId}:${awardPresentation.award.awardedAt}`;
    if (finalizedAwardPresentationKeysRef.current.has(awardPresentationKey)) return;
    finalizedAwardPresentationKeysRef.current.add(awardPresentationKey);
    const award = awardPresentation.award;
    const applyFinalizedState = (result: ReturnType<typeof finalizeAuctionAwardInSettings>) => {
      setAuctionAwards((previous) => ({ ...previous, ...result.awards }));
      commitCurrencyState(result.balances, result.history);
      setAwardPresentation((previous) => (
        previous ? { ...previous, hasFinalized: true } : previous
      ));
    };

    if (!isSupabaseSettingsEnabled) {
      try {
        applyFinalizedState(finalizeAuctionAwardInSettings({
          currencyBalances: currencyBalancesRef.current,
          currencyHistory: currencyHistoryRef.current,
          auctionBids,
          auctionAwards,
        }, award));
      } catch (error) {
        finalizedAwardPresentationKeysRef.current.delete(awardPresentationKey);
        console.error('Failed to finalize auction award.', error);
        setAwardPresentation(null);
      }
      return;
    }

    let finalizedState: ReturnType<typeof finalizeAuctionAwardInSettings> | null = null;
    void updateSharedSettings((currentValue) => {
      finalizedState = finalizeAuctionAwardInSettings(currentValue, award);
      return finalizedState.value;
    })
      .then(() => {
        if (finalizedState) applyFinalizedState(finalizedState);
      })
      .catch((error) => {
        finalizedAwardPresentationKeysRef.current.delete(awardPresentationKey);
        console.error('Failed to finalize auction award in Supabase.', error);
        setAwardPresentation(null);
      });
  }, [awardPresentation]);

  useEffect(() => {
    if (!awardPresentation?.isComplete || !awardPresentation.hasFinalized || queuedAwardItems.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      const nextIndex = queuedAwardItems.findIndex((item) => {
        const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
        return !auctionAwards[item.id] && currentBid.bidder !== null && currentBid.amount > 0;
      });

      if (nextIndex < 0) {
        setQueuedAwardItems([]);
        return;
      }

      const nextItem = queuedAwardItems[nextIndex];
      if (!nextItem) {
        setQueuedAwardItems([]);
        return;
      }

      setQueuedAwardItems(queuedAwardItems.slice(nextIndex + 1));
      startAwardPresentationForItem(nextItem);
    }, AUCTION_AWARD_QUEUE_ADVANCE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [awardPresentation, queuedAwardItems, auctionBids, auctionAwards]);

  const applyNoticeDraft = (nextValue: string) => {
    setNoticeDraft(nextValue);
    const nextNotice = nextValue;
    setScheduleNotice(nextNotice);
    setScheduleNoticeHighlights((previous) => normalizeNoticeHighlightRanges(previous, nextNotice.trim()));
    setIsNoticeEnabled(nextNotice.trim().length > 0);
  };

  const closeNoticeEdit = () => {
    const nextNotice = noticeDraft.trim();
    setNoticeDraft(nextNotice);
    setScheduleNotice(nextNotice);
    setScheduleNoticeHighlights((previous) => normalizeNoticeHighlightRanges(previous, nextNotice));
    setIsNoticeEnabled(nextNotice.length > 0);
    skipNoticeAutoSaveRef.current = true;
    setIsEditingNotice(false);
  };

  const clearAndCloseNotice = () => {
    skipNoticeAutoSaveRef.current = isEditingNoticeRef.current;
    setScheduleNotice('');
    setScheduleNoticeHighlights([]);
    setNoticeDraft('');
    setIsNoticeEnabled(false);
    setIsEditingNotice(false);
  };

  const closeMemoNotebook = () => {
    setIsMemoOpen(false);
  };

  const toggleBackgroundMusic = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();

    const audio = backgroundMusicRef.current ?? getSharedBackgroundMusicAudio();
    if (!audio) return;

    if (!audio.paused) {
      isMusicLoadingRef.current = false;
      setIsMusicLoading(false);
      audio.pause();
      return;
    }

    if (isMusicLoadingRef.current) return;

    try {
      isMusicLoadingRef.current = true;
      setIsMusicLoading(true);
      setIsMusicAvailable(true);
      audio.volume = BACKGROUND_MUSIC_VOLUME;
      audio.loop = true;
      audio.preload = 'auto';

      if (audio.error) {
        audio.src = BACKGROUND_MUSIC_SRC;
        audio.load();
      } else if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
        audio.load();
      }

      await audio.play();
    } catch (error) {
      console.error('Background music playback failed', error);
      setIsMusicAvailable(false);
    } finally {
      isMusicLoadingRef.current = false;
      setIsMusicLoading(false);
    }
  };

  // Visual calculations
  const displayTotalTime = scheduleTotalTime;
  const displayTimeLeft = scheduleTimeLeft;
  const displayIsRunning = scheduleIsRunning;
  const isScheduleIdle = displayTotalTime === 0;
  const adjustedScheduleNow = getAdjustedScheduleDate(scheduleFocusTick, scheduleClockOffsetSeconds);
  const today = adjustedScheduleNow.getDay();
  const scheduleMonthDayLabel = adjustedScheduleNow.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
  const scheduleWeekdayLabel = adjustedScheduleNow.toLocaleDateString('ko-KR', {
    weekday: 'long',
  });
  const currentSubjectWeekKey = getWeekKeyForDate(adjustedScheduleNow);
  const currentDaySchedule = weeklySchedule[today] || [];
  const currentScheduleSecondsOfDay =
    adjustedScheduleNow.getHours() * 3600 +
    adjustedScheduleNow.getMinutes() * 60 +
    adjustedScheduleNow.getSeconds();
  const activeClassEndImage = currentDaySchedule
    .filter((slot) => slot.type === 'class')
    .slice(0, CLASS_END_IMAGE_MESSAGES.length)
    .map((slot, index) => ({
      secondsSinceEnd: currentScheduleSecondsOfDay - slot.end * 60,
      message: CLASS_END_IMAGE_MESSAGES[index],
    }))
    .find(
      ({ secondsSinceEnd }) =>
        secondsSinceEnd >= 0 &&
        secondsSinceEnd < CLASS_END_IMAGE_DURATION_SECONDS,
    );
  const showClassEndImage = Boolean(activeClassEndImage);
  const activeScheduleSlot = currentDaySchedule.find(
    (slot) => currentScheduleSecondsOfDay >= slot.start * 60 && currentScheduleSecondsOfDay < slot.end * 60,
  );
  const studentCharacterShuffleScope = [
    adjustedScheduleNow.getFullYear(),
    adjustedScheduleNow.getMonth(),
    adjustedScheduleNow.getDate(),
    timerType,
    activeScheduleSlot?.id ?? 'none',
    activeScheduleSlot?.type ?? 'none',
    activeScheduleSlot?.start ?? 'none',
    activeScheduleSlot?.end ?? 'none',
  ].join(':');
  useEffect(() => {
    setStudentCharacterShuffleNonce(Math.random().toString(36).slice(2, 11));
  }, [studentCharacterShuffleScope]);

  const percentage = displayTotalTime > 0 ? displayTimeLeft / displayTotalTime : 0;
  const warningThreshold = 0.5;
  const urgentThreshold = 0.2;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = -(circumference - percentage * circumference);

  let colorClass = "teacher-tone-text-accent";
  let strokeColor = "var(--teacher-accent)";
  let ringTrackColor = "var(--teacher-border)";
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
  const shouldShowMorningReading = timerType === 'morning' && !isScheduleIdle;
  const shouldShowTimedMessage = isScheduleBreak || isScheduleLunch;
  const scheduleTypeLabel =
    timerType === 'class'
      ? currentSlotName || "\uC218\uC5C5\uC2DC\uAC04"
      : timerType === 'break'
        ? "\uC26C\uB294\uC2DC\uAC04"
        : timerType === 'morning'
          ? MORNING_ACTIVITY_LABEL
        : timerType === 'lunch'
          ? "\uC810\uC2EC\uC2DC\uAC04"
          : "\uC77C\uC815 \uC5C6\uC74C";
  const scheduleTypeBadgeClass =
    timerType === 'class'
      ? 'timer-status-chip--class'
      : timerType === 'break'
        ? 'timer-status-chip--break'
        : timerType === 'morning'
          ? 'timer-status-chip--morning'
          : timerType === 'lunch'
            ? 'timer-status-chip--lunch'
            : 'timer-status-chip--idle';

  const getCharacterMessage = (stage: 'warning' | 'urgent' | 'end') => {
    if (isScheduleBreak) {
      if (stage === 'warning') return "\uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC26C\uB294 \uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    if (isScheduleLunch) {
      if (stage === 'warning') return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB098\uAC00\uC694.\n\uD654\uC7A5\uC2E4\uC740 \uBBF8\uB9AC \uB2E4\uB140\uC624\uC138\uC694.";
      if (stage === 'urgent') return "\uC774\uC81C \uC815\uB9AC\uD560 \uC2DC\uAC04\uC774\uC5D0\uC694.\n\uAD50\uACFC\uC11C\uB97C \uCC45\uC0C1 \uC704\uC5D0 \uC62C\uB824 \uB450\uC138\uC694.";
      return "\uC810\uC2EC\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694!";
    }

    return "";
  };

  if (isScheduleIdle) {
    colorClass = "teacher-tone-text-secondary";
    strokeColor = "var(--teacher-border-strong)";
    ringTrackColor = "var(--teacher-surface-muted)";
    bgClass = "app-tone-idle";
  } else if (shouldShowTimedMessage && displayTimeLeft === 0) {
    colorClass = "teacher-tone-text-urgent";
    strokeColor = "var(--teacher-urgent)";
    showCharacter = true;
    bgClass = "app-tone-finished";
    characterMessage = getCharacterMessage('end');
  } else if (shouldShowTimedMessage && percentage <= urgentThreshold) {
    colorClass = "teacher-tone-text-urgent";
    strokeColor = "var(--teacher-urgent)";
    showCharacter = true;
    bgClass = "app-tone-urgent";
    characterMessage = getCharacterMessage('urgent');
    if (displayIsRunning) {
      pulseClass = "mascot-alert-pulse";
    }
  } else if (shouldShowTimedMessage && percentage <= warningThreshold) {
    colorClass = "teacher-tone-text-warning";
    strokeColor = "var(--teacher-warning)";
    showCharacter = true;
    bgClass = "app-tone-warning";
    characterMessage = getCharacterMessage('warning');
  }

  const showTimerNotification = showCharacter || showClassEndImage;
  const timerNotificationMessage = activeClassEndImage?.message ?? characterMessage;
  const timerNotificationTextColorClass = showClassEndImage ? 'teacher-tone-text-accent' : colorClass;
  const timerNotificationImageSrc = showClassEndImage
    ? '/first-break-bear.png?v=20260527'
    : '/character.png?v=20260301';
  const timerNotificationImageAlt = showClassEndImage
    ? 'class end notification'
    : 'character notification';

  if (showTimerNotification && displayIsRunning) {
    const bobOffset = Math.sin((displayTimeLeft || 0) * 0.8) * 10;
    const tilt = Math.sin((displayTimeLeft || 0) * 1.3) * (percentage <= urgentThreshold ? 6 : 3);
    characterMotionStyle = {
      transform: `translateY(${bobOffset}px) rotate(${tilt}deg)`,
      transition: "transform 220ms ease-out",
    };
  }

  const formatTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatMinutesToTime = (mins: number) => {
    const safeMins = Number.isFinite(mins) ? Math.max(0, Math.floor(mins)) : 0;
    const h = Math.floor(safeMins / 60).toString().padStart(2, '0');
    const m = (safeMins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
  };

  const manualProgress = manualTotalTime > 0 ? Math.max(0, Math.min(1, manualTimeLeft / manualTotalTime)) : 0;
  const manualClockClass = 'text-[#006241]';
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
  const drawOverlayNameLength = isDrawOverlayStudentName ? Array.from(drawOverlayText.replace(/\s/gu, '')).length : 0;
  const drawOverlayNameSizeClass =
    !isDrawOverlayStudentName
      ? ''
      : drawOverlayNameLength <= 2
        ? ' random-board-display-name-short'
        : drawOverlayNameLength <= 3
          ? ' random-board-display-name-medium'
          : drawOverlayNameLength <= 4
            ? ' random-board-display-name-long'
            : ' random-board-display-name-compact';
  const drawOverlayBoardClass = `random-board ${
    isStudentDrawing ? 'random-board-drawing' : ''
  }${isDrawOverlayEmpty ? ' random-board-empty-state' : ''}${
    isDrawWinVisible ? ' random-board-win-impact' : ''
  }${isDrawRepeatVisible ? ' random-board-repeat-impact' : ''}${
    isDrawResetVisible ? ' random-board-reset-impact' : ''
  }${isDrawOverlayDismissing ? ' random-board-overlay-dismissing' : ''
  }`;
  const drawOverlayNumberClass = `random-board-number${
    isDrawOverlayVisible ? ' random-board-number-active' : ''
  }${isDrawOverlayStudentName || isDrawOverlayReset ? ' random-board-display-name' : ''}${
    drawOverlayNameSizeClass
  }${
    isDrawOverlayReset ? ' random-board-reset-label' : ''
  }${
    isDrawOverlayEmpty ? ' random-board-empty-text' : ''
  }${isDrawRepeatVisible ? ' random-board-number-repeat-accent' : ''}${
    isDrawWinVisible ? ' random-board-number-win-punch' : ''
  }${isDrawResetVisible ? ' random-board-number-reset-accent' : ''
  }`;
  const visibleStudentCharacters = STUDENT_CHARACTERS.filter(
    (character) => !failedStudentCharacterIds.has(character.id),
  );
  const emotionTodayKey = getKoreanLocalDateKey();
  const selectedStudentEmotionEntries = getStudentEmotionEntries(
    studentEmotionHistory,
    selectedEmotionStudentNumber,
  );
  const selectedStudentEmotionByDate = new Map<string, StudentEmotionEntry>(
    selectedStudentEmotionEntries.map((entry) => [entry.dateKey, entry]),
  );
  const emotionCalendarDays = getEmotionCalendarDays(emotionCalendarMonth);
  const selectedEmotionHistoryEntry = selectedEmotionHistoryDateKey
    ? selectedStudentEmotionByDate.get(selectedEmotionHistoryDateKey) ?? null
    : null;
  const selectedEmotionHistory = getStudentEmotion(selectedEmotionHistoryEntry?.emotionId);
  const selectedEmotionMonthlyZoneCounts = STUDENT_EMOTION_ZONES.reduce<Record<StudentEmotionZoneId, number>>(
    (counts, zone) => ({ ...counts, [zone.id]: 0 }),
    {} as Record<StudentEmotionZoneId, number>,
  );
  selectedStudentEmotionEntries.forEach((entry) => {
    const entryDate = getEmotionCalendarDate(entry.dateKey);
    if (
      entryDate.getFullYear() !== emotionCalendarMonth.getFullYear()
      || entryDate.getMonth() !== emotionCalendarMonth.getMonth()
    ) return;
    const emotion = getStudentEmotion(entry.emotionId);
    if (emotion) selectedEmotionMonthlyZoneCounts[emotion.zone] += 1;
  });
  const selectedEmotionMonthlyTotal = STUDENT_EMOTION_ZONES.reduce(
    (total, zone) => total + selectedEmotionMonthlyZoneCounts[zone.id],
    0,
  );
  const studentCharacterOrderSeed = [
    studentCharacterShuffleScope,
    studentCharacterShuffleNonce,
    visibleStudentCharacters.map((character) => character.id).join(','),
  ].join(':');
  const shouldShowStudentCharacterBySchedule =
    timerType === 'none' ||
    ((timerType === 'break' || timerType === 'lunch') && activeScheduleSlot?.type === timerType);
  const canShowStudentCharacter =
    shouldShowStudentCharacterBySchedule &&
    visibleStudentCharacters.length > 0 &&
    !isAnnouncementOpen &&
    !isCurrencyPanelOpen &&
    !showTimerNotification;
  const studentCharacterElapsedSeconds =
    activeScheduleSlot && activeScheduleSlot.type === timerType && canShowStudentCharacter
      ? Math.max(0, currentScheduleSecondsOfDay - activeScheduleSlot.start * 60)
      : currentScheduleSecondsOfDay;
  const getStudentCharacterWalker = (
    elapsedSeconds: number,
    offsetSeconds: number,
    streamIndex: number,
    excludedCharacterId?: string,
  ): StudentCharacterWalker | null => {
    if (!canShowStudentCharacter) return null;
    if (streamIndex > 0 && visibleStudentCharacters.length === 1) return null;

    const shiftedElapsedSeconds = Math.max(0, elapsedSeconds + offsetSeconds);
    const walkCycle = Math.floor(shiftedElapsedSeconds / STUDENT_CHARACTER_WALK_SECONDS);
    const spawnOrder = walkCycle * 2 + streamIndex;
    const characterRoundIndex = Math.floor(spawnOrder / visibleStudentCharacters.length);
    let characterIndex = spawnOrder % visibleStudentCharacters.length;
    const roundCharacters = getShuffledStudentCharacters(
      visibleStudentCharacters,
      `${studentCharacterOrderSeed}:round-${characterRoundIndex}`,
    );
    let character = roundCharacters[characterIndex];
    if (character?.id === excludedCharacterId) {
      for (let candidateOffset = 1; candidateOffset < roundCharacters.length; candidateOffset += 1) {
        const candidateIndex = (characterIndex + candidateOffset) % roundCharacters.length;
        const candidate = roundCharacters[candidateIndex];
        if (candidate && candidate.id !== excludedCharacterId) {
          characterIndex = candidateIndex;
          character = candidate;
          break;
        }
      }
    }
    if (!character) return null;
    const pathIndex = (spawnOrder * 3 + characterIndex * 2) % STUDENT_CHARACTER_WALK_PATHS.length;
    const shouldSpeak =
      Boolean(character.speech || character.speechImageSrc) &&
      shouldStudentCharacterSpeak(spawnOrder, characterIndex, streamIndex);

    const renderKey = `${streamIndex}-${walkCycle}-${characterIndex}-${character.id}`;
    return {
      renderKey,
      character,
      direction: spawnOrder % 2 === 0 ? 'right' : 'left',
      path: STUDENT_CHARACTER_WALK_PATHS[pathIndex],
      animationDelaySeconds: -(shiftedElapsedSeconds % STUDENT_CHARACTER_WALK_SECONDS),
      spawnScale: getStudentCharacterSpawnScale(renderKey),
      shouldSpeak,
    };
  };
  const primaryStudentCharacterWalker = getStudentCharacterWalker(studentCharacterElapsedSeconds, 0, 0);
  let secondaryStudentCharacterWalker = getStudentCharacterWalker(
    studentCharacterElapsedSeconds,
    STUDENT_CHARACTER_WALK_SECONDS / 2,
    1,
    primaryStudentCharacterWalker?.character.id,
  );
  if (primaryStudentCharacterWalker?.shouldSpeak && secondaryStudentCharacterWalker?.shouldSpeak) {
    secondaryStudentCharacterWalker = {
      ...secondaryStudentCharacterWalker,
      shouldSpeak: false,
    };
  }
  const activeStudentCharacterWalkers = [
    primaryStudentCharacterWalker,
    secondaryStudentCharacterWalker,
  ].filter((walker): walker is StudentCharacterWalker => walker !== null);
  const markStudentCharacterFailed = (characterId: string) => {
    setFailedStudentCharacterIds((previous) => {
      if (previous.has(characterId)) return previous;
      const next = new Set(previous);
      next.add(characterId);
      return next;
    });
  };

  const currentMinsForScheduleView = adjustedScheduleNow.getHours() * 60 + adjustedScheduleNow.getMinutes();
  const activeSlotIndex = currentDaySchedule.findIndex(
    (slot) => currentMinsForScheduleView >= slot.start && currentMinsForScheduleView < slot.end
  );
  const nextSlotIndex = currentDaySchedule.findIndex((slot) => currentMinsForScheduleView < slot.start);
  const activeStatusSlot = activeSlotIndex !== -1 ? currentDaySchedule[activeSlotIndex] : null;
  const nextStatusSlot = activeSlotIndex === -1 && nextSlotIndex !== -1 ? currentDaySchedule[nextSlotIndex] : null;
  const scheduleStatusDetail = activeStatusSlot
    ? `${formatMinutesToTime(activeStatusSlot.start)} - ${formatMinutesToTime(activeStatusSlot.end)}`
    : nextStatusSlot
      ? `다음 ${getScheduleSlotDisplayTitle(
        nextStatusSlot,
        getWeeklySubject(weeklySubjects, currentSubjectWeekKey, today, nextStatusSlot),
      )} ${formatMinutesToTime(nextStatusSlot.start)}`
      : currentDaySchedule.length > 0
        ? '오늘 일정 종료'
        : '오늘 일정 없음';
  const focusSlotIndex =
    activeSlotIndex !== -1
      ? activeSlotIndex
      : nextSlotIndex !== -1
        ? nextSlotIndex
        : currentDaySchedule.length - 1;

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const previousRunning = previousWatchFaceRunningRef.current;
    const isFinished = displayTotalTime > 0 && displayTimeLeft === 0;
    const didRunningChange = previousRunning !== null && previousRunning !== displayIsRunning;
    const didFinish = !previousWatchFaceFinishedRef.current && isFinished;

    previousWatchFaceRunningRef.current = displayIsRunning;
    previousWatchFaceFinishedRef.current = isFinished;

    if (!didRunningChange && !didFinish) return;

    setIsWatchFaceReacting(true);
    const timeoutId = window.setTimeout(() => {
      setIsWatchFaceReacting(false);
    }, 720);

    return () => window.clearTimeout(timeoutId);
  }, [displayIsRunning, displayTimeLeft, displayTotalTime]);

  useLayoutEffect(() => {
    if (focusSlotIndex < 0) return;
    const focusSlot = currentDaySchedule[focusSlotIndex];
    if (!focusSlot) return;
    const node = scheduleSlotRefs.current[focusSlot.id];
    const list = scheduleListRef.current;
    if (!node || !list) return;

    const nodeTop = node.offsetTop;
    const targetTop = nodeTop - (list.clientHeight - node.offsetHeight) / 2;
    const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
    const nextScrollTop = Math.min(Math.max(0, targetTop), maxTop);
    if (Math.abs(list.scrollTop - nextScrollTop) < 4) return;

    list.scrollTo({
      top: nextScrollTop,
      behavior: 'smooth',
    });
  }, [today, currentSlotName, weeklySchedule, focusSlotIndex, currentDaySchedule, scheduleFocusTick]);

  const trimmedNotice = scheduleNotice.trim();
  const hasScheduleNotice = trimmedNotice.length > 0;
  const getNoticeTextClass = (text: string) => {
    const length = text.replace(/\s+/g, '').length;
    if (length <= 10) return 'text-[clamp(3rem,6.8vw,3.75rem)] leading-[1.06] tracking-[-0.024em]';
    if (length <= 18) return 'text-[clamp(2.72rem,6.05vw,3.24rem)] leading-[1.12] tracking-[-0.02em]';
    if (length <= 30) return 'text-[clamp(2.36rem,5.1vw,2.78rem)] leading-[1.18] tracking-[-0.014em]';
    if (length <= 44) return 'text-[clamp(2.04rem,4.3vw,2.38rem)] leading-[1.24] tracking-[-0.008em]';
    return 'text-[clamp(1.84rem,3.75vw,2.14rem)] leading-[1.3] tracking-[-0.004em]';
  };
  const studentNoticeTextClass = getNoticeTextClass(trimmedNotice);
  const draftNoticeTextClass = getNoticeTextClass(noticeDraft);
  const shouldShowNoticeCard = isEditingNotice || (isNoticeEnabled && hasScheduleNotice);
  const hasCurrencyStudentNumberInput = currencyStudentNumberInput.length > 0;
  const parsedCurrencyStudentNumber = Number(currencyStudentNumberInput);
  const isCurrencyStudentNumberInvalid =
    hasCurrencyStudentNumberInput && !CURRENCY_STUDENT_NUMBERS.includes(parsedCurrencyStudentNumber);
  const selectedCurrencyBalance =
    editingCurrencyNumber === null
      ? null
      : (currencyBalances[String(editingCurrencyNumber)] ?? DEFAULT_CURRENCY_BALANCE);
  const parsedCurrencyBalanceInput = Number(currencyBalanceInput);
  const isCurrencyBalanceInputInvalid = currencyBalanceInput.trim().length === 0
    || !Number.isInteger(parsedCurrencyBalanceInput)
    || parsedCurrencyBalanceInput < 0
    || parsedCurrencyBalanceInput > CURRENCY_BALANCE_MAX;
  const selectedCurrencyGroupCount = CURRENCY_STUDENT_NUMBERS.filter((studentNumber) =>
    currencyGroupStudentNumbers.includes(studentNumber),
  ).length;
  const renderNoticeTextWithHighlights = (text: string) => {
    const ranges = normalizeNoticeHighlightRanges(scheduleNoticeHighlights, text);
    if (ranges.length === 0) return text;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((range, index) => {
      if (range.start > cursor) {
        nodes.push(text.slice(cursor, range.start));
      }
      nodes.push(
        <span
          key={`notice-highlight-${index}`}
          className={`notice-highlight-text notice-highlight-text-${range.color || NOTICE_HIGHLIGHT_COLORS[0].id}`}
        >
          {text.slice(range.start, range.end)}
        </span>,
      );
      cursor = range.end;
    });
    if (cursor < text.length) {
      nodes.push(text.slice(cursor));
    }
    return nodes;
  };
  const applyNoticeSelectionHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = document.querySelector('[data-notice-text-content="true"]');
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    const noticeContent = container.closest('.notice-content');
    if (!(noticeContent instanceof HTMLElement)) return;

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(container);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const start = beforeRange.toString().length;
    const selectedLength = range.toString().length;
    const end = start + selectedLength;

    if (selectedLength <= 0) return;

    const selectionRect = range.getBoundingClientRect();
    const hostRect = noticeContent.getBoundingClientRect();
    const popoverWidth = 136;
    const popoverHeight = 44;
    const x = Math.max(12, Math.min(selectionRect.right - hostRect.left + 12, hostRect.width - popoverWidth - 12));
    const y = Math.max(12, Math.min(selectionRect.bottom - hostRect.top + 10, hostRect.height - popoverHeight - 12));

    skipNextNoticeTextClickRef.current = true;
    setNoticeHighlightPopoverPosition({ x, y });
    setPendingNoticeHighlightRange({ start, end, color: NOTICE_HIGHLIGHT_COLORS[0].id });
  };
  const applyNoticeDraftSelectionHighlight = () => {
    const textarea = noticeInputRef.current;
    if (!textarea) return;

    const selectionStart = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const selectionEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);
    if (selectionEnd <= selectionStart) {
      setPendingNoticeHighlightRange(null);
      return;
    }

    const leadingTrimLength = noticeDraft.length - noticeDraft.trimStart().length;
    const trimmedText = noticeDraft.trim();
    const start = Math.max(0, Math.min(trimmedText.length, selectionStart - leadingTrimLength));
    const end = Math.max(0, Math.min(trimmedText.length, selectionEnd - leadingTrimLength));
    if (end <= start) {
      setPendingNoticeHighlightRange(null);
      return;
    }

    const editor = textarea.closest('.notice-editor');
    if (!(editor instanceof HTMLElement)) return;

    const computedStyle = window.getComputedStyle(textarea);
    const fontSize = Number.parseFloat(computedStyle.fontSize) || 44;
    const selectedPrefix = noticeDraft.slice(0, selectionEnd);
    const lineCount = selectedPrefix.split('\n').length;
    const estimatedX = textarea.clientWidth / 2 + Math.min(fontSize * 2, textarea.clientWidth * 0.22);
    const popoverWidth = 136;
    const popoverHeight = 44;
    const x = Math.max(12, Math.min(estimatedX, editor.clientWidth - popoverWidth - 12));
    const y = Math.max(12, Math.min(34 + (lineCount - 1) * fontSize * 1.18, editor.clientHeight - popoverHeight - 12));

    setNoticeHighlightPopoverPosition({ x, y });
    setPendingNoticeHighlightRange({ start, end, color: NOTICE_HIGHLIGHT_COLORS[0].id });
  };
  const applyPendingNoticeHighlight = (color: NoticeHighlightColorId) => {
    if (!pendingNoticeHighlightRange) return;
    const nextCursorPosition =
      noticeDraft.length - noticeDraft.trimStart().length + pendingNoticeHighlightRange.end;
    setScheduleNoticeHighlights((previous) =>
      normalizeNoticeHighlightRanges(
        [...previous, { ...pendingNoticeHighlightRange, color }],
        trimmedNotice,
      ),
    );
    skipNextNoticeTextClickRef.current = false;
    setPendingNoticeHighlightRange(null);
    window.getSelection()?.removeAllRanges();
    if (isEditingNoticeRef.current) {
      noticeInputRef.current?.focus();
      noticeInputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }
  };
  const cancelPendingNoticeHighlight = () => {
    const nextCursorPosition = pendingNoticeHighlightRange
      ? noticeDraft.length - noticeDraft.trimStart().length + pendingNoticeHighlightRange.end
      : null;
    if (pendingNoticeHighlightRange) {
      setScheduleNoticeHighlights((previous) =>
        removeNoticeHighlightRange(previous, pendingNoticeHighlightRange, trimmedNotice),
      );
    }
    skipNextNoticeTextClickRef.current = false;
    setPendingNoticeHighlightRange(null);
    window.getSelection()?.removeAllRanges();
    if (isEditingNoticeRef.current && nextCursorPosition !== null) {
      noticeInputRef.current?.focus();
      noticeInputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }
  };
  const musicButtonLabel = isMusicPlaying ? '배경 음악 끄기' : '배경 음악 켜기';
  const noticeMemoButton = (
    <button
      type="button"
      onClick={() => {
        void playAnnouncementSound('pop');
        setIsYoutubePanelOpen(false);
        setIsClasswordPanelOpen(false);
        setIsCurrencyPanelOpen(false);
        setIsMemoOpen(true);
      }}
      className="inline-flex h-6 items-center justify-center gap-1 rounded-full border border-[#D7E2D1] bg-[rgba(240,246,237,0.94)] px-2 text-[0.64rem] font-extrabold text-[#5C8D6D] shadow-[0_8px_16px_rgba(93,118,84,0.1)] backdrop-blur-xl transition-[background-color,transform,color] hover:bg-[rgba(248,251,246,0.98)] hover:scale-[1.02] hover:text-[#4F7258] sm:h-7 sm:px-2.25 sm:text-[0.68rem] md:h-8 md:px-2.5 md:text-[0.72rem]"
      aria-label="메모장"
      title="메모장"
      data-notice-memo-button="true"
    >
      <StickyNote size={13} strokeWidth={2.2} />
      <span>메모</span>
    </button>
  );
  const noticeBanner = (
    <AnimatePresence initial={false}>
      {shouldShowNoticeCard ? (
        <motion.div
          key="schedule-notice"
          className="relative z-30 shrink-0 overflow-hidden px-4 pb-1 pt-3 sm:px-5 sm:pt-4 md:px-6 md:pt-[1.15rem] lg:px-7 xl:px-8"
          initial={shouldReduceMotion
            ? { height: 0, opacity: 0 }
            : { height: 0, opacity: 0, y: -8, scale: 0.996 }}
          animate={{ height: 'auto', opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion
            ? { height: 0, opacity: 0 }
            : { height: 0, opacity: 0, y: -8, scale: 0.996 }}
          transition={shouldReduceMotion
            ? { duration: 0.16, ease: 'easeOut' }
            : {
                height: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                y: { type: 'spring', stiffness: 420, damping: 40, mass: 0.78 },
                scale: { type: 'spring', stiffness: 420, damping: 40, mass: 0.78 },
                opacity: { duration: 0.16, ease: 'easeOut' },
              }}
          style={{ transformOrigin: '50% 0%', willChange: 'transform, opacity' }}
          data-notice-motion="true"
        >
      <div
        className={`notice-card relative mx-auto w-full overflow-visible rounded-[2.2rem] border-2 border-[#4F6B47] bg-[#FFFBF6] px-1 pb-1 pt-1 text-left shadow-[0_16px_30px_rgba(82,107,73,0.16)] md:px-1.5 md:pb-1.5 ${isEditingNotice ? 'notice-card-editing' : 'notice-card-reading'}`}
      >
        {isEditingNotice ? (
          <div className="notice-editor relative grid min-h-[3.6rem] grid-rows-[1.45rem_minmax(0,1fr)_1.45rem] rounded-[1.8rem] border border-[#8FA384] bg-[#FFFDF8] px-2.5 py-1.5 transition-colors focus-within:border-[#5D7654] focus-within:ring-2 focus-within:ring-[#5D7654]/20 sm:min-h-[3.85rem] sm:grid-rows-[1.55rem_minmax(0,1fr)_1.55rem] sm:px-3 md:min-h-[4.1rem] md:grid-rows-[1.7rem_minmax(0,1fr)_1.7rem]">
            <div aria-hidden="true" className="row-start-1" />
            <div className="row-start-2 flex min-h-0 items-center">
              <textarea
                ref={noticeInputRef}
                value={noticeDraft}
                onChange={(e) => applyNoticeDraft(e.target.value)}
                onKeyUp={(e) => {
                  if (!e.nativeEvent.isComposing) {
                    applyNoticeDraftSelectionHighlight();
                  }
                }}
                onMouseUp={applyNoticeDraftSelectionHighlight}
                onTouchEnd={applyNoticeDraftSelectionHighlight}
                rows={1}
                maxLength={160}
                placeholder="공지 입력"
                className={`notice-draft-body block w-full resize-none overflow-hidden bg-transparent p-0 break-keep text-center font-bold text-[#3E2D20] outline-none placeholder:text-[#6E8265]/72 ${draftNoticeTextClass}`}
              />
            </div>
            {pendingNoticeHighlightRange ? (
              <div
                className="notice-highlight-popover absolute z-30 flex items-center gap-1.5 rounded-full border bg-white/95 px-2 py-1.5 shadow-[0_12px_24px_rgba(151,80,59,0.16)] backdrop-blur-sm"
                style={{
                  left: noticeHighlightPopoverPosition.x,
                  top: noticeHighlightPopoverPosition.y,
                }}
                data-notice-highlight-popover="true"
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyPendingNoticeHighlight('coral')}
                  className="notice-highlight-apply-button inline-flex h-8 items-center justify-center rounded-full px-3 text-[0.72rem] font-extrabold text-white transition-colors"
                  title="코랄색으로 강조"
                  aria-label="코랄색으로 강조"
                >
                  강조
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelPendingNoticeHighlight}
                  className="inline-flex h-8 items-center justify-center rounded-full px-2.5 text-[0.7rem] font-extrabold text-[#8A6347] transition-colors hover:bg-[#FFF2E3]"
                >
                  취소
                </button>
              </div>
            ) : null}
            <div className="row-start-3 flex items-center justify-end gap-2">
              {noticeMemoButton}
            </div>
          </div>
        ) : (
          <>
            <div className="notice-content relative grid min-h-[3.6rem] w-full grid-rows-[1.45rem_minmax(0,1fr)_1.45rem] rounded-[1.8rem] border border-[#8FA384] bg-[#FFFDF8] px-2.5 py-1.5 transition-colors hover:bg-white sm:min-h-[3.85rem] sm:grid-rows-[1.55rem_minmax(0,1fr)_1.55rem] sm:px-3 md:min-h-[4.1rem] md:grid-rows-[1.7rem_minmax(0,1fr)_1.7rem]">
              <div aria-hidden="true" className="row-start-1" />
              <div
                className="row-start-2 flex w-full min-h-0 items-center justify-center bg-transparent text-left"
                title="드래그한 뒤 강조를 누르면 코랄색으로 표시됩니다."
                onClick={() => {
                  if (skipNextNoticeTextClickRef.current) {
                    skipNextNoticeTextClickRef.current = false;
                    return;
                  }
                  setPendingNoticeHighlightRange(null);
                  startNoticeEdit();
                }}
                onMouseUp={applyNoticeSelectionHighlight}
                onTouchEnd={applyNoticeSelectionHighlight}
              >
                <p
                  data-notice-text-content="true"
                  className={`notice-text-body notice-text-selectable w-full break-keep whitespace-pre-line text-center font-bold text-[#3E2D20] ${studentNoticeTextClass}`}
                >
                  {renderNoticeTextWithHighlights(trimmedNotice)}
                </p>
              </div>
              <div className="row-start-3 flex items-center justify-end">
                {noticeMemoButton}
              </div>
              {pendingNoticeHighlightRange ? (
                <div
                  className="notice-highlight-popover absolute z-30 flex items-center gap-1.5 rounded-full border bg-white/95 px-2 py-1.5 shadow-[0_12px_24px_rgba(151,80,59,0.16)] backdrop-blur-sm"
                  style={{
                    left: noticeHighlightPopoverPosition.x,
                    top: noticeHighlightPopoverPosition.y,
                  }}
                  data-notice-highlight-popover="true"
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyPendingNoticeHighlight('coral')}
                    className="notice-highlight-apply-button inline-flex h-8 items-center justify-center rounded-full px-3 text-[0.72rem] font-extrabold text-white transition-colors"
                    title="코랄색으로 강조"
                    aria-label="코랄색으로 강조"
                  >
                    강조
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelPendingNoticeHighlight}
                    className="inline-flex h-8 items-center justify-center rounded-full px-2.5 text-[0.7rem] font-extrabold text-[#8A6347] transition-colors hover:bg-[#FFF2E3]"
                  >
                    취소
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
  const scheduleSettingsPanel = (
    <div className="settings-panel-grid grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <aside className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
        <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-title text-[1.2rem] font-extrabold text-[#3F2B20]">요일 선택</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openScheduleCopy}
                className="toolbar-button toolbar-button-green inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5C8D5D] transition-colors"
                title="선택한 요일 일정을 평일에 복사"
                aria-label="선택한 요일 일정을 평일에 복사"
              >
                <Copy size={18} strokeWidth={2.35} />
              </button>
              <div className="settings-count-pill rounded-full border border-[#E6D5C9] bg-white px-3 py-1.5 text-[0.82rem] font-extrabold text-[#8A6347]">
                {activeWeekdayScheduleCount} / {WEEKDAYS.length}일 사용
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-2">
            {[1, 2, 3, 4, 5].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => selectEditingDay(day)}
                className={`settings-day-button rounded-[1.1rem] px-3 py-3 text-center text-[0.95rem] font-extrabold transition-[background-color,border-color,color,box-shadow,transform] ${
                  editingDay === day
                    ? 'settings-day-button-active bg-[#688772] text-white shadow-[0_12px_20px_rgba(82,107,73,0.2)]'
                    : 'settings-day-button-idle border border-[#E6D5C9] bg-white text-[#8A6347] hover:border-[#CBB39D] hover:bg-[#FFF9F2]'
                }`}
              >
                {DAYS[day]}요일
              </button>
            ))}
          </div>

          <div className="settings-schedule-transfer mt-4 grid grid-cols-2 gap-2 border-t border-[#E6D5C9] pt-4">
            <button
              type="button"
              onClick={exportSchedule}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] border border-[#D8C7B6] bg-white px-3 text-[0.84rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF9F2]"
            >
              <Download size={17} aria-hidden="true" />
              시간표 백업
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] border border-[#D8C7B6] bg-white px-3 text-[0.84rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF9F2]"
            >
              <Upload size={17} aria-hidden="true" />
              시간표 복구
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={importSchedule}
            />
          </div>

        </section>

        <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
          <h3 className="section-title text-[1.1rem] font-extrabold text-[#3F2B20]">학교 시계 보정</h3>
          <p className="mt-1.5 text-[0.82rem] font-semibold leading-relaxed text-[#8A6347]/75">
            학교 종이보다 빠르면 +, 늦으면 −초
          </p>
          <label className="mt-3 flex items-center gap-2">
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
        </section>

      </aside>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <h3 className="section-title text-[1.35rem] font-extrabold text-[#3F2B20]">
                {DAYS[editingDay]}요일 일정
              </h3>
            </div>
          </div>
        </div>

        {showCopyConfirm && (
          <div className="confirm-box flex flex-col gap-4 rounded-xl border border-[#C65D47]/30 bg-[#FFF5F3] p-4">
            <div>
              <p className="text-sm font-bold text-[#C65D47]">
                {DAYS[editingDay]}요일 일정을 복사할 평일을 선택하세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="복사할 평일 선택">
                {WEEKDAYS.map((day) => {
                  const isSourceDay = day === editingDay;
                  const isSelected = copyTargetDays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isSourceDay}
                      aria-pressed={isSourceDay ? undefined : isSelected}
                      onClick={() => toggleScheduleCopyTarget(day)}
                      className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-extrabold transition-[background-color,border-color,color,box-shadow,transform] ${
                        isSourceDay
                          ? 'cursor-not-allowed border-[#D8D6D1] bg-[#ECEBE7] text-[#77736D]'
                          : isSelected
                            ? 'border-[#4D6F60] bg-[#4D6F60] text-white shadow-[0_6px_14px_rgba(77,111,96,0.18)]'
                            : 'border-[#D8C7B6] bg-white text-[#6E5139] hover:border-[#9FB9AD] hover:bg-[#F3FAF7]'
                      }`}
                    >
                      {DAYS[day]}요일{isSourceDay ? ' · 기준' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                onClick={closeScheduleCopy}
                className="toolbar-button toolbar-button-neutral rounded-lg px-3 py-1.5 text-sm font-bold text-[#8A6347]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={copyTargetDays.size === 0}
                onClick={confirmScheduleCopy}
                className="toolbar-button toolbar-button-danger copy-confirm-action-button rounded-lg px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#B7B4AE]"
              >
                {copyTargetDays.size > 0 ? `${copyTargetDays.size}일에 복사` : '요일을 선택하세요'}
              </button>
            </div>
          </div>
        )}

        <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5">
          <div className="space-y-3">
            {editingDaySchedule.length === 0 ? (
              <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-10 text-center font-medium text-[#8A6347]/60">
                일정이 없습니다.
              </div>
            ) : (
              editingDaySchedule.map((slot, index) => {
                const isMorningRow = index === 0;
                const isClassRow = slot.type === 'class';
                const isFixedDurationRow = !isMorningRow && (slot.type === 'class' || slot.type === 'break');
                const periodNumber = getSchedulePeriodNumber(slot);
                return (
                  <div key={slot.id} className="slot-editor-entry">
                    <div className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
                    {isClassRow ? (
                      <span className="slot-period-label -ml-2 inline-flex min-h-10 min-w-[3.4rem] flex-1 items-center rounded-xl px-3 text-base font-extrabold text-[#3A5A3B] md:text-lg">
                        {periodNumber ?? slot.name}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={slot.name}
                        readOnly={isMorningRow || slot.type === 'break' || slot.type === 'lunch'}
                        onChange={(e) => updateSlot(editingDay, slot.id, 'name', e.target.value)}
                        className="slot-name-input -ml-2 min-w-[120px] flex-1 rounded-lg border-none bg-transparent px-2 py-1 text-base font-bold text-[#8A6347] outline-none focus:ring-2 focus:ring-[#5C8D5D]/20 md:text-lg"
                        placeholder="일정 이름"
                      />
                    )}
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
                    {index < editingDaySchedule.length - 1 ? (
                      <div className="slot-insert-rail">
                        <button
                          type="button"
                          onClick={() => addSlot(editingDay, index)}
                          className="slot-insert-button"
                          aria-label={`${slot.name} 다음에 일정 추가`}
                          title="이 위치에 일정 추가"
                        >
                          <span aria-hidden="true"><Plus size={16} strokeWidth={2.6} /></span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => addSlot(editingDay)}
            className="add-slot-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5C8D5D] py-4 text-lg font-bold text-[#5C8D5D] transition-[background-color,border-color,box-shadow,color] hover:bg-[#5C8D5D] hover:text-white"
          >
            <Plus size={24} />
            일정 추가
          </button>
        </div>
      </section>
    </div>
  );
  const subjectSettingsPanel = (
    <div className="settings-panel-grid grid gap-4">
      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="section-title text-[1.35rem] font-extrabold text-[#3F2B20]">주차별 과목</h3>
          </div>
          <label className="subject-week-select-label flex w-full max-w-[31rem] flex-col gap-2 sm:min-w-[28rem]">
            <span className="section-title text-[0.85rem] font-bold text-[#8A6347]">주 선택</span>
            <select
              value={selectedSubjectWeekKey}
              onChange={(event) => setSelectedSubjectWeekKey(event.target.value)}
              className="subject-week-select slot-select w-full cursor-pointer rounded-xl border border-[#D7E2D1] bg-white px-3 py-2.5 text-[0.95rem] font-extrabold text-[#3A5A3B] outline-none transition-colors hover:bg-[#F3FAF7]"
            >
              {subjectWeekOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h4 className="section-title text-[1.15rem] font-extrabold text-[#3F2B20]">
            {selectedSubjectWeekLabel}
          </h4>
        </div>

        {subjectPeriodKeys.length === 0 ? (
          <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-10 text-center font-medium text-[#8A6347]/60">
            수업 일정이 없습니다.
          </div>
        ) : (
          <div className="custom-scrollbar overflow-x-auto pb-1">
            <datalist id={SUBJECT_CATALOG_DATALIST_ID}>
              {subjectCatalog.map((subject) => <option key={subject} value={subject} />)}
            </datalist>
            <table className="subject-week-table w-full min-w-[54rem] border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-2 pb-2 text-left text-[0.82rem] font-extrabold text-[#8A6347]">교시</th>
                  {WEEKDAYS.map((day) => (
                    <th key={day} className="px-2 pb-2 text-left text-[0.82rem] font-extrabold text-[#8A6347]">
                      {DAYS[day]}요일
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjectPeriodKeys.map((subjectKey) => (
                  <tr key={subjectKey}>
                    <th className="rounded-l-2xl border border-r-0 border-[#E6D5C9] bg-white px-3 py-3 text-left">
                      <span className="slot-period-label inline-flex min-h-10 min-w-[3.4rem] items-center justify-center rounded-xl bg-[#F0F5F0] px-3 text-base font-extrabold text-[#3A5A3B]">
                        {Number.isFinite(Number(subjectKey)) ? subjectKey : subjectKey}
                      </span>
                    </th>
                    {WEEKDAYS.map((day, dayIndex) => {
                      const slot = subjectClassSlotsByDay[day].find(
                        (classSlot) => getScheduleSubjectKey(classSlot) === subjectKey,
                      );
                      const weeklySubjectValue = slot
                        ? getWeeklySubject(weeklySubjects, selectedSubjectWeekKey, day, slot)
                        : '';
                      const subjectInputState = getSubjectInputState(weeklySubjectValue);
                      const subjectStatusClass = `slot-subject-input-${subjectInputState}`;

                      return (
                        <td
                          key={`${subjectKey}-${day}`}
                          className={`border-y border-[#E6D5C9] bg-white px-2 py-3 ${
                            dayIndex === WEEKDAYS.length - 1 ? 'rounded-r-2xl border-r pr-3' : ''
                          }`}
                        >
                          {slot ? (
                            <div className="subject-combobox relative">
                              <input
                                type="text"
                                list={subjectCatalog.length > 0 ? SUBJECT_CATALOG_DATALIST_ID : undefined}
                                value={weeklySubjectValue}
                                onChange={(event) => updateWeeklySubject(selectedSubjectWeekKey, day, slot, event.target.value)}
                                maxLength={MAX_SUBJECT_NAME_LENGTH}
                                className={`slot-subject-input subject-combobox-input w-full min-w-0 rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] py-2.5 pl-3 pr-9 text-[0.95rem] font-bold text-[#3F2B20] outline-none transition-colors hover:border-[#B58363] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20 ${subjectStatusClass}`}
                                data-subject-state={getSubjectInputState(weeklySubjectValue)}
                                placeholder="선택"
                                title="목록에서 선택하거나 직접 입력"
                                aria-label={`${DAYS[day]}요일 ${subjectKey}교시 과목 선택 또는 입력`}
                              />
                              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A6347]/70" size={16} />
                            </div>
                          ) : (
                            <span className="block rounded-xl border border-dashed border-[#E6D5C9] bg-[#F7F0E8]/70 px-3 py-2.5 text-center text-[0.9rem] font-bold text-[#B89E87]/70">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title text-[1.35rem] font-extrabold text-[#3F2B20]">과목 목록</h3>
          </div>
          <span className="settings-count-pill inline-flex min-h-9 items-center rounded-full border border-[#D7E2D1] bg-white px-3 text-[0.82rem] font-extrabold text-[#3A5A3B]">
            {subjectCatalog.length}개
          </span>
        </div>

        <div className="subject-catalog-list grid gap-2">
          {subjectCatalog.length === 0 ? (
            <div className="empty-slot-state rounded-2xl border border-dashed border-[#E6D5C9] bg-white py-6 text-center font-medium text-[#8A6347]/60 sm:col-span-2 xl:col-span-3">
              등록된 과목이 없습니다.
            </div>
          ) : (
            subjectCatalog.map((subject, index) => (
              <div key={`subject-catalog-${index}`} className="subject-catalog-row flex min-w-0 items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => updateSubjectCatalogItem(index, event.target.value)}
                  onFocus={beginSubjectCatalogEdit}
                  onBlur={endSubjectCatalogEdit}
                  maxLength={MAX_SUBJECT_NAME_LENGTH}
                  className="subject-catalog-input min-w-0 flex-1 rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-3 py-2.5 text-[0.95rem] font-bold text-[#3F2B20] outline-none transition-colors hover:border-[#B58363] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
                  aria-label={`${index + 1}번째 과목`}
                />
                <button
                  type="button"
                  onClick={() => removeSubjectCatalogItem(index)}
                  className="icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] text-[#B05A47] transition-colors hover:border-[#C74C3D] hover:bg-[#FFF1EC]"
                  title="과목 삭제"
                  aria-label={`${subject} 삭제`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="subject-catalog-add-row mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newSubjectName}
            onChange={(event) => setNewSubjectName(event.target.value)}
            onFocus={beginSubjectCatalogEdit}
            onBlur={endSubjectCatalogEdit}
            maxLength={MAX_SUBJECT_NAME_LENGTH}
            onKeyDown={(event) => {
              if (isComposingKeyboardEvent(event) || event.altKey || event.ctrlKey || event.metaKey) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                addSubjectCatalogItem();
              }
            }}
            className="subject-catalog-input min-w-0 flex-1 rounded-xl border border-[#D7E2D1] bg-white px-3 py-2.5 text-[0.95rem] font-bold text-[#3F2B20] outline-none transition-colors hover:border-[#9FC7B8] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20"
            placeholder="새 과목"
          />
          <button
            type="button"
            onClick={addSubjectCatalogItem}
            disabled={!normalizeSubjectName(newSubjectName) || subjectCatalog.includes(normalizeSubjectName(newSubjectName))}
            className="add-subject-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#5C8D5D] bg-[#5C8D5D] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#476F48] disabled:cursor-not-allowed disabled:border-[#C9D8C9] disabled:bg-[#8FA98F]"
          >
            <Plus size={18} />
            과목 추가
          </button>
        </div>
      </section>
    </div>
  );
  const drawnBallsSettingsCard = (
    <div className="settings-card random-history-panel rounded-[1.7rem] border border-[#EEE4D6] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="max-w-[32rem]">
          <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
            {DRAWN_BALLS_SECTION_LABEL}
          </h4>
        </div>

        <div className="settings-count-pill rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
          {selectedDrawHistoryEntries.length} / {selectedDrawSettingsCaseData.totalCount}
        </div>
      </div>

      <div className="custom-scrollbar random-history-scroll mt-4 max-h-[17rem] overflow-y-auto pr-1">
        {selectedDrawHistoryEntries.length > 0 ? (
          <div className="random-history-grid">
            {selectedDrawHistoryDisplayEntries.map((entry) => {
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
  );
  const drawSettingsPanel = (
    <div className="settings-panel-grid grid gap-4 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF5EE] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5 lg:sticky lg:top-0 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">상황</h3>
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
                className={`settings-case-card rounded-[1.45rem] border-2 p-3 transition-colors ${
                  isSelected
                    ? 'settings-case-card-active border-[#B58363] bg-white shadow-[0_10px_20px_rgba(181,131,99,0.12)]'
                    : 'settings-case-card-idle border-[#E8DCCD] bg-[rgba(255,252,247,0.88)]'
                }`}
              >
                <div className="draw-case-heading-row flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={caseState.label}
                      onFocus={() => setDrawSettingsCaseId(caseState.id)}
                      onChange={(event) => updateDrawCaseLabel(caseState.id, event.target.value)}
                      className="draw-case-label-input w-full rounded-xl border px-3 py-2 text-[1rem] font-extrabold md:text-[1.08rem]"
                      placeholder={getCaseLabelByIndex(index)}
                      aria-label={`${displayLabel} 이름 수정`}
                    />
                    <button
                      type="button"
                      onClick={() => setDrawSettingsCaseId(caseState.id)}
                      className="mt-1.5 block w-full text-left text-[0.88rem] font-bold leading-6 text-[#B58363]"
                    >
                      {getCaseSummaryLabel(caseState)}
                    </button>
                  </div>

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
        <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="section-title text-[1.35rem] font-extrabold text-[#3F2B20]">
                {selectedDrawSettingsCaseLabel}
              </h3>
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

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="settings-stat-card rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="settings-eyebrow text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                범위
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {selectedDrawSettingsBounds.minNumber} - {selectedDrawSettingsBounds.maxNumber}
              </div>
            </div>
            <div className="settings-stat-card rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="settings-eyebrow text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                명단
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {assignedStudentNameCount} / {settingsStudentNumbers.length}
              </div>
            </div>
            <div className="settings-stat-card rounded-[1.15rem] border border-[#E7DACB] bg-[#FFF9F1] px-4 py-3">
              <div className="settings-eyebrow text-[0.78rem] font-extrabold uppercase tracking-[0.18em] text-[#B58363]/75">
                기록
              </div>
              <div className="mt-1 text-[1rem] font-extrabold text-[#3F2B20]">
                {selectedDrawHistoryEntries.length} / {selectedDrawSettingsCaseData.totalCount}
              </div>
            </div>
          </div>
        </div>

        {drawnBallsSettingsCard}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)]">
          <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FCF8F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
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

          <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="flex items-start justify-between gap-3">
              <div className="max-w-[32rem]">
                <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">재등장 연출</h4>
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
                  className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-[left] ${
                    repeatPickEnabled ? 'left-[2.55rem]' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="max-w-[32rem]">
              <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">학생 명단</h4>
            </div>

            <div className="settings-count-pill rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
              {assignedStudentNameCount} / {settingsStudentNumbers.length}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(15rem,18.5rem)_minmax(0,1fr)]">
            <div className="settings-subcard rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
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
              </div>

              <div className="custom-scrollbar mt-3 max-h-[22rem] overflow-y-auto pr-1">
                <div className="grid gap-2.5">
                  {settingsStudentNumbers.map((studentNumber, index) => (
                    <label
                      key={studentNumber}
                      className="draw-roster-row grid grid-cols-[4.2rem_minmax(0,1fr)] items-center gap-2 rounded-[1.05rem] border border-[#E6D5C9] bg-white/90 px-3 py-2.5"
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

        {isHiddenDrawSettingsVisible ? (
            <div className="settings-card rounded-[1.7rem] border border-[#E6D8C9] bg-[#FBF2E9] p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-[32rem]">
                  <h4 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">
                    {SECRET_DRAW_SECTION_LABEL}
                  </h4>
                </div>

                <div className="settings-count-pill rounded-full border border-[#E6D5C9] bg-white px-4 py-2 text-[0.88rem] font-extrabold text-[#8A6347]">
                  {reservedDrawCount > 0 ? `${reservedDrawCount}개 예약` : SECRET_DRAW_EMPTY_LABEL}
                </div>
              </div>

              <div className="settings-subcard mt-4 rounded-[1.2rem] border border-[#E7DACB] bg-[#FFF9F1] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
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
  );

  const auctionVisibleDayCount = getAuctionVisibleDayCount();
  const isAuctionScheduleClosed = auctionVisibleDayCount === 0;
  const isAuctionConfigurationExpanded =
    !isAuctionScheduleClosed || temporaryVisibleAuctionItemIds.size > 0;
  const awardableAuctionItems = auctionItems.filter((item) => {
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    return item.dayIndex < auctionVisibleDayCount && !auctionAwards[item.id] && currentBid.bidder !== null && currentBid.amount > 0;
  });
  const awardPresentationCompletedItems = awardPresentation
    ? getAuctionAwardsForDay(auctionItems, auctionAwards, awardPresentation.item.dayIndex)
    : [];

  const sendTeacherLetter = async () => {
    const content = mailContent.trim();
    if (!content || isMailSending) return;
    setIsMailSending(true);
    setMailStatus('');
    const recipients = getTeacherLetterRecipients(mailRecipient);
    const batchId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const letters = recipients.map((recipient) => ({
      id: `${batchId}-${recipient}`,
      recipient,
      senderLabel: '선생님',
      senderStudentNumber: null,
      replyToId: mailReplyToId,
      title: mailTitle.trim(),
      content,
      createdAt,
    }));
    try {
      let savedState = createStudentLetters(studentLife, letters);
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          savedState = createStudentLetters(normalizeStudentLifeState(current.studentLife), letters);
          return { ...current, studentLife: savedState };
        });
      } else {
        savedState = createStudentLetters(loadStoredStudentLifeState(), letters);
        storeStudentLifeState(savedState);
      }
      setStudentLife(savedState);
      setMailTitle('');
      setMailContent('');
      setMailReplyToId(undefined);
      setMailStatus(mailRecipient === ALL_STUDENTS_LETTER_RECIPIENT
        ? '모든 학생에게 보냈습니다.'
        : `${mailRecipient}번에게 보냈습니다.`);
    } catch (error) {
      console.error('Failed to send teacher letter.', error);
      setMailStatus('편지를 보내지 못했습니다.');
    } finally {
      setIsMailSending(false);
    }
  };

  const markTeacherLetterAsRead = async (letterId: string) => {
    if (teacherLetterReadInFlightRef.current.has(letterId)) return;
    teacherLetterReadInFlightRef.current.add(letterId);
    const readAt = new Date().toISOString();
    try {
      let savedState = markTeacherLetterRead(studentLife, letterId, readAt);
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          savedState = markTeacherLetterRead(
            normalizeStudentLifeState(current.studentLife),
            letterId,
            readAt,
          );
          return { ...current, studentLife: savedState };
        });
      } else {
        savedState = markTeacherLetterRead(loadStoredStudentLifeState(), letterId, readAt);
        storeStudentLifeState(savedState);
      }
      setStudentLife(savedState);
    } catch (error) {
      console.error('Failed to mark teacher letter as read.', error);
    } finally {
      teacherLetterReadInFlightRef.current.delete(letterId);
    }
  };

  const publishDailyWriting = async (input: {
    readonly dateKey: string;
    readonly topic: string;
    readonly requiredWord: string;
    readonly requiredWordMeaning: string;
  }): Promise<boolean> => {
    if (isWritingPublishing) return false;
    if (!isDailyWritingWeekday(input.dateKey)) {
      setWritingStatus('글쓰기 주제는 월요일부터 금요일까지만 할당할 수 있습니다.');
      return false;
    }
    const draft = {
      dateKey: input.dateKey,
      topic: input.topic.trim(),
      requiredWord: input.requiredWord.trim(),
      requiredWordMeaning: input.requiredWordMeaning.trim(),
      publishedAt: new Date().toISOString(),
    };
    setIsWritingPublishing(true);
    setWritingStatus('');
    try {
      let published = publishDailyWritingAssignment(dailyWriting, studentLife, draft);
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          published = publishDailyWritingAssignment(
            normalizeDailyWritingState(current.dailyWriting),
            normalizeStudentLifeState(current.studentLife),
            draft,
          );
          return { ...current, dailyWriting: published.state, studentLife: published.studentLife };
        });
      } else {
        published = publishDailyWritingAssignment(loadStoredDailyWritingState(), loadStoredStudentLifeState(), draft);
        storeStudentLifeState(published.studentLife);
        storeDailyWritingState(published.state);
      }
      setStudentLife(published.studentLife);
      setDailyWriting(published.state);
      setWritingStatus('글밥 편지를 23명에게 보냈습니다.');
      return true;
    } catch (error) {
      console.error('Failed to publish daily writing assignment.', error);
      setWritingStatus('글밥 편지를 보내지 못했습니다.');
      return false;
    } finally {
      setIsWritingPublishing(false);
    }
  };

  const rewardDailyWritingStudent = async (studentNumber: number): Promise<boolean> => {
    const assignment = dailyWriting.assignment;
    if (!assignment || rewardingWritingStudentNumber !== null) return false;
    setRewardingWritingStudentNumber(studentNumber);
    setWritingStatus('');
    try {
      const initialReward = claimDailyWritingRewardInSettings(
        { currencyBalances: currencyBalancesRef.current, currencyHistory: currencyHistoryRef.current },
        studentNumber,
        assignment.dateKey,
      );
      let savedBalances = initialReward.balances;
      let savedHistory = initialReward.history;
      let wasAwarded = initialReward.awarded;
      let savedDailyWriting = dailyWriting;
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          const reward = claimDailyWritingRewardInSettings(current, studentNumber, assignment.dateKey);
          savedBalances = reward.balances;
          savedHistory = reward.history;
          wasAwarded = reward.awarded;
          savedDailyWriting = hasDailyWritingReward(reward.history, studentNumber, assignment.dateKey)
            ? markDailyWritingStudentRewarded(
              normalizeDailyWritingState(current.dailyWriting),
              studentNumber,
              assignment.dateKey,
            )
            : normalizeDailyWritingState(current.dailyWriting);
          return { ...reward.value, dailyWriting: savedDailyWriting };
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        const reward = claimDailyWritingRewardInSettings(snapshot, studentNumber, assignment.dateKey);
        savedBalances = reward.balances;
        savedHistory = reward.history;
        wasAwarded = reward.awarded;
        savedDailyWriting = hasDailyWritingReward(reward.history, studentNumber, assignment.dateKey)
          ? markDailyWritingStudentRewarded(loadStoredDailyWritingState(), studentNumber, assignment.dateKey)
          : loadStoredDailyWritingState();
        if (wasAwarded) {
          const stored = storeStudentPetSnapshot({
            ...snapshot,
            currencyBalances: savedBalances,
            currencyHistory: savedHistory,
          });
          if (!stored) {
            setWritingStatus('고마를 지급하지 못했습니다.');
            return false;
          }
          storeDailyWritingState(savedDailyWriting);
        }
      }
      commitCurrencyState(savedBalances, savedHistory);
      setDailyWriting(savedDailyWriting);
      setWritingStatus(wasAwarded
        ? `${studentNumber}번에게 25고마를 지급했습니다.`
        : `${studentNumber}번은 이미 지급했거나 잔액 한도에 도달했습니다.`);
      return wasAwarded;
    } catch (error) {
      console.error('Failed to reward daily writing assignment.', error);
      setWritingStatus('고마를 지급하지 못했습니다.');
      return false;
    } finally {
      setRewardingWritingStudentNumber(null);
    }
  };

  const cancelDailyWritingStudentReward = async (studentNumber: number): Promise<boolean> => {
    const assignment = dailyWriting.assignment;
    if (!assignment || rewardingWritingStudentNumber !== null) return false;
    setRewardingWritingStudentNumber(studentNumber);
    setWritingStatus('');
    try {
      let savedBalances = currencyBalancesRef.current;
      let savedHistory = currencyHistoryRef.current;
      let savedDailyWriting = dailyWriting;
      let wasCancelled = false;
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          const cancellation = cancelDailyWritingRewardInSettings(current, studentNumber, assignment.dateKey);
          savedBalances = cancellation.balances;
          savedHistory = cancellation.history;
          wasCancelled = cancellation.cancelled;
          savedDailyWriting = cancellation.cancelled
            ? unmarkDailyWritingStudentRewarded(
              normalizeDailyWritingState(current.dailyWriting),
              studentNumber,
              assignment.dateKey,
            )
            : normalizeDailyWritingState(current.dailyWriting);
          return { ...cancellation.value, dailyWriting: savedDailyWriting };
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        const cancellation = cancelDailyWritingRewardInSettings(snapshot, studentNumber, assignment.dateKey);
        savedBalances = cancellation.balances;
        savedHistory = cancellation.history;
        wasCancelled = cancellation.cancelled;
        savedDailyWriting = cancellation.cancelled
          ? unmarkDailyWritingStudentRewarded(loadStoredDailyWritingState(), studentNumber, assignment.dateKey)
          : loadStoredDailyWritingState();
        if (wasCancelled) {
          const stored = storeStudentPetSnapshot({
            ...snapshot,
            currencyBalances: savedBalances,
            currencyHistory: savedHistory,
          });
          if (!stored) {
            setWritingStatus('지급을 취소하지 못했습니다.');
            return false;
          }
          storeDailyWritingState(savedDailyWriting);
        }
      }
      commitCurrencyState(savedBalances, savedHistory);
      setDailyWriting(savedDailyWriting);
      setWritingStatus(wasCancelled
        ? `${studentNumber}번의 25고마 지급을 취소했습니다.`
        : `${studentNumber}번의 지급 기록을 찾지 못했습니다.`);
      return wasCancelled;
    } catch (error) {
      console.error('Failed to cancel daily writing reward.', error);
      setWritingStatus('지급을 취소하지 못했습니다.');
      return false;
    } finally {
      setRewardingWritingStudentNumber(null);
    }
  };

  const dailyWritingCompletedStudentNumbers = new Set<number>([
    ...dailyWriting.completedStudentNumbers,
    ...CURRENCY_STUDENT_NUMBERS.filter((studentNumber) => (
      dailyWriting.assignment
        ? hasDailyWritingReward(currencyHistory, studentNumber, dailyWriting.assignment.dateKey)
        : false
    )),
  ]);
  const dailyWritingAssignedDateKeys = [...new Set([
    ...getDailyWritingAssignedDateKeys(studentLife.letters),
    ...(dailyWriting.assignment ? [dailyWriting.assignment.dateKey] : []),
  ])].sort();

  const teacherLetters = getTeacherLetters(studentLife);
  const unreadTeacherLetterCount = getUnreadTeacherLetterCount(studentLife);
  const selectedTeacherLetter = teacherLetters.find((letter) => letter.id === selectedTeacherLetterId)
    ?? (unreadTeacherLetterCount === 0 ? teacherLetters[0] : null)
    ?? null;

  useEffect(() => {
    if (
      !isSettingsOpen
      || settingsPanel !== 'mail'
      || !selectedTeacherLetter
      || selectedTeacherLetter.readAt !== null
    ) return;
    void markTeacherLetterAsRead(selectedTeacherLetter.id);
  }, [isSettingsOpen, selectedTeacherLetter, settingsPanel]);

  const replyToStudentLetter = () => {
    if (!selectedTeacherLetter?.senderStudentNumber) return;
    setMailRecipient(selectedTeacherLetter.senderStudentNumber);
    setMailTitle(selectedTeacherLetter.title.startsWith('답장:')
      ? selectedTeacherLetter.title
      : `답장: ${selectedTeacherLetter.title || '편지'}`);
    setMailContent('');
    setMailReplyToId(selectedTeacherLetter.id);
  };

  const addFeaturedWriting = () => {
    const writing = createEmptyFeaturedWriting(crypto.randomUUID());
    setBookstoreSettings((current) => ({
      featuredWritings: [...current.featuredWritings, writing],
    }));
  };

  const updateFeaturedWriting = (
    writingId: string,
    change: (writing: FeaturedWriting) => FeaturedWriting,
  ) => {
    setBookstoreSettings((current) => ({
      featuredWritings: current.featuredWritings.map((writing) => (
        writing.id === writingId ? change(writing) : writing
      )),
    }));
  };

  const deleteFeaturedWriting = (writing: FeaturedWriting) => {
    const label = writing.title.trim() || '제목 없는 글';
    if (!window.confirm(`“${label}” 우수글을 삭제할까요?`)) return;
    setBookstoreSettings((current) => ({
      featuredWritings: current.featuredWritings.filter((entry) => entry.id !== writing.id),
    }));
  };

  const bookstoreSettingsPanel = (
    <section
      className="settings-card teacher-bookstore-settings rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5"
      aria-labelledby="teacher-bookstore-title"
      onFocusCapture={() => {
        isEditingBookstoreRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          isEditingBookstoreRef.current = false;
        }
      }}
    >
      <header className="teacher-bookstore-header">
        <div>
          <h3 id="teacher-bookstore-title">우수글 진열대</h3>
        </div>
        <button type="button" onClick={addFeaturedWriting}>
          <Plus size={18} aria-hidden="true" /> 우수글 추가
        </button>
      </header>

      {bookstoreSettings.featuredWritings.length > 0 ? (
        <div className="teacher-featured-writing-list">
          {bookstoreSettings.featuredWritings.map((writing, index) => {
            const canPublish = writing.title.trim().length > 0 && writing.content.trim().length > 0;
            return (
              <article key={writing.id} className="teacher-featured-writing-card">
                <div className="teacher-featured-writing-toolbar">
                  <strong>진열 {index + 1}</strong>
                  <div>
                    <button
                      type="button"
                      onClick={() => setBookstoreSettings((current) => ({
                        featuredWritings: moveFeaturedWriting(current.featuredWritings, writing.id, -1),
                      }))}
                      disabled={index === 0}
                      aria-label={`${writing.title || '제목 없는 글'} 위로 이동`}
                    >
                      <ArrowUp size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookstoreSettings((current) => ({
                        featuredWritings: moveFeaturedWriting(current.featuredWritings, writing.id, 1),
                      }))}
                      disabled={index === bookstoreSettings.featuredWritings.length - 1}
                      aria-label={`${writing.title || '제목 없는 글'} 아래로 이동`}
                    >
                      <ArrowDown size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="teacher-featured-writing-delete"
                      onClick={() => deleteFeaturedWriting(writing)}
                      aria-label={`${writing.title || '제목 없는 글'} 삭제`}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="teacher-featured-writing-fields">
                  <label className="teacher-featured-writing-wide">
                    <span>제목</span>
                    <input
                      value={writing.title}
                      maxLength={80}
                      onChange={(event) => updateFeaturedWriting(writing.id, (current) => ({ ...current, title: event.target.value }))}
                      placeholder="예: 우리 반의 봄"
                    />
                  </label>
                  <label className="teacher-featured-writing-wide">
                    <span>본문</span>
                    <textarea
                      value={writing.content}
                      maxLength={10_000}
                      rows={2}
                      onChange={(event) => updateFeaturedWriting(writing.id, (current) => ({ ...current, content: event.target.value }))}
                      placeholder="학생에게 보여 줄 글을 입력하세요"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className={`teacher-featured-writing-publish${writing.isPublished ? ' is-published' : ''}`}
                  onClick={() => updateFeaturedWriting(writing.id, (current) => ({
                    ...current,
                    isPublished: !current.isPublished,
                  }))}
                  disabled={!canPublish && !writing.isPublished}
                  aria-pressed={writing.isPublished}
                >
                  <span aria-hidden="true" />
                  {writing.isPublished ? '학생에게 공개 중' : canPublish ? '비공개 · 눌러서 공개' : '제목과 본문을 입력해 주세요'}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="teacher-bookstore-empty">
          <BookOpen aria-hidden="true" />
          <strong>등록된 우수글이 없습니다.</strong>
          <p>‘우수글 추가’를 눌러 첫 글을 진열해 보세요.</p>
        </div>
      )}
    </section>
  );

  const assignedStudentByProfile = new Map(
    Object.entries(studentLife.failureProfileAssignments).map(([studentNumber, profileImage]) => (
      [profileImage, Number(studentNumber)] as const
    )),
  );
  const teacherAvailableProfiles = FAILURE_PROFILE_OPTIONS.filter((profile) => (
    !assignedStudentByProfile.has(profile.imageSrc)
  ));
  const teacherUsedProfiles = FAILURE_PROFILE_OPTIONS.filter((profile) => (
    assignedStudentByProfile.has(profile.imageSrc)
  ));
  const teacherStudentCharacterRoster = getStudentCharacterRoster();

  const shopSettingsPanel = (
    <section className="teacher-shop-hub" aria-labelledby="teacher-shop-title">
      <h2 id="teacher-shop-title" className="sr-only">기타 설정</h2>
      <nav className="teacher-shop-tabs" aria-label="기타 세부 설정" role="tablist">
        <button type="button" role="tab" id="teacher-shop-tab-items" aria-controls="teacher-shop-panel-items" aria-selected={teacherShopTab === 'items'} className={teacherShopTab === 'items' ? 'is-active' : ''} onClick={() => setTeacherShopTab('items')}><Users aria-hidden="true" /><span>프로필</span></button>
        <button type="button" role="tab" id="teacher-shop-tab-skins" aria-controls="teacher-shop-panel-skins" aria-selected={teacherShopTab === 'skins'} className={teacherShopTab === 'skins' ? 'is-active' : ''} onClick={() => setTeacherShopTab('skins')}><Gamepad2 aria-hidden="true" /><span>고마 스킨 뽑기</span></button>
        <button type="button" role="tab" id="teacher-shop-tab-houses" aria-controls="teacher-shop-panel-houses" aria-selected={teacherShopTab === 'houses'} className={teacherShopTab === 'houses' ? 'is-active' : ''} onClick={() => setTeacherShopTab('houses')}><Hammer aria-hidden="true" /><span>집</span></button>
        <button type="button" role="tab" id="teacher-shop-tab-characters" aria-controls="teacher-shop-panel-characters" aria-selected={teacherShopTab === 'characters'} className={teacherShopTab === 'characters' ? 'is-active' : ''} onClick={() => setTeacherShopTab('characters')}><PersonStanding aria-hidden="true" /><span>캐릭터</span></button>
      </nav>

      {teacherShopTab === 'items' ? (
        <section id="teacher-shop-panel-items" role="tabpanel" aria-labelledby="teacher-shop-tab-items" className="settings-card teacher-shop-collection teacher-shop-profiles rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5">
          <header>
            <div><h3>전체 프로필</h3><p>학생에게 배정된 프로필은 사용 중으로 표시됩니다.</p></div>
            <span>사용 가능 {teacherAvailableProfiles.length} · 사용 중 {teacherUsedProfiles.length}</span>
          </header>
          <div className="teacher-shop-profile-groups">
            <section aria-labelledby="teacher-profile-available-title">
              <header>
                <h4 id="teacher-profile-available-title">사용 가능</h4>
                <span>{teacherAvailableProfiles.length}개</span>
              </header>
              <div className="teacher-shop-profile-grid">
                {teacherAvailableProfiles.map((profile) => (
                  <article key={profile.id} data-status="available">
                    <img src={profile.imageSrc} alt="" width={192} height={192} loading="lazy" decoding="async" />
                    <div><strong>{profile.label}</strong><span>사용 가능</span></div>
                  </article>
                ))}
              </div>
            </section>
            <section aria-labelledby="teacher-profile-used-title">
              <header>
                <h4 id="teacher-profile-used-title">사용 중</h4>
                <span>{teacherUsedProfiles.length}개</span>
              </header>
              <div className="teacher-shop-profile-grid">
                {teacherUsedProfiles.map((profile) => (
                  <article key={profile.id} data-status="used">
                    <img src={profile.imageSrc} alt="" width={192} height={192} loading="lazy" decoding="async" />
                    <div><strong>{profile.label}</strong><span>{assignedStudentByProfile.get(profile.imageSrc)}번 사용 중</span></div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {teacherShopTab === 'skins' ? (
        <section id="teacher-shop-panel-skins" role="tabpanel" aria-labelledby="teacher-shop-tab-skins" className="settings-card teacher-shop-collection teacher-shop-skins rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5">
          <header><div><h3>고마 스킨 도감</h3><p>학생이 뽑을 수 있는 전체 스킨</p></div><span>{STUDENT_CHARACTER_PRIZES.length}종</span></header>
          <div className="teacher-shop-skin-list">
            {STUDENT_CHARACTER_PRIZES.map((character) => (
              <article key={character.id}>
                <img src={character.imageSrc} alt="" />
                <span>{character.name}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {teacherShopTab === 'houses' ? (
        <section id="teacher-shop-panel-houses" role="tabpanel" aria-labelledby="teacher-shop-tab-houses" className="settings-card teacher-shop-collection teacher-shop-houses rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5">
          <header><div><h3>구매 가능한 집</h3><p>학생 집 상점에 표시되는 목록</p></div><span>{STUDENT_HOUSE_DESIGNS.length}채</span></header>
          <div className="teacher-shop-house-list">
            {STUDENT_HOUSE_DESIGNS.map((house) => (
              <article key={house.id}>
                <img src={house.imageSrc} alt="" />
                <div><strong>{house.name}</strong><span>{house.price} 고마</span></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {teacherShopTab === 'characters' ? (
        <section id="teacher-shop-panel-characters" role="tabpanel" aria-labelledby="teacher-shop-tab-characters" className="settings-card teacher-shop-collection teacher-shop-characters rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5">
          <header><div><h3>교실 캐릭터</h3><p>교사 화면에서 돌아다니는 학생 제작 캐릭터</p></div><span>1~23번</span></header>
          <div className="teacher-shop-character-grid">
            {teacherStudentCharacterRoster.map(({ studentNumber, character }) => {
              const speech = character?.speech ?? null;
              return (
                <article key={studentNumber} data-empty={character === null ? 'true' : undefined} aria-label={character ? `${studentNumber}번 캐릭터, 멘트: ${speech ?? '멘트 대기'}` : `${studentNumber}번 캐릭터와 멘트 등록 대기`}>
                  <strong>{studentNumber}번</strong>
                  <div className="teacher-shop-character-stage">
                    {character
                      ? <img src={character.imageSrc} alt={character.alt} width={192} height={192} loading="lazy" decoding="async" />
                      : <span className="teacher-shop-character-placeholder">캐릭터 대기</span>}
                  </div>
                  <p className="teacher-shop-character-message" data-empty={speech === null ? 'true' : undefined}>
                    {speech ? <q>{speech}</q> : <span>멘트 대기</span>}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );

  const investmentSettings = normalizeStudentInvestmentSettings(studentStockMarket.settings);
  const updateInvestmentSetting = (
    key: 'minimumAmount' | 'maximumAmount' | 'rounding',
    value: number | StudentInvestmentRounding,
  ) => setStudentStockMarket((current) => updateStudentInvestmentSettings(current, { ...investmentSettings, [key]: value }));
  const investmentReturnPercentOptions = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50] as const;
  const formatInvestmentPercent = (percent: number) => `${percent > 0 ? '+' : ''}${percent}%`;
  const stockMarketWeekDateKeys = getInvestmentWeekDateKeys(stockMarketDateKey);
  const selectedStockMarketWeekday = stockMarketWeekDateKeys.includes(stockMarketDateKey)
    ? stockMarketDateKey
    : stockMarketWeekDateKeys[4];
  const stockMarketWeekdayLabels = ['월', '화', '수', '목', '금'] as const;
  const formatStockMarketDate = (dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00Z`);
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
  };
  const shiftStockMarketWeek = (dayOffset: number) => {
    const nextDate = new Date(`${stockMarketWeekDateKeys[0]}T12:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
    setStockMarketDateKey(nextDate.toISOString().slice(0, 10));
  };
  const updateStockMarketWeekDraft = (
    dateKey: string,
    stockId: StudentStockId,
    patch: Partial<StockMarketDraft>,
  ) => setStockMarketWeekDrafts((current) => {
    const existingDraft = current[dateKey]?.[stockId] ?? { returnPercent: '', comment: '' };
    return {
      ...current,
      [dateKey]: {
        ...current[dateKey],
        [stockId]: { ...existingDraft, ...patch },
      },
    };
  });
  const saveStockMarketWeek = () => {
    const entries = stockMarketWeekDateKeys.flatMap((dateKey) => STUDENT_STOCKS.flatMap((stock) => {
      const draft = stockMarketWeekDrafts[dateKey]?.[stock.id];
      const returnPercent = draft?.returnPercent;
      if (returnPercent === undefined || returnPercent === '') return [];
      return [{ dateKey, stockId: stock.id, draft: { ...draft, returnPercent } }];
    }));
    if (entries.length === 0) {
      setStockMarketSaveStatus('등록할 등락을 먼저 선택해 주세요.');
      return;
    }
    setStudentStockMarket((current) => entries.reduce<StudentStockMarket>((market, { dateKey, stockId, draft }) => (
      upsertStudentStockMarketEntry(market, stockId, {
        dateKey,
        stage: getInvestmentStageFromPercent(draft.returnPercent),
        returnPercent: draft.returnPercent,
        comment: draft.comment,
      })
    ), current));
    setStockMarketSaveStatus(`이번 주 등락 ${entries.length}개를 저장했습니다.`);
  };

  const stockSettingsPanel = (
    <section className="settings-card teacher-stock-settings" aria-labelledby="teacher-stock-title">
      <section className="teacher-stock-week" aria-labelledby="teacher-stock-title">
        <header>
          <div>
            <h3 id="teacher-stock-title">이번 주 등락</h3>
            <span>{formatStockMarketDate(stockMarketWeekDateKeys[0])} ~ {formatStockMarketDate(stockMarketWeekDateKeys[4])} · 미등록 칸은 저장하지 않습니다.</span>
          </div>
          <div className="teacher-stock-week-actions">
            <button type="button" onClick={() => shiftStockMarketWeek(-7)} aria-label="이전 주"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => setStockMarketDateKey(getKoreanLocalDateKey())}>이번 주</button>
            <button type="button" onClick={() => shiftStockMarketWeek(7)} aria-label="다음 주"><ChevronRight size={18} /></button>
            <label className="teacher-stock-week-date"><span>포함 날짜</span><input type="date" value={stockMarketDateKey} onChange={(event) => setStockMarketDateKey(event.target.value)} /></label>
            <button type="button" className="is-primary" onClick={saveStockMarketWeek}>이번 주 저장</button>
          </div>
        </header>
        <div className="teacher-stock-week-table" role="table" aria-label="이번 주 종목별 등락 편집표">
          <div className="teacher-stock-week-row is-heading" role="row">
            <strong role="columnheader">종목</strong>
            {stockMarketWeekDateKeys.map((dateKey, index) => (
              <button key={dateKey} type="button" role="columnheader" className={dateKey === selectedStockMarketWeekday ? 'is-selected' : ''} onClick={() => setStockMarketDateKey(dateKey)}>
                <span>{stockMarketWeekdayLabels[index]}</span><b>{formatStockMarketDate(dateKey)}</b>
              </button>
            ))}
          </div>
          {STUDENT_STOCKS.map((stock) => (
            <div key={stock.id} className="teacher-stock-week-row" role="row">
              <div className="teacher-stock-week-name" role="rowheader"><span aria-hidden="true">{stock.emoji}</span><strong>{stock.name}</strong></div>
              {stockMarketWeekDateKeys.map((dateKey) => {
                const draft = stockMarketWeekDrafts[dateKey]?.[stock.id];
                const percent = draft?.returnPercent ?? '';
                const presentation = percent === '' ? null : getInvestmentStagePresentation(getInvestmentStageFromPercent(percent));
                return (
                  <label key={dateKey} role="cell" className={percent === '' ? 'is-empty' : percent > 0 ? 'is-up' : percent < 0 ? 'is-down' : 'is-flat'}>
                    <select aria-label={`${dateKey} ${stock.name} 수익률`} value={percent} onChange={(event) => updateStockMarketWeekDraft(dateKey, stock.id, { returnPercent: event.target.value === '' ? '' : Number(event.target.value) })}>
                      <option value="">미등록</option>
                      {investmentReturnPercentOptions.map((optionPercent) => <option key={optionPercent} value={optionPercent}>{formatInvestmentPercent(optionPercent)}</option>)}
                    </select>
                    <span>{presentation ? `${presentation.symbol} ${presentation.studentLabel}` : '결과 없음'}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <p className="teacher-stock-save-status" role="status">{stockMarketSaveStatus}</p>
      </section>
      <section className="teacher-stock-comments" aria-labelledby="teacher-stock-comments-title">
        <header><div><h4 id="teacher-stock-comments-title">{formatStockMarketDate(selectedStockMarketWeekday)} 등락 이유</h4><p>필요한 종목만 짧게 적어 주세요.</p></div></header>
        <div>
          {STUDENT_STOCKS.map((stock) => (
            <label key={stock.id}><span>{stock.emoji} {stock.name}</span><input maxLength={120} value={stockMarketWeekDrafts[selectedStockMarketWeekday]?.[stock.id]?.comment ?? ''} onChange={(event) => updateStockMarketWeekDraft(selectedStockMarketWeekday, stock.id, { comment: event.target.value })} placeholder="이유 (선택)" /></label>
          ))}
        </div>
      </section>
      <section className="teacher-return-guide" aria-labelledby="teacher-return-guide-title">
        <header><h4 id="teacher-return-guide-title">학생에게 보이는 말</h4><span>학생 화면에는 %가 표시되지 않습니다.</span></header>
        <div>
          {[-40, -10, 0, 10, 40].map((percent) => {
            const presentation = getInvestmentStagePresentation(getInvestmentStageFromPercent(percent));
            const range = percent === -40 ? '-50% ~ -30%' : percent === -10 ? '-20% ~ -10%' : percent === 0 ? '0%' : percent === 10 ? '+10% ~ +20%' : '+30% ~ +50%';
            return <p key={percent} className={percent > 0 ? 'is-up' : percent < 0 ? 'is-down' : 'is-flat'}><b>{range}</b><span>{presentation.symbol} {presentation.studentLabel}</span></p>;
          })}
        </div>
      </section>
      <section className="teacher-investment-status" aria-labelledby="teacher-investment-status-title"><h4 id="teacher-investment-status-title">학생별 투자 현황</h4><div>{Array.from({ length: 23 }, (_, index) => index + 1).map((studentNumber) => { const state = studentEconomyStates[String(studentNumber)]; const positions = STUDENT_STOCKS.flatMap((stock) => { const position = state?.investments[stock.id]; return position ? [position] : []; }); const invested = positions.reduce((sum, position) => sum + position.investedAmount, 0); const current = positions.reduce((sum, position) => sum + position.currentAmount, 0); return <article key={studentNumber}><strong>{studentNumber}번</strong><span>{positions.length}종목</span><span>투자 {invested}</span><span className={current - invested > 0 ? 'is-up' : current - invested < 0 ? 'is-down' : ''}>{current - invested > 0 ? '+' : ''}{current - invested} 고마</span><b>현재 {current}</b></article>; })}</div></section>
      <section className="teacher-investment-controls" aria-labelledby="teacher-investment-rules-title">
        <header><div><h4 id="teacher-investment-rules-title">투자 운영 규칙</h4><p>처음 정한 뒤 자주 바꾸지 않는 설정입니다.</p></div></header>
        <div className="teacher-investment-rules">
          <label><span>최소 투자</span><div><input type="number" min="1" value={investmentSettings.minimumAmount} onChange={(event) => updateInvestmentSetting('minimumAmount', Number(event.target.value))} /><b>고마</b></div></label>
          <label><span>최대 투자</span><div><input type="number" min={investmentSettings.minimumAmount} value={investmentSettings.maximumAmount} onChange={(event) => updateInvestmentSetting('maximumAmount', Number(event.target.value))} /><b>고마</b></div></label>
          <label><span>소수점 계산</span><select value={investmentSettings.rounding} onChange={(event) => updateInvestmentSetting('rounding', event.target.value as StudentInvestmentRounding)}><option value="round">반올림</option><option value="floor">버림</option><option value="ceil">올림</option></select></label>
        </div>
      </section>
    </section>
  );

  const mailSettingsPanel = (
    <section className="settings-card teacher-mail-settings rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 md:p-5" aria-labelledby="teacher-mail-title">
      <div className="teacher-mail-inbox">
        <header className="teacher-mail-section-header">
          <h3 id="teacher-mail-title">받은 편지</h3>
          <span>{teacherLetters.length}개</span>
        </header>
        {teacherLetters.length === 0 ? (
          <p className="teacher-mail-empty">학생이 선생님께 보낸 편지가 여기에 표시됩니다.</p>
        ) : (
          <div className="teacher-mail-reader">
            <div className="teacher-mail-list" aria-label="선생님 받은 편지 목록">
              {teacherLetters.map((letter) => (
                <button
                  key={letter.id}
                  type="button"
                  className={`${letter.id === selectedTeacherLetter?.id ? 'is-selected' : ''}${letter.readAt === null ? ' is-unread' : ''}`}
                  aria-label={`${letter.readAt === null ? '새 편지, ' : ''}${letter.senderLabel}, ${letter.title || '편지가 도착했어요'}, ${formatTeacherLetterDate(letter.createdAt)}`}
                  onClick={() => setSelectedTeacherLetterId(letter.id)}
                >
                  <span className="teacher-mail-list-meta">
                    <strong>{letter.senderLabel}</strong>
                    {letter.readAt === null ? <span className="teacher-mail-list-new">New</span> : null}
                    <time dateTime={letter.createdAt}>{formatTeacherLetterDate(letter.createdAt)}</time>
                  </span>
                  <span className="teacher-mail-list-title">{letter.title || '편지가 도착했어요'}</span>
                </button>
              ))}
            </div>
            {selectedTeacherLetter ? (
              <article className="teacher-letter-paper">
                <header className="teacher-letter-paper-meta">
                  <span>{selectedTeacherLetter.senderLabel}</span>
                  <time dateTime={selectedTeacherLetter.createdAt}>{formatTeacherLetterDate(selectedTeacherLetter.createdAt)}</time>
                </header>
                <h4>{selectedTeacherLetter.title || '편지가 도착했어요'}</h4>
                <p>{selectedTeacherLetter.content}</p>
                <button type="button" onClick={replyToStudentLetter} disabled={!selectedTeacherLetter.senderStudentNumber}>
                  <Reply size={17} aria-hidden="true" />답장하기
                </button>
              </article>
            ) : (
              <div className="teacher-mail-reader-empty">
                새 편지를 선택하면 내용을 볼 수 있습니다.
              </div>
            )}
          </div>
        )}
      </div>
      <div className="teacher-mail-composer">
        <header className="teacher-mail-section-header">
          <h3>{mailReplyToId ? '답장 쓰기' : '학생에게 편지'}</h3>
          <span className="teacher-mail-recipient-preview">받는 사람 · {mailRecipient === ALL_STUDENTS_LETTER_RECIPIENT ? '모든 학생' : `${mailRecipient}번`}</span>
        </header>
        <div className="grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-extrabold text-[#476152]">
          받는 학생
          <select value={mailRecipient} onChange={(event) => setMailRecipient(Number(event.target.value))} className="min-h-11 rounded-xl border border-[#D7E3DC] bg-white px-3 text-[#26352E]">
            <option value={ALL_STUDENTS_LETTER_RECIPIENT} disabled={Boolean(mailReplyToId)}>모든 학생</option>
            {Array.from({ length: 23 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}번</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-extrabold text-[#476152]">
          제목
          <input value={mailTitle} maxLength={40} onChange={(event) => setMailTitle(event.target.value)} className="min-h-11 rounded-xl border border-[#D7E3DC] bg-white px-3 text-[#26352E]" placeholder="제목" />
        </label>
        </div>
        <label className="grid gap-2 text-sm font-extrabold text-[#476152]">
          내용
          <textarea value={mailContent} maxLength={300} onChange={(event) => setMailContent(event.target.value)} className="min-h-32 resize-y rounded-xl border border-[#D7E3DC] bg-white p-3 text-[#26352E]" placeholder="학생에게 전할 내용을 적어 주세요" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span role="status" className="text-sm font-bold text-[#476152]">{mailStatus}</span>
          <button type="button" onClick={() => void sendTeacherLetter()} disabled={isMailSending || mailContent.trim().length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#006241] px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45">
            <Send size={18} aria-hidden="true" />{isMailSending ? '보내는 중' : '보내기'}
          </button>
        </div>
      </div>
    </section>
  );

  const writingSettingsPanel = (
    <TeacherWritingSettings
      assignment={dailyWriting.assignment}
      assignedDateKeys={dailyWritingAssignedDateKeys}
      completedStudentNumbers={dailyWritingCompletedStudentNumbers}
      isPublishing={isWritingPublishing}
      rewardingStudentNumber={rewardingWritingStudentNumber}
      status={writingStatus}
      onPublish={publishDailyWriting}
      onReward={rewardDailyWritingStudent}
      onCancelReward={cancelDailyWritingStudentReward}
    />
  );

  const emotionSettingsPanel = (
    <section className="emotion-status-settings settings-card rounded-[1.7rem] border border-[#DDE9E2] bg-[#FFFCF7] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5" aria-label="학생별 오늘 감정">
      <div className="emotion-status-layout">
        <div className="emotion-status-student-grid">
          {Array.from({ length: 23 }, (_, index) => index + 1).map((number) => {
            const entry = getTodayStudentEmotionEntry(studentEmotionHistory, number);
            const emotion = getStudentEmotion(entry?.emotionId);
            return (
              <button
                key={number}
                type="button"
                className="emotion-status-student"
                aria-label={`${number}번 ${emotion?.label ?? '미기록'}`}
                aria-pressed={selectedEmotionStudentNumber === number}
                title={`${number}번 ${emotion?.label ?? '미기록'}`}
                onClick={() => {
                  const entries = getStudentEmotionEntries(studentEmotionHistory, number);
                  const dateKey = entries[0]?.dateKey ?? getKoreanLocalDateKey();
                  const date = getEmotionCalendarDate(dateKey);
                  setSelectedEmotionStudentNumber(number);
                  setEmotionCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  setSelectedEmotionHistoryDateKey(dateKey);
                }}
              >
                <strong>{number}</strong>
                {emotion ? <StudentEmotionOrbVisual emotion={emotion} compact /> : <span className="emotion-status-empty-orb" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="student-emotion-calendar-layout" aria-label={`${selectedEmotionStudentNumber}번 감정 기록`}>
          <section className="student-emotion-calendar" aria-label={`${emotionCalendarMonthFormatter.format(emotionCalendarMonth)} ${selectedEmotionStudentNumber}번 감정 기록`}>
            <header className="student-emotion-calendar-header">
              <button
                type="button"
                className="student-emotion-calendar-nav"
                aria-label="이전 달"
                title="이전 달"
                onClick={() => {
                  setEmotionCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
                  setSelectedEmotionHistoryDateKey('');
                }}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <h3>{emotionCalendarMonthFormatter.format(emotionCalendarMonth)}</h3>
              <button
                type="button"
                className="student-emotion-calendar-nav"
                aria-label="다음 달"
                title="다음 달"
                onClick={() => {
                  setEmotionCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
                  setSelectedEmotionHistoryDateKey('');
                }}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="student-emotion-calendar-weekdays" aria-hidden="true">
              {EMOTION_CALENDAR_WEEKDAYS.map((weekday, index) => (
                <span key={weekday} data-weekday={index}>{weekday}</span>
              ))}
            </div>
            <div className="student-emotion-calendar-grid" role="grid" aria-label="감정 기록 날짜">
              {emotionCalendarDays.map((day) => {
                const entry = selectedStudentEmotionByDate.get(day.dateKey);
                const emotion = getStudentEmotion(entry?.emotionId);
                const isSelected = day.dateKey === selectedEmotionHistoryDateKey;
                const isToday = day.dateKey === emotionTodayKey;
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
                      aria-label={`${emotionCalendarDateFormatter.format(day.date)}${emotion ? `, ${emotion.label}` : ', 기록 없음'}`}
                      onClick={() => {
                        setSelectedEmotionHistoryDateKey(day.dateKey);
                        if (!day.isCurrentMonth) {
                          setEmotionCalendarMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                        }
                      }}
                    >
                      <span className="student-emotion-calendar-day-heading">
                        <span className="student-emotion-calendar-day-number">{day.date.getDate()}</span>
                        {isToday && day.isCurrentMonth ? <span className="student-emotion-calendar-today-badge">오늘</span> : null}
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
            <aside className="student-emotion-calendar-detail" data-emotion-zone={selectedEmotionHistory?.zone} aria-live="polite">
              {selectedEmotionHistoryEntry && selectedEmotionHistory ? (
                <>
                  <div className="student-emotion-calendar-detail-heading">
                    <span>{emotionCalendarDateFormatter.format(getEmotionCalendarDate(selectedEmotionHistoryEntry.dateKey))}</span>
                    <strong>{selectedEmotionStudentNumber}번 기록</strong>
                  </div>
                  <div className="student-emotion-calendar-detail-emotion">
                    <StudentEmotionOrbVisual emotion={selectedEmotionHistory} />
                    <strong>{selectedEmotionHistory.label}</strong>
                  </div>
                  <div className="student-emotion-calendar-notes">
                    <p><strong>어떤 일이 있었나요?</strong><span>{selectedEmotionHistoryEntry.comment}</span></p>
                    {selectedEmotionHistoryEntry.selfMessage ? <p><strong>나에게 해주는 한 마디</strong><span>{selectedEmotionHistoryEntry.selfMessage}</span></p> : null}
                  </div>
                </>
              ) : (
                <div className="student-emotion-calendar-detail-empty">
                  <CalendarDays size={24} aria-hidden="true" />
                  <strong>{selectedEmotionHistoryDateKey ? '이날은 기록이 없어요' : '날짜를 선택해 주세요'}</strong>
                  <span>감정을 기록한 날짜를 선택해 주세요.</span>
                </div>
              )}
            </aside>
            <section className="student-emotion-monthly-summary" aria-labelledby="emotion-monthly-summary-title">
              <header>
                <div>
                  <span>{emotionCalendarMonthFormatter.format(emotionCalendarMonth)}</span>
                  <h3 id="emotion-monthly-summary-title">월간 감정색</h3>
                </div>
                <strong>{selectedEmotionMonthlyTotal}일</strong>
              </header>
              <div className="student-emotion-monthly-bar" aria-hidden="true">
                {STUDENT_EMOTION_ZONES.map((zone) => selectedEmotionMonthlyZoneCounts[zone.id] > 0 ? (
                  <span
                    key={zone.id}
                    data-zone={zone.id}
                    style={{ flexGrow: selectedEmotionMonthlyZoneCounts[zone.id] }}
                  />
                ) : null)}
              </div>
              <ul>
                {STUDENT_EMOTION_ZONES.map((zone) => (
                  <li key={zone.id} data-zone={zone.id}>
                    <span aria-hidden="true" />
                    <strong>{zone.label.replace(' 영역', '')}</strong>
                    <b>{selectedEmotionMonthlyZoneCounts[zone.id]}</b>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );

  const resetClassDonation = async () => {
    const resetState = { ...classDonation, totalAmount: 0, history: [] };
    setClassDonation(resetState);
    if (!isSupabaseSettingsEnabled) return;
    try {
      await updateSharedSettings((currentValue) => {
        const current = currentValue && typeof currentValue === 'object'
          ? currentValue as Record<string, unknown>
          : {};
        return { ...current, classDonation: resetState };
      });
    } catch (error) {
      if (error instanceof Error) console.error('Failed to reset class donation.', error);
    }
  };

  const auctionSettingsPanel = (
    <div className="settings-panel-grid grid gap-4">
      {settingsPanel === 'donation' ? (
      <section
        className="settings-card rounded-[1.7rem] border border-[#CFE3D8] bg-[#F7FBF9] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5"
      >
        <div className="flex items-center justify-end">
          <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#B9D7CA] bg-white px-4 font-extrabold text-[#006B4D]">
            <input
              type="checkbox"
              checked={classDonation.enabled}
              onChange={(event) => setClassDonation((previous) => ({ ...previous, enabled: event.target.checked }))}
              className="h-5 w-5 accent-[#007A57]"
            />
            사용
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="grid gap-1.5">
            <span className="section-title text-[0.76rem] font-black text-[#6F7D70]">기부 물품명</span>
            <input
              type="text"
              value={classDonation.itemName}
              onChange={(event) => setClassDonation((previous) => ({
                ...previous,
                itemName: event.target.value.slice(0, 60),
              }))}
              className="h-11 rounded-[0.85rem] border border-[#CFE3D8] bg-white px-3 font-extrabold text-[#1F2523] outline-none focus:border-[#7FB59F]"
              placeholder="교사용 물품명"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="section-title text-[0.76rem] font-black text-[#6F7D70]">목표 고마</span>
            <input
              type="number"
              min="1"
              max={CURRENCY_BALANCE_MAX}
              value={classDonation.targetAmount}
              onChange={(event) => {
                if (event.target.value === '') return;
                const targetAmount = Math.max(
                  classDonation.totalAmount,
                  Math.min(CURRENCY_BALANCE_MAX, Math.floor(Number(event.target.value) || 1)),
                );
                setClassDonation((previous) => ({
                  ...previous,
                  targetAmount,
                }));
              }}
              className="h-11 rounded-[0.85rem] border border-[#CFE3D8] bg-white px-3 text-right font-mono font-black text-[#1F2523] outline-none focus:border-[#7FB59F]"
            />
          </label>
        </div>

        <div className="mt-3 rounded-[1rem] border border-[#DCEAE3] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.78rem] font-extrabold text-[#6F7D70]">진행</span>
            <strong className="font-mono text-[1rem] font-black text-[#007A57]">
              {formatCurrency(classDonation.totalAmount)} / {formatCurrency(classDonation.targetAmount)}
            </strong>
          </div>
          <progress
            className="teacher-donation-progress mt-2 h-2.5 w-full overflow-hidden rounded-full"
            value={classDonation.totalAmount}
            max={Math.max(classDonation.targetAmount, 1)}
            aria-label="기부 진행률"
          />
        </div>

        {classDonation.history.length > 0 ? (
          <details className="settings-disclosure mt-3 rounded-[1rem] border border-[#DCEAE3] bg-white">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-[0.84rem] font-extrabold text-[#46534B]">
              기부 기록 {classDonation.history.length}건
            </summary>
            <div className="custom-scrollbar max-h-44 overflow-y-auto border-t border-[#EDF2EF] p-2">
              {classDonation.history.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#EDF2EF] px-2 py-2 last:border-b-0">
                  <span className="font-extrabold text-[#38423D]">{entry.studentNumber}번</span>
                  <span className="text-[0.78rem] font-bold text-[#7A8780]">{new Date(entry.createdAt).toLocaleString('ko-KR')}</span>
                  <span className="font-mono font-black text-[#007A57]">{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <details className="settings-disclosure mt-3 rounded-[1rem] border border-[#E4D7C9] bg-white/70">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-[0.84rem] font-extrabold text-[#6E5139]">
            목표 관리
          </summary>
          <div className="border-t border-[#EEE4D6] p-3">
            <button
              type="button"
              onClick={() => void resetClassDonation()}
              disabled={classDonation.totalAmount === 0 && classDonation.history.length === 0}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-[0.85rem] border border-[#D8B6A2] bg-white px-4 text-[0.84rem] font-extrabold text-[#7A4C24] disabled:cursor-not-allowed disabled:opacity-45"
            >
              새 목표로 초기화
            </button>
          </div>
        </details>
      </section>
      ) : null}

      {settingsPanel === 'auction' ? (
      <section
        className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5"
      >
        <div className="mb-4">
          <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">물품 설정 및 현황</h3>
        </div>

        {isAuctionScheduleClosed ? (
          <div className="auction-settings-closed-summary">
            <div className="auction-settings-closed-copy">
              <span className="auction-settings-closed-icon" aria-hidden="true">
                <Lock size={18} />
              </span>
              <div>
                <strong>경매 일정이 열려 있지 않음</strong>
                <span>등록 물품 {auctionItems.length}개</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isAuctionConfigurationExpanded) {
                  setTemporaryVisibleAuctionItemIds(new Set());
                  return;
                }
                setTemporaryVisibleAuctionItemIds(new Set(auctionItems.map((item) => item.id)));
              }}
              className="auction-settings-closed-action"
              aria-expanded={isAuctionConfigurationExpanded}
              aria-controls="auction-settings-day-list"
            >
              {isAuctionConfigurationExpanded ? '물품 설정 닫기' : '물품 설정 열기'}
            </button>
          </div>
        ) : null}

        {isAuctionConfigurationExpanded ? (
        <div id="auction-settings-day-list" className="auction-settings-day-list grid gap-3">
          {AUCTION_WEEKDAY_LABELS.map((weekdayLabel, dayIndex) => {
            const accent = AUCTION_DAY_ACCENTS[dayIndex] ?? AUCTION_DAY_ACCENTS[0];
            const dayItems = auctionItems.filter((item) => item.dayIndex === dayIndex);
            const isDayPublic = dayIndex < auctionVisibleDayCount;
            const canAddDayItem =
              auctionItems.length < AUCTION_MAX_ITEM_COUNT && dayItems.length < AUCTION_MAX_ITEMS_PER_DAY;

            return (
              <div
                key={weekdayLabel}
                className={`auction-settings-day-row grid gap-3 rounded-[1.25rem] border p-3 shadow-[0_10px_22px_rgba(31,24,18,0.045)] lg:grid-cols-[11.5rem_minmax(0,1fr)] ${
                  isDayPublic ? 'bg-white' : 'opacity-90'
                }`}
                style={{
                  borderColor: accent.border,
                  backgroundColor: isDayPublic ? '#FFFFFF' : accent.soft,
                }}
              >
                <div
                  className="auction-settings-day-head flex min-h-[3.25rem] items-center justify-between gap-3 border-b px-1 pb-3 lg:min-h-0 lg:flex-col lg:items-start lg:justify-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3"
                  style={{ borderColor: accent.border }}
                >
                  <div className="flex min-w-0 items-center gap-2.5 lg:w-full">
                    <span
                      aria-hidden="true"
                      className="h-8 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accent.chip }}
                    />
                    <span
                      className="section-title truncate text-[1.08rem] font-black"
                      style={{ color: accent.chip }}
                    >
                      {weekdayLabel}요일
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addAuctionItem(dayIndex)}
                    disabled={!canAddDayItem}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border bg-white px-3 transition-colors disabled:cursor-not-allowed disabled:border-[#E5DFD8] disabled:bg-[#F4F0EA] disabled:text-[#8A7A6B] lg:w-full"
                    style={canAddDayItem ? { borderColor: accent.border, color: accent.chip } : undefined}
                    aria-label={`${weekdayLabel}요일 물품 추가`}
                    title={`${weekdayLabel}요일 물품 추가`}
                  >
                    <Plus size={17} />
                    <span className="section-title text-[0.78rem] font-extrabold">추가</span>
                  </button>
                </div>

                <div className="auction-settings-item-grid grid gap-2">
                  {dayItems.map((item, slotIndex) => {
                    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
                    const award = auctionAwards[item.id] ?? null;
                    const isPublic = item.dayIndex < auctionVisibleDayCount;
                    const isTemporarilyVisible = !isPublic && temporaryVisibleAuctionItemIds.has(item.id);
                    const isVisibleInSettings = isPublic || isTemporarilyVisible;
                    const canAward = isPublic && !award && currentBid.bidder !== null && currentBid.amount > 0;
                    const canRemoveItem = auctionItems.length > 1;
                    const itemDisplayName = getAuctionItemDisplayName(item.name, item.dayIndex);

                    return (
                      <div
                        key={item.id}
                        onDoubleClick={() => {
                          if (isPublic) return;
                          setTemporaryVisibleAuctionItemIds((previous) => {
                            const next = new Set(previous);
                            next.add(item.id);
                            return next;
                          });
                        }}
                        className={`auction-item-card relative w-full rounded-[1rem] border p-3 shadow-[0_8px_16px_rgba(31,24,18,0.045)] ${
                          isVisibleInSettings
                            ? 'bg-white'
                            : 'auction-item-card-locked opacity-90'
                        }`}
                        style={{
                          borderColor: accent.border,
                          backgroundColor: isVisibleInSettings ? '#FFFFFF' : accent.soft,
                        }}
                      >
                        {isVisibleInSettings ? (
                          <>
                            <div className="auction-item-name-row flex items-center gap-2">
                              <input
                                value={itemDisplayName}
                                onChange={(event) => updateAuctionItem(item.id, { name: event.target.value })}
                                onFocus={beginAuctionItemEdit}
                                onBlur={endAuctionItemEdit}
                                className="section-title h-11 min-w-0 flex-1 rounded-[0.85rem] border bg-[#FAFCFB] px-3 text-[1rem] font-black leading-tight text-[#1F2523] outline-none transition-colors focus:bg-white"
                                style={{ borderColor: accent.border }}
                                aria-label={`${weekdayLabel}요일 ${slotIndex + 1}번 물품 이름`}
                                placeholder="물품 이름"
                              />
                              <button
                                type="button"
                                onClick={() => removeAuctionItem(item.id)}
                                disabled={!canRemoveItem}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-[#6E5139] transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-[#B5A89C]"
                                style={{ borderColor: accent.border, color: canRemoveItem ? accent.chip : '#B5A89C' }}
                                aria-label={`${weekdayLabel}요일 ${slotIndex + 1}번 물품 삭제`}
                                title={canRemoveItem ? '물품 삭제' : '마지막 물품은 삭제할 수 없습니다'}
                              >
                                <Trash2 size={14} />
                              </button>
                              {!isPublic && isTemporarilyVisible ? (
                                <span className="absolute right-3 top-[-0.55rem] rounded-full bg-white px-2 py-0.5 text-[0.58rem] font-black text-[#006241] shadow-sm">
                                  임시 공개
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2">
                              <div
                                className="flex min-h-10 items-center justify-between gap-2 rounded-[0.85rem] border bg-[#FAFCFB] px-3 py-1.5"
                                style={{ borderColor: accent.border }}
                              >
                                {award ? (
                                  <span
                                    className="inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 font-mono text-[0.74rem] font-black text-white"
                                    style={getStudentLabelStyle(award.winner)}
                                  >
                                    {award.winner}번
                                  </span>
                                ) : currentBid.bidder ? (
                                  <span
                                    className="inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 font-mono text-[0.74rem] font-black text-white"
                                    style={getStudentLabelStyle(currentBid.bidder)}
                                  >
                                    {currentBid.bidder}번
                                  </span>
                                ) : (
                                  <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4F0] px-2.5 text-[0.72rem] font-black text-[#6E7A72]">
                                    대기
                                  </span>
                                )}
                                <div
                                  className="min-w-0 flex-1 whitespace-nowrap text-right font-mono text-[1rem] font-black leading-none"
                                  style={{ color: accent.chip }}
                                >
                                  {award ? formatCurrency(award.amount) : formatCurrency(currentBid.amount)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => openAwardConfirm(item, event.currentTarget)}
                                disabled={!canAward}
                                className={`inline-flex min-h-10 items-center justify-center rounded-[0.85rem] border px-2 text-[0.8rem] font-extrabold transition-colors ${
                                  award
                                    ? 'cursor-default bg-white'
                                    : canAward
                                      ? 'text-white'
                                      : 'cursor-not-allowed bg-white/72'
                                }`}
                                style={{
                                  borderColor: accent.border,
                                  backgroundColor: canAward ? accent.chip : undefined,
                                  color: canAward ? '#FFFFFF' : award ? accent.chip : '#8A7A6B',
                                }}
                              >
                                {award ? '완료' : canAward ? '낙찰' : '없음'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-2">
                            <div className="relative min-h-[4.55rem] flex-1 overflow-hidden rounded-[0.85rem] border border-[#E6EEE9] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent.chip }} />
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-3 flex items-center gap-2">
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18211E] text-white shadow-[0_8px_16px_rgba(28,45,40,0.16)]">
                                      <Lock size={17} color="#FFFFFF" strokeWidth={3.4} />
                                    </span>
                                    <span className="h-7 w-12 rounded-full border border-[#DDE8E2] bg-[#F7FAF8]" />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <span className="h-3 w-4/5 rounded-full bg-[#DCE6E0]" />
                                    <span className="h-3 w-3/5 rounded-full bg-[#E9EFEA]" />
                                  </div>
                                </div>
                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.9rem] border border-[#DDE8E2] bg-[#F7FAF8] text-[#8EA099]">
                                  <Sparkles size={18} />
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAuctionItem(item.id)}
                              disabled={!canRemoveItem}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-[#6E5139] transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-[#B5A89C]"
                              style={{ borderColor: accent.border, color: canRemoveItem ? accent.chip : '#B5A89C' }}
                              aria-label={`${weekdayLabel}요일 ${slotIndex + 1}번 물품 삭제`}
                              title={canRemoveItem ? '물품 삭제' : '마지막 물품은 삭제할 수 없습니다'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        ) : null}
      </section>
      ) : null}

      {settingsPanel === 'missions' ? (
      <section
        className="settings-card flex flex-col rounded-[1.7rem] border border-[#DDEBDD] bg-[#F8FCF6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5"
      >
        <div className="order-1 grid gap-3 rounded-[1.25rem] border border-[#BBD8CB] bg-white/85 p-4">
          <div>
            <h3 className="section-title text-[1.05rem] font-black text-[#1F2523]">기존 미션 공개</h3>
            <p className="mt-1 text-[0.82rem] font-bold text-[#65736C]">학생 미션 화면에 보일 항목</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {STUDENT_MISSION_VISIBILITY_GROUPS.map((group) => (
              <fieldset key={group.label} className="grid gap-2 rounded-[1rem] border border-[#DDE8E2] bg-[#F9FCFA] p-3">
                <legend className="section-title px-1 text-[0.78rem] font-black text-[#52645B]">{group.label}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.items.map((mission) => (
                    <label
                      key={mission.id}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.8rem] border px-3 text-[0.82rem] font-extrabold transition-colors ${studentMissionVisibility[mission.id]
                        ? 'border-[#9CCDBE] bg-[#EAF6F0] text-[#006241]'
                        : 'border-[#DDE8E2] bg-white text-[#6F7D70]'}`}
                    >
                      <input
                        type="checkbox"
                        checked={studentMissionVisibility[mission.id]}
                        onChange={(event) => setStudentMissionVisibility((previous) => ({
                          ...previous,
                          [mission.id]: event.target.checked,
                        }))}
                      />
                      <span>{mission.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="order-4 mt-4 grid gap-3 rounded-[1.25rem] border border-[#BBD8CB] bg-white/85 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title text-[1.05rem] font-black text-[#1F2523]">1인 1역</h3>
              <p className="mt-1 text-[0.82rem] font-bold text-[#65736C]">
                칠판부터 물수건까지 각 1명, 우유는 2명입니다. 매일 담당 번호가 한 칸씩 이동합니다. 완료 20고마, 미수행 -20고마
              </p>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#CFE3D8] bg-[#F6FAF7] px-4 font-extrabold text-[#006241]">
              <input
                type="checkbox"
                checked={classroomRoleMission.enabled}
                onChange={(event) => setClassroomRoleMission((previous) => ({
                  ...previous,
                  enabled: event.target.checked,
                }))}
              />
              미션 사용
            </label>
          </div>

          <label className="grid max-w-[18rem] gap-1.5">
            <span className="section-title text-[0.74rem] font-black text-[#6F7D70]">오늘 칠판 전문가</span>
            <select
              value={todayClassroomRoleAssignments[0]?.studentNumber ?? 1}
              onChange={(event) => updateTodayClassroomRoleStart(Number(event.target.value))}
              className="section-title h-11 rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] px-3 text-[0.95rem] font-black text-[#1F2523] outline-none focus:border-[#7FB59F]"
              aria-label="오늘 1인 1역 시작 학생 번호"
            >
              {CURRENCY_STUDENT_NUMBERS.map((studentNumber) => (
                <option key={studentNumber} value={studentNumber}>{studentNumber}번</option>
              ))}
            </select>
          </label>

          <div className="grid gap-2 md:grid-cols-3">
            {todayClassroomRoleAssignments.map((assignment) => {
              const result = classroomRoleMission.results[todayClassroomRoleDateKey]?.[String(assignment.studentNumber)];
              return (
                <div
                  key={`${assignment.roleName}-${assignment.studentNumber}`}
                  className="grid gap-2 rounded-[1rem] border border-[#DDE8E2] bg-[#F9FCFA] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[0.9rem] font-black text-[#1F2523]">{assignment.roleName}</strong>
                    <span className="rounded-full bg-[#EAF6F0] px-2.5 py-1 text-[0.78rem] font-black text-[#006241]">
                      {assignment.studentNumber}번
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateClassroomRoleMissionResult(assignment.studentNumber, 'rewarded')}
                      disabled={!classroomRoleMission.enabled}
                      aria-pressed={result === 'rewarded'}
                      className={`min-h-10 rounded-[0.75rem] border border-[#9CCDBE] px-2 text-[0.8rem] font-black text-[#006241] transition-colors hover:bg-[#EAF6F0] disabled:cursor-not-allowed disabled:text-[#6F7D70] ${result === 'rewarded' ? 'bg-[#DDF2E9]' : 'bg-white'}`}
                    >
                      {result === 'rewarded' ? '지급 취소' : '+20 지급'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateClassroomRoleMissionResult(assignment.studentNumber, 'penalized')}
                      disabled={!classroomRoleMission.enabled}
                      aria-pressed={result === 'penalized'}
                      className={`min-h-10 rounded-[0.75rem] border border-[#E3AAA5] px-2 text-[0.8rem] font-black text-[#9B4A43] transition-colors hover:bg-[#FFF0ED] disabled:cursor-not-allowed disabled:text-[#7D6865] ${result === 'penalized' ? 'bg-[#FFE3DE]' : 'bg-white'}`}
                    >
                      {result === 'penalized' ? '차감 취소' : '-20 차감'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="order-2 my-4 flex flex-wrap items-center justify-end gap-3">
          <span className="text-[0.82rem] font-extrabold text-[#65736C]">
            {auctionMissions.length}/{AUCTION_MISSION_MAX_COUNT}개 등록
          </span>
          <button
            type="button"
            onClick={addAuctionMission}
            disabled={auctionMissions.length >= AUCTION_MISSION_MAX_COUNT}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#9CCDBE] bg-white px-4 text-[0.86rem] font-extrabold text-[#006241] shadow-[0_8px_16px_rgba(31,98,65,0.08)] transition-colors hover:bg-[#EAF6F0] disabled:cursor-not-allowed disabled:border-[#DDE8E2] disabled:bg-[#F2F5F3] disabled:text-[#87928D] disabled:shadow-none"
          >
            <Plus size={16} />
            {auctionMissions.length >= AUCTION_MISSION_MAX_COUNT ? '최대 4개 등록됨' : '미션 추가'}
          </button>
        </div>

        {auctionMissions.length === 0 ? (
          <div className="order-3 rounded-[1.1rem] border border-dashed border-[#BBD8CB] bg-white/80 px-4 py-5 text-center text-[0.86rem] font-extrabold text-[#6F7D70]">
            등록된 미션 없음
          </div>
        ) : (
          <div className="order-3 grid gap-2.5">
            {auctionMissions.map((mission, index) => {
              const contentLength = Array.from(mission.content).length;
              const countId = `auction-mission-count-${index}`;
              const isWithinRecommendedLength = contentLength <= AUCTION_MISSION_RECOMMENDED_LENGTH;

              return (
                <div
                  key={mission.id}
                  className="grid gap-2 rounded-[1.15rem] border border-[#CFE3D8] bg-white p-3 shadow-[0_8px_16px_rgba(31,24,18,0.045)] md:grid-cols-[minmax(0,1fr)_22rem_2.75rem] md:items-end"
                >
                  <label className="grid min-w-0 gap-1.5">
                    <span className="section-title text-[0.74rem] font-black text-[#6F7D70]">
                      미션 내용 {index + 1}
                    </span>
                    <span className="relative min-w-0">
                      <input
                        type="text"
                        value={mission.content}
                        onChange={(event) => updateAuctionMissionContent(mission.id, event.target.value)}
                        onFocus={beginAuctionMissionEdit}
                        onBlur={endAuctionMissionEdit}
                        className="section-title h-11 w-full min-w-0 rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] py-2 pl-3 pr-14 text-[0.95rem] font-black leading-tight text-[#1F2523] outline-none transition-colors focus:border-[#7FB59F] focus:bg-white"
                        aria-label={`미션 ${index + 1} 내용`}
                        aria-describedby={countId}
                        placeholder="예: 책상 정리하기"
                      />
                      <span
                        id={countId}
                        aria-label={`${contentLength}자, 권장 ${AUCTION_MISSION_RECOMMENDED_LENGTH}자 이내`}
                        className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.72rem] font-extrabold tabular-nums ${isWithinRecommendedLength ? 'text-[#65736C]' : 'text-[#9B4A43]'}`}
                      >
                        {contentLength}/{AUCTION_MISSION_RECOMMENDED_LENGTH}
                      </span>
                    </span>
                  </label>

                  <MissionRewardInput
                    missionIndex={index + 1}
                    value={mission.rewardAmount}
                    onValueChange={(value) => updateAuctionMissionRewardAmount(mission.id, value)}
                    onFocus={beginAuctionMissionEdit}
                    onBlur={endAuctionMissionEdit}
                  />

                  <button
                    type="button"
                    onClick={() => removeAuctionMission(mission.id)}
                    className="inline-flex h-11 w-full items-center justify-center rounded-[0.85rem] border border-[#E4D7C9] bg-[#FFFDF8] text-[#8A6347] transition-colors hover:bg-[#FFF7EC] md:w-11"
                    aria-label={`미션 ${index + 1} 삭제`}
                    title="미션 삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      {settingsPanel === 'auction' ? (
      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF5EE] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
        <div className="mb-4">
          <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">경매 관리</h3>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={(event) => {
              auctionActionReturnFocusRef.current = event.currentTarget;
              setPendingAuctionAction('weeklyClose');
            }}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[1rem] border-2 border-[#9FC7B8] bg-[#006241] px-4 py-3 text-[0.98rem] font-extrabold text-white shadow-[0_8px_18px_rgba(0,98,65,0.14)] transition-colors hover:bg-[#005336]"
          >
            주간 경매 마감
          </button>
          <div className="rounded-[1rem] border border-[#E4D7C9] bg-white/70 p-3">
            <button
              type="button"
              onClick={() => setIsCurrencyResetDangerVisible((previous) => !previous)}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-[#FFFDF8] px-4 py-2 text-[0.86rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
              aria-expanded={isCurrencyResetDangerVisible}
            >
              위험 작업 열기
            </button>
            {isCurrencyResetDangerVisible ? (
              <div className="mt-3 rounded-[0.9rem] border-2 border-[#D8B6A2] bg-[#FFF7EC] p-3">
                <p className="mb-2 text-center text-[0.82rem] font-bold leading-5 text-[#7A4C24]">
                  보유 화폐 초기화는 모든 학생의 고마를 100으로 되돌립니다.
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    auctionActionReturnFocusRef.current = event.currentTarget;
                    setPendingAuctionAction('currency');
                  }}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-[0.85rem] border-2 border-[#B9876A] bg-white px-4 py-2 text-[0.86rem] font-extrabold text-[#7A351C] transition-colors hover:bg-[#FBEBD8]"
                >
                  보유 화폐 초기화
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden">
      <div className={`mascot-shell editorial-main-shell timer-main-shell relative flex h-full w-full max-w-none flex-col overflow-hidden rounded-none shadow-none transition-colors duration-1000 ${bgClass} ${isScheduleIdle ? 'timer-idle-state' : ''} ${isQuestionSubmissionPanelOpen ? 'question-submission-panel-open' : ''}`}>
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
        {noticeBanner}
        <div className="editorial-home-layout flex-1 flex min-h-0 flex-col lg:grid lg:grid-cols-[minmax(0,1.36fr)_minmax(22.75rem,28rem)] xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,29.5rem)] 2xl:grid-cols-[minmax(0,1.56fr)_minmax(24.5rem,30rem)]">
          {!isSettingsOpen && !isSettingsMaterialMounted ? (
            <div className="student-character-stage pointer-events-none absolute inset-0 overflow-hidden">
              {activeStudentCharacterWalkers.map((walker) => (
                <React.Fragment key={walker.renderKey}>
                  <StudentCharacterShowcase
                    character={walker.character}
                    timerType={timerType}
                    direction={walker.direction}
                    path={walker.path}
                    animationDelaySeconds={walker.animationDelaySeconds}
                    spawnScale={walker.spawnScale}
                    shouldSpeak={walker.shouldSpeak}
                    onImageError={markStudentCharacterFailed}
                  />
                </React.Fragment>
              ))}
            </div>
          ) : null}
          {/* Left: Timer Display */}
          <div className="timer-pane editorial-timer-pane relative flex h-full min-h-0 flex-col items-center justify-center p-4 md:p-6 lg:px-6 lg:py-7 xl:px-8 xl:py-8">
            <div className="bgm-reveal-zone absolute left-1 top-1 z-40 flex items-start p-3 sm:left-2 sm:top-2 md:left-3 md:top-3">
              <button
                onClick={toggleBackgroundMusic}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.currentTarget.blur()}
                className={`sound-toggle timer-toolbar-button inline-flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center rounded-[1.45rem] transition-[background-color,border-color,box-shadow,transform] sm:h-[3.55rem] sm:w-[3.55rem] sm:rounded-2xl ${
                  isMusicPlaying ? 'sound-toggle-active' : 'sound-toggle-inactive'
                } ${isMusicLoading ? 'cursor-not-allowed sound-toggle-loading' : ''}`}
                title={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
                aria-label={isMusicAvailable ? musicButtonLabel : '배경 음악 다시 시도'}
                type="button"
              >
                {isMusicPlaying ? <Volume2 size={22} /> : <VolumeX size={22} />}
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
                  stroke={ringTrackColor}
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
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              {shouldShowMorningReading ? (
                <button
                  type="button"
                  onClick={toggleNoticeFromTimerCenter}
                  className="morning-reading-overlay morning-reading-notice-button"
                  title={isEditingNotice || (isNoticeEnabled && hasScheduleNotice) ? '공지 닫기' : '공지 편집 열기'}
                  aria-label={isEditingNotice || (isNoticeEnabled && hasScheduleNotice) ? '공지 닫기' : '공지 편집 열기'}
                >
                  <div className="morning-reading-bubble">독서 시간입니다.</div>
                  <img
                    src="/reading-bear-cutout.png?v=20260603"
                    alt="책을 읽고 있는 곰 캐릭터"
                    className="morning-reading-image"
                    draggable={false}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleNoticeFromTimerCenter}
                  className={`timer-watch-face timer-watch-notice-button timer-watch-face-${
                    isScheduleIdle
                      ? 'idle'
                      : percentage <= urgentThreshold
                        ? 'urgent'
                        : percentage <= warningThreshold
                          ? 'warning'
                          : 'calm'
                  } timer-watch-glance-${watchFaceGlance}${
                    isWatchFaceBlinking ? ' timer-watch-face-blinking' : ''
                  }${isWatchFaceReacting ? ' timer-watch-face-reacting' : ''}`}
                  title={isEditingNotice || (isNoticeEnabled && hasScheduleNotice) ? '공지 닫기' : '공지 편집 열기'}
                  aria-label={isEditingNotice || (isNoticeEnabled && hasScheduleNotice) ? '공지 닫기' : '공지 편집 열기'}
                >
                  <span aria-hidden="true" className="timer-watch-eye timer-watch-eye-left">
                    <span className="timer-watch-pupil" />
                  </span>
                  <span aria-hidden="true" className="timer-watch-eye timer-watch-eye-right">
                    <span className="timer-watch-pupil" />
                  </span>
                  <span aria-hidden="true" className="timer-watch-nose" />
                  <span aria-hidden="true" className="timer-watch-smile" />
                </button>
              )}

              {/* Character Notification Overlay (kept within the ring stage so it does not cover the timer text) */}
              <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex h-full items-center justify-center px-4 pb-6 pt-3 transition-[opacity,transform] duration-500 md:pb-8 md:pt-4 ${showTimerNotification ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                <div className="pointer-events-none flex flex-col items-center">
                  {/* Speech Bubble */}
                  {showTimerNotification ? (
                    <div className={`speech-card relative mb-4 max-w-[min(92vw,56rem)] rounded-3xl border-4 border-[#E6D5C9] bg-white text-center shadow-xl md:mb-6 ${speechBubbleSizeClass}`}>
                      <p className={`speech-card-text font-bold whitespace-pre-line break-keep text-center leading-[1.12] md:leading-[1.08] ${speechTextSizeClass} ${timerNotificationTextColorClass}`}>{timerNotificationMessage}</p>
                      {/* Bubble Tail (pointing down) */}
                      <div className="speech-tail-fill absolute -bottom-[14px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-x-transparent border-t-[14px] border-t-white"></div>
                      <div className="speech-tail-outline absolute -bottom-[19px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[15px] border-x-transparent border-t-[17px] border-t-[#E6D5C9]"></div>
                    </div>
                  ) : null}

                  {/* Character Image or Placeholder */}
                  <div className={`mascot-figure-stage relative shrink-0 ${characterWrapSizeClass}`} style={characterMotionStyle}>
                    {characterImageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#8A6347]/40 bg-[#8A6347]/10 text-[#8A6347]/60">
                        <span className="mb-2 text-5xl md:text-7xl">?</span>
                        <span className="text-center text-sm font-bold leading-tight md:text-base">Character<br/>Area</span>
                      </div>
                    )}
                    <img
                      src={timerNotificationImageSrc}
                      alt={timerNotificationImageAlt}
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
                  const switchNode = drawCaseMenuRef.current;
                  if (switchNode?.contains(nextTarget)) return;
                  if (!isDrawCaseMenuOpen) {
                    setIsDrawCaseSwitchNearby(false);
                  }
                }}
                className={`timer-draw-switch absolute left-1/2 top-[7.2%] z-30 grid min-h-[3.2rem] w-[min(16.5rem,62%)] -translate-x-1/2 grid-cols-[2.35rem_minmax(0,1fr)_2.35rem] items-center gap-1 rounded-full border border-[#9FC7B8]/80 bg-[#F7FBF8]/88 px-2 py-1 text-[#006241] shadow-[0_4px_10px_rgba(0,98,65,0.12),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-md transition-[opacity,transform,box-shadow] duration-200 md:min-h-[3.45rem] md:w-[min(18.75rem,52%)] ${
                  isDrawCaseSwitchNearby
                    ? 'scale-100 opacity-100 ring-2 ring-[#D4E9E2]/80'
                    : 'pointer-events-none -translate-y-2 opacity-0'
                }`}
                title="추첨 상황 선택"
                aria-label={`추첨 상황: ${activeDrawLabel}`}
              >
                <button
                  type="button"
                  onClick={() => selectAdjacentActiveDrawCase(-1)}
                  disabled={drawCases.length <= 1}
                  className="timer-draw-step-button inline-flex h-9 w-9 items-center justify-center rounded-full text-[#006241] transition-colors hover:bg-[#D4E9E2] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent md:h-10 md:w-10"
                  aria-label="이전 추첨 상황"
                  title="이전 추첨 상황"
                >
                  <ChevronLeft size={22} strokeWidth={3} />
                </button>
                <div className="inline-flex min-w-0 items-center justify-center gap-1.5 text-[clamp(0.98rem,1.95vw,1.28rem)] font-extrabold">
                  <Sparkles size={19} className="shrink-0 text-[#CBA258]" />
                  <span className="truncate">{activeDrawLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => selectAdjacentActiveDrawCase(1)}
                  disabled={drawCases.length <= 1}
                  className="timer-draw-step-button inline-flex h-9 w-9 items-center justify-center rounded-full text-[#006241] transition-colors hover:bg-[#D4E9E2] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent md:h-10 md:w-10"
                  aria-label="다음 추첨 상황"
                  title="다음 추첨 상황"
                >
                  <ChevronRight size={22} strokeWidth={3} />
                </button>
              </div>
            </div>
            <div className="relative z-[60] mt-2 shrink-0 md:mt-3 lg:mt-4">
              <div className={`clock-display editorial-clock-display text-[clamp(3.7rem,8.5vw,9.8rem)] leading-none font-bold tracking-tight transition-colors duration-1000 xl:text-[clamp(4.1rem,7.8vw,10.2rem)] ${colorClass}`}>
                {formatTime(displayTimeLeft)}
              </div>
            </div>
            <div className="timer-status-row relative z-[60] mt-3 flex w-full max-w-[40rem] flex-wrap items-center justify-center gap-3 md:mt-4 xl:max-w-[45rem]">
              <div className={`inline-manual-timer-shell ${isExtraTimerVisible ? 'inline-manual-timer-shell-open' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawCaseMenuOpen(false);
                    setIsYoutubePanelOpen(false);
                    setIsClasswordPanelOpen(false);
                    setIsCurrencyPanelOpen(false);
                    setIsExtraTimerVisible((previous) => !previous);
                  }}
                  className={`status-medallion timer-primary-chip inline-manual-timer-button inline-flex min-h-[4.3rem] min-w-[13rem] items-center justify-center gap-3 rounded-full border-2 px-5 py-3 text-[clamp(1.2rem,2.8vw,1.85rem)] font-extrabold leading-none tracking-[-0.01em] ${scheduleTypeBadgeClass}`}
                  aria-expanded={isExtraTimerVisible}
                  aria-controls="inline-manual-timer-panel"
                  aria-label={`${scheduleTypeLabel}, ${scheduleStatusDetail}. 보조 타이머 ${isExtraTimerVisible ? '닫기' : '열기'}`}
                  title={isExtraTimerVisible ? '보조 타이머 닫기' : '보조 타이머 열기'}
                >
                  {timerType === 'break' ? <Coffee size={30} strokeWidth={2.3} /> : timerType === 'lunch' ? <Utensils size={30} strokeWidth={2.3} /> : timerType === 'class' || timerType === 'morning' ? <CalendarClock size={30} strokeWidth={2.3} /> : <Timer size={30} strokeWidth={2.3} />}
                  <span className="inline-manual-timer-label min-w-0 truncate">{scheduleTypeLabel}</span>
                </button>
                <div
                  id="inline-manual-timer-panel"
                  className="inline-manual-timer-panel"
                  aria-hidden={!isExtraTimerVisible}
                  inert={!isExtraTimerVisible}
                >
                  <div
                    className={`manual-timer-display manual-timer-display-input inline-manual-timer-display flex items-baseline font-mono font-bold leading-none tracking-tight ${manualClockClass}`}
                    aria-label="보조 타이머 시간"
                    title="보조 타이머 시간 수정"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={isManualTimeEditing && manualEditingPart === 'minutes'
                        ? manualMinutesInputValue
                        : Math.floor(manualTimeLeft / 60).toString().padStart(2, '0')}
                      onFocus={(event) => {
                        setManualMinutesInputValue(Math.floor(manualTimeLeft / 60).toString().padStart(2, '0'));
                        setIsManualTimeEditing(true);
                        setManualEditingPart('minutes');
                        event.currentTarget.select();
                      }}
                      onChange={(event) => {
                        setManualMinutesInputValue(event.target.value.replace(/\D/g, '').slice(0, 3));
                      }}
                      onBlur={() => commitManualTimeInput('minutes')}
                      onKeyDown={(event) => {
                        if (isComposingKeyboardEvent(event)) return;
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                          return;
                        }

                        if (event.key === 'Escape') {
                          skipManualTimeCommitRef.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      className="manual-timer-display-part manual-timer-display-part-minutes bg-transparent text-right outline-none"
                      aria-label="보조 타이머 분"
                    />
                    <span className="manual-timer-display-colon select-none" aria-hidden="true">:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={isManualTimeEditing && manualEditingPart === 'seconds'
                        ? manualSecondsInputValue
                        : (manualTimeLeft % 60).toString().padStart(2, '0')}
                      onFocus={(event) => {
                        setManualSecondsInputValue((manualTimeLeft % 60).toString().padStart(2, '0'));
                        setIsManualTimeEditing(true);
                        setManualEditingPart('seconds');
                        event.currentTarget.select();
                      }}
                      onChange={(event) => {
                        setManualSecondsInputValue(event.target.value.replace(/\D/g, '').slice(0, 2));
                      }}
                      onBlur={() => commitManualTimeInput('seconds')}
                      onKeyDown={(event) => {
                        if (isComposingKeyboardEvent(event)) return;
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                          return;
                        }

                        if (event.key === 'Escape') {
                          skipManualTimeCommitRef.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      className="manual-timer-display-part manual-timer-display-part-seconds bg-transparent text-left outline-none"
                      aria-label="보조 타이머 초"
                    />
                  </div>
                  <div className="inline-manual-timer-actions">
                    <button
                      onClick={toggleTimer}
                      className={`round-action inline-manual-action inline-flex items-center justify-center rounded-full text-white shadow-md ${
                        manualIsRunning ? 'round-action-pause' : 'round-action-play'
                      }`}
                      type="button"
                      title={manualIsRunning ? '보조 타이머 일시정지' : '보조 타이머 시작'}
                      aria-label={manualIsRunning ? '보조 타이머 일시정지' : '보조 타이머 시작'}
                    >
                      {manualIsRunning ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="round-action round-action-reset inline-manual-action inline-flex items-center justify-center rounded-full text-[#8A6347] shadow-md"
                      type="button"
                      title="보조 타이머 초기화"
                      aria-label="보조 타이머 초기화"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={clearManualTimer}
                      className="round-action round-action-reset inline-manual-action inline-flex items-center justify-center rounded-full text-[#8A6347] shadow-md"
                      type="button"
                      title="보조 타이머 시간 초기화"
                      aria-label="보조 타이머 시간 초기화"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => setIsExtraTimerVisible(false)}
                      className="round-action round-action-reset inline-manual-action inline-manual-close-action inline-flex items-center justify-center rounded-full text-[#8A6347] shadow-md"
                      type="button"
                      title="보조 타이머 닫기"
                      aria-label="보조 타이머 닫기"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="inline-manual-timer-progress" aria-hidden="true">
                    <span style={{ width: `${manualProgress * 100}%` }} />
                  </div>
                  <div className="inline-manual-timer-presets">
                    {MANUAL_TIMER_PRESETS.map((preset) => (
                      <button
                        key={preset.seconds}
                        onClick={() => addManualPreset(preset.seconds)}
                        className="manual-timer-preset-button inline-manual-preset"
                        type="button"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls & Presets */}
          <div className="control-pane editorial-control-pane relative flex min-h-0 w-full flex-col gap-4 overflow-hidden border-t border-[#E6D5C9]/50 p-5 sm:p-6 lg:w-auto lg:border-l lg:border-t-0 lg:px-7 lg:py-7 xl:px-8 xl:py-8">
            {isClasswordPanelOpen ? (
              <div id="timer-classword-panel" className="timer-classword-panel docked-utility-panel utility-pane-anchor pointer-events-none absolute inset-x-0 top-0 bottom-[5.65rem] z-[120] flex flex-col justify-end p-3 sm:bottom-[5.85rem] sm:p-4 lg:bottom-[5.43rem] lg:p-5">
                <section className="timer-classword-panel-card content-fit-utility-card utility-pane-card pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden" aria-labelledby="teacher-classword-utility-today-title">
                  <div className="timer-classword-panel-scroll is-board-only custom-scrollbar">
                    <TeacherClasswordPanel
                      profileAssignments={studentLife.failureProfileAssignments}
                      surface="utility"
                      onUtilityClose={() => {
                        setIsClasswordPanelOpen(false);
                        window.requestAnimationFrame(() => classwordPanelTriggerRef.current?.focus({ preventScroll: true }));
                      }}
                    />
                  </div>
                </section>
              </div>
            ) : null}
            <div className="schedule-board schedule-board-compact editorial-schedule-board flex w-full min-h-[23rem] flex-1 flex-col rounded-[2.35rem] border-2 border-[#E6D5C9] bg-[#FDFBF7] p-4 text-left shadow-sm sm:min-h-[27rem] sm:p-5 lg:min-h-0">
              {hasMountedScheduleYoutubePlayer && scheduleYoutubeVideoIds.length > 0 ? (
                <div
                  className={`shrink-0 overflow-hidden rounded-[1.8rem] bg-[#FFFDF8] transition-[margin,max-height,border-color,opacity,box-shadow] duration-300 ${
                    isScheduleYoutubeVisible
                      ? 'mb-3 max-h-[42rem] border border-[#E6D5C9] opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]'
                      : 'pointer-events-none mt-0 max-h-0 border border-transparent opacity-0 shadow-none'
                  }`}
                  aria-hidden={!isScheduleYoutubeVisible}
                >
                  <div className="aspect-video w-full bg-[#F3E9DE]">
                    <ScheduleYoutubePlayer
                      videoIds={scheduleYoutubeVideoIds}
                      shouldAutoplay={shouldAutoplayScheduleYoutube}
                      selectedIndex={boundedActiveScheduleYoutubeIndex}
                      selectionRequestId={scheduleYoutubeSelectionRequestId}
                      onActiveIndexChange={setActiveScheduleYoutubeIndex}
                      onVideoMetadataChange={updateScheduleYoutubeMetadataFromPlayer}
                    />
                  </div>
                  <div className="border-t border-[#E6D5C9] bg-white/92 px-3 py-2">
                    <p className="truncate text-[0.78rem] font-extrabold leading-6 text-[#3F2B20]">
                      <span className="mr-1 text-[#006241]">
                        {boundedActiveScheduleYoutubeIndex + 1}/{scheduleYoutubeCount}
                      </span>
                      {activeScheduleYoutubeItem?.title || '영상'}
                    </p>
                    <div
                      className={`overflow-hidden transition-[margin,max-height,opacity] duration-300 ${
                        isScheduleYoutubePlaylistOpen
                          ? 'mt-2 max-h-[12rem] opacity-100'
                          : 'mt-0 max-h-0 opacity-0'
                      }`}
                    >
                      <ol className="max-h-[11.5rem] space-y-1 overflow-y-auto pr-1">
                        {scheduleYoutubePlaylistItems.map((item) => (
                          <li key={item.url}>
                            <button
                              type="button"
                              onClick={() => playScheduleYoutubePlaylistItem(item.number - 1)}
                              className={`grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-[0.8rem] border px-2 py-1.5 text-left transition-colors hover:border-[#9FC7B8] hover:bg-[#F3FAF7] ${
                                item.isActive
                                  ? 'border-[#9FC7B8] bg-[#EEF7E8] text-[#006241]'
                                  : 'border-[#E9DED2] bg-[#FFFDF8] text-[#8A6347]'
                              }`}
                              title={`${item.number}번 영상 재생: ${item.title}`}
                              aria-label={`${item.number}번 영상 재생: ${item.title}`}
                            >
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.72rem] font-black ${
                                item.isActive ? 'bg-[#006241] text-white' : 'bg-[#F3E9DE] text-[#8A6347]'
                              }`}>
                                {item.number}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[0.76rem] font-extrabold">
                                  {item.number}. {item.title}
                                </span>
                                {item.channelTitle ? (
                                  <span className="block truncate text-[0.64rem] font-bold opacity-70">{item.channelTitle}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-2 flex items-center justify-end gap-2 border-t border-[#E9DED2] pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsScheduleYoutubeVisible(false);
                            setShouldAutoplayScheduleYoutube(false);
                            setIsScheduleYoutubePlaylistOpen(false);
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-full px-3 text-[0.7rem] font-extrabold text-[#8A6347] transition-colors hover:bg-[#FFF7EC]"
                        >
                          숨기기
                        </button>
                        <button
                          type="button"
                          onClick={clearScheduleYoutubeUrl}
                          className="inline-flex h-8 items-center justify-center rounded-full px-3 text-[0.7rem] font-extrabold text-[#B15F49] transition-colors hover:bg-[#FFF2E3]"
                        >
                          목록 비우기
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="schedule-content-area relative min-h-0 flex flex-1 flex-col">
                <div className="schedule-panel-header relative z-20 flex min-h-12 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[#D7E2D1] pb-3">
                  <time
                    dateTime={formatDateKey(adjustedScheduleNow)}
                    className="flex min-w-0 items-baseline gap-[clamp(0.4rem,1.6cqw,0.65rem)] whitespace-nowrap text-[#1D1D1F]"
                  >
                    <span className="truncate text-[clamp(1.75rem,8cqw,2.125rem)] font-extrabold leading-none tracking-[-0.035em]">
                      {scheduleMonthDayLabel}
                    </span>
                    <span className="shrink-0 text-[clamp(1.1rem,4.5cqw,1.35rem)] font-semibold leading-none tracking-[-0.02em] text-[#77777D]">
                      {scheduleWeekdayLabel}
                    </span>
                  </time>
                  <div className="schedule-panel-actions flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                    {scheduleYoutubeCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsScheduleYoutubeVisible(true);
                          setHasMountedScheduleYoutubePlayer(true);
                          setIsScheduleYoutubePlaylistOpen((previous) => !previous);
                        }}
                        className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-[0.76rem] font-extrabold transition-colors ${
                          isScheduleYoutubePlaylistOpen
                            ? 'border-[#9FC7B8] bg-[#EEF7E8] text-[#006241]'
                            : 'border-[#D9C8B6] bg-white text-[#8A6347] hover:border-[#9FC7B8] hover:bg-[#F3FAF7]'
                        }`}
                        title={isScheduleYoutubePlaylistOpen ? '재생목록 닫기' : '재생목록 열기'}
                        aria-label={isScheduleYoutubePlaylistOpen ? '재생목록 닫기' : '재생목록 열기'}
                        aria-expanded={isScheduleYoutubePlaylistOpen}
                      >
                        {scheduleYoutubeCount}개 영상
                      </button>
                    ) : null}
                    <button
                      ref={settingsTriggerRef}
                      type="button"
                      onClick={() => {
                        setIsDrawCaseMenuOpen(false);
                        setIsClasswordPanelOpen(false);
                        setIsCurrencyPanelOpen(false);
                        setIsQuestionSubmissionPanelOpen(false);
                        setEditingDay(getCurrentScheduleWeekday(scheduleClockOffsetSeconds));
                        closeScheduleCopy();
                        setIsSettingsMaterialMounted(true);
                        setIsSettingsOpen(true);
                      }}
                      className="schedule-settings-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7E6DE] bg-white text-[#006241] transition-colors hover:border-[#9FC7B8] hover:bg-[#F3FAF7]"
                      title="설정"
                      aria-label="설정"
                    >
                      <Settings size={19} strokeWidth={2.35} />
                    </button>
                  </div>
                </div>
                {currentDaySchedule.length === 0 ? (
                  <div className="schedule-empty-state flex min-h-[15.5rem] flex-1 flex-col items-center justify-center gap-3 rounded-[1.9rem] border border-dashed border-[#D8C7B4] bg-white/62 px-5 py-12 text-center text-[#8A6347]/74 sm:min-h-[18rem]">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F8F1] text-[#6B8B63] shadow-inner shadow-[#E8F0E4]">
                      <CalendarClock size={26} />
                    </div>
                    <p className="text-[1.55rem] font-bold leading-tight text-[#B89E87] sm:text-[1.8rem]">일정이 없습니다.</p>
                  </div>
                ) : (
                  <ul ref={scheduleListRef} className="schedule-scroll schedule-scroll-stack custom-scrollbar min-h-[15rem] flex-1 overflow-y-auto pb-1 pr-2 pt-2 text-base text-[#8A6347]/90 sm:min-h-[18rem] lg:min-h-0 lg:text-lg">
                    {currentDaySchedule.map((s) => {
                      const isThisSlot = currentMinsForScheduleView >= s.start && currentMinsForScheduleView < s.end;
                      const scheduleSubject = getWeeklySubject(weeklySubjects, currentSubjectWeekKey, today, s);
                      const periodNumber = getSchedulePeriodNumber(s);
                      const shouldShowSubject = s.type === 'class' && scheduleSubject.length > 0 && periodNumber !== null;
                      const scheduleRowTitle = shouldShowSubject
                        ? `${periodNumber}. ${scheduleSubject}`
                        : periodNumber !== null
                          ? `${periodNumber}교시`
                          : getScheduleSlotDisplayTitle(s, scheduleSubject);
                      const isCompactScheduleRow = s.type === 'morning' || s.type === 'break' || s.type === 'lunch';

                      return (
                        <li
                          key={s.id}
                          ref={(el) => {
                            scheduleSlotRefs.current[s.id] = el;
                          }}
                          className={`schedule-row schedule-row-spacious ${isCompactScheduleRow ? 'schedule-row-compact' : ''} grid items-center rounded-xl transition-colors ${isThisSlot ? 'schedule-row-active font-bold text-white shadow-md' : 'schedule-row-idle'}`}
                        >
                          <span className="schedule-row-title-wrap min-w-0">
                            {shouldShowSubject ? (
                              <span className="schedule-row-subject">{scheduleRowTitle}</span>
                            ) : (
                              <span className="schedule-row-title font-semibold">
                                {scheduleRowTitle}
                              </span>
                            )}
                          </span>
                          <span className="schedule-row-time font-mono">{formatMinutesToTime(s.start)} - {formatMinutesToTime(s.end)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="schedule-quick-actions editorial-quick-actions grid w-full shrink-0 grid-cols-5 gap-3">
              <div className="relative min-w-0">
                <button
                  ref={currencyPanelTriggerRef}
                  type="button"
                  onClick={() => {
                    void playAnnouncementSound('pop');
                    setIsExtraTimerVisible(false);
                    setIsYoutubePanelOpen(false);
                    setIsClasswordPanelOpen(false);
                    setIsQuestionSubmissionPanelOpen(false);
                    setIsCurrencyPanelOpen((previous) => !previous);
                  }}
                  className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] ${
                    isCurrencyPanelOpen ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]' : ''
                  }`}
                  aria-expanded={isCurrencyPanelOpen}
                  aria-controls={isCurrencyPanelOpen ? 'timer-currency-panel' : undefined}
                  aria-label={isCurrencyPanelOpen ? '화폐 닫기' : '화폐 열기'}
                  title="화폐"
                >
                  <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                    <Coins size={22} />
                  </div>
                </button>
              </div>
              <div className="relative min-w-0">
                <button
                  ref={youtubePanelTriggerRef}
                  onClick={() => {
                    void playAnnouncementSound('pop');
                    setIsExtraTimerVisible(false);
                    setIsClasswordPanelOpen(false);
                    setIsCurrencyPanelOpen(false);
                    setIsQuestionSubmissionPanelOpen(false);
                    setIsYoutubePanelOpen((previous) => !previous);
                  }}
                  className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] ${
                    scheduleYoutubeCount > 0
                      ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]'
                      : ''
                  }`}
                  aria-expanded={isYoutubePanelOpen}
                  aria-controls={isYoutubePanelOpen ? 'timer-youtube-panel' : undefined}
                  aria-label="유튜브 재생목록"
                  title="유튜브 재생목록"
                  type="button"
                >
                  <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                    <Music size={22} />
                  </div>
                </button>
              </div>
                <button
                  ref={classwordPanelTriggerRef}
                  onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsYoutubePanelOpen(false);
                  setIsExtraTimerVisible(false);
                  setIsCurrencyPanelOpen(false);
                  setIsQuestionSubmissionPanelOpen(false);
                  setIsClasswordPanelOpen((previous) => !previous);
                }}
                className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] ${
                  isClasswordPanelOpen ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]' : ''
                }`}
                aria-expanded={isClasswordPanelOpen}
                aria-controls={isClasswordPanelOpen ? 'timer-classword-panel' : undefined}
                aria-label={isClasswordPanelOpen ? '낱말판 닫기' : '낱말판 열기'}
                title="낱말판"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <LetterText size={22} />
                </div>
              </button>
              <button
                ref={questionPanelTriggerRef}
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsYoutubePanelOpen(false);
                  setIsClasswordPanelOpen(false);
                  setIsCurrencyPanelOpen(false);
                  setIsExtraTimerVisible(false);
                  setIsQuestionSubmissionPanelOpen((previous) => !previous);
                }}
                className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] ${
                  isQuestionSubmissionPanelOpen ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]' : ''
                }`}
                aria-expanded={isQuestionSubmissionPanelOpen}
                aria-controls={isQuestionSubmissionPanelOpen ? 'timer-question-submission-panel' : undefined}
                aria-label={isQuestionSubmissionPanelOpen ? '질문 제출 현황 닫기' : '질문 제출 현황 열기'}
                title="질문 제출 현황"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <MessageCircleQuestion size={22} />
                </div>
              </button>
              <button
                ref={announcementLaunchButtonRef}
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsYoutubePanelOpen(false);
                  setIsClasswordPanelOpen(false);
                  setIsCurrencyPanelOpen(false);
                  setIsQuestionSubmissionPanelOpen(false);
                  setIsAnnouncementOpen(true);
                }}
                className="announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f]"
                aria-label="알림장"
                title="알림장"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <NotebookText size={22} />
                </div>
              </button>
            </div>

            {isCurrencyPanelOpen ? (
              <div id="timer-currency-panel" className="currency-panel docked-utility-panel utility-pane-anchor pointer-events-none absolute inset-x-0 top-0 bottom-[5.65rem] z-[120] flex flex-col justify-end p-3 sm:bottom-[5.85rem] sm:p-4 lg:bottom-[5.43rem] lg:p-5">
                <div className="content-fit-utility-card utility-pane-card pointer-events-auto flex min-h-0 w-full flex-col rounded-[1.45rem] border border-[#E6D5C9] bg-[#FFFCF7]/98 p-3 shadow-[0_22px_44px_rgba(95,71,50,0.16)] backdrop-blur-sm">
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] border border-[#E6D5C9] bg-white/92 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#E9DED2] pb-3">
                      <div className="min-w-0">
                        <h3 className="section-title text-[1.05rem] font-extrabold text-[#3F2B20]">화폐</h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCurrencyPanelOpen(false);
                            setEditingCurrencyNumber(null);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8A6347] transition-colors hover:bg-[#FFF7EC]"
                          title="화폐 닫기"
                          aria-label="화폐 닫기"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div
                      className="mb-3 grid grid-cols-3 rounded-[1rem] border-2 border-[#DDE9E2] bg-[#F1F7F3] p-1"
                      role="group"
                      aria-label="화폐 조정 대상"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrencyAdjustmentTarget('student');
                          setCurrencyAdjustmentSummary(null);
                        }}
                        className={`h-11 rounded-[0.75rem] text-[0.88rem] font-extrabold transition-[background-color,transform] active:scale-[0.98] ${
                          currencyAdjustmentTarget === 'student'
                            ? 'bg-white text-[#006241] shadow-[0_2px_7px_rgba(48,86,68,0.12)]'
                            : 'text-[#708078] hover:bg-white/60'
                        }`}
                        aria-pressed={currencyAdjustmentTarget === 'student'}
                      >
                        개인
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrencyAdjustmentTarget('group');
                          setCurrencyAdjustmentSummary(null);
                          setCurrencyStudentNumberInput('');
                          setIsCurrencyDirectInputVisible(false);
                          setEditingCurrencyNumber(null);
                        }}
                        className={`h-11 rounded-[0.75rem] text-[0.88rem] font-extrabold transition-[background-color,transform] active:scale-[0.98] ${
                          currencyAdjustmentTarget === 'group'
                            ? 'bg-white text-[#006241] shadow-[0_2px_7px_rgba(48,86,68,0.12)]'
                            : 'text-[#708078] hover:bg-white/60'
                        }`}
                        aria-pressed={currencyAdjustmentTarget === 'group'}
                      >
                        모둠
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrencyAdjustmentTarget('all');
                          setCurrencyAdjustmentSummary(null);
                          setCurrencyStudentNumberInput('');
                          setIsCurrencyDirectInputVisible(false);
                          setEditingCurrencyNumber(null);
                        }}
                        className={`h-11 rounded-[0.75rem] text-[0.88rem] font-extrabold transition-[background-color,transform] active:scale-[0.98] ${
                          currencyAdjustmentTarget === 'all'
                            ? 'bg-[#006241] !text-white shadow-[0_3px_8px_rgba(0,98,65,0.2)]'
                            : 'text-[#708078] hover:bg-white/60'
                        }`}
                        aria-pressed={currencyAdjustmentTarget === 'all'}
                      >
                        전체
                      </button>
                    </div>

                    {currencyAdjustmentTarget === 'student' ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#DDE9E2] bg-[#F8FCF6] p-3">
                        <div className="currency-student-number-row flex items-center gap-2">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.95rem] bg-[#EAF6F0] text-[#006241]">
                            <Search size={18} strokeWidth={2.5} />
                          </div>
                          <input
                            ref={currencyStudentNumberInputRef}
                            id="currency-student-number"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            value={currencyStudentNumberInput}
                            onChange={handleCurrencyStudentNumberInputChange}
                            className="h-12 min-w-0 flex-1 rounded-[0.95rem] border-2 border-[#CFE0D8] bg-white px-4 text-center font-mono text-[1.35rem] font-black leading-none text-[#006241] outline-none transition-colors placeholder:text-[#AFC3BA] focus:border-[#006241] focus:bg-[#FDFFFC]"
                            placeholder="번호"
                            aria-label="학생 번호 입력"
                            aria-invalid={isCurrencyStudentNumberInvalid}
                            aria-describedby={isCurrencyStudentNumberInvalid ? 'currency-student-number-error' : undefined}
                          />
                        </div>
                        {isCurrencyStudentNumberInvalid ? (
                          <p id="currency-student-number-error" className="mt-2 text-[0.78rem] font-bold text-[#A34F45]">
                            1~23번만 입력할 수 있어요.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {currencyAdjustmentTarget === 'group' ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#DDE9E2] bg-[#F8FCF6] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[0.82rem] font-extrabold text-[#466258]" aria-live="polite">
                            {selectedCurrencyGroupCount}명 선택
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrencyGroupStudentNumbers([...CURRENCY_STUDENT_NUMBERS]);
                                setCurrencyAdjustmentSummary(null);
                              }}
                              className="h-8 rounded-[0.7rem] px-2.5 text-[0.72rem] font-extrabold text-[#006241] transition-colors hover:bg-[#EAF6F0]"
                            >
                              전체 선택
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrencyGroupStudentNumbers([]);
                                setCurrencyAdjustmentSummary(null);
                              }}
                              className="h-8 rounded-[0.7rem] px-2.5 text-[0.72rem] font-extrabold text-[#708078] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={selectedCurrencyGroupCount === 0}
                            >
                              선택 해제
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="모둠 학생 번호 선택">
                          {CURRENCY_STUDENT_NUMBERS.map((studentNumber) => {
                            const isSelected = currencyGroupStudentNumbers.includes(studentNumber);
                            return (
                              <button
                                key={studentNumber}
                                type="button"
                                onClick={() => toggleCurrencyGroupStudentNumber(studentNumber)}
                                className={`h-10 rounded-[0.8rem] border-2 font-mono text-[0.92rem] font-black transition-colors ${
                                  isSelected
                                    ? 'border-[#006241] text-white'
                                    : 'border-[#D5E4DC] bg-white text-[#385348] hover:border-[#9FC7B8] hover:bg-[#F1FAF6]'
                                }`}
                                aria-pressed={isSelected}
                                aria-label={`${studentNumber}번 ${isSelected ? '선택 해제' : '선택'}`}
                              >
                                {studentNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {currencyAdjustmentTarget === 'student' && editingCurrencyNumber !== null && selectedCurrencyBalance !== null ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#9FC7B8] bg-[#F1FAF6] p-3 shadow-[0_8px_18px_rgba(0,98,65,0.06)]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#006241] text-white shadow-[0_6px_12px_rgba(0,98,65,0.18)]">
                            <span className="font-mono text-[1.2rem] font-black leading-none">{editingCurrencyNumber}</span>
                          </div>
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 rounded-[0.95rem] border-2 border-[#CFE0D8] bg-white px-3 py-2.5 text-right font-mono text-[1.08rem] font-black leading-none text-[#1F2523]">
                            <span>{formatCurrencyAmount(selectedCurrencyBalance)}</span>
                            {currencyAdjustmentSummary?.target === 'student' ? (
                              <span className="whitespace-nowrap text-[0.72rem] font-black text-[#006241]">
                                {formatCurrencyAdjustmentSummary(currencyAdjustmentSummary)}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustCurrencyBalance(editingCurrencyNumber, -CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white font-mono text-[1.15rem] font-black text-[#6E5139] transition-[background-color,transform] hover:bg-[#FFF7EC] active:scale-90 active:bg-[#F4E8DC]"
                            aria-label={`${editingCurrencyNumber}번 화폐 ${CURRENCY_BALANCE_STEP} 줄이기`}
                            title={`-${CURRENCY_BALANCE_STEP}`}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustCurrencyBalance(editingCurrencyNumber, CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] font-mono text-[1.15rem] font-black text-[#006241] transition-[background-color,transform] hover:bg-[#DDF0E8] active:scale-90 active:bg-[#CDE8DC]"
                            aria-label={`${editingCurrencyNumber}번 화폐 ${CURRENCY_BALANCE_STEP} 늘리기`}
                            title={`+${CURRENCY_BALANCE_STEP}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-[0.85rem] border border-[#CFE0D8] bg-white text-[0.82rem] font-extrabold text-[#466258] transition-colors hover:bg-[#F7FBF9]"
                          aria-expanded={isCurrencyDirectInputVisible}
                          aria-controls="currency-direct-setting"
                          onClick={() => setIsCurrencyDirectInputVisible((previous) => !previous)}
                        >
                          직접 설정
                        </button>
                        {isCurrencyDirectInputVisible ? (
                          <div id="currency-direct-setting" className="mt-2 flex items-center gap-2">
                            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[0.85rem] border border-[#CFE0D8] bg-white px-3">
                              <input
                                type="number"
                                min={0}
                                max={CURRENCY_BALANCE_MAX}
                                step={1}
                                value={currencyBalanceInput}
                                onChange={(event) => setCurrencyBalanceInput(event.target.value)}
                                className="h-10 min-w-0 flex-1 bg-transparent text-right font-mono text-[1rem] font-black text-[#1F2523] outline-none"
                                aria-label={`${editingCurrencyNumber}번 화폐 직접 설정`}
                                autoFocus
                              />
                              <span className="shrink-0 text-[0.76rem] font-extrabold text-[#466258]">고마</span>
                            </label>
                            <button
                              type="button"
                              disabled={isCurrencyBalanceInputInvalid}
                              onClick={() => setCurrencyBalanceExactly(editingCurrencyNumber, parsedCurrencyBalanceInput)}
                              className="h-10 shrink-0 rounded-[0.85rem] bg-[#006241] px-4 text-[0.82rem] font-extrabold text-white transition-colors hover:bg-[#004f35] disabled:cursor-not-allowed disabled:bg-[#9FB8AD]"
                            >
                              적용
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : currencyAdjustmentTarget === 'group' ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#9FC7B8] bg-[#F1FAF6] p-3 shadow-[0_8px_18px_rgba(0,98,65,0.06)]">
                        <div className="currency-all-action-row flex items-center gap-2.5">
                          <div
                            className="flex h-11 w-24 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#006241] px-1 text-white shadow-[0_6px_12px_rgba(0,98,65,0.18)]"
                            role="status"
                            aria-live="polite"
                          >
                            {currencyAdjustmentSummary?.target === 'group' ? (
                              <span className="whitespace-nowrap text-[0.72rem] font-black leading-none text-white">
                                {formatCurrencyAdjustmentSummary(currencyAdjustmentSummary)}
                              </span>
                            ) : (
                              <span className="whitespace-nowrap text-[0.78rem] font-black leading-none">{selectedCurrencyGroupCount}명</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => adjustGroupCurrencyBalances(-CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white font-mono text-[1.15rem] font-black text-[#6E5139] transition-[background-color,transform] hover:bg-[#FFF7EC] active:scale-90 active:bg-[#F4E8DC] disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`선택한 학생 화폐 ${CURRENCY_BALANCE_STEP} 줄이기`}
                            title={`선택한 학생 -${CURRENCY_BALANCE_STEP}`}
                            disabled={selectedCurrencyGroupCount === 0}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustGroupCurrencyBalances(CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] font-mono text-[1.15rem] font-black text-[#006241] transition-[background-color,transform] hover:bg-[#DDF0E8] active:scale-90 active:bg-[#CDE8DC] disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`선택한 학생 화폐 ${CURRENCY_BALANCE_STEP} 늘리기`}
                            title={`선택한 학생 +${CURRENCY_BALANCE_STEP}`}
                            disabled={selectedCurrencyGroupCount === 0}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : currencyAdjustmentTarget === 'all' ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#9FC7B8] bg-[#F1FAF6] p-3 shadow-[0_8px_18px_rgba(0,98,65,0.06)]">
                        <div className="currency-all-action-row flex items-center gap-2.5">
                          <div
                            className="flex h-11 w-24 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#006241] px-1 text-white shadow-[0_6px_12px_rgba(0,98,65,0.18)]"
                            role="status"
                            aria-live="polite"
                          >
                            {currencyAdjustmentSummary?.target === 'all' ? (
                              <span className="whitespace-nowrap text-[0.72rem] font-black leading-none text-white">
                                {formatCurrencyAdjustmentSummary(currencyAdjustmentSummary)}
                              </span>
                            ) : (
                              <motion.span
                                key="currency-range"
                                initial={{ opacity: 0.45 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.12, ease: 'easeOut' }}
                                className="text-[0.88rem] font-black leading-none"
                              >
                                1–23
                              </motion.span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => adjustAllCurrencyBalances(-CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white font-mono text-[1.15rem] font-black text-[#6E5139] transition-[background-color,transform] hover:bg-[#FFF7EC] active:scale-90 active:bg-[#F4E8DC]"
                            aria-label={`전체 화폐 ${CURRENCY_BALANCE_STEP} 줄이기`}
                            title={`전체 -${CURRENCY_BALANCE_STEP}`}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustAllCurrencyBalances(CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] font-mono text-[1.15rem] font-black text-[#006241] transition-[background-color,transform] hover:bg-[#DDF0E8] active:scale-90 active:bg-[#CDE8DC]"
                            aria-label={`전체 화폐 ${CURRENCY_BALANCE_STEP} 늘리기`}
                            title={`전체 +${CURRENCY_BALANCE_STEP}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : null}

                  </div>
                </div>
              </div>
            ) : null}

            {isQuestionSubmissionPanelOpen ? (
              <div id="timer-question-submission-panel" className="question-submission-panel docked-utility-panel utility-pane-anchor pointer-events-none absolute inset-x-0 top-0 bottom-[5.65rem] z-[150] flex flex-col justify-end p-3 sm:bottom-[5.85rem] sm:p-4 lg:bottom-[5.43rem] lg:p-5">
                <div className="content-fit-utility-card question-submission-panel-card utility-pane-card pointer-events-auto flex min-h-0 w-full flex-col rounded-[1.45rem] border border-[#DDE9E2] bg-[#FFFCF7] p-3 shadow-[0_22px_44px_rgba(95,71,50,0.16)]">
                  <div className="question-submission-panel-scroll min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] border border-[#DDE9E2] bg-white p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E4EDE7] pb-3">
                      <div className="flex items-center gap-2 rounded-full bg-[#F8FCF6] px-3 py-1.5 text-[0.76rem] font-extrabold text-[#3F2B20]">
                        <span className="sr-only">질문 제출 현황</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#168657]" />
                          개인
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#347FC4]" />
                          주제
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void refreshQuestionSubmissionStatuses()}
                          disabled={isQuestionSubmissionLoading}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#BFD8CB] bg-[#F1FAF6] text-[#006241] transition-colors hover:bg-[#E6F4ED] disabled:cursor-not-allowed disabled:opacity-60"
                          title="제출 현황 새로고침"
                          aria-label="제출 현황 새로고침"
                        >
                          <RotateCcw size={14} className={isQuestionSubmissionLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsQuestionSubmissionPanelOpen(false)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8A6347] transition-colors hover:bg-[#FFF7EC]"
                          title="질문 제출 현황 닫기"
                          aria-label="질문 제출 현황 닫기"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    </div>

                    {questionSubmissionError ? (
                      <div className="mb-3 rounded-[1rem] border border-[#E4C5B9] bg-[#FFF7EC] px-3 py-2.5 text-[0.78rem] font-bold leading-5 text-[#A34F45]">
                        {questionSubmissionError}
                      </div>
                    ) : null}

                    {questionSubmissionStatuses.length > 0 ? (
                      <div className="question-submission-grid grid grid-cols-[repeat(auto-fit,minmax(4.85rem,1fr))] gap-2">
                        {questionSubmissionStatuses.map((status) => (
                          <div
                            key={status.number}
                            className={`question-submission-status-card flex min-h-[5.25rem] flex-col items-center justify-between rounded-[0.9rem] border-2 px-2 py-2.5 shadow-[0_6px_14px_rgba(31,24,18,0.045)] ${
                              status.personalSubmitted || status.topicSubmitted
                                ? 'border-[#8FD6BB] bg-[#E8F9F0]'
                                : 'border-[#DCCCA8] bg-white'
                            }`}
                            aria-label={`${status.number}번 개인질문 ${
                              status.personalSubmitted ? '제출' : '미제출'
                            }, 주제질문 ${status.topicSubmitted ? '제출' : '미제출'}`}
                          >
                            <span className={`font-mono text-[1.45rem] font-black leading-none ${
                              status.personalSubmitted || status.topicSubmitted ? 'text-[#176244]' : 'text-[#665F56]'
                            }`}>
                              {status.number}
                            </span>
                            <span className="flex items-center justify-center gap-2" aria-hidden="true">
                              <span
                                className={`h-3.5 w-3.5 rounded-full ${
                                  status.personalSubmitted ? 'bg-[#168657]' : 'bg-[#DDE5EC]'
                                }`}
                              />
                              <span
                                className={`h-3.5 w-3.5 rounded-full ${
                                  status.topicSubmitted ? 'bg-[#347FC4]' : 'bg-[#DDE5EC]'
                                }`}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[1rem] border border-dashed border-[#CFE3D8] bg-[#F8FCF6] px-4 py-5 text-center text-[0.82rem] font-extrabold text-[#6F7D70]">
                        {isQuestionSubmissionLoading ? '제출 현황을 확인하고 있습니다.' : '새로고침을 눌러 제출 현황을 확인하세요.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {isYoutubePanelOpen ? (
              <div id="timer-youtube-panel" className="youtube-panel docked-utility-panel utility-pane-anchor pointer-events-none absolute inset-x-0 top-0 bottom-[5.65rem] z-[70] flex flex-col justify-end p-3 sm:bottom-[5.85rem] sm:p-4 lg:bottom-[5.43rem] lg:p-5">
                <div
                  className="content-fit-utility-card utility-pane-card pointer-events-auto flex min-h-0 w-full flex-col rounded-[1.45rem] border border-[#E6D5C9] bg-[#FFFCF7]/98 p-3 shadow-[0_22px_44px_rgba(95,71,50,0.16)] backdrop-blur-sm"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] border border-[#E6D5C9] bg-white/92 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    {hasScheduleYoutubeFavorites ? (
                      <div className="mb-3">
                        <div
                          className="grid max-h-[5.5rem] grid-cols-3 gap-2 overflow-y-auto px-1 py-1"
                          onDragOver={(event) => {
                            if (!isScheduleYoutubeFavoritesEditing) return;
                            event.preventDefault();
                          }}
                          onDrop={() => setDraggingScheduleYoutubeFavoriteId(null)}
                        >
                          {scheduleYoutubeFavorites.map((favorite, index) => (
                            <div
                              key={favorite.id}
                              className={`youtube-favorite-chip group flex min-w-0 items-center gap-1 rounded-full border border-[#D7E2D1] bg-[#FFFDF8] transition-[border-color,background-color,box-shadow] ${
                                isScheduleYoutubeFavoritesEditing ? 'h-8 px-1.5' : 'h-8 px-2'
                              } ${
                                draggingScheduleYoutubeFavoriteId === favorite.id
                                  ? 'border-[#8DBEA8] bg-[#EAF6F0] opacity-70'
                                  : ''
                              }`}
                              onDragEnter={(event) => {
                                if (!isScheduleYoutubeFavoritesEditing) return;
                                event.preventDefault();
                                const draggingFavoriteId =
                                  draggingScheduleYoutubeFavoriteId || event.dataTransfer.getData('text/plain');
                                if (!draggingFavoriteId || draggingFavoriteId === favorite.id) return;
                                reorderScheduleYoutubeFavorite(draggingFavoriteId, index);
                              }}
                              onDragOver={(event) => {
                                if (!isScheduleYoutubeFavoritesEditing) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                              }}
                              onDragEnd={() => setDraggingScheduleYoutubeFavoriteId(null)}
                            >
                              {isScheduleYoutubeFavoritesEditing ? (
                                <>
                                  <span
                                    draggable
                                    onDragStart={(event) => {
                                      setDraggingScheduleYoutubeFavoriteId(favorite.id);
                                      event.dataTransfer.effectAllowed = 'move';
                                      event.dataTransfer.setData('text/plain', favorite.id);
                                    }}
                                    className="inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded-full text-[#A98261] transition-colors hover:bg-[#FFF2E3] active:cursor-grabbing"
                                    title={`${favorite.name} 순서 이동`}
                                    aria-label={`${favorite.name} 순서 이동`}
                                  >
                                    <GripVertical size={13} />
                                  </span>
                                  <input
                                    type="text"
                                    value={favorite.name}
                                    onChange={(event) => updateScheduleYoutubeFavoriteName(favorite.id, event.target.value)}
                                    onBlur={() => normalizeScheduleYoutubeFavoriteName(favorite.id)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onKeyDown={(event) => {
                                      if (isComposingKeyboardEvent(event)) return;
                                      if (event.key !== 'Enter') return;
                                      event.preventDefault();
                                      normalizeScheduleYoutubeFavoriteName(favorite.id);
                                      event.currentTarget.blur();
                                    }}
                                    className="min-w-0 flex-1 bg-transparent text-[0.68rem] font-extrabold text-[#6E5139] outline-none placeholder:text-[#A98261]/70"
                                    placeholder="이름"
                                    aria-label={`${favorite.name || '즐겨찾기'} 이름 수정`}
                                    title="즐겨찾기 이름 수정"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeScheduleYoutubeFavorite(favorite.id)}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#A98261] transition-colors hover:bg-[#FFF2E3] hover:text-[#C7684A]"
                                    title={`${favorite.name} 삭제`}
                                    aria-label={`${favorite.name} 삭제`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onPointerDown={startYoutubeFavoriteLongPress}
                                  onPointerUp={clearYoutubeFavoriteLongPress}
                                  onPointerCancel={clearYoutubeFavoriteLongPress}
                                  onPointerLeave={clearYoutubeFavoriteLongPress}
                                  onClick={() => {
                                    if (skipNextYoutubeFavoriteClickRef.current) {
                                      skipNextYoutubeFavoriteClickRef.current = false;
                                      return;
                                    }

                                    addScheduleYoutubeFavoriteToPlaylist(favorite);
                                  }}
                                  className="h-full min-h-0 min-w-0 flex-1 truncate px-1 text-left text-[0.68rem] font-extrabold text-[#6E5139] transition-colors group-hover:text-[#006241]"
                                  aria-label={`${favorite.name} 재생목록 추가`}
                                >
                                  {favorite.name || '이름 없음'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div
                      className="mb-3 rounded-[1rem] border border-[#D7E2D1] bg-[#F8FCF6] p-2.5"
                      onPointerDown={() => {
                        if (!isScheduleYoutubeFavoritesEditing) return;
                        setDraggingScheduleYoutubeFavoriteId(null);
                        setIsScheduleYoutubeFavoritesEditing(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Search
                            size={15}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7A9B87]"
                          />
                          <input
                            ref={youtubeSearchInputRef}
                            type="text"
                            value={youtubeSearchInput}
                            onChange={(event) => {
                              setYoutubeSearchInput(event.target.value);
                              if (youtubeSearchError) {
                                setYoutubeSearchError('');
                              }
                            }}
                            onKeyDown={(event) => {
                              if (isComposingKeyboardEvent(event)) return;
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              void searchScheduleYoutubeVideos();
                            }}
                            className="time-input w-full rounded-[0.85rem] border border-[#D7E2D1] bg-white py-2 pl-8 pr-9 text-[0.82rem] font-bold text-[#3F2B20] outline-none transition-colors focus:border-[#8DBEA8]"
                            placeholder="YouTube 검색"
                            aria-label="YouTube 검색어"
                          />
                          {youtubeSearchInput || youtubeSearchResults.length > 0 || youtubeSearchError ? (
                            <button
                              type="button"
                              onClick={closeScheduleYoutubeSearch}
                              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8A6347] transition-colors hover:bg-[#FFF7EC] hover:text-[#C7684A]"
                              title="검색 닫기"
                              aria-label="검색 닫기"
                            >
                              <X size={13} />
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void searchScheduleYoutubeVideos()}
                          disabled={isYoutubeSearching}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#8DBEA8] px-3 text-[0.78rem] font-extrabold text-white transition-colors hover:bg-[#7AAD96] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {isYoutubeSearching ? '검색 중' : '검색'}
                        </button>
                      </div>

                      {youtubeSearchResults.length > 0 ? (
                        <div className="mt-2 max-h-[13.5rem] space-y-1.5 overflow-y-auto pr-1">
                          {youtubeSearchResults.map((result) => (
                            <div
                              key={result.id}
                              className="grid grid-cols-[4.6rem_minmax(0,1fr)_2.3rem_3.1rem] items-center gap-2 rounded-[0.85rem] border border-[#E1E9DD] bg-white p-1.5"
                            >
                              <div className="aspect-video overflow-hidden rounded-[0.65rem] bg-[#EFE5D9]">
                                {result.thumbnailUrl ? (
                                  <img
                                    src={result.thumbnailUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-[0.72rem] font-extrabold leading-4 text-[#3F2B20]">
                                  {result.title}
                                </p>
                                <p className="mt-0.5 truncate text-[0.65rem] font-bold text-[#8A6347]/75">
                                  {result.channelTitle}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => addScheduleYoutubeSearchResultToFavorites(result)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[0.7rem] bg-[#FFF7EC] text-[#C99245] transition-colors hover:bg-[#FFF0DE]"
                                title="즐겨찾기 저장"
                                aria-label={`${result.title} 즐겨찾기 저장`}
                              >
                                <Star size={15} className="fill-current" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addScheduleYoutubeSearchResult(result)}
                                className="inline-flex min-h-8 items-center justify-center rounded-[0.7rem] bg-[#FFF7EC] text-[0.68rem] font-extrabold text-[#8A6347] transition-colors hover:bg-[#FFF0DE]"
                              >
                                추가
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {youtubeSearchError ? (
                        <p className="mt-2 text-[0.72rem] font-bold leading-5 text-[#C7684A]">
                          {youtubeSearchError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsMaterialMounted && (
        <motion.div
          key="timer-settings-material"
          className="settings-backdrop teacher-settings-theme fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: isSettingsOpen ? 1 : 0, pointerEvents: isSettingsOpen ? 'auto' : 'none' }}
          transition={{ duration: shouldReduceMotion ? 0.16 : 0.18, ease: 'easeOut' }}
        >
          <motion.div
            ref={settingsDialogRef}
            className="apple-material-layer settings-dialog editorial-settings-dialog app-settings-modal flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-[#E6D5C9] bg-[#FDFBF7] shadow-2xl"
            role={!hasSettingsChildModal ? 'dialog' : undefined}
            aria-modal={!hasSettingsChildModal ? 'true' : undefined}
            aria-labelledby="timer-settings-title"
            tabIndex={-1}
            style={shouldReduceMotion
              ? { opacity: settingsMaterialProgress }
              : { opacity: settingsMaterialProgress, scale: settingsMaterialScale, filter: settingsMaterialFilter }}
          >
            <div
              className="settings-parent-content flex min-h-0 flex-1 flex-col"
              aria-hidden={hasSettingsChildModal ? 'true' : undefined}
            >
            <div className="settings-header flex shrink-0 items-center justify-between border-b border-[#E6D5C9] bg-white p-5 md:p-6">
              <h2 id="timer-settings-title" className="section-title flex items-center gap-2 text-xl font-bold text-[#8A6347] md:text-2xl">
                <Settings size={24} className="md:w-7 md:h-7" />
                설정
              </h2>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="icon-button rounded-full p-2 text-[#8A6347]/60 transition-colors hover:bg-[#FDFBF7] hover:text-[#8A6347]"
                  aria-label="설정 닫기"
                  title="설정 닫기"
                >
                  <X size={24} className="md:w-7 md:h-7" />
                </button>
              </div>
            </div>

            <div className="settings-workspace min-h-0 flex-1">
              <nav
                className="settings-navigation custom-scrollbar"
                aria-label="설정 기능"
                onKeyDown={handleSettingsNavigationKeyDown}
              >
                {SETTINGS_NAVIGATION_GROUPS.map((group) => (
                  <section key={group.label} className="settings-navigation-group" aria-label={group.label}>
                    {group.showHeading !== false ? (
                      <h3 className="settings-navigation-label">{group.label}</h3>
                    ) : null}
                    <div className="settings-navigation-items">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = settingsPanel === item.panel;
                        return (
                          <button
                            key={item.panel}
                            type="button"
                            data-settings-nav-item
                            onClick={() => setSettingsPanel(item.panel)}
                            className="settings-navigation-item"
                            aria-current={isActive ? 'page' : undefined}
                            tabIndex={isActive ? 0 : -1}
                          >
                            <ItemIcon size={19} aria-hidden="true" />
                            <span>{item.label}</span>
                            {item.panel === 'mail' && unreadTeacherLetterCount > 0 ? (
                              <span
                                className="settings-navigation-new-badge"
                                aria-label={`새로 받은 편지 ${unreadTeacherLetterCount}개`}
                              >
                                New
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </nav>

              <section
                className="settings-content"
                aria-label={`${currentSettingsNavigationItem?.label ?? '설정'} 설정`}
              >
                <div key={settingsPanel} className="settings-body custom-scrollbar overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
                  {settingsPanel === 'schedule'
                    ? scheduleSettingsPanel
                    : settingsPanel === 'subjects'
                      ? subjectSettingsPanel
                      : settingsPanel === 'draw'
                        ? drawSettingsPanel
                        : settingsPanel === 'shop'
                          ? shopSettingsPanel
                        : settingsPanel === 'stocks'
                          ? stockSettingsPanel
                        : settingsPanel === 'emotion'
                            ? emotionSettingsPanel
                            : settingsPanel === 'mail'
                              ? mailSettingsPanel
                              : settingsPanel === 'writing'
                                ? writingSettingsPanel
                              : settingsPanel === 'classword'
                              ? <TeacherClasswordPanel profileAssignments={studentLife.failureProfileAssignments} />
                              : settingsPanel === 'today-friend'
                                ? <TeacherTodayFriendPanel />
                              : settingsPanel === 'bookstore'
                                ? bookstoreSettingsPanel
                                : settingsPanel === 'auction' || settingsPanel === 'donation' || settingsPanel === 'missions'
                                  ? auctionSettingsPanel
                                  : null}
                </div>
              </section>
            </div>
            </div>

            {pendingAwardItemId ? (() => {
              const item = auctionItems.find((auctionItem) => auctionItem.id === pendingAwardItemId);
              const currentBid = item ? auctionBids[item.id] ?? { amount: 0, bidder: null } : null;
              const awardItemName = item ? getAuctionItemDisplayName(item.name, item.dayIndex) : '선택한 물품';
              const lastAwardItemChar = awardItemName.trim().slice(-1);
              const awardItemParticle = lastAwardItemChar && (lastAwardItemChar.charCodeAt(0) - 0xac00) % 28 > 0
                ? '을'
                : '를';

              return (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
                  role="presentation"
                  onClick={() => setPendingAwardItemId(null)}
                >
                  <div
                    ref={awardConfirmDialogRef}
                    className="apple-material-layer w-full max-w-[24rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.24)]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="auction-award-confirm-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h3 id="auction-award-confirm-title" className="section-title text-[1.35rem] font-extrabold text-[#2F241D]">
                      낙찰 처리할까요?
                    </h3>
                    <p className="mt-2 text-[1.05rem] font-black leading-7 text-[#006241]">
                      {awardItemName}{awardItemParticle} {currentBid?.bidder ?? '-'}번 학생에게
                      <br />
                      {formatCurrency(currentBid?.amount ?? 0)}에 낙찰합니다.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingAwardItemId(null)}
                        className="inline-flex h-11 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white px-4 text-[0.95rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={startAwardPresentation}
                        className="inline-flex h-11 items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
                      >
                        낙찰
                      </button>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {awardPresentation ? (() => {
              const activeStep = awardPresentation.steps[awardPresentation.currentIndex] ?? awardPresentation.steps[0];
              const activeStepIndex = awardPresentation.isComplete
                ? Math.max(awardPresentation.steps.length - 1, 0)
                : awardPresentation.currentIndex;
              const progressPercent = awardPresentation.steps.length <= 1
                ? 100
                : Math.round((activeStepIndex / (awardPresentation.steps.length - 1)) * 100);
              const hasQueuedAwardPresentations = queuedAwardItems.length > 0;

              return (
                <div
                  ref={awardPresentationDialogRef}
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2523]/55 px-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-label="낙찰 애니메이션"
                >
                  <div data-award-speed={getAuctionAwardSpeed(awardPresentation.steps.length)} className={`apple-material-layer auction-award-stage relative w-full max-w-[52rem] overflow-hidden rounded-[1.6rem] border-2 border-[#9FC7B8] bg-[#FFFDF8] shadow-[0_30px_90px_rgba(31,24,18,0.34)] ${
                    awardPresentation.isComplete ? 'auction-award-stage-complete' : ''
                  }`}>
                    <div className="auction-award-confetti pointer-events-none absolute inset-0 overflow-hidden">
                      {Array.from({ length: 18 }).map((_, index) => (
                        <span
                          key={`auction-award-confetti-${index}`}
                          style={{
                            left: `${6 + ((index * 17) % 88)}%`,
                            animationDelay: `${index * 0.045}s`,
                            backgroundColor: ['#007A57', '#B2793A', '#2E7D86', '#7A5BA8'][index % 4],
                          }}
                        />
                      ))}
                    </div>

                    <div className="relative border-b border-[#E6D5C9] bg-[#F8FCF6] px-5 py-4">
                      <div className="flex items-center justify-end">
                        <div className="shrink-0 rounded-full border border-[#D7E6DE] bg-white px-4 py-2 text-right shadow-sm">
                          <div className="font-mono text-[1.08rem] font-black leading-none text-[#006241]">
                            {activeStepIndex + 1} / {Math.max(awardPresentation.steps.length, 1)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#D7E6DE]">
                        <div
                          className="auction-award-progress-fill h-full rounded-full bg-[#006241]"
                          style={{ transform: `scaleX(${progressPercent / 100})` }}
                        />
                      </div>
                    </div>

                    <div className="relative p-4">
                      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(17rem,0.74fr)]">
                        <div className="rounded-[1.2rem] border border-[#D7E6DE] bg-[#F8FCF6] p-3">
                          <div className="grid max-h-[19rem] gap-1.5 overflow-y-auto">
                            {awardPresentation.steps.map((step, stepIndex) => {
                              const isPast = stepIndex < activeStepIndex || awardPresentation.isComplete;
                              const isActive = stepIndex === activeStepIndex && !awardPresentation.isComplete;
                              const isWinnerStep = awardPresentation.isComplete && stepIndex === awardPresentation.steps.length - 1;

                              return (
                                <div
                                  key={`award-step-row-${step.itemId}-${step.createdAt}-${stepIndex}`}
                                  className={`auction-award-step-row grid min-h-[3.75rem] grid-cols-[2rem_4.6rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-1.5 transition-[border-color,background-color,box-shadow,opacity] ${
                                    isActive
                                      ? 'auction-award-step-active border-[#006241] bg-white shadow-[0_12px_24px_rgba(0,98,65,0.14)]'
                                      : isWinnerStep
                                        ? 'border-[#9FC7B8] bg-[#EAF6F0]'
                                        : isPast
                                          ? 'border-[#D7E6DE] bg-white'
                                          : 'border-[#E5DFD8] bg-[#F4F0EA] opacity-72'
                                  }`}
                                >
                                  <div className="font-mono text-[0.78rem] font-black text-[#6E7A72]">
                                    {stepIndex + 1}
                                  </div>
                                  <div className="flex min-w-0 items-center">
                                    <span
                                      className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 font-mono text-[0.82rem] font-black text-white"
                                      style={getStudentLabelStyle(step.bidder)}
                                    >
                                      {step.bidder}번
                                    </span>
                                  </div>
                                  <div className="text-right font-mono text-[1rem] font-black text-[#006241]">
                                    {formatCurrency(step.amount)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {awardPresentationCompletedItems.length > 0 ? (
                            <div className="mt-3 border-t border-[#D7E6DE] pt-3">
                              <div className="mb-1.5 text-[0.78rem] font-black text-[#006241]">낙찰 완료</div>
                              <div className="grid gap-1">
                                {awardPresentationCompletedItems.map(({ item, award }) => (
                                  <div
                                    key={award.itemId}
                                    className="flex min-w-0 items-center justify-between gap-2 rounded-[0.65rem] bg-white px-2 py-1.5 text-[0.76rem] font-black text-[#46534B]"
                                  >
                                    <span className="min-w-0 truncate">{getAuctionItemDisplayName(item.name, item.dayIndex)}</span>
                                    <span className="shrink-0 font-mono text-[#006241]">{award.winner}번 · {formatCurrency(award.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className={`auction-award-result-card flex min-h-[19rem] flex-col items-center justify-center rounded-[1.2rem] border-2 p-5 text-center ${
                          awardPresentation.isComplete
                            ? 'border-[#9FC7B8] bg-[#F8FCF6]'
                            : 'border-[#D7E6DE] bg-white'
                        }`}>
                          <div className="flex justify-center">
                            <div
                              key={`result-bidder-${awardPresentation.isComplete ? 'winner' : awardPresentation.currentIndex}`}
                              className={`auction-award-current-chip inline-flex h-24 min-w-24 items-center justify-center rounded-full px-5 font-mono text-[2rem] font-black text-white shadow-[0_18px_34px_rgba(31,24,18,0.22)] ${
                                awardPresentation.isComplete ? 'auction-award-winner-chip' : ''
                              }`}
                              style={getStudentLabelStyle(awardPresentation.isComplete
                                ? awardPresentation.award.winner
                                : activeStep?.bidder ?? awardPresentation.award.winner)}
                            >
                              {awardPresentation.isComplete
                                ? `${awardPresentation.award.winner}번`
                                : activeStep
                                  ? `${activeStep.bidder}번`
                                  : '-'}
                            </div>
                          </div>
                          {awardPresentation.isComplete ? (
                            <div className="mt-4 inline-flex max-w-full items-center justify-center gap-2.5 rounded-full border border-[#E2D3BE] bg-white px-3.5 py-2 shadow-sm">
                              <Trophy className="auction-award-trophy shrink-0 text-[#B2793A]" size={34} />
                              <span className="min-w-0 truncate text-[0.95rem] font-black text-[#6E5139]">
                                {getAuctionItemDisplayName(awardPresentation.item.name, awardPresentation.item.dayIndex)}
                              </span>
                            </div>
                          ) : null}
                          <div
                            key={`result-price-${awardPresentation.isComplete ? 'final' : awardPresentation.currentIndex}`}
                            className="auction-award-price mt-4 font-mono text-[2.45rem] font-black leading-tight text-[#006241]"
                          >
                            {awardPresentation.isComplete
                              ? formatCurrency(awardPresentation.award.amount)
                              : activeStep
                                ? formatCurrency(activeStep.amount)
                                : formatCurrency(0)}
                          </div>
                          {awardPresentation.isComplete ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!hasQueuedAwardPresentations) {
                                  setAwardPresentation(null);
                                }
                              }}
                              disabled={hasQueuedAwardPresentations}
                              className="mt-5 inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-[0.9rem] bg-[#006241] px-5 text-[0.95rem] font-extrabold text-white shadow-[0_14px_24px_rgba(0,98,65,0.22)] transition-colors hover:bg-[#005336] disabled:cursor-wait disabled:bg-[#6F8A65]"
                            >
                              {hasQueuedAwardPresentations ? '다음 낙찰 준비 중' : '확인'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {pendingAuctionAction ? (() => {
              const actionCopy = {
                weeklyClose: {
                  title: '이번 주 경매를 마감할까요?',
                  body: '물품 초기화, 입찰가 초기화, 세금 징수, 주급 제공을 순서대로 처리합니다.',
                  action: '주간 마감',
                },
                currency: {
                  title: '보유 화폐를 정말 초기화할까요?',
                  body: '모든 학생의 보유 고마가 100으로 돌아갑니다. 주간 마감에는 사용하지 않는 별도 위험 작업입니다.',
                  action: '보유 화폐 초기화',
                },
              }[pendingAuctionAction];

              return (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
                  role="presentation"
                  onClick={() => setPendingAuctionAction(null)}
                >
                  <div
                    ref={auctionActionDialogRef}
                    className="apple-material-layer w-full max-w-[24rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.24)]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="auction-reset-confirm-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h3 id="auction-reset-confirm-title" className="section-title text-[1.35rem] font-extrabold text-[#2F241D]">
                      {actionCopy.title}
                    </h3>
                    <p className="mt-2 text-[0.95rem] font-extrabold leading-6 text-[#6E5139]">
                      {actionCopy.body}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingAuctionAction(null)}
                        className="inline-flex h-11 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white px-4 text-[0.95rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={confirmAuctionManagementAction}
                        className="inline-flex h-11 items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
                      >
                        {actionCopy.action}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })() : null}
             
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
                  className="toolbar-button toolbar-button-green inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5C8D5D] transition-colors"
                  title="선택한 요일 일정을 평일에 복사"
                  aria-label="선택한 요일 일정을 평일에 복사"
                >
                  <Copy size={18} strokeWidth={2.35} />
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
                      className="toolbar-button toolbar-button-danger copy-confirm-action-button rounded-lg px-3 py-1.5 text-sm font-bold text-white"
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
                    <div key={slot.id} className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
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
                className="add-slot-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5C8D5D] py-4 text-lg font-bold text-[#5C8D5D] transition-[background-color,border-color,box-shadow,color] hover:bg-[#5C8D5D] hover:text-white"
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
                            <div className="draw-case-heading-row flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={caseState.label}
                                  onFocus={() => setDrawSettingsCaseId(caseState.id)}
                                  onChange={(event) => updateDrawCaseLabel(caseState.id, event.target.value)}
                                  className="draw-case-label-input w-full rounded-xl border px-3 py-2 text-[1rem] font-extrabold md:text-[1.08rem]"
                                  placeholder={getCaseLabelByIndex(index)}
                                  aria-label={`${displayLabel} 이름 수정`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setDrawSettingsCaseId(caseState.id)}
                                  className="mt-1.5 block w-full text-left text-[0.88rem] font-bold leading-6 text-[#B58363]"
                                >
                                  {getCaseSummaryLabel(caseState)}
                                </button>
                              </div>

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
                                  className="draw-roster-row grid grid-cols-[4.2rem_minmax(0,1fr)] items-center gap-2 rounded-[1.05rem] border border-[#E6D5C9] bg-white/90 px-3 py-2.5"
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
                            {selectedDrawHistoryDisplayEntries.map((entry) => {
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
                            className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-[left] ${
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
          </motion.div>
        </motion.div>
      )}
      {!isSettingsOpen && awardPresentation ? (() => {
        const activeStep = awardPresentation.steps[awardPresentation.currentIndex] ?? awardPresentation.steps[0];
        const activeStepIndex = awardPresentation.isComplete
          ? Math.max(awardPresentation.steps.length - 1, 0)
          : awardPresentation.currentIndex;
        const progressPercent = awardPresentation.steps.length <= 1
          ? 100
          : Math.round((activeStepIndex / (awardPresentation.steps.length - 1)) * 100);
        const hasQueuedAwardPresentations = queuedAwardItems.length > 0;

        return (
          <div
            ref={awardPresentationDialogRef}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2523]/55 px-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="낙찰 애니메이션"
          >
          <div data-award-speed={getAuctionAwardSpeed(awardPresentation.steps.length)} className={`apple-material-layer auction-award-stage relative w-full max-w-[52rem] overflow-hidden rounded-[1.6rem] border-2 border-[#9FC7B8] bg-[#FFFDF8] shadow-[0_30px_90px_rgba(31,24,18,0.34)] ${
              awardPresentation.isComplete ? 'auction-award-stage-complete' : ''
            }`}>
              <div className="auction-award-confetti pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span
                    key={`auction-award-confetti-standalone-${index}`}
                    style={{
                      left: `${6 + ((index * 17) % 88)}%`,
                      animationDelay: `${index * 0.045}s`,
                      backgroundColor: ['#007A57', '#B2793A', '#2E7D86', '#7A5BA8'][index % 4],
                    }}
                  />
                ))}
              </div>

              <div className="relative border-b border-[#E6D5C9] bg-[#F8FCF6] px-5 py-4">
                <div className="flex items-center justify-end">
                  <div className="shrink-0 rounded-full border border-[#D7E6DE] bg-white px-4 py-2 text-right shadow-sm">
                    <div className="font-mono text-[1.08rem] font-black leading-none text-[#006241]">
                      {activeStepIndex + 1} / {Math.max(awardPresentation.steps.length, 1)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#D7E6DE]">
                <div
                  className="auction-award-progress-fill h-full rounded-full bg-[#006241]"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
                </div>
              </div>

              <div className="relative p-4">
                <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(17rem,0.74fr)]">
                  <div className="rounded-[1.2rem] border border-[#D7E6DE] bg-[#F8FCF6] p-3">
                    <div className="grid max-h-[19rem] gap-1.5 overflow-y-auto">
                      {awardPresentation.steps.map((step, stepIndex) => {
                        const isPast = stepIndex < activeStepIndex || awardPresentation.isComplete;
                        const isActive = stepIndex === activeStepIndex && !awardPresentation.isComplete;
                        const isWinnerStep = awardPresentation.isComplete && stepIndex === awardPresentation.steps.length - 1;

                        return (
                          <div
                            key={`award-step-row-standalone-${step.itemId}-${step.createdAt}-${stepIndex}`}
                            className={`auction-award-step-row grid min-h-[3.75rem] grid-cols-[2rem_4.6rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-1.5 transition-[border-color,background-color,box-shadow,opacity] ${
                              isActive
                                ? 'auction-award-step-active border-[#006241] bg-white shadow-[0_12px_24px_rgba(0,98,65,0.14)]'
                                : isWinnerStep
                                  ? 'border-[#9FC7B8] bg-[#EAF6F0]'
                                  : isPast
                                    ? 'border-[#D7E6DE] bg-white'
                                    : 'border-[#E5DFD8] bg-[#F4F0EA] opacity-72'
                            }`}
                          >
                            <div className="font-mono text-[0.78rem] font-black text-[#6E7A72]">
                              {stepIndex + 1}
                            </div>
                            <div className="flex min-w-0 items-center">
                              <span
                                className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 font-mono text-[0.82rem] font-black text-white"
                                style={getStudentLabelStyle(step.bidder)}
                              >
                                {step.bidder}번
                              </span>
                            </div>
                            <div className="text-right font-mono text-[1rem] font-black text-[#006241]">
                              {formatCurrency(step.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {awardPresentationCompletedItems.length > 0 ? (
                      <div className="mt-3 border-t border-[#D7E6DE] pt-3">
                        <div className="mb-1.5 text-[0.78rem] font-black text-[#006241]">낙찰 완료</div>
                        <div className="grid gap-1">
                          {awardPresentationCompletedItems.map(({ item, award }) => (
                            <div
                              key={award.itemId}
                              className="flex min-w-0 items-center justify-between gap-2 rounded-[0.65rem] bg-white px-2 py-1.5 text-[0.76rem] font-black text-[#46534B]"
                            >
                              <span className="min-w-0 truncate">{getAuctionItemDisplayName(item.name, item.dayIndex)}</span>
                              <span className="shrink-0 font-mono text-[#006241]">{award.winner}번 · {formatCurrency(award.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={`auction-award-result-card flex min-h-[19rem] flex-col items-center justify-center rounded-[1.2rem] border-2 p-5 text-center ${
                    awardPresentation.isComplete
                      ? 'border-[#9FC7B8] bg-[#F8FCF6]'
                      : 'border-[#D7E6DE] bg-white'
                  }`}>
                    <div className="flex justify-center">
                      <div
                        key={`result-bidder-standalone-${awardPresentation.isComplete ? 'winner' : awardPresentation.currentIndex}`}
                        className={`auction-award-current-chip inline-flex h-24 min-w-24 items-center justify-center rounded-full px-5 font-mono text-[2rem] font-black text-white shadow-[0_18px_34px_rgba(31,24,18,0.22)] ${
                          awardPresentation.isComplete ? 'auction-award-winner-chip' : ''
                        }`}
                        style={getStudentLabelStyle(awardPresentation.isComplete
                          ? awardPresentation.award.winner
                          : activeStep?.bidder ?? awardPresentation.award.winner)}
                      >
                        {awardPresentation.isComplete
                          ? `${awardPresentation.award.winner}번`
                          : activeStep
                            ? `${activeStep.bidder}번`
                            : '-'}
                      </div>
                    </div>
                    {awardPresentation.isComplete ? (
                      <div className="mt-4 inline-flex max-w-full items-center justify-center gap-2.5 rounded-full border border-[#E2D3BE] bg-white px-3.5 py-2 shadow-sm">
                        <Trophy className="auction-award-trophy shrink-0 text-[#B2793A]" size={34} />
                        <span className="min-w-0 truncate text-[0.95rem] font-black text-[#6E5139]">
                          {getAuctionItemDisplayName(awardPresentation.item.name, awardPresentation.item.dayIndex)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      key={`result-price-standalone-${awardPresentation.isComplete ? 'final' : awardPresentation.currentIndex}`}
                      className="auction-award-price mt-4 font-mono text-[2.45rem] font-black leading-tight text-[#006241]"
                    >
                      {awardPresentation.isComplete
                        ? formatCurrency(awardPresentation.award.amount)
                        : activeStep
                          ? formatCurrency(activeStep.amount)
                          : formatCurrency(0)}
                    </div>
                    {awardPresentation.isComplete ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!hasQueuedAwardPresentations) {
                            setAwardPresentation(null);
                          }
                        }}
                        disabled={hasQueuedAwardPresentations}
                        className="mt-5 inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-[0.9rem] bg-[#006241] px-5 text-[0.95rem] font-extrabold text-white shadow-[0_14px_24px_rgba(0,98,65,0.22)] transition-colors hover:bg-[#005336] disabled:cursor-wait disabled:bg-[#6F8A65]"
                      >
                        {hasQueuedAwardPresentations ? '다음 낙찰 준비 중' : '확인'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
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
        auctionItems={auctionItems}
        auctionAwards={auctionAwards}
        awardableAuctionItems={awardableAuctionItems}
        auctionBids={auctionBids}
        onOpenAwardConfirm={openAwardConfirm}
        onStartAwardQueue={startAwardPresentationQueue}
      />
      <MemoNotebookOverlay
        isOpen={isMemoOpen}
        onClose={closeMemoNotebook}
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
