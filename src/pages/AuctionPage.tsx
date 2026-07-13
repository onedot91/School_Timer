import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { animate as animateMotion, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import AuctionRoom from '../components/AuctionRoom';
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
  type AuctionAwards,
  type AuctionBidHistory,
  type AuctionItem,
  type AuctionMission,
  type AuctionBids,
  type CurrencyBalances,
} from '../lib/currency';
import {
  isSupabaseSettingsEnabled,
  loadSharedSettingsRow,
  updateSharedSettings,
} from '../lib/supabaseSettings';
import { playAuctionSound, prepareAuctionAudio } from '../lib/auctionAudio';
import {
  hasPersonalQuestionSubmission,
  loadQuestionSubmissionStatuses,
} from '../lib/questionSubmissionStatus';
import { useModalFocus } from '../lib/useModalFocus';
import {
  claimWeeklyMissionRewardInSettings,
  getKoreanIsoWeekKey,
  syncPersonalQuestionWeeklyMission,
  type WeeklyMissionStatus,
} from '../lib/weeklyMission';

interface AuctionPageProps {
  studentNumber: number;
}

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

export default function AuctionPage({ studentNumber }: AuctionPageProps) {
  const shouldReduceMotion = useReducedMotion();
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => normalizeCurrencyBalances(null));
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [auctionBidHistory, setAuctionBidHistory] = useState<AuctionBidHistory>(() => normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
  const [auctionAwards, setAuctionAwards] = useState<AuctionAwards>(() => normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
  const [auctionMissions, setAuctionMissions] = useState<AuctionMission[]>(getInitialAuctionMissions);
  const [weeklyMissionStatus, setWeeklyMissionStatus] = useState<WeeklyMissionStatus>('loading');
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [bidAmountDrafts, setBidAmountDrafts] = useState<Record<string, string>>({});
  const [selectedItemId, setSelectedItemId] = useState(DEFAULT_AUCTION_ITEMS[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(isSupabaseSettingsEnabled);
  const [isSubmittingItemId, setIsSubmittingItemId] = useState<string | null>(null);
  const [pendingBid, setPendingBid] = useState<{ itemId: string; amount: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
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
  const shouldReturnStatusFocusRef = useRef(false);

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
    dialogRef: statusDialogRef,
    isOpen: activeModal === 'status' && statusDialogElement !== null,
    onDismiss: dismissStatusMessage,
    returnFocusRef: statusReturnFocusRef,
  });

  const studentKey = String(studentNumber);
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
  const visibleDayCount = getAuctionVisibleDayCount();
  const firstVisibleItem = auctionItems.find((item) => item.dayIndex < visibleDayCount) ?? null;

  const selectedItem = useMemo(
    () => {
      const selectedIndex = auctionItems.findIndex((item) => item.id === selectedItemId);
      const selectedAuctionItem = selectedIndex >= 0 ? auctionItems[selectedIndex] : null;
      if (selectedAuctionItem && selectedAuctionItem.dayIndex < visibleDayCount) return selectedAuctionItem;
      return firstVisibleItem;
    },
    [auctionItems, firstVisibleItem, selectedItemId, visibleDayCount],
  );

  const refreshAuctionState = async () => {
    if (!isSupabaseSettingsEnabled) {
      setCurrencyBalances(normalizeCurrencyBalances(null));
      setAuctionItems(normalizeAuctionItems(null));
      setAuctionBids(normalizeAuctionBids(null, AUCTION_ITEM_IDS));
      setAuctionBidHistory(normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
      setAuctionAwards(normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
      setAuctionMissions(getStoredAuctionMissions());
      setIsLoading(false);
      return;
    }

    try {
      const row = await loadSharedSettingsRow();
      const value = row?.value && typeof row.value === 'object'
        ? (row.value as {
            currencyBalances?: unknown;
            auctionBids?: unknown;
            auctionItems?: unknown;
            auctionBidHistory?: unknown;
            auctionAwards?: unknown;
            auctionMissions?: unknown;
          })
        : {};
      setCurrencyBalances(normalizeCurrencyBalances(value.currencyBalances));
      setAuctionItems(normalizeAuctionItems(value.auctionItems));
      setAuctionBids(normalizeAuctionBids(value.auctionBids, AUCTION_ITEM_IDS));
      setAuctionBidHistory(normalizeAuctionBidHistory(value.auctionBidHistory, AUCTION_ITEM_IDS));
      setAuctionAwards(normalizeAuctionAwards(value.auctionAwards, AUCTION_ITEM_IDS));
      setAuctionMissions(normalizeAuctionMissions(value.auctionMissions));
    } catch (error) {
      console.error('Failed to load auction state from Supabase.', error);
      setAuctionMissions([]);
      showStatusMessage('경매 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuctionState();
    if (!isSupabaseSettingsEnabled) return;

    const intervalId = window.setInterval(() => {
      void refreshAuctionState();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [studentNumber]);

  useEffect(() => {
    let isActive = true;

    const syncWeeklyMission = async () => {
      try {
        const result = await syncPersonalQuestionWeeklyMission(studentNumber);
        if (!isActive) return;
        setWeeklyMissionStatus(result.completed ? 'completed' : 'incomplete');
        setCurrencyBalances((previous) => ({
          ...previous,
          [String(studentNumber)]: result.balance,
        }));
      } catch (error) {
        if (!isActive) return;
        const isExpectedLocalApiAbsence = import.meta.env.DEV
          && error instanceof Error
          && error.message === 'WEEKLY_MISSION_HTTP_404';
        if (!isExpectedLocalApiAbsence) console.warn('Failed to sync weekly mission.', error);

        try {
          const submissionStatuses = await loadQuestionSubmissionStatuses();
          if (!isActive) return;
          const isCompleted = hasPersonalQuestionSubmission(submissionStatuses, studentNumber);
          if (!isCompleted) {
            setWeeklyMissionStatus('incomplete');
            return;
          }

          let claimedBalance: number | null = null;
          await updateSharedSettings((currentValue) => {
            const claim = claimWeeklyMissionRewardInSettings(
              currentValue,
              studentNumber,
              getKoreanIsoWeekKey(),
            );
            claimedBalance = claim.balance;
            return claim.value;
          });
          if (!isActive) return;
          setWeeklyMissionStatus('completed');
          if (claimedBalance !== null) {
            setCurrencyBalances((previous) => ({
              ...previous,
              [String(studentNumber)]: claimedBalance ?? previous[String(studentNumber)],
            }));
          }
        } catch (fallbackError) {
          if (!isActive) return;
          console.warn('Failed to load weekly mission completion fallback.', fallbackError);
          setWeeklyMissionStatus('unavailable');
        }
      }
    };

    setWeeklyMissionStatus('loading');
    void syncWeeklyMission();
    const intervalId = window.setInterval(() => void syncWeeklyMission(), 60_000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [studentNumber]);

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

  return (
    <div className="auction-page custom-scrollbar h-[100dvh] w-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 md:py-5">
      <main className="mx-auto w-full max-w-7xl">
        <AuctionRoom
          auctionItems={auctionItems}
          auctionBids={auctionBids}
          auctionAwards={auctionAwards}
          auctionMissions={auctionMissions}
          weeklyMissionStatus={weeklyMissionStatus}
          availableBalance={availableBalance}
          reservedAmount={reservedAmount}
          visibleDayCount={visibleDayCount}
          selectedItemId={selectedItem?.id ?? null}
          studentLabel={`${studentNumber}번`}
          isLoading={isLoading}
          onSelectItem={selectItem}
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
                    <p className="font-mono text-[0.9rem] font-black text-[#007A57]">
                      최고가 {formatCurrency(currentBid.amount)} · 시작가 {formatCurrency(selectedItem.startPrice)}
                    </p>
                  </div>
                  <div className="text-[0.78rem] font-black text-[#7A8780]">
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
      </main>
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
