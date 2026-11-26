import type { ReactNode } from 'react';
import { Gavel } from 'lucide-react';
import {
  AUCTION_MAX_ITEMS_PER_DAY,
  type AuctionAwards,
  type AuctionBids,
  type AuctionItem,
} from '../lib/currency';
import type { FailureProfileAssignments } from '../lib/failureExhibition';
import { AuctionItemCard } from './AuctionItemCard';

interface AuctionRoomProps {
  /** Today's items only; earlier days are not shown to students. */
  readonly auctionItems: readonly AuctionItem[];
  readonly auctionBids: AuctionBids;
  readonly auctionAwards?: AuctionAwards;
  /** During lunch the shown lead is the one from before lunch, and lunch bids stay hidden. */
  readonly isLunchSealed?: boolean;
  readonly ownBidAmounts?: Readonly<Record<string, number>>;
  readonly studentNumber: number;
  readonly selectedItemId?: string | null;
  readonly profileAssignments: FailureProfileAssignments;
  /** The bid bar for the selected item, under the tickets. */
  readonly seat?: ReactNode;
  readonly onSelectItem?: (item: AuctionItem) => void;
}

/** Today's auction: up to six tickets in two rows, with the bid bar underneath. */
export default function AuctionRoom({
  auctionItems,
  auctionBids,
  auctionAwards,
  isLunchSealed = false,
  ownBidAmounts,
  studentNumber,
  selectedItemId,
  profileAssignments,
  seat,
  onSelectItem,
}: AuctionRoomProps) {
  const items = auctionItems.slice(0, AUCTION_MAX_ITEMS_PER_DAY);
  // The stage always holds six places; unused ones stay as blank tickets.
  const emptySlots = Array.from({ length: AUCTION_MAX_ITEMS_PER_DAY - items.length }, (_, index) => index);

  return (
    <section className="auction-room-shell auction-hall" aria-label="오늘의 경매">
      <>
          <div className="auction-hall-tickets" data-item-count={items.length}>
            {items.map((item, slotIndex) => (
              <AuctionItemCard
                key={item.id}
                item={item}
                slotIndex={slotIndex}
                currentBid={auctionBids[item.id] ?? { amount: 0, bidder: null }}
                award={auctionAwards?.[item.id] ?? null}
                isLunchSealed={isLunchSealed}
                lunchOwnBid={ownBidAmounts?.[item.id] ?? null}
                studentNumber={studentNumber}
                isSelected={item.id === selectedItemId}
                profileAssignments={profileAssignments}
                onSelect={(selected) => onSelectItem?.(selected)}
              />
            ))}
            {emptySlots.map((slot) => (
              <span key={`empty-${slot}`} className="auction-ticket auction-ticket-blank" aria-hidden="true">
                <span className="auction-ticket-body" />
                <span className="auction-ticket-stub" />
                <span className="auction-ticket-notch auction-ticket-notch-top" />
                <span className="auction-ticket-notch auction-ticket-notch-bottom" />
              </span>
            ))}
            {items.length === 0 ? (
              <div className="auction-hall-empty">
                <Gavel size={44} strokeWidth={2.2} aria-hidden="true" />
                <p>오늘은 경매가 없어요</p>
              </div>
            ) : null}
          </div>
          {items.length > 0 ? seat : null}
      </>
    </section>
  );
}
