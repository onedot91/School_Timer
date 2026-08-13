import { getDailyDonationCharacterSource } from '../../lib/dailyDonationCharacter';
import { getKoreanLocalDateKey } from '../../lib/studentEmotion';

export type StudentStoreSection = 'plaza' | 'bank' | 'shop' | 'auction' | 'securities' | 'securities-trade' | 'donation';

interface StudentPlazaProps {
  onOpen: (section: Exclude<StudentStoreSection, 'plaza' | 'securities-trade'>) => void;
}

const HOTSPOTS = [
  { section: 'bank', label: '은행', className: 'student-plaza-hotspot-bank' },
  { section: 'shop', label: '상점', className: 'student-plaza-hotspot-shop' },
  { section: 'auction', label: '경매장', className: 'student-plaza-hotspot-auction' },
  { section: 'securities', label: '증권사', className: 'student-plaza-hotspot-securities' },
] as const;

export default function StudentPlaza({ onOpen }: StudentPlazaProps) {
  const donationCharacterSource = getDailyDonationCharacterSource(getKoreanLocalDateKey());

  return (
    <section className="student-plaza" aria-label="고마 광장">
      <img src="/student-plaza.png" alt="은행, 상점, 경매장, 증권사가 있는 고마 광장" />
      {HOTSPOTS.map((hotspot) => (
        <button
          key={hotspot.section}
          type="button"
          className={`student-plaza-hotspot ${hotspot.className}`}
          aria-label={`${hotspot.label}으로 이동`}
          onClick={() => onOpen(hotspot.section)}
        >
          <span>{hotspot.label}</span>
        </button>
      ))}
      <button
        type="button"
        className="student-plaza-hotspot student-plaza-hotspot-donation"
        aria-label="기부하러 이동"
        onClick={() => onOpen('donation')}
      >
        <img src={donationCharacterSource} alt="" />
      </button>
    </section>
  );
}
