import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { animate as animateMotion, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import AuctionRoom from '../components/AuctionRoom';
import StudentActionProgress from '../components/student/StudentActionProgress';
import StudentEmotionPage from '../components/student/StudentEmotionPage';
import StudentFailureExhibitionPage from '../components/student/StudentFailureExhibitionPage';
import StudentMissionsPage from '../components/student/StudentMissionsPage';
import StudentMailboxPage from '../components/student/StudentMailboxPage';
import StudentLibraryPage from '../components/student/StudentLibraryPage';
import StudentOverviewPage from '../components/student/StudentOverviewPage';
import StudentStorePage from '../components/student/StudentStorePage';
import StudentSudokuPage from '../components/student/StudentSudokuPage';
import StudentNumberBaseballPage from '../components/student/StudentNumberBaseballPage';
import type { StudentStoreSection } from '../components/student/StudentPlaza';
import {
  AUCTION_BID_STEP,
  AUCTION_ITEM_IDS,
  AUCTION_MISSIONS_STORAGE_KEY,
  DEFAULT_CURRENCY_BALANCE,
  DEFAULT_AUCTION_ITEMS,
  clampAuctionBidAmount,
  formatCurrency,
  getAuctionItemDisplayName,
  getAuctionVisibleDayCount,
  getMinimumAuctionBid,
  getReservedAuctionBidAmount,
  hasAuctionBidAmount,
  normalizeAuctionAwards,
  normalizeAuctionBidHistory,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeAuctionMissions,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  appendCurrencyHistoryEntry,
  claimDailyEmotionRewardInSettings,
  hasDailyEmotionReward,
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionItem,
  type AuctionMission,
  type AuctionBids,
  type CurrencyBalances,
  type CurrencyHistory,
} from '../lib/currency';
import {
  isSupabaseSettingsEnabled,
  donateToClassGoal,
  invalidateSharedSettingsCache,
  loadSharedSettingsRow,
  loadSharedSettingsUpdatedAt,
  updateSharedSettings,
} from '../lib/supabaseSettings';
import {
  createClassDonationThankYouLetter,
  getClassDonationMaximum,
  getClassDonationPublicState,
  isClassDonationCompleted,
  type ClassDonationPublicState,
} from '../lib/classDonation';
import { playAuctionSound, prepareAuctionAudio } from '../lib/auctionAudio';
import {
  createStudentEmotionEntry,
  getStudentEmotionEntries,
  getStudentEmotion,
  getKoreanLocalDateKey,
  getTodayStudentEmotionEntry,
  loadStoredStudentEmotionHistory,
  mergeStudentEmotionHistories,
  normalizeStudentEmotionHistory,
  storeStudentEmotionHistory,
  upsertStudentEmotionEntry,
  type StudentEmotionHistory,
  type StudentEmotionId,
} from '../lib/studentEmotion';
import {
  hasPersonalQuestionSubmission,
  loadQuestionSubmissionStatuses,
} from '../lib/questionSubmissionStatus';
import { useModalFocus } from '../lib/useModalFocus';
import {
  STUDENT_PET_FEED_AMOUNT,
  applyStudentPetPositionOverrides,
  feedStudentPetEgg,
  getStudentPetState,
  loadStoredStudentPetSnapshot,
  moveStudentPet,
  moveGomaCharacter,
  nameStudentPet,
  normalizeStudentPetStates,
  selectStudentPet,
  storeStudentPetPositionOverride,
  storeStudentPetSnapshot,
  type StudentPetState,
  type StudentPetStates,
} from '../lib/studentPet';
import {
  applyStudentEconomyAction,
  getStudentEconomyState,
  loadStoredStudentStockMarket,
  loadStoredStudentShopCatalog,
  normalizeStudentEconomyStates,
  normalizeStudentShopCatalog,
  normalizeStudentStockMarket,
  type StudentEconomyAction,
  type StudentEconomyStates,
  type StudentShopCatalogItem,
  type StudentStockMarket,
} from '../lib/studentEconomy';
import { updateStudentEconomy } from '../lib/studentEconomyClient';
import { createBrowserRequestId } from '../lib/requestId';
import { createBookStackMissionEntry } from '../lib/bookStackMission';
import {
  loadStoredClassroomRoleMissionSettings,
  normalizeClassroomRoleMissionSettings,
  type ClassroomRoleMissionSettings,
} from '../lib/classroomRoleMission';
import {
  createWeeklyMissionStatuses,
  BOOK_STACK_WEEKLY_MISSION_TYPE,
  FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  getKoreanIsoWeekKey,
  hasWeeklyMissionReward,
  syncWeeklyMissions,
  WEEKLY_MISSION_TYPES,
  type WeeklyMissionStatuses,
} from '../lib/weeklyMission';
import {
  loadStudentSettingsSnapshot,
  shouldLoadFullStudentSettings,
  storeStudentSettingsSnapshot,
  STUDENT_FOREGROUND_SYNC_COOLDOWN_MS,
  STUDENT_SETTINGS_SYNC_INTERVAL_MS,
} from '../lib/studentSettingsSync';
import {
  createStudentLetter,
  getStudentBooks,
  getStudentLetters,
  getStudentSentLetters,
  getUnreadStudentLetterCount,
  loadStoredStudentLifeState,
  markStudentLetterRead,
  normalizeStudentLifeState,
  storeStudentLifeState,
  updateStoredStudentLifeState,
  type StudentLifeState,
} from '../lib/studentLife';
import {
  getFailureStoriesNewestFirst,
  selectFailureProfile,
  toggleFailureStamp,
  type FailureStampId,
} from '../lib/failureExhibition';
import { createFailureExhibitionMissionEntry } from '../lib/failureExhibitionMission';
import { createBankMailboxLetters } from '../lib/bankMailbox';
import { useStudentSudokuState } from '../lib/useStudentSudokuState';
import { useStudentNumberBaseballState } from '../lib/useStudentNumberBaseballState';
import { createNumberBaseballProgressEntry } from '../lib/numberBaseball';
import type { SudokuDifficulty } from '../lib/sudoku';
import {
  hasDailyWritingLetterForDate,
  hasDailyWritingReward,
  loadStoredDailyWritingState,
  normalizeDailyWritingState,
  type DailyWritingState,
} from '../lib/dailyWriting';

interface AuctionPageProps {
  studentNumber: number;
}

type StudentView = 'overview' | 'emotions' | 'missions' | 'sudoku' | 'number-baseball' | 'mailbox' | 'library' | 'library-bookstore' | 'library-bookshelf' | 'store' | 'store-bank' | 'store-shop' | 'store-auction' | 'store-securities' | 'store-securities-trade' | 'store-donation';

type SharedSettingsValue = {
  currencyBalances?: unknown;
  auctionBids?: unknown;
  auctionItems?: unknown;
  auctionBidHistory?: unknown;
  auctionAwards?: unknown;
  auctionMissions?: unknown;
  classroomRoleMission?: unknown;
  currencyHistory?: unknown;
  classDonation?: unknown;
  studentEmotionHistory?: unknown;
  studentPets?: unknown;
  studentEconomy?: unknown;
  studentShopCatalog?: unknown;
  studentStockMarket?: unknown;
  studentLife?: unknown;
  dailyWriting?: unknown;
  studentSudoku?: unknown;
  studentNumberBaseball?: unknown;
};

const STUDENT_VIEW_HASHES: Record<StudentView, string> = {
  overview: '#student-overview',
  emotions: '#student-emotions',
  missions: '#student-missions',
  sudoku: '#student-sudoku',
  'number-baseball': '#student-number-baseball',
  mailbox: '#student-mailbox',
  library: '#student-library',
  'library-bookstore': '#student-library-bookstore',
  'library-bookshelf': '#student-library-bookshelf',
  store: '#student-store',
  'store-bank': '#student-store-bank',
  'store-shop': '#student-store-shop',
  'store-auction': '#student-store-auction',
  'store-securities': '#student-store-securities',
  'store-securities-trade': '#student-store-securities-trade',
  'store-donation': '#student-store-donation',
};

const STORE_VIEW_BY_SECTION: Record<StudentStoreSection, StudentView> = {
  plaza: 'store',
  bank: 'store-bank',
  shop: 'store-shop',
  auction: 'store-auction',
  securities: 'store-securities',
  'securities-trade': 'store-securities-trade',
  donation: 'store-donation',
};

const getStoreSection = (view: StudentView): StudentStoreSection => (
  Object.entries(STORE_VIEW_BY_SECTION).find(([, storeView]) => storeView === view)?.[0] as StudentStoreSection | undefined
) ?? 'plaza';

const isStudentStoreView = (view: StudentView) => view === 'store' || view.startsWith('store-');

const getStudentViewFromHash = (): StudentView => {
  const matchedView = Object.entries(STUDENT_VIEW_HASHES).find(([, hash]) => hash === window.location.hash)?.[0];
  return matchedView && matchedView in STUDENT_VIEW_HASHES ? matchedView as StudentView : 'overview';
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

const getInitialAuctionMissions = (): AuctionMission[] => (
  isSupabaseSettingsEnabled ? [] : getStoredAuctionMissions()
);

const getInitialSelectedAuctionItemId = () => {
  const visibleDayCount = getAuctionVisibleDayCount();
  const currentDayIndex = Math.max(0, visibleDayCount - 1);
  return DEFAULT_AUCTION_ITEMS.find((item) => item.dayIndex === currentDayIndex)?.id
    ?? DEFAULT_AUCTION_ITEMS[0]?.id
    ?? '';
};

export default function AuctionPage({ studentNumber }: AuctionPageProps) {
  const shouldReduceMotion = useReducedMotion();
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => (
    isSupabaseSettingsEnabled
      ? normalizeCurrencyBalances(null)
      : loadStoredStudentPetSnapshot().currencyBalances
  ));
  const [currencyHistory, setCurrencyHistory] = useState<CurrencyHistory>(() => (
    isSupabaseSettingsEnabled
      ? normalizeCurrencyHistory(null)
      : loadStoredStudentPetSnapshot().currencyHistory
  ));
  const {
    studentSudokuProgress,
    hasCompletedWeeklySudokuMission,
    activeSudokuDifficulty,
    completedSudokuDifficulty,
    saveSudokuProgress,
    startSudoku,
    completeSudoku,
    applySharedStudentSudoku,
    refreshLocalStudentSudoku,
  } = useStudentSudokuState({
    studentNumber,
    currencyHistory,
    onCurrencyBalancesChange: setCurrencyBalances,
    onCurrencyHistoryChange: setCurrencyHistory,
  });
  const {
    progressEntry: numberBaseballEntry,
    status: numberBaseballStatus,
    hasReward: hasNumberBaseballReward,
    weekKey: numberBaseballWeekKey,
    gameId: numberBaseballGameId,
    startGame: startNumberBaseball,
    saveProgress: saveNumberBaseballProgress,
    completeGame: completeNumberBaseball,
    applySharedProgress: applySharedNumberBaseball,
    refreshLocalProgress: refreshLocalNumberBaseball,
  } = useStudentNumberBaseballState({
    studentNumber,
    currencyHistory,
    onCurrencyBalancesChange: setCurrencyBalances,
    onCurrencyHistoryChange: setCurrencyHistory,
  });
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [auctionBidHistory, setAuctionBidHistory] = useState<AuctionBidHistory>(() => normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
  const [auctionAwards, setAuctionAwards] = useState<AuctionAwards>(() => normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
  const [auctionMissions, setAuctionMissions] = useState<AuctionMission[]>(getInitialAuctionMissions);
  const [classroomRoleMission, setClassroomRoleMission] = useState<ClassroomRoleMissionSettings>(
    loadStoredClassroomRoleMissionSettings,
  );
  const [classDonation, setClassDonation] = useState<ClassDonationPublicState>(() => getClassDonationPublicState(null));
  const [studentEmotionHistory, setStudentEmotionHistory] = useState<StudentEmotionHistory>(
    loadStoredStudentEmotionHistory,
  );
  const [studentPetStates, setStudentPetStates] = useState<StudentPetStates>(() => (
    isSupabaseSettingsEnabled
      ? applyStudentPetPositionOverrides({ [String(studentNumber)]: getStudentPetState({}, studentNumber) })
      : loadStoredStudentPetSnapshot().studentPets
  ));
  const [studentEconomyStates, setStudentEconomyStates] = useState<StudentEconomyStates>(() => (
    isSupabaseSettingsEnabled ? {} : loadStoredStudentPetSnapshot().studentEconomy
  ));
  const [studentShopCatalog, setStudentShopCatalog] = useState<StudentShopCatalogItem[]>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentShopCatalog(undefined) : loadStoredStudentShopCatalog()
  ));
  const [studentStockMarket, setStudentStockMarket] = useState<StudentStockMarket>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentStockMarket(undefined) : loadStoredStudentStockMarket()
  ));
  const [studentLife, setStudentLife] = useState<StudentLifeState>(() => (
    isSupabaseSettingsEnabled ? normalizeStudentLifeState(null) : loadStoredStudentLifeState()
  ));
  const [dailyWriting, setDailyWriting] = useState<DailyWritingState>(() => (
    isSupabaseSettingsEnabled ? normalizeDailyWritingState(null) : loadStoredDailyWritingState()
  ));
  const [isStudentLifeSaving, setIsStudentLifeSaving] = useState(false);
  const [isPetSaving, setIsPetSaving] = useState(false);
  const [isEconomySaving, setIsEconomySaving] = useState(false);
  const isEconomySavingRef = useRef(false);
  const studentPetStatesRef = useRef(studentPetStates);
  const petPositionSaveQueueRef = useRef(Promise.resolve());
  const [isEmotionSaving, setIsEmotionSaving] = useState(false);
  const [weeklyMissionStatuses, setWeeklyMissionStatuses] = useState<WeeklyMissionStatuses>(() => (
    createWeeklyMissionStatuses('loading')
  ));
  const [hasWeeklyMissionSyncError, setHasWeeklyMissionSyncError] = useState(false);
  const [activeStudentView, setActiveStudentView] = useState<StudentView>('overview');
  const [sudokuDifficulty, setSudokuDifficulty] = useState<SudokuDifficulty>(activeSudokuDifficulty ?? 'basic');

  useEffect(() => {
    studentPetStatesRef.current = studentPetStates;
  }, [studentPetStates]);

  useEffect(() => {
    if (activeSudokuDifficulty) setSudokuDifficulty(activeSudokuDifficulty);
  }, [activeSudokuDifficulty]);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [bidAmountDrafts, setBidAmountDrafts] = useState<Record<string, string>>({});
  const [selectedItemId, setSelectedItemId] = useState(getInitialSelectedAuctionItemId);
  const [isLoading, setIsLoading] = useState(isSupabaseSettingsEnabled);
  const [isSubmittingItemId, setIsSubmittingItemId] = useState<string | null>(null);
  const [pendingBid, setPendingBid] = useState<{ itemId: string; amount: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [donationAmountDraft, setDonationAmountDraft] = useState('1');
  const [isDonating, setIsDonating] = useState(false);
  const [donationError, setDonationError] = useState('');
  const [activeModal, setActiveModal] = useState<'bid' | 'status' | null>(null);
  const [renderedPendingBid, setRenderedPendingBid] = useState<{ itemId: string; amount: number } | null>(null);
  const [renderedStatusMessage, setRenderedStatusMessage] = useState('');
  const bidMaterialProgress = useMotionValue(0);
  const bidMaterialScale = useTransform(bidMaterialProgress, [0, 1], [0.965, 1]);
  const bidMaterialFilter = useTransform(bidMaterialProgress, (progress) => `blur(${(1 - progress) * 10}px) saturate(${0.92 + progress * 0.08})`);
  const statusMaterialProgress = useMotionValue(0);
  const statusMaterialScale = useTransform(statusMaterialProgress, [0, 1], [0.965, 1]);
  const statusMaterialFilter = useTransform(statusMaterialProgress, (progress) => `blur(${(1 - progress) * 10}px) saturate(${0.92 + progress * 0.08})`);
  const pendingBidStateRef = useRef(pendingBid);
  const statusMessageStateRef = useRef(statusMessage);
  pendingBidStateRef.current = pendingBid;
  statusMessageStateRef.current = statusMessage;
  const bidDialogRef = useRef<HTMLDivElement>(null);
  const [bidDialogElement, setBidDialogElement] = useState<HTMLDivElement | null>(null);
  const setBidDialogNode = useCallback((node: HTMLDivElement | null) => {
    bidDialogRef.current = node;
    setBidDialogElement(node);
  }, []);
  const bidTriggerRef = useRef<HTMLButtonElement>(null);
  const statusDialogRef = useRef<HTMLDivElement>(null);
  const [statusDialogElement, setStatusDialogElement] = useState<HTMLDivElement | null>(null);
  const setStatusDialogNode = useCallback((node: HTMLDivElement | null) => {
    statusDialogRef.current = node;
    setStatusDialogElement(node);
  }, []);
  const statusReturnFocusRef = useRef<HTMLElement>(null);
  const donationDialogRef = useRef<HTMLDivElement>(null);
  const donationTriggerRef = useRef<HTMLButtonElement>(null);
  const donationRequestIdRef = useRef('');
  const shouldReturnStatusFocusRef = useRef(false);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const sharedSettingsUpdatedAtRef = useRef<string | null>(null);
  const isSharedSettingsRefreshInFlightRef = useRef(false);
  const pendingFullSettingsRefreshRef = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, '', STUDENT_VIEW_HASHES.overview);

    const syncViewFromHistory = () => {
      setActiveStudentView(getStudentViewFromHash());
      pageScrollRef.current?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', syncViewFromHistory);
    window.addEventListener('popstate', syncViewFromHistory);
    return () => {
      window.removeEventListener('hashchange', syncViewFromHistory);
      window.removeEventListener('popstate', syncViewFromHistory);
    };
  }, []);

  const navigateStudentView = useCallback((view: StudentView) => {
    const targetHash = STUDENT_VIEW_HASHES[view];
    setActiveStudentView(view);
    pageScrollRef.current?.scrollTo({ top: 0 });
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
  }, []);

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeStudentView]);

  const focusAuctionReturnTarget = useCallback(() => {
    const storedTarget = statusReturnFocusRef.current;
    const bidTarget = document.getElementById('auction-bid-trigger');
    const bidTargetCanFocus = bidTarget?.isConnected
      && !bidTarget.matches(':disabled, [aria-disabled="true"]');
    const amountTarget = document.getElementById('auction-bid-amount-input');
    const returnTarget = bidTargetCanFocus
      ? bidTarget
      : amountTarget?.isConnected
        ? amountTarget
        : storedTarget;
    if (returnTarget?.isConnected && !returnTarget.matches(':disabled, [aria-disabled="true"]')) {
      returnTarget.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (pendingBid) {
      setRenderedPendingBid(pendingBid);
      if (activeModal === null || activeModal === 'bid') setActiveModal('bid');
      return;
    }
    if (activeModal === null && statusMessage) {
      setRenderedStatusMessage(statusMessage);
      setActiveModal('status');
    }
  }, [activeModal, pendingBid, statusMessage]);

  useEffect(() => {
    if (activeModal !== 'bid' || !renderedPendingBid) return;
    const target = pendingBid ? 1 : 0;
    const controls = animateMotion(bidMaterialProgress, target, {
      duration: shouldReduceMotion ? 0.16 : 0.34,
      ease: shouldReduceMotion ? 'easeOut' : [0.2, 0.8, 0.2, 1],
      onComplete: () => {
        if (target !== 0 || pendingBidStateRef.current) return;
        setRenderedPendingBid(null);
        if (statusMessageStateRef.current) {
          setRenderedStatusMessage(statusMessageStateRef.current);
          setActiveModal('status');
        } else {
          setActiveModal(null);
          window.requestAnimationFrame(focusAuctionReturnTarget);
        }
      },
    });
    return () => controls.stop();
  }, [activeModal, bidMaterialProgress, focusAuctionReturnTarget, pendingBid, renderedPendingBid, shouldReduceMotion]);

  useEffect(() => {
    if (activeModal !== 'status' || !renderedStatusMessage) return;
    const target = statusMessage ? 1 : 0;
    const controls = animateMotion(statusMaterialProgress, target, {
      duration: shouldReduceMotion ? 0.16 : 0.34,
      ease: shouldReduceMotion ? 'easeOut' : [0.2, 0.8, 0.2, 1],
      onComplete: () => {
        if (target !== 0 || statusMessageStateRef.current) return;
        setRenderedStatusMessage('');
        setActiveModal(null);
        shouldReturnStatusFocusRef.current = false;
        window.requestAnimationFrame(focusAuctionReturnTarget);
      },
    });
    return () => controls.stop();
  }, [activeModal, focusAuctionReturnTarget, renderedStatusMessage, shouldReduceMotion, statusMaterialProgress, statusMessage]);

  const showStatusMessage = (message: string) => {
    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    statusReturnFocusRef.current = activeElement && !bidDialogRef.current?.contains(activeElement)
      ? activeElement
      : bidTriggerRef.current;
    if (bidDialogRef.current) {
      setPendingBid(null);
      window.requestAnimationFrame(() => setStatusMessage(message));
      return;
    }
    setRenderedStatusMessage(message);
    setActiveModal('status');
    setStatusMessage(message);
  };

  const dismissStatusMessage = () => {
    shouldReturnStatusFocusRef.current = true;
    setStatusMessage('');
  };

  useModalFocus({
    dialogRef: bidDialogRef,
    isOpen: activeModal === 'bid' && bidDialogElement !== null,
    onDismiss: () => {
      if (!isSubmittingItemId) setPendingBid(null);
    },
    isDismissible: isSubmittingItemId === null,
    returnFocusRef: bidTriggerRef,
  });

  useModalFocus({
    dialogRef: donationDialogRef,
    isOpen: isDonationOpen,
    onDismiss: () => {
      if (!isDonating) setIsDonationOpen(false);
    },
    isDismissible: !isDonating,
    returnFocusRef: donationTriggerRef,
  });

  useModalFocus({
    dialogRef: statusDialogRef,
    isOpen: activeModal === 'status' && statusDialogElement !== null,
    onDismiss: dismissStatusMessage,
    returnFocusRef: statusReturnFocusRef,
  });

  const studentKey = String(studentNumber);
  const currentDateKey = getKoreanLocalDateKey();
  const studentLetters = getStudentLetters(studentLife, studentNumber, currentDateKey);
  const studentPet = getStudentPetState(studentPetStates, studentNumber);
  const todayEmotionEntry = getTodayStudentEmotionEntry(studentEmotionHistory, studentNumber);
  const studentEmotionEntries = getStudentEmotionEntries(studentEmotionHistory, studentNumber);
  const todayEmotion = getStudentEmotion(todayEmotionEntry?.emotionId);
  const hasCompletedDailyEmotionMission = todayEmotionEntry !== null
    && hasDailyEmotionReward(currencyHistory, studentNumber, todayEmotionEntry.dateKey);
  const hasCurrentDailyWritingMission = dailyWriting.assignment?.dateKey === currentDateKey
    || hasDailyWritingLetterForDate(studentLetters, currentDateKey);
  const hasCompletedDailyWritingMission = hasCurrentDailyWritingMission
    && hasDailyWritingReward(currencyHistory, studentNumber, currentDateKey);
  const balance = currencyBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
  const activeAuctionItemIds = auctionItems.map((item) => item.id);
  const reservedAmount = getReservedAuctionBidAmount(
    auctionBids,
    studentNumber,
    undefined,
    auctionAwards,
    activeAuctionItemIds,
  );
  const availableBalance = Math.max(0, balance - reservedAmount);
  const activeStoreSection = getStoreSection(activeStudentView);
  const studentEconomy = getStudentEconomyState(studentEconomyStates, studentNumber);
  const maximumDonation = getClassDonationMaximum(classDonation, availableBalance);
  const hasCompletedClassDonation = isClassDonationCompleted(classDonation);
  const shouldShowClassDonation = classDonation.enabled || hasCompletedClassDonation;
  const donationAmount = Math.floor(Number(donationAmountDraft));
  const isDonationAmountValid = Number.isInteger(donationAmount)
    && donationAmount >= 1
    && donationAmount <= maximumDonation;
  const visibleDayCount = getAuctionVisibleDayCount();
  const firstVisibleItem = auctionItems.find((item) => item.dayIndex < visibleDayCount) ?? null;
  const studentSentLetters = getStudentSentLetters(studentLife, studentNumber);
  const studentBooks = getStudentBooks(studentLife, studentNumber);
  const failureStories = getFailureStoriesNewestFirst(studentLife.failureStories);
  const profileAssignments = studentLife.failureProfileAssignments;
  const unreadLetterCount = getUnreadStudentLetterCount(studentLife, studentNumber, currentDateKey);

  const saveStudentLifeChange = async (change: (current: StudentLifeState) => StudentLifeState) => {
    if (isStudentLifeSaving) return false;
    setIsStudentLifeSaving(true);
    try {
      let saved = studentLife;
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object' ? currentValue as Record<string, unknown> : {};
          saved = change(normalizeStudentLifeState(current.studentLife));
          return { ...current, studentLife: saved };
        });
      } else {
        saved = await updateStoredStudentLifeState(change);
      }
      setStudentLife(saved);
      return true;
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    } finally {
      setIsStudentLifeSaving(false);
    }
  };

  const sendStudentLetter = (recipient: number, title: string, content: string, replyToId?: string) => saveStudentLifeChange((current) => createStudentLetter(current, {
    id: createBrowserRequestId(), recipient, senderLabel: `${studentNumber}번`, senderStudentNumber: studentNumber, replyToId, title, content, createdAt: new Date().toISOString(),
  }));

  const readStudentLetter = async (letterId: string) => {
    await saveStudentLifeChange((current) => markStudentLetterRead(current, studentNumber, letterId, new Date().toISOString()));
  };

  const addStudentBookEntry = async (title: string, author: string, pageCount: number) => {
    if (isStudentLifeSaving) return false;
    setIsStudentLifeSaving(true);
    try {
      const input = {
        id: createBrowserRequestId(),
        studentNumber,
        title,
        author,
        pageCount,
        createdAt: new Date().toISOString(),
      };
      let result = createBookStackMissionEntry({
        currencyBalances,
        currencyHistory,
        studentLife,
      }, input);

      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          result = createBookStackMissionEntry(currentValue, input);
          return result.value;
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        result = createBookStackMissionEntry({
          ...snapshot,
          studentLife: loadStoredStudentLifeState(),
        }, input);
        if (!result.applied) return false;
        storeStudentLifeState(result.studentLife);
        if (!storeStudentPetSnapshot({
          ...snapshot,
          currencyBalances: result.balances,
          currencyHistory: result.history,
        })) return false;
      }

      if (!result.applied) return false;
      setStudentLife(result.studentLife);
      setCurrencyBalances(result.balances);
      setCurrencyHistory(result.history);
      return true;
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    } finally {
      setIsStudentLifeSaving(false);
    }
  };

  const createStudentFailureStory = async (failure: string, lesson: string) => {
    if (isStudentLifeSaving) return false;
    setIsStudentLifeSaving(true);
    try {
      const input = {
        id: createBrowserRequestId(),
        studentNumber,
        failure,
        lesson,
        createdAt: new Date().toISOString(),
      };
      let result = createFailureExhibitionMissionEntry({
        currencyBalances,
        currencyHistory,
        studentLife,
      }, input);

      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          result = createFailureExhibitionMissionEntry(currentValue, input);
          return result.value;
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        result = createFailureExhibitionMissionEntry({
          ...snapshot,
          studentLife: loadStoredStudentLifeState(),
        }, input);
        if (!result.applied) return false;
        storeStudentLifeState(result.studentLife);
        if (!storeStudentPetSnapshot({
          ...snapshot,
          currencyBalances: result.balances,
          currencyHistory: result.history,
        })) return false;
      }

      if (!result.applied) return false;
      setStudentLife(result.studentLife);
      setCurrencyBalances(result.balances);
      setCurrencyHistory(result.history);
      return true;
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    } finally {
      setIsStudentLifeSaving(false);
    }
  };

  const stampStudentFailureStory = (storyId: string, stampId: FailureStampId) => saveStudentLifeChange((current) => ({
    ...current,
    failureStories: toggleFailureStamp(current.failureStories, storyId, studentNumber, stampId),
  }));

  const selectStudentFailureProfile = async (profileImage: string) => {
    const selection = {
      reason: 'invalid_profile' as ReturnType<typeof selectFailureProfile>['reason'],
    };
    const saved = await saveStudentLifeChange((current) => {
      const result = selectFailureProfile(
        current.failureProfileAssignments,
        studentNumber,
        profileImage,
      );
      selection.reason = result.reason;
      return result.applied
        ? { ...current, failureProfileAssignments: result.assignments }
        : current;
    });

    if (!saved) {
      showStatusMessage('프로필을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    }
    if (selection.reason === 'profile_in_use') {
      showStatusMessage('다른 학생이 사용 중인 프로필입니다.');
      return false;
    }
    if (selection.reason !== 'selected') {
      showStatusMessage('이미 사용 중인 프로필입니다.');
      return false;
    }
    showStatusMessage('프로필을 바꿨습니다.');
    return true;
  };

  const feedStudentPet = async () => {
    if (isPetSaving) return false;
    setIsPetSaving(true);
    try {
      let savedPet = studentPet;
      let savedBalances = currencyBalances;

      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          const currentBalances = normalizeCurrencyBalances(current.currencyBalances);
          const currentHistory = normalizeCurrencyHistory(current.currencyHistory);
          const currentPets = normalizeStudentPetStates(current.studentPets);
          const currentPet = getStudentPetState(currentPets, studentNumber);
          const currentBids = normalizeAuctionBids(current.auctionBids, AUCTION_ITEM_IDS);
          const currentAwards = normalizeAuctionAwards(current.auctionAwards, AUCTION_ITEM_IDS);
          const latestBalance = currentBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
          const latestReserved = getReservedAuctionBidAmount(
            currentBids,
            studentNumber,
            undefined,
            currentAwards,
            activeAuctionItemIds,
          );
          if (latestBalance - latestReserved < STUDENT_PET_FEED_AMOUNT) throw new Error('INSUFFICIENT_FUNDS');

          const nextBalance = latestBalance - STUDENT_PET_FEED_AMOUNT;
          savedPet = feedStudentPetEgg(currentPet);
          savedBalances = { ...currentBalances, [studentKey]: nextBalance };
          return {
            ...current,
            currencyBalances: savedBalances,
            currencyHistory: appendCurrencyHistoryEntry(currentHistory, {
              studentNumber,
              before: latestBalance,
              after: nextBalance,
              reason: 'pet_feed',
            }),
            studentPets: { ...currentPets, [studentKey]: savedPet },
          };
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        const currentPet = getStudentPetState(snapshot.studentPets, studentNumber);
        const latestBalance = snapshot.currencyBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
        if (latestBalance - reservedAmount < STUDENT_PET_FEED_AMOUNT) return false;
        const nextBalance = latestBalance - STUDENT_PET_FEED_AMOUNT;
        savedPet = feedStudentPetEgg(currentPet);
        savedBalances = { ...snapshot.currencyBalances, [studentKey]: nextBalance };
        const stored = storeStudentPetSnapshot({
          studentPets: { ...snapshot.studentPets, [studentKey]: savedPet },
          currencyBalances: savedBalances,
          currencyHistory: appendCurrencyHistoryEntry(snapshot.currencyHistory, {
            studentNumber,
            before: latestBalance,
            after: nextBalance,
            reason: 'pet_feed',
          }),
          studentEconomy: snapshot.studentEconomy,
        });
        if (!stored) return false;
      }

      setCurrencyBalances(savedBalances);
      setStudentPetStates((previous) => ({ ...previous, [studentKey]: savedPet }));
      return true;
    } catch (error) {
      console.error('Failed to feed student pet.', error);
      await refreshAuctionState();
      return false;
    } finally {
      setIsPetSaving(false);
    }
  };

  const saveStudentPet = async (updatePet: (currentPet: StudentPetState) => StudentPetState | null) => {
    if (isPetSaving) return false;
    setIsPetSaving(true);
    try {
      let savedPets = studentPetStates;
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          const currentPets = normalizeStudentPetStates(current.studentPets);
          const currentPet = getStudentPetState(currentPets, studentNumber);
          const nextPet = updatePet(currentPet);
          if (!nextPet) throw new Error('PET_UPDATE_REJECTED');
          savedPets = normalizeStudentPetStates({
            ...currentPets,
            [studentKey]: nextPet,
          });
          return { ...current, studentPets: savedPets };
        });
      } else {
        const snapshot = loadStoredStudentPetSnapshot();
        const currentPet = getStudentPetState(snapshot.studentPets, studentNumber);
        const nextPet = updatePet(currentPet);
        if (!nextPet) return false;
        savedPets = normalizeStudentPetStates({
          ...snapshot.studentPets,
          [studentKey]: nextPet,
        });
        if (!storeStudentPetSnapshot({ ...snapshot, studentPets: savedPets })) return false;
      }
      setStudentPetStates(savedPets);
      return true;
    } catch (error) {
      console.error('Failed to save student pet.', error);
      return false;
    } finally {
      setIsPetSaving(false);
    }
  };

  const nameCurrentStudentPet = (name: string) => saveStudentPet((currentPet) => nameStudentPet(currentPet, name));

  const changeStudentPet = (petId: string) => saveStudentPet((currentPet) => selectStudentPet(currentPet, petId));

  const saveStudentPetPosition = (
    target: 'pet' | 'goma',
    position: StudentPetState['position'],
  ) => {
    const currentPet = getStudentPetState(studentPetStatesRef.current, studentNumber);
    const nextPet = target === 'pet'
      ? moveStudentPet(currentPet, position)
      : moveGomaCharacter(currentPet, position);
    if (!nextPet) return Promise.resolve(false);

    const nextPets = normalizeStudentPetStates({
      ...studentPetStatesRef.current,
      [studentKey]: nextPet,
    });
    studentPetStatesRef.current = nextPets;
    setStudentPetStates(nextPets);

    if (!isSupabaseSettingsEnabled) {
      const snapshot = loadStoredStudentPetSnapshot();
      return Promise.resolve(storeStudentPetSnapshot({ ...snapshot, studentPets: nextPets }));
    }

    storeStudentPetPositionOverride(studentNumber, nextPet);
    const scheduledSave = petPositionSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          const currentPets = normalizeStudentPetStates(current.studentPets);
          const currentPetAtSave = getStudentPetState(currentPets, studentNumber);
          const savedPet = target === 'pet'
            ? moveStudentPet(currentPetAtSave, position)
            : moveGomaCharacter(currentPetAtSave, position);
          if (!savedPet) throw new Error('PET_POSITION_UPDATE_REJECTED');
          return {
            ...current,
            studentPets: normalizeStudentPetStates({ ...currentPets, [studentKey]: savedPet }),
          };
        });
      });
    petPositionSaveQueueRef.current = scheduledSave;
    void scheduledSave.catch((error) => {
      console.error('Failed to save student pet position.', error);
    });
    return Promise.resolve(true);
  };

  const moveCurrentStudentPet = (position: StudentPetState['position']) => (
    saveStudentPetPosition('pet', position)
  );

  const moveCurrentGomaCharacter = (position: StudentPetState['gomaPosition']) => (
    saveStudentPetPosition('goma', position)
  );

  const saveStudentEmotion = useCallback(async (emotionId: StudentEmotionId, comment: string) => {
    if (isEmotionSaving) return false;
    setIsEmotionSaving(true);
    try {
      const entry = createStudentEmotionEntry(studentNumber, emotionId, comment, new Date(), todayEmotionEntry);
      let savedHistory: StudentEmotionHistory = {};
      let savedCurrencyHistory: CurrencyHistory = currencyHistory;
      let savedBalances = currencyBalances;
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const current = currentValue && typeof currentValue === 'object'
            ? currentValue as Record<string, unknown>
            : {};
          savedHistory = upsertStudentEmotionEntry(
            mergeStudentEmotionHistories(current.studentEmotionHistory, studentEmotionHistory),
            entry,
          );
          const reward = claimDailyEmotionRewardInSettings(
            { ...current, studentEmotionHistory: savedHistory },
            studentNumber,
            entry.dateKey,
            entry.updatedAt,
          );
          savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
          savedCurrencyHistory = reward.history;
          return reward.value;
        });
      } else {
        savedHistory = upsertStudentEmotionEntry(studentEmotionHistory, entry);
        if (!storeStudentEmotionHistory(savedHistory)) return false;
        const snapshot = loadStoredStudentPetSnapshot();
        const reward = claimDailyEmotionRewardInSettings(snapshot, studentNumber, entry.dateKey, entry.updatedAt);
        savedBalances = normalizeCurrencyBalances(reward.value.currencyBalances);
        savedCurrencyHistory = reward.history;
        if (reward.awarded && !storeStudentPetSnapshot({
          ...snapshot,
          currencyBalances: savedBalances,
          currencyHistory: savedCurrencyHistory,
        })) return false;
      }
      setStudentEmotionHistory(savedHistory);
      setCurrencyBalances(savedBalances);
      setCurrencyHistory(savedCurrencyHistory);
      return true;
    } catch (error) {
      console.error('Failed to save student emotion.', error);
      return false;
    } finally {
      setIsEmotionSaving(false);
    }
  }, [currencyBalances, currencyHistory, isEmotionSaving, studentEmotionHistory, studentNumber, todayEmotionEntry]);

  const selectedItem = useMemo(
    () => {
      const selectedIndex = auctionItems.findIndex((item) => item.id === selectedItemId);
      const selectedAuctionItem = selectedIndex >= 0 ? auctionItems[selectedIndex] : null;
      if (selectedAuctionItem && selectedAuctionItem.dayIndex < visibleDayCount) return selectedAuctionItem;
      return firstVisibleItem;
    },
    [auctionItems, firstVisibleItem, selectedItemId, visibleDayCount],
  );

  const applySharedSettingsValue = useCallback((value: SharedSettingsValue) => {
    setCurrencyBalances(normalizeCurrencyBalances(value.currencyBalances));
    setCurrencyHistory(normalizeCurrencyHistory(value.currencyHistory));
    setAuctionItems(normalizeAuctionItems(value.auctionItems));
    setAuctionBids(normalizeAuctionBids(value.auctionBids, AUCTION_ITEM_IDS));
    setAuctionBidHistory(normalizeAuctionBidHistory(value.auctionBidHistory, AUCTION_ITEM_IDS));
    setAuctionAwards(normalizeAuctionAwards(value.auctionAwards, AUCTION_ITEM_IDS));
    setAuctionMissions(normalizeAuctionMissions(value.auctionMissions));
    setClassroomRoleMission(normalizeClassroomRoleMissionSettings(value.classroomRoleMission));
    setClassDonation(getClassDonationPublicState(value.classDonation));
    setStudentEmotionHistory(normalizeStudentEmotionHistory(value.studentEmotionHistory));
    const normalizedPetStates = applyStudentPetPositionOverrides(value.studentPets);
    studentPetStatesRef.current = normalizedPetStates;
    setStudentPetStates(normalizedPetStates);
    setStudentEconomyStates(normalizeStudentEconomyStates(value.studentEconomy));
    setStudentShopCatalog(normalizeStudentShopCatalog(value.studentShopCatalog));
    setStudentStockMarket(normalizeStudentStockMarket(value.studentStockMarket));
    setStudentLife(normalizeStudentLifeState(value.studentLife));
    setDailyWriting(normalizeDailyWritingState(value.dailyWriting));
    applySharedStudentSudoku(value);
    applySharedNumberBaseball(value);
    const weekKey = getKoreanIsoWeekKey();
    setWeeklyMissionStatuses((previous) => WEEKLY_MISSION_TYPES.reduce<WeeklyMissionStatuses>(
      (statuses, missionType) => ({
        ...statuses,
        [missionType]: hasWeeklyMissionReward(value.currencyHistory, studentNumber, weekKey, missionType)
          ? 'completed'
          : previous[missionType],
      }),
      previous,
    ));
  }, [applySharedNumberBaseball, applySharedStudentSudoku, studentNumber]);

  const refreshAuctionState = useCallback(async ({ forceFull = false }: { forceFull?: boolean } = {}) => {
    if (!isSupabaseSettingsEnabled) {
      const localPetSnapshot = loadStoredStudentPetSnapshot();
      setCurrencyBalances(localPetSnapshot.currencyBalances);
      setCurrencyHistory(localPetSnapshot.currencyHistory);
      setAuctionItems(normalizeAuctionItems(null));
      setAuctionBids(normalizeAuctionBids(null, AUCTION_ITEM_IDS));
      setAuctionBidHistory(normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
      setAuctionAwards(normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
      setAuctionMissions(getStoredAuctionMissions());
      setClassroomRoleMission(loadStoredClassroomRoleMissionSettings());
      setClassDonation(getClassDonationPublicState(null));
      setStudentEmotionHistory(loadStoredStudentEmotionHistory());
      setStudentPetStates(localPetSnapshot.studentPets);
      setStudentEconomyStates(localPetSnapshot.studentEconomy);
      setStudentShopCatalog(loadStoredStudentShopCatalog());
      setStudentLife(loadStoredStudentLifeState());
      setDailyWriting(loadStoredDailyWritingState());
      refreshLocalStudentSudoku();
      refreshLocalNumberBaseball();
      setIsLoading(false);
      return;
    }

    if (isSharedSettingsRefreshInFlightRef.current) {
      if (forceFull) pendingFullSettingsRefreshRef.current = true;
      return;
    }
    isSharedSettingsRefreshInFlightRef.current = true;

    try {
      let shouldForceFull = forceFull;
      do {
        pendingFullSettingsRefreshRef.current = false;
        try {
          let shouldLoadFull = shouldForceFull || sharedSettingsUpdatedAtRef.current === null;
          if (!shouldLoadFull) {
            const updatedAt = await loadSharedSettingsUpdatedAt();
            shouldLoadFull = shouldLoadFullStudentSettings(sharedSettingsUpdatedAtRef.current, updatedAt);
          }

          if (shouldLoadFull) {
            const row = await loadSharedSettingsRow();
            const value = row?.value && typeof row.value === 'object'
              ? row.value as SharedSettingsValue
              : {};
            applySharedSettingsValue(value);
            sharedSettingsUpdatedAtRef.current = row?.updated_at ?? null;
            if (row?.updated_at && row.value && typeof row.value === 'object') {
              storeStudentSettingsSnapshot({ studentNumber, updatedAt: row.updated_at, value });
            }
          }
        } catch (error) {
          console.error('Failed to load auction state from Supabase.', error);
        }
        shouldForceFull = pendingFullSettingsRefreshRef.current;
      } while (shouldForceFull);
    } finally {
      isSharedSettingsRefreshInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [applySharedSettingsValue, refreshLocalNumberBaseball, refreshLocalStudentSudoku, studentNumber]);

  useEffect(() => {
    if (!isSupabaseSettingsEnabled) return;
    const snapshot = loadStudentSettingsSnapshot(studentNumber);
    if (!snapshot) return;
    sharedSettingsUpdatedAtRef.current = snapshot.updatedAt;
    applySharedSettingsValue(snapshot.value);
    setIsLoading(false);
  }, [applySharedSettingsValue, studentNumber]);

  useEffect(() => {
    let lastForegroundRefreshAt = 0;
    const refreshWhenVisible = (forceFull = false) => {
      if (document.visibilityState === 'visible') void refreshAuctionState({ forceFull });
    };
    const isEntryRefreshView = activeStudentView === 'emotions'
      || activeStudentView === 'missions'
      || activeStudentView === 'sudoku'
      || activeStudentView === 'number-baseball'
      || activeStudentView === 'mailbox'
      || activeStudentView === 'library'
      || activeStudentView === 'library-bookstore'
      || activeStudentView === 'library-bookshelf';
    refreshWhenVisible(isStudentStoreView(activeStudentView) || isEntryRefreshView);

    const syncView = isStudentStoreView(activeStudentView) ? 'store' : activeStudentView;
    const intervalMs = STUDENT_SETTINGS_SYNC_INTERVAL_MS[syncView];
    const intervalId = intervalMs === undefined
      ? undefined
      : window.setInterval(() => refreshWhenVisible(), intervalMs);
    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundRefreshAt < STUDENT_FOREGROUND_SYNC_COOLDOWN_MS) return;
      lastForegroundRefreshAt = now;
      refreshWhenVisible();
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [activeStudentView, refreshAuctionState]);

  useEffect(() => {
    if (activeStudentView !== 'missions') return;
    let isActive = true;

    const syncWeeklyMission = async () => {
      try {
        const result = await syncWeeklyMissions(studentNumber);
        if (!isActive) return;
        setWeeklyMissionStatuses(result.missions.reduce<WeeklyMissionStatuses>(
          (statuses, mission) => ({
            ...statuses,
            [mission.missionType]: mission.completed ? 'completed' : 'incomplete',
          }),
          createWeeklyMissionStatuses('incomplete'),
        ));
        setHasWeeklyMissionSyncError(false);
        const finalBalance = Math.max(...result.missions.map((mission) => mission.balance));
        setCurrencyBalances((previous) => ({
          ...previous,
          [String(studentNumber)]: finalBalance,
        }));
      } catch (error) {
        if (!isActive) return;
        const isExpectedLocalApiAbsence = import.meta.env.DEV
          && error instanceof Error
          && error.message === 'WEEKLY_MISSIONS_HTTP_404';
        if (!isExpectedLocalApiAbsence) console.warn('Failed to sync weekly mission.', error);

        try {
          const submissionStatuses = await loadQuestionSubmissionStatuses();
          if (!isActive) return;
          const isCompleted = hasPersonalQuestionSubmission(submissionStatuses, studentNumber);
          setHasWeeklyMissionSyncError(false);
          if (!isCompleted) {
            setWeeklyMissionStatuses((previous) => ({
              ...previous,
              [PERSONAL_QUESTION_WEEKLY_MISSION_TYPE]: 'incomplete',
              classword_word_entry: previous.classword_word_entry === 'completed' ? 'completed' : 'unavailable',
              classword_quiz_correct: previous.classword_quiz_correct === 'completed' ? 'completed' : 'unavailable',
            }));
            return;
          }

          setWeeklyMissionStatuses((previous) => ({
            ...previous,
            [PERSONAL_QUESTION_WEEKLY_MISSION_TYPE]: 'unavailable',
            classword_word_entry: previous.classword_word_entry === 'completed' ? 'completed' : 'unavailable',
            classword_quiz_correct: previous.classword_quiz_correct === 'completed' ? 'completed' : 'unavailable',
          }));
        } catch (fallbackError) {
          if (!isActive) return;
          console.warn('Failed to load weekly mission completion fallback.', fallbackError);
          setHasWeeklyMissionSyncError(true);
          setWeeklyMissionStatuses((previous) => WEEKLY_MISSION_TYPES.reduce<WeeklyMissionStatuses>(
            (statuses, missionType) => ({
              ...statuses,
              [missionType]: previous[missionType] === 'completed' ? 'completed' : 'unavailable',
            }),
            previous,
          ));
        }
      }
    };

    setWeeklyMissionStatuses((previous) => WEEKLY_MISSION_TYPES.reduce<WeeklyMissionStatuses>(
      (statuses, missionType) => ({
        ...statuses,
        [missionType]: previous[missionType] === 'completed' ? 'completed' : 'loading',
      }),
      previous,
    ));
    void syncWeeklyMission();
    const syncOnReturn = () => {
      if (document.visibilityState === 'visible') void syncWeeklyMission();
    };
    window.addEventListener('focus', syncOnReturn);
    document.addEventListener('visibilitychange', syncOnReturn);

    return () => {
      isActive = false;
      window.removeEventListener('focus', syncOnReturn);
      document.removeEventListener('visibilitychange', syncOnReturn);
    };
  }, [activeStudentView, studentNumber]);

  const selectItem = (item: AuctionItem) => {
    const itemIndex = auctionItems.findIndex((auctionItem) => auctionItem.id === item.id);
    if (itemIndex < 0 || item.dayIndex >= visibleDayCount) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumAuctionBid(item, currentBid.amount);
    setSelectedItemId(item.id);
    setBidAmountDrafts((previous) => ({
      ...previous,
      [item.id]: previous[item.id] ?? String(Math.max(minimumBid, clampAuctionBidAmount(bidAmounts[item.id] ?? minimumBid))),
    }));
    setBidAmounts((previous) => ({
      ...previous,
      [item.id]: Math.max(minimumBid, clampAuctionBidAmount(previous[item.id] ?? minimumBid)),
    }));
  };

  const updateBidAmountDraft = (itemId: string, nextValue: string) => {
    const numericText = nextValue.replace(/[^\d]/g, '');
    setBidAmountDrafts((previous) => ({ ...previous, [itemId]: numericText }));
    setBidAmounts((previous) => ({
      ...previous,
      [itemId]: numericText ? clampAuctionBidAmount(Number(numericText)) : 0,
    }));
  };

  const commitBidAmountDraft = (itemId: string, minimumBid: number, maxBid: number) => {
    const parsedAmount = Number(bidAmountDrafts[itemId] ?? '');
    const nextAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.min(maxBid, Math.max(minimumBid, clampAuctionBidAmount(parsedAmount)))
      : minimumBid;
    setBidAmountDrafts((previous) => ({ ...previous, [itemId]: String(nextAmount) }));
    setBidAmounts((previous) => ({ ...previous, [itemId]: nextAmount }));
  };

  const submitBid = async (item: AuctionItem, confirmedBidAmount: number) => {
    if (isSubmittingItemId) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id]) {
      showStatusMessage('이미 낙찰된 물품입니다.');
      return;
    }
    if (currentBid.bidder === studentNumber) {
      showStatusMessage('다른 번호가 더 높게 입찰한 뒤 다시 입찰할 수 있습니다.');
      return;
    }
    const minimumBid = getMinimumAuctionBid(item, currentBid.amount);
    const bidAmount = clampAuctionBidAmount(confirmedBidAmount);
    const reservedExcludingItem = getReservedAuctionBidAmount(
      auctionBids,
      studentNumber,
      item.id,
      auctionAwards,
      activeAuctionItemIds,
    );
    const availableForItem = Math.max(0, balance - reservedExcludingItem);

    if (bidAmount < minimumBid) {
      showStatusMessage(`${formatCurrency(minimumBid)}부터 입찰할 수 있습니다.`);
      return;
    }

    if (hasAuctionBidAmount(auctionBidHistory, item.id, bidAmount)) {
      showStatusMessage('이미 입찰된 금액입니다. 다른 금액으로 입찰해 주세요.');
      return;
    }

    if (bidAmount > availableForItem) {
      showStatusMessage('예약금을 제외한 사용 가능 고마가 부족합니다.');
      return;
    }

    setIsSubmittingItemId(item.id);
    setStatusMessage('');

    try {
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const currentObject = currentValue && typeof currentValue === 'object'
            ? (currentValue as Record<string, unknown>)
            : {};
          const currentBalances = normalizeCurrencyBalances(currentObject.currencyBalances);
          const currentBids = normalizeAuctionBids(currentObject.auctionBids, AUCTION_ITEM_IDS);
          const currentHistory = normalizeAuctionBidHistory(currentObject.auctionBidHistory, AUCTION_ITEM_IDS);
          const currentAwards = normalizeAuctionAwards(currentObject.auctionAwards, AUCTION_ITEM_IDS);
          if (currentAwards[item.id]) {
            throw new Error('ALREADY_AWARDED');
          }
          const latestBalance = currentBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
          const latestBid = currentBids[item.id] ?? { amount: 0, bidder: null };
          const latestMinimumBid = getMinimumAuctionBid(item, latestBid.amount);
          const latestReservedExcludingItem = getReservedAuctionBidAmount(
            currentBids,
            studentNumber,
            item.id,
            currentAwards,
            activeAuctionItemIds,
          );
          const latestAvailableForItem = Math.max(0, latestBalance - latestReservedExcludingItem);

          if (latestBid.bidder === studentNumber) {
            throw new Error('ALREADY_HIGHEST_BIDDER');
          }

          if (bidAmount > latestAvailableForItem) {
            throw new Error('INSUFFICIENT_FUNDS');
          }

          if (bidAmount < latestMinimumBid) {
            throw new Error('BID_TOO_LOW');
          }

          if (hasAuctionBidAmount(currentHistory, item.id, bidAmount)) {
            throw new Error('DUPLICATE_BID_AMOUNT');
          }

          return {
            ...currentObject,
            version: 1,
            currencyBalances: currentBalances,
            auctionBids: {
              ...currentBids,
              [item.id]: {
                amount: bidAmount,
                bidder: studentNumber,
              },
            },
            auctionBidHistory: {
              ...currentHistory,
              [item.id]: [
                ...(currentHistory[item.id] ?? []),
                {
                  itemId: item.id,
                  bidder: studentNumber,
                  amount: bidAmount,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
            auctionAwards: currentAwards,
          };
        });
        await refreshAuctionState();
      } else {
        setAuctionBids((previous) => ({
          ...previous,
          [item.id]: {
            amount: bidAmount,
            bidder: studentNumber,
          },
        }));
        setAuctionBidHistory((previous) => ({
          ...previous,
          [item.id]: [
            ...(previous[item.id] ?? []),
            {
              itemId: item.id,
              bidder: studentNumber,
              amount: bidAmount,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }

      setBidAmounts((previous) => ({ ...previous, [item.id]: bidAmount + AUCTION_BID_STEP }));
      setBidAmountDrafts((previous) => ({ ...previous, [item.id]: String(bidAmount + AUCTION_BID_STEP) }));
      void playAuctionSound('bid');
      showStatusMessage('입찰이 완료되었습니다.');
    } catch (error) {
      console.error('Failed to submit auction bid.', error);
      showStatusMessage(error instanceof Error && error.message === 'INSUFFICIENT_FUNDS'
        ? '예약금을 제외한 사용 가능 고마가 부족합니다.'
        : error instanceof Error && error.message === 'BID_TOO_LOW'
          ? '현재 최고 입찰가보다 높게 입찰해야 합니다.'
          : error instanceof Error && error.message === 'ALREADY_HIGHEST_BIDDER'
            ? '다른 번호가 더 높게 입찰한 뒤 다시 입찰할 수 있습니다.'
            : error instanceof Error && error.message === 'ALREADY_AWARDED'
              ? '이미 낙찰된 물품입니다.'
              : error instanceof Error && error.message === 'DUPLICATE_BID_AMOUNT'
                ? '이미 입찰된 금액입니다. 다른 금액으로 입찰해 주세요.'
                : '입찰을 처리하지 못했습니다. 다시 시도해 주세요.');
      await refreshAuctionState();
    } finally {
      setIsSubmittingItemId(null);
    }
  };

  const openBidConfirm = (item: AuctionItem, bidAmount: number) => {
    void prepareAuctionAudio();

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id]) {
      showStatusMessage('이미 낙찰된 물품입니다.');
      return;
    }
    if (currentBid.bidder === studentNumber) {
      showStatusMessage('다른 번호가 더 높게 입찰한 뒤 다시 입찰할 수 있습니다.');
      return;
    }
    const minimumBid = getMinimumAuctionBid(item, currentBid.amount);
    const confirmedAmount = clampAuctionBidAmount(bidAmount);
    const reservedExcludingItem = getReservedAuctionBidAmount(
      auctionBids,
      studentNumber,
      item.id,
      auctionAwards,
      activeAuctionItemIds,
    );
    const availableForItem = Math.max(0, balance - reservedExcludingItem);

    if (confirmedAmount < minimumBid) {
      showStatusMessage(`${formatCurrency(minimumBid)}부터 입찰할 수 있습니다.`);
      return;
    }

    if (hasAuctionBidAmount(auctionBidHistory, item.id, confirmedAmount)) {
      showStatusMessage('이미 입찰된 금액입니다. 다른 금액으로 입찰해 주세요.');
      return;
    }

    if (confirmedAmount > availableForItem) {
      showStatusMessage('예약금을 제외한 사용 가능 고마가 부족합니다.');
      return;
    }

    const nextPendingBid = { itemId: item.id, amount: confirmedAmount };
    setRenderedPendingBid(nextPendingBid);
    setActiveModal('bid');
    setPendingBid(nextPendingBid);
  };

  const confirmPendingBid = async () => {
    if (!pendingBid) return;
    void prepareAuctionAudio();

    const item = auctionItems.find((auctionItem) => auctionItem.id === pendingBid.itemId);
    if (!item) {
      setPendingBid(null);
      showStatusMessage('입찰할 물품을 찾지 못했습니다.');
      return;
    }

    try {
      await submitBid(item, pendingBid.amount);
    } finally {
      setPendingBid(null);
    }
  };

  const openDonation = () => {
    if (!classDonation.enabled || maximumDonation < 1 || activeModal !== null) return;
    setDonationAmountDraft('');
    setDonationError('');
    donationRequestIdRef.current = `class-donation-${studentNumber}-${createBrowserRequestId()}`;
    setIsDonationOpen(true);
  };

  const confirmDonation = async () => {
    if (!isDonationAmountValid || isDonating) return;
    setIsDonating(true);
    try {
      const requestId = donationRequestIdRef.current;
      const letterCreatedAt = new Date().toISOString();
      const result = await donateToClassGoal(studentNumber, donationAmount, requestId);
      let savedStudentLife = studentLife;
      await updateSharedSettings((currentValue) => {
        const current = currentValue && typeof currentValue === 'object'
          ? currentValue as Record<string, unknown>
          : {};
        savedStudentLife = createClassDonationThankYouLetter(
          normalizeStudentLifeState(current.studentLife),
          { studentNumber, donatedAmount: result.donatedAmount, requestId, createdAt: letterCreatedAt },
        );
        return { ...current, studentLife: savedStudentLife };
      });
      setCurrencyBalances((previous) => ({ ...previous, [studentKey]: result.balance }));
      setStudentLife(savedStudentLife);
      setClassDonation((previous) => ({
        ...previous,
        targetAmount: result.targetAmount,
        totalAmount: result.totalAmount,
      }));
      setIsDonationOpen(false);
      donationRequestIdRef.current = '';
      showStatusMessage(`${formatCurrency(result.donatedAmount)}를 기부했습니다.`);
      await refreshAuctionState();
    } catch (error) {
      console.error('Failed to donate to class goal.', error);
      setDonationError('처리 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.');
      await refreshAuctionState();
    } finally {
      setIsDonating(false);
    }
  };

  const runStudentEconomyAction = async (action: StudentEconomyAction) => {
    if (isEconomySavingRef.current) return false;
    isEconomySavingRef.current = true;
    setIsEconomySaving(true);
    try {
      const requestId = `student-economy-${studentNumber}-${createBrowserRequestId()}`;
      let savedBalances = currencyBalances;
      let savedHistory = currencyHistory;
      let savedEconomyStates = studentEconomyStates;
      let savedStudentLife = studentLife;
      let resultMessage = '';

      if (isSupabaseSettingsEnabled) {
        const result = await updateStudentEconomy({ studentNumber, action, requestId });
        savedBalances = { ...currencyBalances, ...result.currencyBalanceEntries };
        savedHistory = { ...currencyHistory, ...result.currencyHistoryEntries };
        savedEconomyStates = { ...studentEconomyStates, [studentKey]: result.studentEconomy };
        savedStudentLife = result.studentLife;
        resultMessage = result.message;
        sharedSettingsUpdatedAtRef.current = null;
        invalidateSharedSettingsCache();
      } else {
        const bankMailCreatedAt = new Date().toISOString();
        const snapshot = loadStoredStudentPetSnapshot();
        const currentWallet = snapshot.currencyBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
        const result = applyStudentEconomyAction({
          state: snapshot.studentEconomy[studentKey],
          action,
          wallet: currentWallet,
          availableWallet: Math.max(0, currentWallet - reservedAmount),
          requestId,
          shopCatalog: studentShopCatalog,
          stockMarket: studentStockMarket,
        });
        resultMessage = result.message;
        savedEconomyStates = { ...snapshot.studentEconomy, [studentKey]: result.state };
        const currentStudentLife = loadStoredStudentLifeState();
        savedStudentLife = result.applied
          ? createBankMailboxLetters({ action, studentNumber, requestId, createdAt: bankMailCreatedAt }).reduce(
              (life, letter) => createStudentLetter(life, letter),
              currentStudentLife,
            )
          : currentStudentLife;
        let nextBalances = { ...snapshot.currencyBalances, [studentKey]: result.wallet };
        savedHistory = result.applied && result.wallet !== currentWallet
          ? appendCurrencyHistoryEntry(snapshot.currencyHistory, {
              studentNumber,
              before: currentWallet,
              after: result.wallet,
              reason: result.reason,
            })
          : snapshot.currencyHistory;
        if (result.applied && action.type === 'transfer') {
          const recipientKey = String(action.recipientNumber);
          const recipientWallet = snapshot.currencyBalances[recipientKey] ?? DEFAULT_CURRENCY_BALANCE;
          nextBalances = { ...nextBalances, [recipientKey]: recipientWallet + action.amount };
          savedHistory = appendCurrencyHistoryEntry(savedHistory, {
            studentNumber: action.recipientNumber,
            before: recipientWallet,
            after: recipientWallet + action.amount,
            reason: result.reason,
          });
        }
        savedBalances = nextBalances;
        if (!storeStudentPetSnapshot({
          ...snapshot,
          currencyBalances: nextBalances,
          currencyHistory: savedHistory,
          studentEconomy: savedEconomyStates,
        })) return false;
        storeStudentLifeState(savedStudentLife);
      }

      setCurrencyBalances(savedBalances);
      setCurrencyHistory(savedHistory);
      setStudentEconomyStates(savedEconomyStates);
      setStudentLife(savedStudentLife);
      if (resultMessage && action.type !== 'draw_character') showStatusMessage(resultMessage);
      if (isSupabaseSettingsEnabled) void refreshAuctionState({ forceFull: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const userMessage = message === 'INSUFFICIENT_AVAILABLE_CURRENCY'
        ? '사용 가능한 고마가 부족합니다.'
        : message === 'INSUFFICIENT_BANK_BALANCE'
          ? '예금 잔액이 부족합니다.'
          : message === 'EXCESSIVE_LOAN_REPAYMENT'
            ? '대출 잔액보다 많이 갚을 수 없습니다.'
            : message === 'DEPOSIT_NOT_AVAILABLE_TODAY'
              ? '예금은 월요일부터 금요일까지만 들 수 있습니다.'
              : message === 'DEPOSIT_NOT_MATURED'
                ? '아직 만기 전입니다. 예금을 깨면 원금만 받을 수 있습니다.'
                : message === 'LOAN_LIMIT_EXCEEDED'
                  ? '대출은 한 번에 50고마까지 받을 수 있고, 기존 대출을 먼저 갚아야 합니다.'
                  : message === 'TRANSFER_DAILY_LIMIT_REACHED'
                    ? '이체는 하루에 한 번, 한 명에게만 보낼 수 있습니다.'
                    : message === 'TRANSFER_AMOUNT_LIMIT_EXCEEDED'
                      ? '한 번에 30고마까지만 보낼 수 있습니다.'
            : message === 'STOCK_MARKET_CLOSED'
              ? '토·일은 휴장입니다.'
              : message === 'INVESTMENT_LIMIT_EXCEEDED'
                ? '최대 투자 금액을 넘을 수 없습니다.'
                : message === 'INVALID_INVESTMENT_AMOUNT'
                  ? '투자할 고마를 다시 확인해 주세요.'
                  : message === 'INVESTMENT_NOT_FOUND'
                    ? '찾을 투자금이 없습니다.'
              : message === 'HOUSE_ALREADY_REPAIRED'
                ? '이미 집을 고쳤습니다.'
                : message === 'HOUSE_SHOP_LOCKED'
                  ? '집을 먼저 고쳐야 합니다.'
                  : message === 'ALL_CHARACTERS_OWNED'
                    ? '모든 캐릭터를 모았습니다.'
                    : message === 'CUSTOM_HOUSE_COUPON_REQUIRED'
                      ? '집 만들기 쿠폰이 필요합니다.'
              : '처리하지 못했습니다. 다시 시도해 주세요.';
      showStatusMessage(userMessage);
      return false;
    } finally {
      isEconomySavingRef.current = false;
      setIsEconomySaving(false);
    }
  };

  const isStudentActionPending = isLoading
    || isStudentLifeSaving
    || isPetSaving
    || isEconomySaving
    || isEmotionSaving
    || isSubmittingItemId !== null
    || isDonating;

  return (
    <div ref={pageScrollRef} className="auction-page student-mode-page custom-scrollbar h-[100dvh] w-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 md:py-5" aria-busy={isStudentActionPending}>
      <StudentActionProgress isActive={isStudentActionPending} />
      <main className="mx-auto w-full max-w-7xl">
        {activeStudentView === 'overview' ? (
          <StudentOverviewPage
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
            pet={studentPet}
            isPetSaving={isPetSaving}
            todayEmotion={todayEmotion}
            hasUnreadMail={unreadLetterCount > 0}
            isHouseRepaired={(studentEconomy.inventory.house_repair ?? 0) > 0}
            ownedCharacterIds={studentEconomy.ownedCharacterIds}
            activeCharacterId={studentEconomy.activeCharacterId}
            isCharacterSaving={isEconomySaving}
            ownedHouseIds={studentEconomy.ownedHouseIds}
            activeHouseId={studentEconomy.activeHouseId}
            customHouseDesign={studentEconomy.customHouseDesign}
            isHouseSaving={isEconomySaving}
            onFeedPet={feedStudentPet}
            onNamePet={nameCurrentStudentPet}
            onChangePet={changeStudentPet}
            onMovePet={moveCurrentStudentPet}
            onMoveGoma={moveCurrentGomaCharacter}
            onSelectCharacter={(characterId) => runStudentEconomyAction({ type: 'select_character', characterId })}
            onSelectHouse={(houseId) => runStudentEconomyAction({ type: 'select_house', houseId })}
            onOpenEmotions={() => navigateStudentView('emotions')}
            onOpenMissions={() => navigateStudentView('missions')}
            onOpenStore={() => navigateStudentView('store')}
            onOpenMailbox={() => navigateStudentView('mailbox')}
            onOpenLibrary={() => navigateStudentView('library')}
          />
        ) : null}
        {activeStudentView === 'emotions' ? (
          <StudentEmotionPage
            todayEntry={todayEmotionEntry}
            history={studentEmotionEntries}
            isSaving={isEmotionSaving}
            onSave={saveStudentEmotion}
            onBack={() => navigateStudentView('overview')}
          />
        ) : null}
        {activeStudentView === 'missions' ? (
          <StudentMissionsPage
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
            auctionMissions={auctionMissions}
            classroomRoleMission={classroomRoleMission}
            weeklyMissionStatuses={weeklyMissionStatuses}
            hasSyncError={hasWeeklyMissionSyncError}
            isDailyEmotionMissionCompleted={hasCompletedDailyEmotionMission}
            hasDailyWritingMission={hasCurrentDailyWritingMission}
            isDailyWritingMissionCompleted={hasCompletedDailyWritingMission}
            isWeeklySudokuMissionCompleted={hasCompletedWeeklySudokuMission}
            isFailureExhibitionMissionCompleted={hasWeeklyMissionReward(
              currencyHistory,
              studentNumber,
              getKoreanIsoWeekKey(),
              FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE,
            )}
            isBookStackMissionCompleted={hasWeeklyMissionReward(
              currencyHistory,
              studentNumber,
              getKoreanIsoWeekKey(),
              BOOK_STACK_WEEKLY_MISSION_TYPE,
            )}
            activeSudokuDifficulty={activeSudokuDifficulty}
            completedSudokuDifficulty={completedSudokuDifficulty}
            numberBaseballStatus={numberBaseballStatus}
            onOpenEmotions={() => navigateStudentView('emotions')}
            onOpenMailbox={() => navigateStudentView('mailbox')}
            onOpenFailureExhibition={() => navigateStudentView('library')}
            onOpenBookStack={() => navigateStudentView('library-bookshelf')}
            onOpenSudoku={async (difficulty) => {
              const startedDifficulty = await startSudoku(difficulty);
              if (!startedDifficulty) {
                showStatusMessage('스도쿠 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
                return;
              }
              setSudokuDifficulty(startedDifficulty);
              navigateStudentView('sudoku');
            }}
            onOpenNumberBaseball={async () => {
              const started = await startNumberBaseball();
              if (!started) {
                showStatusMessage('숫자야구를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
                return;
              }
              navigateStudentView('number-baseball');
            }}
            onBack={() => navigateStudentView('overview')}
          />
        ) : null}
        {activeStudentView === 'sudoku' ? (
          <StudentSudokuPage
            studentNumber={studentNumber}
            difficulty={sudokuDifficulty}
            progress={studentSudokuProgress}
            hasReward={hasCompletedWeeklySudokuMission}
            onSave={saveSudokuProgress}
            onComplete={completeSudoku}
            onBack={() => navigateStudentView('missions')}
          />
        ) : null}
        {activeStudentView === 'number-baseball' ? (
          <StudentNumberBaseballPage
            studentNumber={studentNumber}
            weekKey={numberBaseballWeekKey}
            entry={numberBaseballEntry ?? createNumberBaseballProgressEntry(numberBaseballGameId)}
            hasReward={hasNumberBaseballReward}
            onSave={saveNumberBaseballProgress}
            onComplete={completeNumberBaseball}
            onBack={() => navigateStudentView('missions')}
          />
        ) : null}
        {activeStudentView === 'mailbox' ? (
          <StudentMailboxPage
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            letters={studentLetters}
            sentLetters={studentSentLetters}
            unreadCount={unreadLetterCount}
            isSaving={isStudentLifeSaving}
            onRead={readStudentLetter}
            onSend={sendStudentLetter}
            onBack={() => navigateStudentView('overview')}
          />
        ) : null}
        {activeStudentView === 'library' || activeStudentView === 'library-bookstore' ? (
          <StudentFailureExhibitionPage
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            stories={failureStories}
            isSaving={isStudentLifeSaving}
            onCreate={createStudentFailureStory}
            onStamp={stampStudentFailureStory}
            onOpenBookshelf={() => navigateStudentView('library-bookshelf')}
            onBack={() => navigateStudentView('overview')}
          />
        ) : null}
        {activeStudentView === 'library-bookshelf' ? (
          <StudentLibraryPage
            books={studentBooks}
            isSaving={isStudentLifeSaving}
            onAdd={addStudentBookEntry}
            onBack={() => navigateStudentView('overview')}
          />
        ) : null}
        {isStudentStoreView(activeStudentView) ? (
          <StudentStorePage
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
            section={activeStoreSection}
            economyState={studentEconomy}
            shopCatalog={studentShopCatalog}
            stockMarket={studentStockMarket}
            isEconomySaving={isEconomySaving}
            donation={{
              totalAmount: classDonation.totalAmount,
              targetAmount: classDonation.targetAmount,
              canDonate: shouldShowClassDonation && maximumDonation >= 1 && !isLoading,
              isCompleted: hasCompletedClassDonation,
              triggerRef: donationTriggerRef,
              onDonate: openDonation,
            }}
            onEconomyAction={runStudentEconomyAction}
            onSelectProfile={selectStudentFailureProfile}
            onOpenSection={(section) => navigateStudentView(STORE_VIEW_BY_SECTION[section])}
            onBack={() => navigateStudentView(activeStoreSection === 'plaza' ? 'overview' : activeStoreSection === 'securities-trade' ? 'store-securities' : 'store')}
          >
          <AuctionRoom
          auctionItems={auctionItems}
          auctionBids={auctionBids}
          auctionAwards={auctionAwards}
          auctionMissions={auctionMissions}
          weeklyMissionStatuses={weeklyMissionStatuses}
          availableBalance={availableBalance}
          reservedAmount={reservedAmount}
          visibleDayCount={visibleDayCount}
          selectedItemId={selectedItem?.id ?? null}
          studentLabel={`${studentNumber}번`}
          profileAssignments={profileAssignments}
          isLoading={isLoading}
          showStudentSummary={false}
          onSelectItem={selectItem}
          donationWidget={null}
          footer={selectedItem ? (() => {
            const currentBid = auctionBids[selectedItem.id] ?? { amount: 0, bidder: null };
            const award = auctionAwards[selectedItem.id] ?? null;
            const selectedItemDisplayName = getAuctionItemDisplayName(selectedItem.name, selectedItem.dayIndex);
            if (award) {
              return (
                <div className="auction-bid-panel rounded-[1.25rem] border border-[#DCE7E1] bg-white p-4 text-center shadow-[0_10px_24px_rgba(28,45,40,0.07)]">
                  <div className="rounded-[1rem] border border-[#E5ECE8] bg-[#FAFCFB] px-4 py-3">
                    <div className="text-[0.9rem] font-black text-[#8A5A1F]">낙찰 완료</div>
                    <div className="mt-1 font-mono text-[1.35rem] font-black text-[#007A57]">
                      {award.winner}번 · {formatCurrency(award.amount)}
                    </div>
                  </div>
                </div>
              );
            }
            const minimumBid = getMinimumAuctionBid(selectedItem, currentBid.amount);
            const reservedExcludingItem = getReservedAuctionBidAmount(
              auctionBids,
              studentNumber,
              selectedItem.id,
              auctionAwards,
              activeAuctionItemIds,
            );
            const maxBid = clampAuctionBidAmount(Math.max(0, balance - reservedExcludingItem));
            const selectedBidAmount = Math.max(
              clampAuctionBidAmount(bidAmounts[selectedItem.id] ?? minimumBid),
            );
            const bidAmountDraft = bidAmountDrafts[selectedItem.id] ?? String(selectedBidAmount || minimumBid);
            const canSubmit =
              !isLoading &&
              isSubmittingItemId === null &&
              selectedBidAmount >= minimumBid &&
              selectedBidAmount <= maxBid;

            return (
              <div className="auction-bid-panel rounded-[1.25rem] border border-[#DCE7E1] bg-white p-4 shadow-[0_10px_24px_rgba(28,45,40,0.07)]">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="section-title min-w-0 truncate text-[1.35rem] font-extrabold leading-tight text-[#18211E]">
                      {selectedItemDisplayName}
                    </h2>
                    <p className="font-mono text-[1.05rem] font-black text-[#007A57]">
                      최고가 {formatCurrency(currentBid.amount)} · 시작가 {formatCurrency(selectedItem.startPrice)}
                    </p>
                  </div>
                  <div className="text-[0.95rem] font-black text-[#6E7A72]">
                    입찰 단위 {formatCurrency(AUCTION_BID_STEP)}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center rounded-[0.9rem] border border-[#DCE7E1] bg-[#FAFCFB] px-4 focus-within:border-[#8DC9B7] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#8DC9B7]/35">
                    <input
                      id="auction-bid-amount-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bidAmountDraft}
                      onChange={(event) => updateBidAmountDraft(selectedItem.id, event.target.value)}
                      onBlur={() => commitBidAmountDraft(selectedItem.id, minimumBid, maxBid)}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitBidAmountDraft(selectedItem.id, minimumBid, maxBid);
                          openBidConfirm(selectedItem, selectedBidAmount);
                        }
                      }}
                      className="h-full min-w-0 bg-transparent text-center font-mono text-[1.28rem] font-black text-[#18211E] outline-none"
                      aria-label={`${selectedItemDisplayName} 입찰 금액`}
                      placeholder={String(minimumBid)}
                    />
                    <span className="pl-2 font-mono text-[1.02rem] font-black text-[#007A57]">고마</span>
                  </label>
                  <button
                    id="auction-bid-trigger"
                    ref={bidTriggerRef}
                    type="button"
                    onClick={() => openBidConfirm(selectedItem, selectedBidAmount)}
                    disabled={!canSubmit}
                    className="inline-flex h-12 w-full items-center justify-center rounded-[0.9rem] bg-[#007A57] text-[1rem] font-extrabold text-white shadow-[0_10px_20px_rgba(0,122,87,0.14)] transition-colors hover:bg-[#006B4D] disabled:cursor-not-allowed disabled:bg-[#C9D4CD] disabled:text-white/82"
                  >
                    {isSubmittingItemId === selectedItem.id ? '...' : '입찰'}
                  </button>
                </div>
              </div>
            );
          })() : null}
          />
          </StudentStorePage>
        ) : null}
      </main>
      {isDonationOpen ? (
        <div
          className="auction-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/32 px-4"
          role="presentation"
          onClick={() => {
            if (!isDonating) setIsDonationOpen(false);
          }}
        >
          <div
            ref={donationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-donation-title"
            onClick={(event) => event.stopPropagation()}
            className="class-donation-dialog apple-material-layer w-full max-w-[28rem] rounded-[1.75rem] border-2 border-[#8DC9B7] bg-white p-5 shadow-[0_28px_70px_rgba(28,45,40,0.24)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="class-donation-title" className="section-title text-[1.45rem] font-extrabold text-[#18211E]">학급 기부</h2>
              <button
                type="button"
                onClick={() => setIsDonationOpen(false)}
                disabled={isDonating}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#DCE7E1] text-[#38423D] disabled:opacity-50"
                aria-label="기부 창 닫기"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 rounded-[1rem] border border-[#DCEAE3] bg-[#F7FBF9] p-3">
              <div className="font-mono text-[1.25rem] font-black text-[#007A57]">
                {formatCurrency(classDonation.totalAmount)} / {formatCurrency(classDonation.targetAmount)}
              </div>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#DDEAE4]">
                <span
                  className="block h-full rounded-full bg-[#007A57]"
                  style={{ width: `${Math.min(100, (classDonation.totalAmount / classDonation.targetAmount) * 100)}%` }}
                />
              </span>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">기부할 고마</span>
              <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center rounded-[0.9rem] border-2 border-[#9FC7B8] bg-white px-4 focus-within:border-[#007A57]">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={donationAmountDraft}
                  onChange={(event) => setDonationAmountDraft(event.target.value.replace(/\D/g, ''))}
                  disabled={isDonating}
                  placeholder="금액 입력"
                  className="h-full min-w-0 bg-transparent text-center font-mono text-[1.25rem] font-black text-[#18211E] outline-none placeholder:font-sans placeholder:text-[0.95rem] placeholder:text-[#8A9991]"
                  autoFocus
                />
                <span className="font-mono font-black text-[#007A57]">고마</span>
              </div>
            </label>

            <p className="mt-2 text-right text-[0.82rem] font-extrabold text-[#6E7A72]">
              기부 후 {formatCurrency(Math.max(0, availableBalance - (isDonationAmountValid ? donationAmount : 0)))}
            </p>
            {!isDonationAmountValid && donationAmountDraft !== '' ? (
              <p className="mt-2 text-[0.8rem] font-extrabold text-[#B84A34]">
                1 이상 {formatCurrency(maximumDonation)} 이하로 입력해 주세요.
              </p>
            ) : null}
            {donationError ? (
              <p className="mt-2 text-[0.8rem] font-extrabold text-[#B84A34]">{donationError}</p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsDonationOpen(false)}
                disabled={isDonating}
                className="h-12 rounded-[0.9rem] border-2 border-[#DCE7E1] bg-white font-extrabold text-[#38423D] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDonation()}
                disabled={!isDonationAmountValid || isDonating}
                className="h-12 rounded-[0.9rem] bg-[#007A57] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#C9D4CD]"
              >
                {isDonating ? '처리 중...' : '기부하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeModal === 'bid' && renderedPendingBid ? (() => {
        const pendingItem = auctionItems.find((item) => item.id === renderedPendingBid.itemId);
        const pendingItemName = pendingItem
          ? getAuctionItemDisplayName(pendingItem.name, pendingItem.dayIndex)
          : '선택한 물품';
        const lastPendingItemChar = pendingItemName.trim().slice(-1);
        const pendingItemParticle = lastPendingItemChar && (lastPendingItemChar.charCodeAt(0) - 0xac00) % 28 > 0
          ? '을'
          : '를';
        const pendingCurrentBid = renderedPendingBid.itemId
          ? auctionBids[renderedPendingBid.itemId] ?? { amount: 0, bidder: null }
          : { amount: 0, bidder: null };

        return (
          <motion.div
            key="auction-confirm-material"
            className="auction-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/32 px-4"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: pendingBid ? 1 : 0, pointerEvents: pendingBid ? 'auto' : 'none' }}
            transition={{ duration: shouldReduceMotion ? 0.16 : 0.18, ease: 'easeOut' }}
            onClick={() => {
              if (!isSubmittingItemId) setPendingBid(null);
            }}
          >
            <motion.div
              ref={setBidDialogNode}
              className="apple-material-layer auction-confirm-dialog w-full max-w-[34rem] break-keep rounded-[1.75rem] border-2 border-[#8DC9B7] bg-white p-6 text-left shadow-[0_28px_70px_rgba(28,45,40,0.24)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auction-bid-confirm-title"
              onClick={(event) => event.stopPropagation()}
              style={shouldReduceMotion
                ? { opacity: bidMaterialProgress }
                : { opacity: bidMaterialProgress, scale: bidMaterialScale, filter: bidMaterialFilter }}
            >
              <h2 id="auction-bid-confirm-title" className="section-title text-center text-[1.65rem] font-extrabold leading-tight text-[#18211E]">
                {pendingItemName}{pendingItemParticle}{' 이\u00a0금액으로 입찰할까요?'}
              </h2>

              <div className="mt-5 rounded-[1.15rem] border border-[#D7E6DE] bg-[#F6FCF9] p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] lg:items-center">
                  <div className="rounded-[1rem] border border-[#D7E6DE] bg-white px-4 py-3">
                    <div className="text-[0.76rem] font-black text-[#6E7A72]">현재 최고가</div>
                    <div className="mt-1 font-mono text-[1.25rem] font-black leading-none text-[#2F241D]">
                      {formatCurrency(pendingCurrentBid.amount)}
                    </div>
                  </div>
                  <div className="auction-bid-flow-arrow hidden h-10 w-10 items-center justify-center rounded-full bg-white text-[#007A57] shadow-sm ring-1 ring-[#D7E6DE] lg:inline-flex">
                    <ArrowRight size={22} strokeWidth={3} />
                  </div>
                  <div className="rounded-[1rem] border-2 border-[#8DC9B7] bg-white px-4 py-3 text-right">
                    <div className="text-[0.76rem] font-black text-[#007A57]">당신의 입찰 금액</div>
                    <div className="mt-1 font-mono text-[1.55rem] font-black leading-none text-[#007A57]">
                      {formatCurrency(renderedPendingBid.amount)}
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-4 rounded-[1rem] border border-[#E4D7C9] bg-[#FFF8EC] px-4 py-3 text-[0.95rem] font-extrabold leading-6 text-[#6E5139]">
                입찰 후에는 <strong className="text-[#B84A34] underline decoration-[#B84A34]/30 underline-offset-4">되돌릴 수 없습니다.</strong> 금액과 물품을 확인한 뒤 진행해 주세요.
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPendingBid(null)}
                  disabled={isSubmittingItemId !== null}
                  className="inline-flex h-12 items-center justify-center rounded-[0.95rem] border-2 border-[#E0BF8D] bg-[#FFFCF6] px-4 text-[1rem] font-extrabold text-[#8A5A1F] transition-colors hover:bg-[#FFF2DA] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  다시 확인하기
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPendingBid()}
                  disabled={isSubmittingItemId !== null}
                  className="inline-flex h-12 items-center justify-center rounded-[0.95rem] bg-[#007A57] px-4 text-[1rem] font-extrabold text-white shadow-[0_10px_20px_rgba(0,122,87,0.16)] transition-colors hover:bg-[#006B4D] disabled:cursor-not-allowed disabled:bg-[#C9D4CD]"
                >
                  {isSubmittingItemId ? '입찰 처리 중...' : '입찰하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        );
      })() : null}
      {activeModal === 'status' && renderedStatusMessage ? (
        <motion.div
          key="auction-status-material"
          className="auction-modal-backdrop auction-status-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          role="presentation"
          onClick={dismissStatusMessage}
          initial={{ opacity: 0 }}
          animate={{ opacity: statusMessage ? 1 : 0, pointerEvents: statusMessage ? 'auto' : 'none' }}
          transition={{ duration: shouldReduceMotion ? 0.16 : 0.18, ease: 'easeOut' }}
        >
          <motion.div
            ref={setStatusDialogNode}
            className="apple-material-layer auction-status-dialog w-full max-w-[18rem] break-keep rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auction-status-message"
            onClick={(event) => event.stopPropagation()}
            style={shouldReduceMotion
              ? { opacity: statusMaterialProgress }
              : { opacity: statusMaterialProgress, scale: statusMaterialScale, filter: statusMaterialFilter }}
          >
            <p id="auction-status-message" aria-live="polite" className="font-mono text-[1.35rem] font-black text-[#006241]">{renderedStatusMessage}</p>
            <button
              type="button"
              onClick={dismissStatusMessage}
              className="mt-4 inline-flex min-h-[2.875rem] min-w-[6.5rem] items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
            >
              확인
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
