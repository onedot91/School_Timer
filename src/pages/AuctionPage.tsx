import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => normalizeCurrencyBalances(null));
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [, setAuctionBidHistory] = useState<AuctionBidHistory>(() => normalizeAuctionBidHistory(null, AUCTION_ITEM_IDS));
  const [auctionAwards, setAuctionAwards] = useState<AuctionAwards>(() => normalizeAuctionAwards(null, AUCTION_ITEM_IDS));
  const [auctionMissions, setAuctionMissions] = useState<AuctionMission[]>(getInitialAuctionMissions);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [selectedItemId, setSelectedItemId] = useState(DEFAULT_AUCTION_ITEMS[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(isSupabaseSettingsEnabled);
  const [isSubmittingItemId, setIsSubmittingItemId] = useState<string | null>(null);
  const [pendingBid, setPendingBid] = useState<{ itemId: string; amount: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

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
      setStatusMessage('경매 정보를 불러오지 못했습니다.');
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

  const selectItem = (item: AuctionItem) => {
    const itemIndex = auctionItems.findIndex((auctionItem) => auctionItem.id === item.id);
    if (itemIndex < 0 || item.dayIndex >= visibleDayCount) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumAuctionBid(item, currentBid.amount);
    setSelectedItemId(item.id);
    setBidAmounts((previous) => ({
      ...previous,
      [item.id]: Math.max(minimumBid, clampAuctionBidAmount(previous[item.id] ?? minimumBid)),
    }));
  };

  const submitBid = async (item: AuctionItem, confirmedBidAmount: number) => {
    if (isSubmittingItemId) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    if (auctionAwards[item.id]) {
      setStatusMessage('이미 낙찰된 물품입니다.');
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
      setStatusMessage(`${formatCurrency(minimumBid)}부터 입찰할 수 있습니다.`);
      return;
    }

    if (bidAmount > availableForItem) {
      setStatusMessage('예약금을 제외한 사용 가능 고마가 부족합니다.');
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

          if (bidAmount > latestAvailableForItem) {
            throw new Error('INSUFFICIENT_FUNDS');
          }

          if (bidAmount < latestMinimumBid) {
            throw new Error('BID_TOO_LOW');
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
      void playAuctionSound('bid');
      setStatusMessage('입찰이 완료되었습니다.');
    } catch (error) {
      console.error('Failed to submit auction bid.', error);
      setStatusMessage(error instanceof Error && error.message === 'INSUFFICIENT_FUNDS'
        ? '예약금을 제외한 사용 가능 고마가 부족합니다.'
        : error instanceof Error && error.message === 'BID_TOO_LOW'
          ? '현재 최고 입찰가보다 높게 입찰해야 합니다.'
          : error instanceof Error && error.message === 'ALREADY_AWARDED'
            ? '이미 낙찰된 물품입니다.'
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
      setStatusMessage('이미 낙찰된 물품입니다.');
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
      setStatusMessage(`${formatCurrency(minimumBid)}부터 입찰할 수 있습니다.`);
      return;
    }

    if (confirmedAmount > availableForItem) {
      setStatusMessage('예약금을 제외한 사용 가능 고마가 부족합니다.');
      return;
    }

    setPendingBid({ itemId: item.id, amount: confirmedAmount });
  };

  const confirmPendingBid = async () => {
    if (!pendingBid) return;
    void prepareAuctionAudio();

    const item = auctionItems.find((auctionItem) => auctionItem.id === pendingBid.itemId);
    if (!item) {
      setPendingBid(null);
      setStatusMessage('입찰할 물품을 찾지 못했습니다.');
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
                <div className="mx-4 mb-4 rounded-[1.25rem] border border-[#DCE7E1] bg-white p-4 text-center shadow-[0_10px_24px_rgba(28,45,40,0.07)] md:mx-5 md:mb-5">
                  <h2 className="section-title text-[1.45rem] font-extrabold leading-tight text-[#18211E]">
                    {selectedItemDisplayName}
                  </h2>
                  <div className="mt-3 rounded-[1rem] border border-[#E5ECE8] bg-[#FAFCFB] px-4 py-3">
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
              minimumBid,
              clampAuctionBidAmount(bidAmounts[selectedItem.id] ?? minimumBid),
            );
            const canSubmit =
              !isLoading &&
              isSubmittingItemId === null &&
              selectedBidAmount >= minimumBid &&
              selectedBidAmount <= maxBid;

            return (
              <div className="mx-4 mb-4 rounded-[1.25rem] border border-[#DCE7E1] bg-white p-4 shadow-[0_10px_24px_rgba(28,45,40,0.07)] md:mx-5 md:mb-5">
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
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2 sm:grid-cols-[3.2rem_minmax(0,1fr)_3.2rem_10rem]">
                  <button
                    type="button"
                    onClick={() => setBidAmounts((previous) => ({
                      ...previous,
                      [selectedItem.id]: Math.max(minimumBid, selectedBidAmount - AUCTION_BID_STEP),
                    }))}
                    className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border border-[#E6DED3] bg-[#FFFDF9] text-[1.35rem] font-black text-[#8A5A1F] transition-colors hover:bg-[#FFF8EC]"
                    aria-label={`${selectedItemDisplayName} 입찰가 낮추기`}
                  >
                    -
                  </button>
                  <div className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border border-[#DCE7E1] bg-[#FAFCFB] px-2 text-center font-mono text-[1.28rem] font-black text-[#18211E]">
                    {formatCurrency(selectedBidAmount)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBidAmounts((previous) => ({
                      ...previous,
                      [selectedItem.id]: Math.min(maxBid, selectedBidAmount + AUCTION_BID_STEP),
                    }))}
                    className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border border-[#CFE2D8] bg-[#F6FBF8] text-[1.35rem] font-black text-[#007A57] transition-colors hover:bg-[#EAF7F1]"
                    aria-label={`${selectedItemDisplayName} 입찰가 올리기`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => openBidConfirm(selectedItem, selectedBidAmount)}
                    disabled={!canSubmit}
                    className="col-span-3 inline-flex h-12 w-full items-center justify-center rounded-[0.9rem] bg-[#007A57] text-[1rem] font-extrabold text-white shadow-[0_10px_20px_rgba(0,122,87,0.14)] transition-colors hover:bg-[#006B4D] disabled:cursor-not-allowed disabled:bg-[#C9D4CD] disabled:text-white/82 sm:col-span-1"
                  >
                    {isSubmittingItemId === selectedItem.id ? '...' : '입찰'}
                  </button>
                </div>
              </div>
            );
          })() : null}
        />
      </main>
      {pendingBid ? (() => {
        const pendingItem = auctionItems.find((item) => item.id === pendingBid.itemId);
        const pendingItemName = pendingItem
          ? getAuctionItemDisplayName(pendingItem.name, pendingItem.dayIndex)
          : '선택한 물품';
        const lastPendingItemChar = pendingItemName.trim().slice(-1);
        const pendingItemParticle = lastPendingItemChar && (lastPendingItemChar.charCodeAt(0) - 0xac00) % 28 > 0
          ? '을'
          : '를';
        const pendingCurrentBid = pendingBid.itemId
          ? auctionBids[pendingBid.itemId] ?? { amount: 0, bidder: null }
          : { amount: 0, bidder: null };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/32 px-4"
            role="presentation"
            onClick={() => {
              if (!isSubmittingItemId) setPendingBid(null);
            }}
          >
            <div
              className="w-full max-w-[34rem] rounded-[1.75rem] border-2 border-[#8DC9B7] bg-white p-6 text-left shadow-[0_28px_70px_rgba(28,45,40,0.24)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auction-bid-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="auction-bid-confirm-title" className="section-title text-center text-[1.65rem] font-extrabold leading-tight text-[#18211E]">
                {pendingItemName}{pendingItemParticle} 이 금액으로 입찰할까요?
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
                      {formatCurrency(pendingBid.amount)}
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
            </div>
          </div>
        );
      })() : null}
      {statusMessage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          role="presentation"
          onClick={() => setStatusMessage('')}
        >
          <div
            className="w-full max-w-[18rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-mono text-[1.35rem] font-black text-[#006241]">{statusMessage}</p>
            <button
              type="button"
              onClick={() => setStatusMessage('')}
              className="mt-4 inline-flex h-10 min-w-[6.5rem] items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
