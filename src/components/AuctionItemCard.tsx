import { useEffect, useRef, useState } from 'react';
import {
  formatCurrency,
  getAuctionItemDisplayName,
  type AuctionAward,
  type AuctionBid,
  type AuctionItem,
} from '../lib/currency';
import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../lib/failureExhibition';

export type AuctionLotState = 'open' | 'mine' | 'empty' | 'lunch' | 'won';

/** One state per ticket, so the stage, the bid bar and their labels always agree. */
export const getAuctionLotState = (
  currentBid: AuctionBid, award: AuctionAward | null, isLunchSealed: boolean, studentNumber: number,
): AuctionLotState => {
  if (award) return 'won';
  if (isLunchSealed) return 'lunch';
  if (currentBid.bidder === null || currentBid.amount <= 0) return 'empty';
  return currentBid.bidder === studentNumber ? 'mine' : 'open';
};

/** Six question-mark profiles, one colour per ticket slot, shown while lunch hides the lead. */
export const AUCTION_LUNCH_PROFILE_COUNT = 6;
export const getAuctionLunchProfileImage = (slotIndex: number): string => (
  `/auction/question-${(Math.max(0, slotIndex) % AUCTION_LUNCH_PROFILE_COUNT) + 1}.png`
);

/** The label under a profile; the student's own lead shows only "나". */
export const getAuctionLotLabel = (state: AuctionLotState, leader: number | null): string => {
  if (state === 'lunch') return '';
  if (state === 'empty') return '첫 입찰';
  if (state === 'mine') return '나';
  return `${leader ?? '-'}번`;
};

interface AuctionProfileProps {
  readonly state: AuctionLotState;
  readonly leader: number | null;
  readonly slotIndex: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly className?: string;
}

/** The leading student's profile, the lunch question mark, or an empty dashed slot. */
export function AuctionProfile({ state, leader, slotIndex, profileAssignments, className = '' }: AuctionProfileProps) {
  if (state === 'empty' || (state !== 'lunch' && leader === null)) {
    return <span className={`auction-profile auction-profile-empty ${className}`} aria-hidden="true" />;
  }
  const src = state === 'lunch'
    ? getAuctionLunchProfileImage(slotIndex)
    : getFailureProfileImage(leader ?? 0, profileAssignments);
  return (
    <span className={`auction-profile ${className}`} aria-hidden="true">
      <img key={src} src={src} alt="" width={192} height={192} decoding="async" />
    </span>
  );
}

interface AuctionTicketProps {
  readonly key?: string;
  readonly item: AuctionItem;
  readonly slotIndex: number;
  readonly currentBid: AuctionBid;
  readonly award: AuctionAward | null;
  readonly isLunchSealed: boolean;
  /** The student's own lunch bid, or null before they bid at lunch. */
  readonly lunchOwnBid: number | null;
  readonly studentNumber: number;
  readonly isSelected: boolean;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onSelect: (item: AuctionItem) => void;
}

/** One auction item as a ticket: name and price on the body, the leader on the stub. */
export function AuctionItemCard({
  item,
  slotIndex,
  currentBid,
  award,
  isLunchSealed,
  lunchOwnBid,
  studentNumber,
  isSelected,
  profileAssignments,
  onSelect,
}: AuctionTicketProps) {
  const itemDisplayName = getAuctionItemDisplayName(item.name, item.dayIndex);
  const state = getAuctionLotState(currentBid, award, isLunchSealed, studentNumber);
  const leader = award?.winner ?? currentBid.bidder;
  // No bid yet reads as 0; the start price is where the bid box begins.
  const amount = award?.amount ?? (state === 'empty' ? 0 : currentBid.amount);
  const label = getAuctionLotLabel(state, leader);

  // The stamp lands only when the award arrives while the screen is open, not on every load.
  const awardKey = award ? `${award.winner}:${award.amount}` : '';
  const previousAwardKey = useRef(awardKey);
  const [isStamping, setIsStamping] = useState(false);
  useEffect(() => {
    if (awardKey && !previousAwardKey.current) setIsStamping(true);
    previousAwardKey.current = awardKey;
  }, [awardKey]);

  const spoken = state === 'lunch'
    ? `점심 전 ${formatCurrency(amount)}, 지금 최고가는 비공개${lunchOwnBid === null ? '' : `, 내가 부른 값 ${formatCurrency(lunchOwnBid)}`}`
    : state === 'empty' ? `아직 입찰 없음, 시작가 ${formatCurrency(item.startPrice)}`
      : state === 'won' ? `${leader}번이 ${formatCurrency(amount)}에 낙찰`
        : `현재가 ${formatCurrency(amount)}, ${state === 'mine' ? '내 입찰이 가장 높아요' : `${leader}번이 가장 높아요`}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={isSelected}
      aria-label={`${itemDisplayName}, ${spoken}`}
      className="auction-ticket"
      data-state={state}
      data-selected={isSelected ? 'true' : undefined}
    >
      <span className="auction-ticket-body">
        <span className="auction-ticket-name">{itemDisplayName}</span>
        {state === 'lunch' ? (
          <span className="auction-ticket-lunch">
            <span className="auction-ticket-before">
              <small>점심 전</small>
              <strong>{amount}</strong>
              <small>고마</small>
            </span>
            {lunchOwnBid !== null ? (
              <span className="auction-ticket-own">내가 부른 값 <strong>{lunchOwnBid}</strong> 고마</span>
            ) : null}
          </span>
        ) : (
          <span className="auction-ticket-price">
            <strong key={amount}>{amount}</strong>
            <small>고마</small>
          </span>
        )}
      </span>
      <span className="auction-ticket-stub">
        <AuctionProfile state={state} leader={leader} slotIndex={slotIndex} profileAssignments={profileAssignments} />
        {label ? <span className="auction-ticket-label">{label}</span> : null}
      </span>
      <span className="auction-ticket-notch auction-ticket-notch-top" aria-hidden="true" />
      <span className="auction-ticket-notch auction-ticket-notch-bottom" aria-hidden="true" />
      {state === 'won' ? (
        <span
          className="auction-ticket-stamp"
          data-stamping={isStamping ? 'true' : undefined}
          onAnimationEnd={() => setIsStamping(false)}
          aria-hidden="true"
        >
          낙찰
        </span>
      ) : null}
    </button>
  );
}
