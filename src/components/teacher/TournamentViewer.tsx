import { Download, Shuffle, SkipForward, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';
import {
  clearTournamentWinner,
  countTournamentResults,
  createTournament,
  getTournamentContestants,
  getTournamentWinner,
  setTournamentWinner,
  type Tournament,
} from '../../lib/tournament';
import {
  TOURNAMENT_CHAMPION,
  TOURNAMENT_CHAMPION_KEY,
  TOURNAMENT_STAGE_HEIGHT,
  TOURNAMENT_STAGE_WIDTH,
  getTournamentDestinationKey,
  getTournamentLayout,
  type TournamentLayout,
} from '../../lib/tournamentLayout';
import { playTournamentDraw, playTournamentMatch, type TournamentMotionContext, type TournamentMotionPoint } from '../../lib/tournamentMotion';
import { useModalFocus } from '../../lib/useModalFocus';
import StableLabel from '../StableLabel';
import StudentConfirmDialog from '../student/StudentConfirmDialog';
import TournamentBracket from './TournamentBracket';

interface TournamentViewerProps {
  /** 아직 뽑지 않았으면 빈 대진표 */
  readonly tournament: Tournament | null;
  readonly emptyTournament: Tournament;
  readonly profileAssignments: FailureProfileAssignments;
  readonly returnFocusRef: RefObject<HTMLElement | null>;
  readonly isDownloading: boolean;
  readonly downloadError: string;
  readonly onDownload: () => void;
  readonly onChange: (tournament: Tournament) => void;
  readonly onClose: () => void;
}

type PendingConfirm = { readonly kind: 'redraw' } | { readonly kind: 'undo'; readonly match: number; readonly removedCount: number };

const NO_KEYS: ReadonlySet<string> = new Set();

const getMotionPoint = (layout: TournamentLayout, key: string): TournamentMotionPoint => {
  if (key === TOURNAMENT_CHAMPION_KEY) return TOURNAMENT_CHAMPION;
  const slot = layout.slots.find((candidate) => candidate.key === key);
  return slot
    ? { x: slot.x + (slot.isRound ? slot.width : slot.height) / 2, y: slot.y + slot.height / 2, size: slot.height }
    : TOURNAMENT_CHAMPION;
};

export default function TournamentViewer({
  tournament,
  emptyTournament,
  profileAssignments,
  returnFocusRef,
  isDownloading,
  downloadError,
  onDownload,
  onChange,
  onClose,
}: TournamentViewerProps) {
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultCount = tournament ? countTournamentResults(tournament) : 0;

  useModalFocus({ dialogRef, isOpen: true, onDismiss: onClose, initialFocusRef: primaryButtonRef, returnFocusRef });

  useEffect(() => () => abortRef.current?.abort(), []);

  // 무대(1600×900)를 SVG와 같은 비율·위치로 맞춘다.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const layer = layerRef.current;
    if (!dialog || !layer) return undefined;
    const fit = () => {
      const scale = Math.min(dialog.clientWidth / TOURNAMENT_STAGE_WIDTH, dialog.clientHeight / TOURNAMENT_STAGE_HEIGHT);
      layer.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, []);

  const focusPrimary = () => window.requestAnimationFrame(() => primaryButtonRef.current?.focus({ preventScroll: true }));

  const revealKey = (key: string) => {
    flushSync(() => setHiddenKeys((previous) => new Set([...previous].filter((hidden) => hidden !== key))));
    dialogRef.current?.querySelector(`[data-slot="${key}"]`)?.animate([
      { transform: 'scale(1.35, .72)' },
      { transform: 'scale(.86, 1.2)', offset: 0.3 },
      { transform: 'scale(1.1, .94)', offset: 0.6 },
      { transform: 'scale(1)' },
    ], { duration: 520, easing: 'ease-out' });
  };

  // 교사 화면은 동작 줄이기에서 제외한다(RootApp의 data-teacher-motion). 건너뛰기로 바로 끝낼 수 있다.
  const run = async (keys: readonly string[], motion: (context: TournamentMotionContext) => Promise<void>) => {
    const layer = layerRef.current;
    if (!layer) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setHiddenKeys(new Set(keys));
    setIsPlaying(true);
    focusPrimary();
    try {
      await motion({ layer, signal: controller.signal, getProfile: (student) => getFailureProfileImage(student, profileAssignments) });
    } catch (error) {
      // 애니메이션은 장식이므로 건너뛰거나 실패해도 정해진 결과를 바로 보여 준다.
      if (!controller.signal.aborted) console.warn('Tournament motion stopped.', error);
    } finally {
      layer.replaceChildren();
      abortRef.current = null;
      setHiddenKeys(NO_KEYS);
      setIsPlaying(false);
      focusPrimary();
    }
  };

  const draw = () => {
    const next = createTournament((tournament ?? emptyTournament).title);
    const layout = getTournamentLayout(next);
    const entries = layout.slots.flatMap((slot) => (slot.isEntry && slot.student !== null ? [{
      ...getMotionPoint(layout, slot.key),
      key: slot.key,
      student: slot.student,
    }] : []));
    onChange(next);
    void run(entries.map((entry) => entry.key), (context) => playTournamentDraw(context, entries, revealKey));
  };

  const selectStudent = (match: number, student: number) => {
    if (!tournament || isPlaying) return;
    if (getTournamentWinner(tournament, match) === student) {
      const cleared = clearTournamentWinner(tournament, match);
      const removedCount = resultCount - countTournamentResults(cleared);
      if (removedCount > 1) setPendingConfirm({ kind: 'undo', match, removedCount });
      else onChange(cleared);
      return;
    }
    const contestants = getTournamentContestants(tournament, match);
    const loser = contestants.find((contestant) => contestant !== null && contestant !== student);
    onChange(setTournamentWinner(tournament, match, student));
    if (!loser) return;
    const layout = getTournamentLayout(tournament);
    const winnerIndex = contestants.indexOf(student);
    const destinationKey = getTournamentDestinationKey(match);
    const ownKeys = [`${match}:0`, `${match}:1`];
    void run([...ownKeys, destinationKey], (context) => playTournamentMatch(context, {
      winner: { student, from: getMotionPoint(layout, ownKeys[winnerIndex]) },
      loser: { student: loser, from: getMotionPoint(layout, ownKeys[1 - winnerIndex]) },
      destination: getMotionPoint(layout, destinationKey),
      path: layout.connectors.find((connector) => connector.fromKey === ownKeys[winnerIndex])?.path ?? '',
      isWinnerFirst: winnerIndex === 0,
      isFinal: match === 1,
      onReturn: () => setHiddenKeys(new Set([destinationKey])),
      onLand: () => revealKey(destinationKey),
    }));
  };

  // 뒤에 설정 창이 남아 있어 useModalFocus가 이 창으로 초점을 돌려주지 못하므로 직접 돌려준다.
  const closeConfirm = () => {
    setPendingConfirm(null);
    focusPrimary();
  };

  const confirmPending = () => {
    const confirmed = pendingConfirm;
    closeConfirm();
    if (confirmed?.kind === 'redraw') draw();
    else if (confirmed && tournament) onChange(clearTournamentWinner(tournament, confirmed.match));
  };

  return (
    <>
      <section ref={dialogRef} className="teacher-settings-theme tournament-viewer" role="dialog" aria-modal="true" aria-label="토너먼트 크게 보기" aria-busy={isPlaying}>
        <TournamentBracket
          tournament={tournament ?? emptyTournament}
          profileAssignments={profileAssignments}
          hiddenKeys={hiddenKeys}
          isEmpty={!tournament}
          onSelect={selectStudent}
        />
        <div ref={layerRef} className="tournament-stage" data-playing={isPlaying || undefined} aria-hidden="true" />
        <div className="tournament-viewer-actions">
          {isPlaying ? (
            <button ref={primaryButtonRef} type="button" className="tournament-button" onClick={() => abortRef.current?.abort()}>
              <SkipForward size={18} aria-hidden="true" />
              건너뛰기
            </button>
          ) : (
            <>
              {tournament && resultCount === 0 ? <p>이긴 학생을 누르세요</p> : null}
              {tournament ? (
                <>
                  <button ref={primaryButtonRef} type="button" className="tournament-button" onClick={() => setPendingConfirm({ kind: 'redraw' })}>
                    <Shuffle size={18} aria-hidden="true" />
                    다시 뽑기
                  </button>
                  <button type="button" className="tournament-button" disabled={isDownloading} onClick={onDownload}>
                    <Download size={18} aria-hidden="true" />
                    <StableLabel busy={isDownloading} busyLabel="만드는 중" label="다운로드" />
                  </button>
                </>
              ) : (
                <button ref={primaryButtonRef} type="button" className="tournament-button tournament-draw-button" onClick={draw}>
                  <Shuffle size={26} aria-hidden="true" />
                  뽑기
                </button>
              )}
              <button type="button" className="tournament-button" onClick={onClose}>
                <X size={18} aria-hidden="true" />
                닫기
              </button>
              {downloadError ? <p className="tournament-error" role="alert">{downloadError}</p> : null}
            </>
          )}
        </div>
      </section>
      {pendingConfirm ? (
        <StudentConfirmDialog
          isOpen
          title={pendingConfirm.kind === 'redraw' ? '대진표를 다시 뽑을까요?' : '이 경기 결과를 취소할까요?'}
          description={pendingConfirm.kind === 'redraw'
            ? `지금 대진표${resultCount > 0 ? `와 경기 결과 ${resultCount}개` : ''}가 사라지고 되돌릴 수 없습니다.`
            : `이어진 경기까지 결과 ${pendingConfirm.removedCount}개가 취소됩니다.`}
          confirmLabel={pendingConfirm.kind === 'redraw' ? '다시 뽑기' : '결과 취소'}
          cancelLabel="닫기"
          isPending={false}
          returnFocusRef={primaryButtonRef}
          onCancel={closeConfirm}
          onConfirm={confirmPending}
        />
      ) : null}
    </>
  );
}
