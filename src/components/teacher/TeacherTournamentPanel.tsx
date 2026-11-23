import { Download, Maximize2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import { getKoreanLocalDateKey } from '../../lib/studentEmotion';
import {
  TOURNAMENT_DEFAULT_TITLE,
  TOURNAMENT_MATCH_COUNT,
  TOURNAMENT_TITLE_MAX_LENGTH,
  countTournamentResults,
  createTournament,
  limitTournamentTitle,
  type Tournament,
} from '../../lib/tournament';
import { downloadBlob, renderTournamentPng } from '../../lib/tournamentImage';
import StableLabel from '../StableLabel';
import SettingsPanelFrame, { SettingsStatusChip } from './SettingsPanelFrame';
import TournamentBracket from './TournamentBracket';
import TournamentViewer from './TournamentViewer';
import '../../tournament.css';

interface TeacherTournamentPanelProps {
  readonly tabs: ReactNode;
  readonly tournament: Tournament | null;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onChange: (tournament: Tournament) => void;
}

const EMPTY_TOURNAMENT = createTournament('', () => 0);

const getFileName = (title: string) => (
  `${(title.trim() || TOURNAMENT_DEFAULT_TITLE).replace(/[\\/:*?"<>|]/g, ' ').trim() || TOURNAMENT_DEFAULT_TITLE} ${getKoreanLocalDateKey()}.png`
);

export default function TeacherTournamentPanel({ tabs, tournament, profileAssignments, onChange }: TeacherTournamentPanelProps) {
  const [titleDraft, setTitleDraft] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  const title = tournament?.title ?? titleDraft;
  const emptyTournament = { ...EMPTY_TOURNAMENT, title };
  const resultCount = tournament ? countTournamentResults(tournament) : 0;

  const changeTitle = (value: string) => {
    const nextTitle = limitTournamentTitle(value);
    if (tournament) onChange({ ...tournament, title: nextTitle });
    else setTitleDraft(nextTitle);
  };

  const download = async () => {
    if (!svgRef.current || isDownloading) return;
    setIsDownloading(true);
    setDownloadError('');
    try {
      downloadBlob(await renderTournamentPng(svgRef.current), getFileName(title));
    } catch {
      setDownloadError('그림을 만들지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SettingsPanelFrame
      label="토너먼트"
      className="tournament-panel"
      status={(
        <>
          {tabs}
          {resultCount > 0 ? <SettingsStatusChip tone="accent">경기 {resultCount} / {TOURNAMENT_MATCH_COUNT}</SettingsStatusChip> : null}
        </>
      )}
      action={(
        <button ref={expandButtonRef} type="button" className="settings-frame-primary" onClick={() => setIsExpanded(true)}>
          <Maximize2 size={17} aria-hidden="true" />
          {tournament ? '크게 보기' : '뽑으러 가기'}
        </button>
      )}
    >
      <div className="tournament-toolbar">
        <input
          type="text"
          value={title}
          maxLength={TOURNAMENT_TITLE_MAX_LENGTH}
          placeholder={TOURNAMENT_DEFAULT_TITLE}
          aria-label="토너먼트 이름"
          onChange={(event) => changeTitle(event.target.value)}
        />
        {tournament ? (
          <button type="button" className="tournament-button" disabled={isDownloading} onClick={() => void download()}>
            <Download size={18} aria-hidden="true" />
            <StableLabel busy={isDownloading} busyLabel="만드는 중" label="다운로드" />
          </button>
        ) : null}
      </div>
      {downloadError && !isExpanded ? <p className="tournament-error" role="alert">{downloadError}</p> : null}
      <button type="button" className="tournament-preview" aria-label="대진표 크게 보기" onClick={() => setIsExpanded(true)}>
        <TournamentBracket
          tournament={tournament ?? emptyTournament}
          profileAssignments={profileAssignments}
          isEmpty={!tournament}
          svgRef={svgRef}
        />
      </button>
      {isExpanded ? createPortal(
        <TournamentViewer
          tournament={tournament}
          emptyTournament={emptyTournament}
          profileAssignments={profileAssignments}
          returnFocusRef={expandButtonRef}
          isDownloading={isDownloading}
          downloadError={downloadError}
          onDownload={() => void download()}
          onChange={onChange}
          onClose={() => setIsExpanded(false)}
        />,
        document.body,
      ) : null}
    </SettingsPanelFrame>
  );
}
