import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, Hammer, House, KeyRound, PaintRoller, Sparkles, X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { STUDENT_HOUSE_DESIGNS, type StudentEconomyAction } from '../../lib/studentEconomy';
import { useModalFocus } from '../../lib/useModalFocus';

export type StudentHouseCelebrationResult = {
  readonly kind: 'repair' | 'purchase';
  readonly name: string;
  readonly imageSrc: string;
};

export function getStudentHouseCelebration(action: StudentEconomyAction): StudentHouseCelebrationResult | null {
  if (action.type === 'buy_item' && action.itemId === 'house_repair') {
    return { kind: 'repair', name: '우리 집', imageSrc: '/student-house-after.webp' };
  }
  if (action.type === 'buy_house') {
    const house = STUDENT_HOUSE_DESIGNS.find(item => item.id === action.houseId);
    return house ? { kind: 'purchase', name: house.name, imageSrc: house.imageSrc } : null;
  }
  return null;
}

const confetti = Array.from({ length: 28 }, (_, index) => {
  const angle = (index / 28) * Math.PI * 2;
  const reach = 125 + (index % 4) * 23;
  return {
    '--piece-x': `${Math.round(Math.cos(angle) * reach)}px`,
    '--piece-y': `${Math.round(Math.sin(angle) * reach * .62 - 45)}px`,
    '--piece-turn': `${(index % 2 ? 1 : -1) * (160 + index * 23)}deg`,
    '--piece-delay': `${(index % 7) * 35}ms`,
    '--piece-color': ['#f3c56c', '#86cfa9', '#efad95', '#fff0b9'][index % 4],
  } as CSSProperties;
});

export default function StudentHouseCelebration({ result, onClose, returnFocusRef }: {
  readonly result: StudentHouseCelebrationResult;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const repair = result.kind === 'repair';
  useModalFocus({ dialogRef, isOpen: true, onDismiss: onClose, initialFocusRef: closeRef, returnFocusRef });

  useEffect(() => {
    let active = true;
    const sources = repair ? [result.imageSrc, '/student-house-before.webp'] : [result.imageSrc];
    void Promise.all(sources.map(src => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => { if (active && src === result.imageSrc) setImageFailed(true); });
    })).then(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [repair, result.imageSrc]);

  return createPortal(
    <div className="student-house-celebration-backdrop" onClick={onClose}>
      <section ref={dialogRef} className="student-house-celebration" role="dialog" aria-modal="true"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
        data-kind={result.kind} data-ready={loaded} data-reduced-motion={Boolean(reducedMotion)}
        onClick={event => event.stopPropagation()}>
        <button ref={closeRef} type="button" className="student-house-celebration-close" aria-label="축하 화면 닫기" onClick={onClose}><X aria-hidden="true" /></button>
        <header className="student-house-celebration-header">
          <span><Check aria-hidden="true" />{repair ? '집 고치기 완료' : '새집 마련 완료'}</span>
          <h2 id={`${id}-title`}>{repair ? '우리 집이 새로워졌어요!' : result.name}</h2>
          <p id={`${id}-description`}>{repair ? '튼튼하게 고친 우리 집. 이제 다른 집도 만나 볼까요?' : '내가 고른 집에서 새로운 이야기가 시작돼요.'}</p>
        </header>
        <div className="student-house-celebration-stage" aria-hidden="true">
          <div className="student-house-celebration-rays" />
          <div className="student-house-celebration-orbit" />
          <div className="student-house-celebration-ground" />
          <div className="student-house-celebration-ring" />
          <div className="student-house-celebration-art">
            {imageFailed ? <House className="student-house-celebration-fallback" /> : <>
              {repair && <img className="student-house-celebration-before" src="/student-house-before.webp" alt="" />}
              <img className="student-house-celebration-house" src={result.imageSrc} alt="" />
            </>}
          </div>
          {repair ? <>
            <span className="student-house-celebration-tool is-hammer"><Hammer /></span>
            <span className="student-house-celebration-tool is-roller"><PaintRoller /></span>
            <span className="student-house-celebration-sweep" />
          </> : <span className="student-house-celebration-key"><KeyRound /></span>}
          <div className="student-house-celebration-confetti">{confetti.map((style, index) => <i key={index} style={style} />)}</div>
          {[0, 1, 2, 3, 4, 5].map(index => <Sparkles key={index} className={`student-house-celebration-star star-${index}`} />)}
          <span className="student-house-celebration-seal"><Check />{repair ? '수리 완료' : '나의 새집'}</span>
        </div>
        <footer>
          <span><Sparkles aria-hidden="true" />{repair ? '집 상점이 열렸어요' : '우리 집으로 바로 적용했어요'}</span>
          <button type="button" onClick={onClose}>{repair ? '집 상점 둘러보기' : '좋아요!'}</button>
        </footer>
      </section>
    </div>, document.body,
  );
}
