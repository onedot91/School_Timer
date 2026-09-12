import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';

import type { TodayFriendGenre } from '../../lib/todayFriend';
import {
  hasSeenTodayFriendIllustration,
  markTodayFriendIllustrationSeen,
} from '../../lib/todayFriendReveal';
import { useModalFocus } from '../../lib/useModalFocus';

interface TodayFriendIllustrationIntroProps {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly genre: TodayFriendGenre;
  readonly genreLabel: string;
  readonly illustrationSrc: string;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
}

const AUTO_DISMISS_MS = 3600;

const getStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export default function TodayFriendIllustrationIntro({
  dateKey,
  studentNumber,
  genre,
  genreLabel,
  illustrationSrc,
  returnFocusRef,
}: TodayFriendIllustrationIntroProps) {
  const identity = { dateKey, studentNumber };
  const [isOpen, setIsOpen] = useState(() => {
    const storage = getStorage();
    return !storage || !hasSeenTodayFriendIllustration(storage, identity);
  });
  const [isImageReady, setIsImageReady] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  const stopAutoDismiss = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  const dismiss = useCallback(() => {
    stopAutoDismiss();
    setIsOpen(false);
  }, [stopAutoDismiss]);

  useModalFocus({
    dialogRef,
    isOpen,
    onDismiss: dismiss,
    initialFocusRef: startRef,
    returnFocusRef,
  });

  useEffect(() => {
    if (!isOpen) return;
    const storage = getStorage();
    if (storage) markTodayFriendIllustrationSeen(storage, identity);
  }, [dateKey, isOpen, studentNumber]);

  useEffect(() => {
    if (!isOpen || !isImageReady) return;
    timerRef.current = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return stopAutoDismiss;
  }, [dismiss, isImageReady, isOpen, stopAutoDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="today-friend-intro-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <section
        ref={dialogRef}
        className="today-friend-intro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-friend-intro-title"
        data-genre={genre}
        data-reduced-motion={reducedMotion ? 'true' : undefined}
        onPointerDown={stopAutoDismiss}
        onKeyDown={stopAutoDismiss}
      >
        <h2 id="today-friend-intro-title" className="sr-only">{genreLabel} 미션</h2>
        <button type="button" className="today-friend-intro-close" aria-label="미션 일러스트 닫기" onClick={dismiss}>
          <X aria-hidden="true" />
        </button>
        <img
          src={illustrationSrc}
          alt={`${genreLabel} 미션 일러스트`}
          width={1774}
          height={887}
          decoding="async"
          onLoad={() => setIsImageReady(true)}
          onError={() => setIsImageReady(true)}
        />
        <button ref={startRef} type="button" className="today-friend-intro-start" onClick={dismiss}>시작하기</button>
      </section>
    </div>
  );
}
