import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Coffee, Coins, Copy, Download, GripVertical, Lock, Music, NotebookText, Pause, Play, Plus, RotateCcw, Search, Settings, Sparkles, Star, StickyNote, Timer, Trash2, Trophy, Upload, Utensils, Volume2, VolumeX, X } from 'lucide-react';
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
  type SavedRandomDrawState,
} from '../lib/randomDraw';
import {
  type AnnouncementNoteRecord,
  isSupabaseSettingsEnabled,
  loadAnnouncementNote,
  loadAnnouncementNoteHistory,
  loadSharedSettingsRow,
  saveAnnouncementNote,
  saveSharedSettings,
} from '../lib/supabaseSettings';
import { playAuctionSound } from '../lib/auctionAudio';
import {
  STUDENT_CHARACTERS,
  STUDENT_CHARACTER_WALK_SECONDS,
  type StudentCharacter,
} from '../lib/studentCharacters';
import {
  AUCTION_DAY_ACCENTS,
  AUCTION_ITEM_IDS,
  AUCTION_MAX_ITEMS_PER_DAY,
  AUCTION_MAX_ITEM_COUNT,
  AUCTION_MISSION_CONTENT_MAX_LENGTH,
  AUCTION_MISSIONS_STORAGE_KEY,
  AUCTION_WEEKDAY_LABELS,
  createAuctionItemTemplate,
  CURRENCY_BALANCE_MAX,
  CURRENCY_BALANCE_STEP,
  CURRENCY_STUDENT_NUMBERS,
  DEFAULT_CURRENCY_BALANCE,
  appendCurrencyHistoryEntry,
  clampAuctionMissionRewardAmount,
  clampCurrencyBalance,
  collectCurrencyTax,
  createDefaultCurrencyBalances,
  createDefaultCurrencyHistory,
  formatCurrencyAmount,
  formatCurrency,
  getAuctionItemDisplayName,
  getAuctionVisibleDayCount,
  getStudentLabelStyle,
  grantWeeklyCurrencyAllowance,
  normalizeAuctionAwards,
  normalizeAuctionBidHistory,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeAuctionMissions,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyHistory,
  type CurrencyHistoryReason,
  type AuctionMission,
  type AuctionAward,
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionBidHistoryEntry,
  type AuctionBids,
  type AuctionItem,
  type CurrencyBalances,
} from '../lib/currency';

type TimerType = 'break' | 'lunch' | 'class' | 'morning' | 'none';
type SettingsPanel = 'schedule' | 'subjects' | 'draw' | 'auction';
type WatchFaceGlance = 'center' | 'left' | 'right' | 'up';
type AuctionManagementAction = 'items' | 'bids' | 'currency' | 'tax' | 'allowance';
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
const LIBRARY_SITE_URL = 'https://librarylibrary.vercel.app';
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
const DRAW_SHORTCUT_LABEL = 'ArrowRight';
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
  return Array.from({ length: 5 }, (_, index) => {
    const weekStart = new Date(centerWeekStart);
    weekStart.setDate(centerWeekStart.getDate() + (index - 2) * 7);
    const key = formatDateKey(weekStart);
    return { key, label: getWeekOptionLabel(key) };
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
  const weeklySubjects = normalizeWeeklySubjects(parsed.weeklySubjects);
  const subjectCatalog = normalizeSubjectCatalog(parsed.subjectCatalog);

  return {
    version: 1,
    weeklySchedule,
    weeklySubjects:
      Object.keys(weeklySubjects).length > 0
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
}: {
  isOpen: boolean;
  onClose: () => void;
  liveTimer: AnnouncementOverlayTimerState;
}) {
  const [dateText, setDateText] = useState(() => getTodayAnnouncementDateText());
  const [noteText, setNoteText] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isViewingHistoryRecord, setIsViewingHistoryRecord] = useState(false);
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

  const noteEditorRef = useRef<HTMLDivElement>(null);
  const notePaperBodyRef = useRef<HTMLDivElement>(null);
  const noteDisplayRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hasRestoredRef = useRef(false);
  const hasEditedNoteTextRef = useRef(false);
  const remoteLoadTokenRef = useRef(0);
  const remoteSaveTimeoutRef = useRef<number | null>(null);
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
    void refreshAnnouncementHistory();
    void playAnnouncementSound('pop');
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
      if (event.key === 'Escape') {
        onClose();
        return;
      }

    };

    window.addEventListener('keydown', handleAnnouncementShortcuts);
    return () => window.removeEventListener('keydown', handleAnnouncementShortcuts);
  }, [isOpen, onClose]);

  const handleClose = () => {
    void playAnnouncementSound('pop');
    setIsViewingHistoryRecord(false);
    setIsHistoryOpen(false);
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
                  <div className="announcement-note-inline-tools" data-capture-exclude="true">
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
                  <h3 className="section-title text-xl font-extrabold text-[#006241]">알림장 기록</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    void playAnnouncementSound('pop');
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
    bobDuration: '860ms',
    bobLift: '-0.36rem',
    bobTilt: '0.7deg',
    easing: 'linear',
    zIndex: 27,
  },
  {
    startTop: '80vh',
    midTopA: '81vh',
    midTopB: '83vh',
    endTop: '82vh',
    size: 'min(31vw, 33vh, 16rem)',
    scale: '1',
    bobDuration: '720ms',
    bobLift: '-0.52rem',
    bobTilt: '0.45deg',
    easing: 'linear',
    zIndex: 30,
  },
  {
    startTop: '81vh',
    midTopA: '78vh',
    midTopB: '80vh',
    endTop: '84vh',
    size: 'min(29vw, 31vh, 15rem)',
    scale: '0.98',
    bobDuration: '940ms',
    bobLift: '-0.3rem',
    bobTilt: '0.9deg',
    easing: 'linear',
    zIndex: 32,
  },
  {
    startTop: '78vh',
    midTopA: '80vh',
    midTopB: '82vh',
    endTop: '81vh',
    size: 'min(25vw, 28vh, 13.5rem)',
    scale: '0.9',
    bobDuration: '780ms',
    bobLift: '-0.42rem',
    bobTilt: '0.6deg',
    easing: 'linear',
    zIndex: 24,
  },
  {
    startTop: '83vh',
    midTopA: '84vh',
    midTopB: '81vh',
    endTop: '79vh',
    size: 'min(32vw, 34vh, 16.5rem)',
    scale: '1.04',
    bobDuration: '820ms',
    bobLift: '-0.46rem',
    bobTilt: '0.5deg',
    easing: 'linear',
    zIndex: 34,
  },
] as const;

interface StudentCharacterWalker {
  renderKey: string;
  character: StudentCharacter;
  direction: 'left' | 'right';
  path: (typeof STUDENT_CHARACTER_WALK_PATHS)[number];
  animationDelaySeconds: number;
  shouldSpeak: boolean;
}

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
  shouldSpeak,
  onImageError,
}: {
  character: StudentCharacter;
  timerType: TimerType;
  direction: 'left' | 'right';
  path: (typeof STUDENT_CHARACTER_WALK_PATHS)[number];
  animationDelaySeconds: number;
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
    '--student-character-walk-size': path.size,
    '--student-character-walk-scale': path.scale,
    '--student-character-walk-duration': `${STUDENT_CHARACTER_WALK_SECONDS}s`,
    '--student-character-walk-delay': `${initialAnimationDelaySeconds}s`,
    '--student-character-walk-easing': path.easing,
    '--student-character-bob-duration': path.bobDuration,
    '--student-character-bob-lift': path.bobLift,
    '--student-character-bob-tilt': path.bobTilt,
    '--student-character-depth-z': path.zIndex,
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
  );
}

export default function TimerPage() {
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCurrencyPanelOpen, setIsCurrencyPanelOpen] = useState(false);
  const [editingCurrencyNumber, setEditingCurrencyNumber] = useState<number | null>(null);
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => createDefaultCurrencyBalances());
  const [currencyHistory, setCurrencyHistory] = useState<CurrencyHistory>(() => createDefaultCurrencyHistory());
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [auctionBidHistory, setAuctionBidHistory] = useState<AuctionBidHistory>(() => normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
  const [auctionAwards, setAuctionAwards] = useState<AuctionAwards>(() => normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
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
      const savedSubjects = normalizeWeeklySubjects(JSON.parse(localStorage.getItem(WEEKLY_SUBJECTS_STORAGE_KEY) || '{}'));
      if (Object.keys(savedSubjects).length > 0) {
        return savedSubjects;
      }
    } catch {
      // Fall through to migrate legacy slot subjects for the current week.
    }
    return buildWeeklySubjectsFromSchedule(
      weeklySchedule,
      getWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds)),
    );
  });
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalog>(() => {
    try {
      return normalizeSubjectCatalog(JSON.parse(localStorage.getItem(SUBJECT_CATALOG_STORAGE_KEY) || 'null'));
    } catch {
      return [...DEFAULT_SUBJECT_CATALOG];
    }
  });
  const [subjectCatalogEditCommitVersion, setSubjectCatalogEditCommitVersion] = useState(0);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSubjectWeekKey, setSelectedSubjectWeekKey] = useState(() =>
    getWeekKeyForDate(getAdjustedScheduleDate(Date.now(), scheduleClockOffsetSeconds)),
  );
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>('schedule');
  const [editingDay, setEditingDay] = useState<number>(() => getCurrentScheduleWeekday(scheduleClockOffsetSeconds));
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [pendingAuctionAction, setPendingAuctionAction] = useState<AuctionManagementAction | null>(null);
  const [pendingAwardItemId, setPendingAwardItemId] = useState<string | null>(null);
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
  const youtubeFavoriteLongPressTimeoutRef = useRef<number | null>(null);
  const skipNextYoutubeFavoriteClickRef = useRef(false);
  const sharedSettingsHydratedRef = useRef(!isSupabaseSettingsEnabled);
  const sharedSettingsSaveTimeoutRef = useRef<number | null>(null);
  const lastSharedSettingsUpdatedAtRef = useRef<string | null>(null);
  const skipNextSharedSettingsSaveRef = useRef(false);
  const isEditingSubjectCatalogRef = useRef(false);
  const activeDrawCase =
    drawCases.find((caseState) => caseState.id === activeDrawCaseId) ??
    drawCases[0] ??
    createDefaultCaseState(getCaseLabelByIndex(0));

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
    subjectWeekOptions.find((option) => option.key === selectedSubjectWeekKey)?.label ??
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
  });

  const applySharedSettingsSnapshot = (
    remoteSettings: SharedSchoolTimerSettings,
    options: { applyManualTimer: boolean },
  ) => {
    skipNextSharedSettingsSaveRef.current = true;
    setWeeklySchedule(remoteSettings.weeklySchedule);
    setWeeklySubjects(normalizeWeeklySubjects(remoteSettings.weeklySubjects));
    if (!isEditingSubjectCatalogRef.current) {
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
    setCurrencyBalances(normalizeCurrencyBalances(remoteSettings.currencyBalances));
    setCurrencyHistory(normalizeCurrencyHistory(remoteSettings.currencyHistory));
    setAuctionItems(normalizeAuctionItems(remoteSettings.auctionItems));
    setAuctionBids(normalizeAuctionBids(remoteSettings.auctionBids, AUCTION_ITEM_IDS));
    setAuctionBidHistory(normalizeAuctionBidHistory(remoteSettings.auctionBidHistory, AUCTION_ITEM_IDS));
    setAuctionAwards(normalizeAuctionAwards(remoteSettings.auctionAwards, AUCTION_ITEM_IDS));
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
          void saveSharedSettings(buildSharedSettingsSnapshot()).catch((error) => {
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

    if (skipNextSharedSettingsSaveRef.current) {
      skipNextSharedSettingsSaveRef.current = false;
      return;
    }

    if (isEditingSubjectCatalogRef.current || isEditingAuctionMissionRef.current) return;

    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
    }

    sharedSettingsSaveTimeoutRef.current = window.setTimeout(() => {
      sharedSettingsSaveTimeoutRef.current = null;
      void saveSharedSettings(buildSharedSettingsSnapshot())
        .then(() => {
          lastSharedSettingsUpdatedAtRef.current = new Date().toISOString();
        })
        .catch((error) => {
          console.error('Failed to save shared settings to Supabase.', error);
        });
    }, 700);

    return () => {
      if (sharedSettingsSaveTimeoutRef.current !== null) {
        window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
        sharedSettingsSaveTimeoutRef.current = null;
      }
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
    subjectCatalogEditCommitVersion,
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
        isEditingNoticeRef.current ||
        isEditingSubjectCatalogRef.current
      ) return;
      isChecking = true;

      try {
        const remoteRow = await loadSharedSettingsRow();
        if (isCancelled || !remoteRow?.updated_at) return;
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
    setIsLibraryOpen(false);
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

  useEffect(() => {
    if (timerType === 'lunch') {
      setIsExtraTimerVisible(false);
      setIsYoutubePanelOpen(false);
      setIsCurrencyPanelOpen(false);
      setIsLibraryOpen(true);
      return;
    }

    setIsLibraryOpen(false);
  }, [timerType]);

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
        isLibraryOpen ||
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
    isLibraryOpen,
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
      if (event.key !== 'ArrowRight' && event.code !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        isSettingsOpen ||
        isMemoOpen ||
        isAnnouncementOpen ||
        isYoutubePanelOpen ||
        isCurrencyPanelOpen ||
        isLibraryOpen ||
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
    isLibraryOpen,
    isMemoOpen,
    isSettingsOpen,
    isYoutubePanelOpen,
    drawCases,
    repeatPickEnabled,
    resolvedActiveDrawCaseId,
    shouldTriggerImmediateDrawReset,
  ]);

  useEffect(() => {
    if (!isLibraryOpen) return;

    const handleLibraryEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLibraryOpen(false);
      }
    };

    window.addEventListener('keydown', handleLibraryEscape);

    return () => {
      window.removeEventListener('keydown', handleLibraryEscape);
    };
  }, [isLibraryOpen]);

  useEffect(() => {
    if (
      isDrawResetVisible ||
      isSettingsOpen ||
      isMemoOpen ||
      isAnnouncementOpen ||
      isYoutubePanelOpen ||
      isCurrencyPanelOpen ||
      isLibraryOpen ||
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
    isLibraryOpen,
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

      return next;
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

    const next = [...subjectCatalog];
    next[index] = nextSubject;
    setSubjectCatalog(next);
    replaceWeeklySubjectName(previousSubject, nextSubject);
  };

  const removeSubjectCatalogItem = (index: number) => {
    setSubjectCatalog((previous) => previous.filter((_, subjectIndex) => subjectIndex !== index));
  };

  const addSlot = (day: number) => {
    setWeeklySchedule(prev => {
      const daySchedule = [...(prev[day] || [])];
      const lastSlot = daySchedule[daySchedule.length - 1];
      const start = lastSlot ? lastSlot.end : 540;
      daySchedule.push({
        id: createSlotId(),
        name: getNextClassPeriodName(daySchedule),
        subject: '',
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
    setIsLibraryOpen(false);
    setIsCurrencyPanelOpen(false);
    setIsExtraTimerVisible(false);
    setIsWatchFaceReacting(true);

    if (isEditingNoticeRef.current) {
      closeNoticeEdit();
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

  const recordCurrencyChange = (
    studentNumber: number,
    before: number,
    after: number,
    reason: CurrencyHistoryReason,
    createdAt = new Date().toISOString(),
  ) => {
    setCurrencyHistory((previous) =>
      appendCurrencyHistoryEntry(previous, {
        studentNumber,
        before,
        after,
        reason,
        createdAt,
      }),
    );
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
    setCurrencyHistory((previousHistory) =>
      appendCurrencyChangesToHistory(previousHistory, previousBalances, nextBalances, reason, createdAt),
    );
  };

  const adjustCurrencyBalance = (studentNumber: number, delta: number) => {
    const key = String(studentNumber);
    const before = currencyBalances[key] ?? DEFAULT_CURRENCY_BALANCE;
    const after = clampCurrencyBalance(before + delta);
    recordCurrencyChange(studentNumber, before, after, 'manual');
    setCurrencyBalances((previous) => ({
      ...previous,
      [key]: after,
    }));
  };

  const resetCurrencyBalances = () => {
    const normalizedPrevious = normalizeCurrencyBalances(currencyBalances);
    const nextBalances = createDefaultCurrencyBalances();
    recordCurrencyChanges(normalizedPrevious, nextBalances, 'reset');
    setCurrencyBalances(nextBalances);
    setEditingCurrencyNumber(null);
  };

  const collectTaxFromAllStudents = () => {
    const normalizedPrevious = normalizeCurrencyBalances(currencyBalances);
    const nextBalances = collectCurrencyTax(normalizedPrevious);
    recordCurrencyChanges(normalizedPrevious, nextBalances, 'tax');
    setCurrencyBalances(nextBalances);
  };

  const grantWeeklyAllowanceToAllStudents = () => {
    const normalizedPrevious = normalizeCurrencyBalances(currencyBalances);
    const nextBalances = grantWeeklyCurrencyAllowance(normalizedPrevious);
    recordCurrencyChanges(normalizedPrevious, nextBalances, 'allowance');
    setCurrencyBalances(nextBalances);
  };

  const resetAuctionItems = () => {
    setAuctionItems(normalizeAuctionItems(null));
    setTemporaryVisibleAuctionItemIds(new Set());
  };

  const addAuctionItem = (dayIndex: number) => {
    setAuctionItems((previous) => {
      const normalizedPrevious = normalizeAuctionItems(previous);
      if (normalizedPrevious.length >= AUCTION_MAX_ITEM_COUNT) return normalizedPrevious;
      const sameDayItemCount = normalizedPrevious.filter((item) => item.dayIndex === dayIndex).length;
      if (sameDayItemCount >= AUCTION_MAX_ITEMS_PER_DAY) return normalizedPrevious;
      const nextTemplate = createAuctionItemTemplate(dayIndex, sameDayItemCount);
      return normalizeAuctionItems([...normalizedPrevious, nextTemplate]);
    });
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
    setAwardPresentation((previous) => (previous?.itemId === itemId ? null : previous));
  };

  const resetAuctionBids = () => {
    const emptyAuctionBids = normalizeAuctionBids(null, AUCTION_ITEM_IDS);
    const emptyAuctionBidHistory = normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS);
    const emptyAuctionAwards = normalizeAuctionAwards(null, AUCTION_ITEM_IDS);

    setAuctionBids(emptyAuctionBids);
    setAuctionBidHistory(emptyAuctionBidHistory);
    setAuctionAwards(emptyAuctionAwards);
    setPendingAwardItemId(null);
    setAwardPresentation(null);

    if (!isSupabaseSettingsEnabled || !sharedSettingsHydratedRef.current) return;

    if (sharedSettingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(sharedSettingsSaveTimeoutRef.current);
      sharedSettingsSaveTimeoutRef.current = null;
    }

    void saveSharedSettings({
      ...buildSharedSettingsSnapshot(),
      auctionBids: emptyAuctionBids,
      auctionBidHistory: emptyAuctionBidHistory,
      auctionAwards: emptyAuctionAwards,
    })
      .then(() => {
        lastSharedSettingsUpdatedAtRef.current = new Date().toISOString();
      })
      .catch((error) => {
        console.error('Failed to reset auction bids in Supabase.', error);
      });
  };

  const addAuctionMission = () => {
    setAuctionMissions((previous) => [
      ...previous,
      {
        id: `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        content: `새 미션 ${previous.length + 1}`,
        rewardAmount: 0,
      },
    ]);
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
              content: nextContent.slice(0, AUCTION_MISSION_CONTENT_MAX_LENGTH),
            }
          : mission,
      ),
    );
  };

  const updateAuctionMissionRewardAmount = (missionId: string, nextRewardAmount: string) => {
    setAuctionMissions((previous) =>
      previous.map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              rewardAmount: clampAuctionMissionRewardAmount(nextRewardAmount),
            }
          : mission,
      ),
    );
  };

  const removeAuctionMission = (missionId: string) => {
    setAuctionMissions((previous) => previous.filter((mission) => mission.id !== missionId));
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

  const openAwardConfirm = (item: AuctionItem) => {
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id] || !currentBid.bidder || currentBid.amount <= 0) return;
    setPendingAwardItemId(item.id);
  };

  const startAwardPresentation = () => {
    if (!pendingAwardItemId) return;
    const item = auctionItems.find((auctionItem) => auctionItem.id === pendingAwardItemId);
    if (!item) {
      setPendingAwardItemId(null);
      return;
    }

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id] || !currentBid.bidder || currentBid.amount <= 0) {
      setPendingAwardItemId(null);
      return;
    }

    const itemIndex = auctionItems.findIndex((auctionItem) => auctionItem.id === item.id);
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
  };

  const confirmAuctionManagementAction = () => {
    if (pendingAuctionAction === 'items') {
      resetAuctionItems();
    } else if (pendingAuctionAction === 'bids') {
      resetAuctionBids();
    } else if (pendingAuctionAction === 'currency') {
      resetCurrencyBalances();
    } else if (pendingAuctionAction === 'tax') {
      collectTaxFromAllStudents();
    } else if (pendingAuctionAction === 'allowance') {
      grantWeeklyAllowanceToAllStudents();
    }

    setPendingAuctionAction(null);
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
    }, 720);

    return () => window.clearTimeout(timeoutId);
  }, [awardPresentation]);

  useEffect(() => {
    if (!awardPresentation?.isComplete || awardPresentation.hasFinalized) return;
    const awardPresentationKey = `${awardPresentation.award.itemId}:${awardPresentation.award.awardedAt}`;
    if (finalizedAwardPresentationKeysRef.current.has(awardPresentationKey)) return;
    finalizedAwardPresentationKeysRef.current.add(awardPresentationKey);

    setAuctionAwards((previous) => ({
      ...previous,
      [awardPresentation.award.itemId]: awardPresentation.award,
    }));
    const winnerKey = String(awardPresentation.award.winner);
    const beforeBalance = currencyBalances[winnerKey] ?? DEFAULT_CURRENCY_BALANCE;
    const afterBalance = clampCurrencyBalance(beforeBalance - awardPresentation.award.amount);
    recordCurrencyChange(awardPresentation.award.winner, beforeBalance, afterBalance, 'auction_award');
    setCurrencyBalances((previous) => {
      return {
        ...previous,
        [winnerKey]: afterBalance,
      };
    });
    setAwardPresentation((previous) => (
      previous
        ? {
            ...previous,
            hasFinalized: true,
          }
        : previous
    ));
  }, [awardPresentation]);

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
    setIsNoticeEnabled(false);
    setIsEditingNotice(false);
  };

  const handleNoticeBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    const nextFocusedElement = event.relatedTarget;
    if (
      nextFocusedElement instanceof HTMLElement &&
      (nextFocusedElement.closest('[data-notice-memo-button="true"]') ||
        nextFocusedElement.closest('[data-notice-highlight-popover="true"]'))
    ) {
      return;
    }

    if (skipNoticeAutoSaveRef.current) {
      skipNoticeAutoSaveRef.current = false;
      return;
    }
    closeNoticeEdit();
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

  let colorClass = "text-[#587052]";
  let strokeColor = "#587052";
  let ringTrackColor = "#E6D5C9";
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
      ? 'bg-[#EEF5EA] text-[#466146] border-[#CADABD]'
      : timerType === 'break'
        ? 'bg-[#F7FBF4] text-[#5C7A4B] border-[#D5E6CA]'
        : timerType === 'morning'
          ? 'bg-[#FFF7E3] text-[#8D6C37] border-[#EBCF93]'
          : timerType === 'lunch'
            ? 'bg-[#FFF0E3] text-[#A46943] border-[#EDC7A8]'
            : 'bg-[#F3F4F2] text-[#71766F] border-[#D5D9D2]';

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
    colorClass = "text-[#7A8077]";
    strokeColor = "#C6CCC3";
    ringTrackColor = "#E3E6E1";
    bgClass = "app-tone-idle";
  } else if (shouldShowTimedMessage && displayTimeLeft === 0) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-finished";
    characterMessage = getCharacterMessage('end');
  } else if (shouldShowTimedMessage && percentage <= urgentThreshold) {
    colorClass = "text-[#B55E4C]";
    strokeColor = "#B55E4C";
    showCharacter = true;
    bgClass = "app-tone-urgent";
    characterMessage = getCharacterMessage('urgent');
    if (displayIsRunning) {
      pulseClass = "mascot-alert-pulse";
    }
  } else if (shouldShowTimedMessage && percentage <= warningThreshold) {
    colorClass = "text-[#C58747]";
    strokeColor = "#C58747";
    showCharacter = true;
    bgClass = "app-tone-warning";
    characterMessage = getCharacterMessage('warning');
  }

  const showTimerNotification = showCharacter || showClassEndImage;
  const shouldHideStudentCharacterForNotification =
    showClassEndImage ||
    (shouldShowTimedMessage && displayTimeLeft === 0) ||
    (shouldShowTimedMessage && percentage <= urgentThreshold);
  const timerNotificationMessage = activeClassEndImage?.message ?? characterMessage;
  const timerNotificationTextColorClass = showClassEndImage ? 'text-[#3F7C49]' : colorClass;
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
    !shouldHideStudentCharacterForNotification;
  const studentCharacterElapsedSeconds =
    activeScheduleSlot && activeScheduleSlot.type === timerType && canShowStudentCharacter
      ? Math.max(0, currentScheduleSecondsOfDay - activeScheduleSlot.start * 60)
      : currentScheduleSecondsOfDay;
  const getStudentCharacterWalker = (
    elapsedSeconds: number,
    offsetSeconds: number,
    streamIndex: number,
  ): StudentCharacterWalker | null => {
    if (!canShowStudentCharacter) return null;
    if (streamIndex > 0 && visibleStudentCharacters.length === 1) return null;

    const shiftedElapsedSeconds = Math.max(0, elapsedSeconds + offsetSeconds);
    const walkCycle = Math.floor(shiftedElapsedSeconds / STUDENT_CHARACTER_WALK_SECONDS);
    const spawnOrder = walkCycle * 2 + streamIndex;
    const characterRoundIndex = Math.floor(spawnOrder / visibleStudentCharacters.length);
    const characterIndex = spawnOrder % visibleStudentCharacters.length;
    const roundCharacters = getShuffledStudentCharacters(
      visibleStudentCharacters,
      `${studentCharacterOrderSeed}:round-${characterRoundIndex}`,
    );
    const character = roundCharacters[characterIndex];
    if (!character) return null;
    const pathIndex = (spawnOrder * 3 + characterIndex * 2) % STUDENT_CHARACTER_WALK_PATHS.length;
    const shouldSpeak =
      Boolean(character.speech || character.speechImageSrc) &&
      shouldStudentCharacterSpeak(spawnOrder, characterIndex, streamIndex);

    return {
      renderKey: `${streamIndex}-${walkCycle}-${characterIndex}-${character.id}`,
      character,
      direction: spawnOrder % 2 === 0 ? 'right' : 'left',
      path: STUDENT_CHARACTER_WALK_PATHS[pathIndex],
      animationDelaySeconds: -(shiftedElapsedSeconds % STUDENT_CHARACTER_WALK_SECONDS),
      shouldSpeak,
    };
  };
  const primaryStudentCharacterWalker = getStudentCharacterWalker(studentCharacterElapsedSeconds, 0, 0);
  let secondaryStudentCharacterWalker = getStudentCharacterWalker(
    studentCharacterElapsedSeconds,
    STUDENT_CHARACTER_WALK_SECONDS / 2,
    1,
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
    if (length <= 10) return 'text-[clamp(3rem,6.8vw,3.75rem)] leading-[1.06] tracking-[-0.024em]';
    if (length <= 18) return 'text-[clamp(2.72rem,6.05vw,3.24rem)] leading-[1.12] tracking-[-0.02em]';
    if (length <= 30) return 'text-[clamp(2.36rem,5.1vw,2.78rem)] leading-[1.18] tracking-[-0.014em]';
    if (length <= 44) return 'text-[clamp(2.04rem,4.3vw,2.38rem)] leading-[1.24] tracking-[-0.008em]';
    return 'text-[clamp(1.84rem,3.75vw,2.14rem)] leading-[1.3] tracking-[-0.004em]';
  };
  const studentNoticeTextClass = getNoticeTextClass(trimmedNotice);
  const draftNoticeTextClass = getNoticeTextClass(noticeDraft);
  const shouldShowNoticeCard = isEditingNotice || (isNoticeEnabled && hasScheduleNotice);
  const selectedCurrencyBalance =
    editingCurrencyNumber === null
      ? null
      : (currencyBalances[String(editingCurrencyNumber)] ?? DEFAULT_CURRENCY_BALANCE);
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
  const noticeCardStyle = isEditingNotice
    ? { animation: 'noticeFadeIn 220ms ease-out' }
    : undefined;
  const noticeHandleToneClass = shouldShowNoticeCard ? 'notice-toggle-open' : 'notice-toggle-closed';
  const noticeHandleButtonClass = `notice-toggle ${noticeHandleToneClass} group relative inline-flex h-8 min-w-[9.5rem] items-center justify-center rounded-[1rem] border-2 px-5 transition-all hover:-translate-y-px active:translate-y-0 sm:min-w-[11rem] md:min-w-[12.5rem]`;
  const noticeHandleIconClass = `inline-flex h-5 min-w-[3.25rem] items-center justify-center rounded-full border ${shouldShowNoticeCard ? 'notice-toggle-icon-open' : 'notice-toggle-icon-closed'}`;
  const noticeHandleLineClass = `pointer-events-none absolute inset-x-1.5 top-[3px] h-px rounded-full ${shouldShowNoticeCard ? 'notice-toggle-line-open' : 'notice-toggle-line-closed'}`;
  const musicButtonLabel = isMusicPlaying ? '배경 음악 끄기' : '배경 음악 켜기';
  const noticeMemoButton = (
    <button
      type="button"
      onClick={() => {
        void playAnnouncementSound('pop');
        setIsYoutubePanelOpen(false);
        setIsLibraryOpen(false);
        setIsCurrencyPanelOpen(false);
        setIsMemoOpen(true);
      }}
      className="inline-flex h-6 items-center justify-center gap-1 rounded-full border border-[#D7E2D1] bg-[rgba(240,246,237,0.94)] px-2 text-[0.64rem] font-extrabold text-[#5C8D6D] shadow-[0_8px_16px_rgba(93,118,84,0.1)] backdrop-blur-xl transition-all hover:bg-[rgba(248,251,246,0.98)] hover:scale-[1.02] hover:text-[#4F7258] sm:h-7 sm:px-2.25 sm:text-[0.68rem] md:h-8 md:px-2.5 md:text-[0.72rem]"
      aria-label="메모장"
      title="메모장"
      data-notice-memo-button="true"
    >
      <StickyNote size={13} strokeWidth={2.2} />
      <span>메모</span>
    </button>
  );
  const noticeBanner = shouldShowNoticeCard ? (
    <div className="relative z-30 shrink-0 px-4 pb-1 pt-3 sm:px-5 sm:pt-4 md:px-6 md:pt-[1.15rem] lg:px-7 xl:px-8">
      <div
        className={`notice-card relative mx-auto w-full overflow-visible rounded-[2.2rem] border-2 border-[#4F6B47] bg-[#FFFBF6] px-1 pb-1 pt-1 text-left shadow-[0_16px_30px_rgba(82,107,73,0.16)] md:px-1.5 md:pb-1.5 ${isEditingNotice ? 'notice-card-editing' : 'notice-card-reading'}`}
        style={noticeCardStyle}
      >
        {isEditingNotice ? (
          <div className="notice-editor relative grid min-h-[3.6rem] grid-rows-[1.45rem_minmax(0,1fr)_1.45rem] rounded-[1.8rem] border border-[#8FA384] bg-[#FFFDF8] px-2.5 py-1.5 transition-colors focus-within:border-[#5D7654] focus-within:ring-2 focus-within:ring-[#5D7654]/20 sm:min-h-[3.85rem] sm:grid-rows-[1.55rem_minmax(0,1fr)_1.55rem] sm:px-3 md:min-h-[4.1rem] md:grid-rows-[1.7rem_minmax(0,1fr)_1.7rem]">
            <div aria-hidden="true" className="row-start-1" />
            <div className="row-start-2 flex min-h-0 items-center">
              <textarea
                ref={noticeInputRef}
                value={noticeDraft}
                onChange={(e) => applyNoticeDraft(e.target.value)}
                onBlur={handleNoticeBlur}
                onKeyUp={(e) => {
                  if (!e.nativeEvent.isComposing) {
                    applyNoticeDraftSelectionHighlight();
                  }
                }}
                onMouseUp={applyNoticeDraftSelectionHighlight}
                onTouchEnd={applyNoticeDraftSelectionHighlight}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    closeNoticeEdit();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeNoticeEdit();
                  }
                }}
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
            <div className="row-start-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={closeNoticeEdit}
                  className="inline-flex h-7 items-center justify-center rounded-full px-2.5 text-[0.68rem] font-extrabold text-[#8A6347] transition-colors hover:bg-[#FFF2E3]"
                >
                  닫기
                </button>
              </div>
              {noticeMemoButton}
            </div>
          </div>
        ) : (
          <>
            <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[128%] flex-col items-center">
              <div className="notice-reveal-zone -m-3 p-3">
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
            </div>
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
    </div>
  ) : null;
  const scheduleSettingsPanel = (
    <div className="settings-panel-grid grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <aside className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
        <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-title text-[1.2rem] font-extrabold text-[#3F2B20]">요일 선택</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCopyConfirm(true)}
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
                onClick={() => setEditingDay(day)}
                className={`settings-day-button rounded-[1.1rem] px-3 py-3 text-center text-[0.95rem] font-extrabold transition-all ${
                  editingDay === day
                    ? 'settings-day-button-active bg-[#688772] text-white shadow-[0_12px_20px_rgba(82,107,73,0.2)]'
                    : 'settings-day-button-idle border border-[#E6D5C9] bg-white text-[#8A6347] hover:border-[#CBB39D] hover:bg-[#FFF9F2]'
                }`}
              >
                {DAYS[day]}요일
              </button>
            ))}
          </div>

        </section>

        <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF4EC] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
          <h3 className="section-title text-[1.1rem] font-extrabold text-[#3F2B20]">학교 시계 보정</h3>
          <div className="mt-1.5 space-y-1 text-[0.82rem] font-semibold leading-relaxed text-[#8A6347]/75">
            <p>학교 종이 웹 타이머보다 빠르면 +, 늦으면 -로 입력하세요.</p>
            <p>예: 학교 종이 10초 빠르면 10</p>
          </div>
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
                className="toolbar-button toolbar-button-danger copy-confirm-action-button rounded-lg px-3 py-1.5 text-sm font-bold text-white"
              >
                복사하기
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
                  <div key={slot.id} className="slot-card group flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6D5C9] bg-white p-3 shadow-sm transition-all hover:border-[#B58363] md:gap-3 md:p-4 lg:flex-nowrap">
                    {isClassRow ? (
                      <span className="slot-period-label -ml-2 inline-flex min-h-10 min-w-[3.4rem] flex-1 items-center rounded-xl px-3 text-base font-extrabold text-[#3A5A3B] md:text-lg">
                        {periodNumber ?? slot.name}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={slot.name}
                        readOnly={isMorningRow}
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
                      const subjectStatusClass = weeklySubjectValue.trim()
                        ? 'slot-subject-input-configured'
                        : 'slot-subject-input-empty';

                      return (
                        <td
                          key={`${subjectKey}-${day}`}
                          className={`border-y border-[#E6D5C9] bg-white px-2 py-3 ${
                            dayIndex === WEEKDAYS.length - 1 ? 'rounded-r-2xl border-r pr-3' : ''
                          }`}
                        >
                          {slot ? (
                            subjectCatalog.length > 0 ? (
                              <select
                                value={weeklySubjectValue}
                                onChange={(event) => updateWeeklySubject(selectedSubjectWeekKey, day, slot, event.target.value)}
                                className={`slot-subject-input slot-select w-full min-w-0 cursor-pointer rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-3 py-2.5 text-[0.95rem] font-bold text-[#3F2B20] outline-none transition-colors hover:border-[#B58363] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20 ${subjectStatusClass}`}
                                aria-label={`${DAYS[day]}요일 ${subjectKey}교시 과목`}
                              >
                                <option value="">과목</option>
                                {subjectCatalog.map((subject) => (
                                  <option key={subject} value={subject}>
                                    {subject}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={weeklySubjectValue}
                                onChange={(event) => updateWeeklySubject(selectedSubjectWeekKey, day, slot, event.target.value)}
                                className={`slot-subject-input w-full min-w-0 rounded-xl border border-[#E6D5C9] bg-[#FDFBF7] px-3 py-2.5 text-[0.95rem] font-bold text-[#3F2B20] outline-none transition-colors hover:border-[#B58363] focus:border-[#5C8D5D] focus:ring-2 focus:ring-[#5C8D5D]/20 ${subjectStatusClass}`}
                                placeholder="과목"
                              />
                            )
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
              if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
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
                <div className="flex items-start gap-3">
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
                  className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-all ${
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

  const auctionSettingsPanel = (
    <div className="settings-panel-grid grid gap-4">
      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FBF6EF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] md:p-5">
        <div className="mb-4">
          <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">물품 설정 및 현황</h3>
        </div>

        <div className="auction-settings-day-list grid gap-3">
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
                  {dayItems.length === 0 ? (
                    <div
                      className="auction-settings-empty w-full rounded-[1rem] border border-dashed bg-white/80 px-3 py-4 text-center text-[0.82rem] font-black text-[#8A7A6B]"
                      style={{ borderColor: accent.border }}
                    >
                      물품 없음
                    </div>
                  ) : null}

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
                            <div className="flex items-center gap-2">
                              <input
                                value={itemDisplayName}
                                onChange={(event) => updateAuctionItem(item.id, { name: event.target.value })}
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
                                onClick={() => openAwardConfirm(item)}
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
      </section>

      <section className="settings-card rounded-[1.7rem] border border-[#DDEBDD] bg-[#F8FCF6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">미션</h3>
            <p className="mt-1 text-[0.82rem] font-bold leading-5 text-[#6F7D70]">
              학생 화면에 보여 줄 학급 공통 미션과 보상 고마를 정합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={addAuctionMission}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#9CCDBE] bg-white px-4 text-[0.86rem] font-extrabold text-[#006241] shadow-[0_8px_16px_rgba(31,98,65,0.08)] transition-colors hover:bg-[#EAF6F0]"
          >
            <Plus size={16} />
            미션 추가
          </button>
        </div>

        {auctionMissions.length === 0 ? (
          <div className="rounded-[1.1rem] border border-dashed border-[#BBD8CB] bg-white/80 px-4 py-5 text-center text-[0.86rem] font-extrabold text-[#6F7D70]">
            등록된 미션이 없습니다.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {auctionMissions.map((mission, index) => (
              <div
                key={mission.id}
                className="grid gap-2 rounded-[1.15rem] border border-[#CFE3D8] bg-white p-3 shadow-[0_8px_16px_rgba(31,24,18,0.045)] md:grid-cols-[minmax(0,1fr)_9.25rem_2.75rem] md:items-end"
              >
                <label className="grid min-w-0 gap-1.5">
                  <span className="section-title text-[0.74rem] font-black text-[#6F7D70]">
                    미션 내용 {index + 1}
                  </span>
                  <input
                    type="text"
                    value={mission.content}
                    onChange={(event) => updateAuctionMissionContent(mission.id, event.target.value)}
                    onFocus={beginAuctionMissionEdit}
                    onBlur={endAuctionMissionEdit}
                    className="section-title h-11 min-w-0 rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] px-3 text-[0.95rem] font-black leading-tight text-[#1F2523] outline-none transition-colors focus:border-[#7FB59F] focus:bg-white"
                    aria-label={`미션 ${index + 1} 내용`}
                    placeholder="예: 책상 정리하기"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="section-title text-[0.74rem] font-black text-[#6F7D70]">
                    보상
                  </span>
                  <div className="grid grid-cols-[minmax(0,1fr)_2.8rem] overflow-hidden rounded-[0.85rem] border border-[#CFE3D8] bg-[#FAFCFB] focus-within:border-[#7FB59F] focus-within:bg-white">
                    <input
                      type="number"
                      min={0}
                      max={CURRENCY_BALANCE_MAX}
                      step={CURRENCY_BALANCE_STEP}
                      value={mission.rewardAmount}
                      onChange={(event) => updateAuctionMissionRewardAmount(mission.id, event.target.value)}
                      className="h-11 min-w-0 bg-transparent px-3 text-right font-mono text-[0.95rem] font-black text-[#006241] outline-none"
                      aria-label={`미션 ${index + 1} 보상`}
                    />
                    <span className="flex h-11 items-center justify-center border-l border-[#CFE3D8] text-[0.78rem] font-extrabold text-[#6F7D70]">
                      고마
                    </span>
                  </div>
                </label>

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
            ))}
          </div>
        )}
      </section>

      <section className="settings-card rounded-[1.7rem] border border-[#EEE4D6] bg-[#FAF5EE] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:p-5">
        <div className="mb-4">
          <h3 className="section-title text-[1.18rem] font-extrabold text-[#3F2B20]">경매 관리</h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => setPendingAuctionAction('items')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1rem] border-2 border-[#D7E6DE] bg-[#F8FCF6] px-4 py-2 text-[0.9rem] font-extrabold text-[#006241] transition-colors hover:bg-[#EAF6F0]"
          >
            물품 초기화
          </button>
          <button
            type="button"
            onClick={() => setPendingAuctionAction('bids')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1rem] border-2 border-[#E4D7C9] bg-[#FFFDF8] px-4 py-2 text-[0.9rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
          >
            입찰가 초기화
          </button>
          <button
            type="button"
            onClick={() => setPendingAuctionAction('currency')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1rem] border-2 border-[#D7E6DE] bg-white px-4 py-2 text-[0.9rem] font-extrabold text-[#006241] transition-colors hover:bg-[#F8FCF6]"
          >
            보유 화폐 초기화
          </button>
          <button
            type="button"
            onClick={() => setPendingAuctionAction('tax')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1rem] border-2 border-[#E4D7C9] bg-[#FFF7EC] px-4 py-2 text-[0.9rem] font-extrabold text-[#7A4C24] transition-colors hover:bg-[#FBEBD8]"
          >
            세금 징수
          </button>
          <button
            type="button"
            onClick={() => setPendingAuctionAction('allowance')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[1rem] border-2 border-[#D7E6DE] bg-[#F8FCF6] px-4 py-2 text-[0.9rem] font-extrabold text-[#006241] transition-colors hover:bg-[#EAF6F0]"
          >
            주급 제공
          </button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="mascot-app h-[100dvh] w-full overflow-hidden p-3 sm:p-4 md:p-8">
      <div className={`mascot-shell editorial-main-shell relative flex h-full w-full max-w-screen-2xl flex-col overflow-hidden rounded-[2rem] shadow-2xl transition-colors duration-1000 md:rounded-[3rem] ${bgClass} ${isScheduleIdle ? 'timer-idle-state' : ''}`}>
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
        {activeStudentCharacterWalkers.map((walker) => (
          <React.Fragment key={walker.renderKey}>
            <StudentCharacterShowcase
              character={walker.character}
              timerType={timerType}
              direction={walker.direction}
              path={walker.path}
              animationDelaySeconds={walker.animationDelaySeconds}
              shouldSpeak={walker.shouldSpeak}
              onImageError={markStudentCharacterFailed}
            />
          </React.Fragment>
        ))}
        {noticeBanner}
        <div
          className={`editorial-home-layout flex-1 flex min-h-0 flex-col lg:grid ${
            isLibraryOpen
              ? 'lg:grid-cols-[minmax(0,1.36fr)_minmax(22.75rem,28rem)] xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,29.5rem)] 2xl:grid-cols-[minmax(0,1.56fr)_minmax(24.5rem,30rem)]'
              : 'lg:grid-cols-[minmax(0,1.36fr)_minmax(22.75rem,28rem)] xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,29.5rem)] 2xl:grid-cols-[minmax(0,1.56fr)_minmax(24.5rem,30rem)]'
          }`}
        >
          {/* Left: Timer Display */}
          <div className="timer-pane editorial-timer-pane relative flex h-full min-h-0 flex-col items-center justify-center p-4 md:p-6 lg:px-6 lg:py-7 xl:px-8 xl:py-8">
            <div className="bgm-reveal-zone absolute left-1 top-1 z-40 flex items-start p-3 sm:left-2 sm:top-2 md:left-3 md:top-3">
              <button
                onClick={toggleBackgroundMusic}
                onPointerDown={(event) => event.stopPropagation()}
                className={`sound-toggle timer-toolbar-button inline-flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center rounded-[1.45rem] transition-all sm:h-[3.55rem] sm:w-[3.55rem] sm:rounded-2xl ${
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
                  className="transition-all duration-1000 ease-linear"
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
              <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex h-full items-center justify-center px-4 pb-6 pt-3 transition-all duration-500 md:pb-8 md:pt-4 ${showTimerNotification ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
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
                className={`timer-draw-switch absolute left-1/2 top-[7.2%] z-30 grid min-h-[3.2rem] w-[min(16.5rem,62%)] -translate-x-1/2 grid-cols-[2.35rem_minmax(0,1fr)_2.35rem] items-center gap-1 rounded-full border border-[#9FC7B8]/80 bg-[#F7FBF8]/88 px-2 py-1 text-[#006241] shadow-[0_4px_10px_rgba(0,98,65,0.12),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-md transition-all duration-200 md:min-h-[3.45rem] md:w-[min(18.75rem,52%)] ${
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
            <div className="relative z-10 mt-2 shrink-0 md:mt-3 lg:mt-4">
              <div className={`clock-display editorial-clock-display text-[clamp(3.7rem,8.5vw,9.8rem)] leading-none font-bold tracking-tight transition-colors duration-1000 xl:text-[clamp(4.1rem,7.8vw,10.2rem)] ${colorClass}`}>
                {formatTime(displayTimeLeft)}
              </div>
            </div>
            <div className="timer-status-row relative z-10 mt-3 flex w-full max-w-[40rem] flex-wrap items-center justify-center gap-3 md:mt-4 xl:max-w-[45rem]">
              <div className={`inline-manual-timer-shell ${isExtraTimerVisible ? 'inline-manual-timer-shell-open' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawCaseMenuOpen(false);
                    setIsYoutubePanelOpen(false);
                    setIsLibraryOpen(false);
                    setIsCurrencyPanelOpen(false);
                    setIsExtraTimerVisible((previous) => !previous);
                  }}
                  className={`status-medallion timer-primary-chip inline-manual-timer-button inline-flex min-h-[4.3rem] min-w-[13rem] items-center justify-center gap-3 rounded-full border-2 px-5 py-3 text-[clamp(1.2rem,2.8vw,1.85rem)] font-extrabold leading-none tracking-[-0.01em] ${scheduleTypeBadgeClass}`}
                  aria-expanded={isExtraTimerVisible}
                  aria-label={`${scheduleTypeLabel}, ${scheduleStatusDetail}. 보조 타이머 열기`}
                  title={isExtraTimerVisible ? '보조 타이머 닫기' : '보조 타이머 열기'}
                >
                  {timerType === 'break' ? <Coffee size={30} strokeWidth={2.3} /> : timerType === 'lunch' ? <Utensils size={30} strokeWidth={2.3} /> : timerType === 'class' || timerType === 'morning' ? <CalendarClock size={30} strokeWidth={2.3} /> : <Timer size={30} strokeWidth={2.3} />}
                  <span className="inline-manual-timer-label min-w-0 truncate">{scheduleTypeLabel}</span>
                </button>
                <div className="inline-manual-timer-panel" aria-hidden={!isExtraTimerVisible}>
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
            {isLibraryOpen ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[5.65rem] z-[60] flex flex-col p-3 sm:bottom-[5.85rem] sm:p-4 lg:bottom-[6rem] lg:p-5">
                <div className="pointer-events-auto relative min-h-0 flex-1 overflow-hidden rounded-[1.7rem] border border-[#DDE9E2] bg-white shadow-[0_18px_36px_rgba(37,28,21,0.14),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-white/70">
                  <iframe
                    src={LIBRARY_SITE_URL}
                    title="도서관"
                    className="absolute left-[-1.85rem] top-[-56.5rem] h-[calc(100%+56.5rem)] w-[calc(100%+3.7rem)] border-0 bg-white"
                    allow="fullscreen"
                    scrolling="no"
                  />
                </div>
              </div>
            ) : null}
            <div className="schedule-board schedule-board-compact editorial-schedule-board flex w-full min-h-[23rem] flex-1 flex-col rounded-[2.35rem] border-2 border-[#E6D5C9] bg-[#FDFBF7] p-4 text-left shadow-sm sm:min-h-[27rem] sm:p-5 lg:min-h-0">
              <div className="schedule-board-header flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="section-title text-[1.08rem] font-extrabold text-[#3F2B20]">오늘 시간표</h3>
                </div>
                <div className="schedule-panel-actions flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {scheduleYoutubeCount > 0 ? (
                    <>
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
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawCaseMenuOpen(false);
                      setIsLibraryOpen(false);
                      setIsCurrencyPanelOpen(false);
                      setEditingDay(getCurrentScheduleWeekday(scheduleClockOffsetSeconds));
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

              {hasMountedScheduleYoutubePlayer && scheduleYoutubeVideoIds.length > 0 ? (
                <div
                  className={`shrink-0 overflow-hidden rounded-[1.8rem] bg-[#FFFDF8] transition-all duration-300 ${
                    isScheduleYoutubeVisible
                      ? 'mt-4 max-h-[42rem] border border-[#E6D5C9] opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]'
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
                      className={`overflow-hidden transition-all duration-300 ${
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

              <div className="mt-3 min-h-0 flex flex-1 flex-col">
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
                      const scheduleSubject = getWeeklySubject(weeklySubjects, currentSubjectWeekKey, today, s);
                      const periodNumber = getSchedulePeriodNumber(s);
                      const shouldShowSubject = s.type === 'class' && scheduleSubject.length > 0 && periodNumber !== null;
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
                              <>
                                <span className="schedule-row-subject">{scheduleSubject}</span>
                                <span className="schedule-row-period-badge">{periodNumber}교시</span>
                              </>
                            ) : (
                              <span className="schedule-row-title font-semibold">
                                {periodNumber !== null ? `${periodNumber}교시` : getScheduleSlotDisplayTitle(s, scheduleSubject)}
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

            <div className="schedule-quick-actions editorial-quick-actions grid w-full shrink-0 grid-cols-4 gap-3">
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    void playAnnouncementSound('pop');
                    setIsExtraTimerVisible(false);
                    setIsYoutubePanelOpen(false);
                    setIsLibraryOpen(false);
                    setIsCurrencyPanelOpen((previous) => !previous);
                  }}
                  className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all ${
                    isCurrencyPanelOpen ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]' : ''
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={isCurrencyPanelOpen}
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
                  onClick={() => {
                    void playAnnouncementSound('pop');
                    setIsExtraTimerVisible(false);
                    setIsLibraryOpen(false);
                    setIsCurrencyPanelOpen(false);
                    setIsYoutubePanelOpen((previous) => !previous);
                  }}
                  className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all ${
                    scheduleYoutubeCount > 0
                      ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]'
                      : ''
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={isYoutubePanelOpen}
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
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsYoutubePanelOpen(false);
                  setIsExtraTimerVisible(false);
                  setIsCurrencyPanelOpen(false);
                  setIsLibraryOpen((previous) => !previous);
                }}
                className={`announcement-launch-button editorial-utility-button flex min-h-[5.9rem] w-full items-center justify-center rounded-[1.65rem] px-3 py-3 text-center text-[#75461f] transition-all ${
                  isLibraryOpen ? 'border-[#BFD4B2] bg-[#EEF7E8]/96 hover:bg-[#F5FBF1]' : ''
                }`}
                aria-haspopup="dialog"
                aria-expanded={isLibraryOpen}
                aria-label={isLibraryOpen ? '도서관 닫기' : '도서관 열기'}
                title="도서관"
                type="button"
              >
                <div className="announcement-launch-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff8ef] text-[#5C8D6D]">
                  <BookOpen size={22} />
                </div>
              </button>
              <button
                onClick={() => {
                  void playAnnouncementSound('pop');
                  setIsYoutubePanelOpen(false);
                  setIsLibraryOpen(false);
                  setIsCurrencyPanelOpen(false);
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

            {isCurrencyPanelOpen ? (
              <div className="pointer-events-none fixed inset-x-0 bottom-[7.25rem] z-[70] flex justify-center px-4 sm:bottom-[8rem] md:bottom-[9rem]">
                <div className="pointer-events-auto w-full max-w-[40rem] rounded-[1.45rem] border border-[#E6D5C9] bg-[#FFFCF7]/98 p-3 shadow-[0_22px_44px_rgba(95,71,50,0.16)] backdrop-blur-sm">
                  <div className="rounded-[1.25rem] border border-[#E6D5C9] bg-white/92 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
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

                    {editingCurrencyNumber !== null && selectedCurrencyBalance !== null ? (
                      <div className="mb-3 rounded-[1.15rem] border-2 border-[#9FC7B8] bg-[#F1FAF6] p-3 shadow-[0_8px_18px_rgba(0,98,65,0.06)]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#006241] text-white shadow-[0_6px_12px_rgba(0,98,65,0.18)]">
                            <span className="font-mono text-[1.2rem] font-black leading-none">{editingCurrencyNumber}</span>
                          </div>
                          <div className="min-w-0 flex-1 rounded-[0.95rem] border-2 border-[#CFE0D8] bg-white px-3 py-2.5 text-right font-mono text-[1.08rem] font-black leading-none text-[#1F2523]">
                            {formatCurrencyAmount(selectedCurrencyBalance)}
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustCurrencyBalance(editingCurrencyNumber, -CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#E4D7C9] bg-white text-[1.15rem] font-black text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
                            aria-label={`${editingCurrencyNumber}번 화폐 ${CURRENCY_BALANCE_STEP} 줄이기`}
                            title={`-${CURRENCY_BALANCE_STEP}`}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustCurrencyBalance(editingCurrencyNumber, CURRENCY_BALANCE_STEP)}
                            className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] text-[1.15rem] font-black text-[#006241] transition-colors hover:bg-[#DDF0E8]"
                            aria-label={`${editingCurrencyNumber}번 화폐 ${CURRENCY_BALANCE_STEP} 늘리기`}
                            title={`+${CURRENCY_BALANCE_STEP}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="currency-card-grid custom-scrollbar grid max-h-[24rem] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
                      {CURRENCY_STUDENT_NUMBERS.map((studentNumber) => {
                        const balance = currencyBalances[String(studentNumber)] ?? DEFAULT_CURRENCY_BALANCE;
                        const isEditingCurrency = editingCurrencyNumber === studentNumber;

                        return (
                          <button
                            key={studentNumber}
                            type="button"
                            onClick={() => setEditingCurrencyNumber((previous) => previous === studentNumber ? null : studentNumber)}
                            className={`inline-flex h-14 items-center justify-center rounded-[1rem] border-2 font-mono text-[1.2rem] font-black leading-none shadow-[0_6px_14px_rgba(0,98,65,0.06)] transition-colors ${
                              isEditingCurrency
                                ? 'border-[#006241] bg-[#006241] text-white'
                                : 'border-[#DDE9E2] bg-[#F8FCF6] text-[#006241] hover:border-[#BFD8CE] hover:bg-[#F3FAF7]'
                            }`}
                            aria-expanded={isEditingCurrency}
                            aria-label={`${studentNumber}번 화폐 ${formatCurrency(balance)}, ${isEditingCurrency ? '선택 해제' : '조정 열기'}`}
                          >
                            {studentNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {isYoutubePanelOpen ? (
              <div className="pointer-events-none fixed inset-x-0 bottom-[7.25rem] z-[70] flex justify-center px-4 sm:bottom-[8rem] md:bottom-[9rem]">
                <div
                  className="pointer-events-auto w-full max-w-[25rem] rounded-[1.45rem] border border-[#E6D5C9] bg-[#FFFCF7]/98 p-3 shadow-[0_22px_44px_rgba(95,71,50,0.16)] backdrop-blur-sm"
                >
                  <div className="rounded-[1.25rem] border border-[#E6D5C9] bg-white/92 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
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
                              className={`group flex min-w-0 items-center gap-1 rounded-full border border-[#D7E2D1] bg-[#FFFDF8] transition-colors hover:border-[#BFD4B2] hover:bg-[#F8FCF6] ${
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
                                  className="min-w-0 flex-1 truncate rounded-full px-1 text-left text-[0.68rem] font-extrabold text-[#6E5139] transition-colors hover:bg-[#FFF2E3]"
                                  title={`${favorite.name} 재생목록 추가`}
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
      {isSettingsOpen && (
        <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-8">
          <div className="settings-dialog editorial-settings-dialog app-settings-modal flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-[#E6D5C9] bg-[#FDFBF7] shadow-2xl">
            <div className="settings-header flex shrink-0 items-center justify-between border-b border-[#E6D5C9] bg-white p-5 md:p-6">
              <h2 className="section-title flex items-center gap-2 text-xl font-bold text-[#8A6347] md:text-2xl">
                <Settings size={24} className="md:w-7 md:h-7" />
                설정
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

            <div className="settings-tab-strip shrink-0 border-b border-[#E6D5C9] bg-white/80 px-4 py-3 md:px-6">
              <div className="grid gap-2 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setSettingsPanel('schedule')}
                  className={`settings-mode-tab rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'schedule'
                      ? 'settings-mode-tab-active border-[#6F9A58] bg-[#ECF5E9] shadow-[0_12px_24px_rgba(95,125,102,0.12)]'
                      : 'settings-mode-tab-idle border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'schedule'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <CalendarClock size={18} className={settingsPanel === 'schedule' ? 'text-[#476152]' : 'text-[#8A6347]'} />
                    시간표
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsPanel('subjects')}
                  className={`settings-mode-tab rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'subjects'
                      ? 'settings-mode-tab-active border-[#6F9A58] bg-[#ECF5E9] shadow-[0_12px_24px_rgba(95,125,102,0.12)]'
                      : 'settings-mode-tab-idle border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'subjects'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <BookOpen size={18} className={settingsPanel === 'subjects' ? 'text-[#476152]' : 'text-[#8A6347]'} />
                    과목
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsPanel('draw')}
                  className={`settings-mode-tab rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'draw'
                      ? 'settings-mode-tab-active border-[#B58363] bg-[#FBF0E4] shadow-[0_12px_24px_rgba(181,131,99,0.12)]'
                      : 'settings-mode-tab-idle border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'draw'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <Sparkles size={18} className={settingsPanel === 'draw' ? 'text-[#B58363]' : 'text-[#8A6347]'} />
                    추첨
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsPanel('auction')}
                  className={`settings-mode-tab rounded-[1.45rem] border px-4 py-3 text-left transition-all ${
                    settingsPanel === 'auction'
                      ? 'settings-mode-tab-active border-[#6F9A58] bg-[#ECF5E9] shadow-[0_12px_24px_rgba(95,125,102,0.12)]'
                      : 'settings-mode-tab-idle border-[#E6D5C9] bg-[#FFFDF9] hover:border-[#CBB39D] hover:bg-[#FFFAF2]'
                  }`}
                  aria-pressed={settingsPanel === 'auction'}
                >
                  <div className="flex items-center gap-2 text-[1rem] font-extrabold text-[#3F2B20]">
                    <Coins size={18} className={settingsPanel === 'auction' ? 'text-[#476152]' : 'text-[#8A6347]'} />
                    경매
                  </div>
                </button>
              </div>
            </div>

            <div className="settings-body custom-scrollbar flex-1 overflow-y-auto bg-[#FDFBF7] p-4 md:p-6">
              {settingsPanel === 'schedule'
                ? scheduleSettingsPanel
                : settingsPanel === 'subjects'
                  ? subjectSettingsPanel
                  : settingsPanel === 'draw'
                    ? drawSettingsPanel
                    : auctionSettingsPanel}
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
                    className="w-full max-w-[24rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.24)]"
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

              return (
                <div
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2523]/55 px-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-label="낙찰 애니메이션"
                >
                  <div className={`auction-award-stage relative w-full max-w-[52rem] overflow-hidden rounded-[1.6rem] border-2 border-[#9FC7B8] bg-[#FFFDF8] shadow-[0_30px_90px_rgba(31,24,18,0.34)] ${
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
                          style={{ width: `${progressPercent}%` }}
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
                                  className={`auction-award-step-row grid min-h-[3.75rem] grid-cols-[2rem_4.6rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-1.5 transition-all ${
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
                              onClick={() => setAwardPresentation(null)}
                              className="mt-5 inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-[0.9rem] bg-[#006241] px-5 text-[0.95rem] font-extrabold text-white shadow-[0_14px_24px_rgba(0,98,65,0.22)] transition-colors hover:bg-[#005336]"
                            >
                              확인
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
                items: {
                  title: '물품을 초기화할까요?',
                  body: '경매 물품이 월요일부터 금요일까지 각 1개씩 기본값으로 돌아갑니다.',
                  action: '물품 초기화',
                },
                bids: {
                  title: '입찰가를 초기화할까요?',
                  body: '모든 물품의 현재 최고 입찰가, 입찰 기록, 낙찰 결과가 지워집니다.',
                  action: '입찰가 초기화',
                },
                currency: {
                  title: '보유 화폐를 초기화할까요?',
                  body: '모든 학생의 보유 고마가 기본값으로 돌아갑니다.',
                  action: '보유 화폐 초기화',
                },
                tax: {
                  title: '세금을 징수할까요?',
                  body: '모든 학생의 보유 고마가 절반으로 줄어듭니다. 소수점이 생기면 많은 쪽으로 올립니다.',
                  action: '세금 징수',
                },
                allowance: {
                  title: '주급을 제공할까요?',
                  body: '모든 학생에게 100고마씩 지급됩니다.',
                  action: '주급 제공',
                },
              }[pendingAuctionAction];

              return (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
                  role="presentation"
                  onClick={() => setPendingAuctionAction(null)}
                >
                  <div
                    className="w-full max-w-[24rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.24)]"
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
