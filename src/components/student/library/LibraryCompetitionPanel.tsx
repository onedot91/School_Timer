import { BookOpen, History, RefreshCw, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { libraryCompetitionClient, type LibraryCompetitionHistoryResponse, type LibraryCompetitionResponse } from '../../../lib/libraryCompetitionClient';
import { useModalFocus } from '../../../lib/useModalFocus';
import { LibraryCompetitionTable } from './LibraryCompetitionTable';

export function LibraryCompetitionPanel({ onClose, onSnapshot, returnFocusRef }: {
  readonly onClose: () => void;
  readonly onSnapshot: (response: LibraryCompetitionResponse) => void;
  readonly returnFocusRef?: RefObject<HTMLCanvasElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const snapshotCallback = useRef(onSnapshot);
  snapshotCallback.current = onSnapshot;
  const request = useRef(0);
  const [response, setResponse] = useState<LibraryCompetitionResponse | null>(null);
  const [history, setHistory] = useState<LibraryCompetitionHistoryResponse | null>(null);
  const [past, setPast] = useState(false);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useModalFocus({ dialogRef, isOpen: true, onDismiss: onClose, initialFocusRef: closeRef, returnFocusRef });

  const load = useCallback(async (archive: boolean, selectedMonth?: string) => {
    const token = ++request.current;
    setLoading(true);
    setMessage('');
    try {
      if (archive) {
        let result = await libraryCompetitionClient.history(selectedMonth);
        const latestMonth = result.months[0]?.seasonId;
        if (!selectedMonth && latestMonth) {
          const months = result.months;
          result = { ...await libraryCompetitionClient.history(latestMonth), months };
        }
        if (token !== request.current) return;
        setHistory(previous => selectedMonth && previous ? { ...result, months: previous.months } : result);
        setMonth(result.archive?.seasonId ?? selectedMonth ?? '');
      } else {
        const result = await libraryCompetitionClient.read('open');
        if (token !== request.current) return;
        setResponse(result);
        snapshotCallback.current(result);
        if (result.rolledOver) setMessage('새로운 달의 챌린지가 시작됐어요. 지난 책은 지난 기록에 보관했어요.');
      }
    } catch (error) {
      if (token !== request.current) return;
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => { void load(false); return () => { request.current += 1; }; }, [load]);
  const standings = past ? history?.archive?.standings ?? [] : response?.competition.standings ?? [];
  const season = past ? history?.archive?.seasonId : response?.competition.state?.seasonId;

  return <div className="library-competition-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="library-competition-panel" role="dialog" aria-modal="true" aria-labelledby="library-competition-title" aria-busy={loading}>
      <header className="library-competition-heading">
        <span className="library-competition-trophy"><Trophy aria-hidden="true" /></span>
        <div><p>{season ? `${season.replace('-', '년 ')}월` : '우리의 책을 모아요'}</p><h2 id="library-competition-title">전국 책방 챌린지</h2></div>
        <button ref={closeRef} type="button" className="library-competition-icon" onClick={onClose} aria-label="순위판 닫기"><X aria-hidden="true" /></button>
      </header>
      <nav className="library-competition-tabs" aria-label="챌린지 기록">
        <button type="button" aria-pressed={!past} onClick={() => { setPast(false); void load(false); }}><Trophy aria-hidden="true" />이번 달</button>
        <button type="button" aria-pressed={past} onClick={() => { setPast(true); void load(true); }}><History aria-hidden="true" />지난 기록</button>
        <button type="button" className="library-competition-icon" disabled={loading} aria-label="순위 새로고침" onClick={() => { void load(past, month || undefined); }}><RefreshCw aria-hidden="true" /></button>
      </nav>
      {message && <p role="status" className="library-competition-message">{message}</p>}
      {past && history && history.months.length > 0 && <label className="library-competition-month">기록 월<select aria-label="지난 기록 월" value={month} onChange={event => { setMonth(event.target.value); void load(true, event.target.value); }}>
        <option value="" disabled>월 선택</option>{history.months.map(entry => <option key={entry.seasonId} value={entry.seasonId}>{entry.seasonId.replace('-', '년 ')}월</option>)}
      </select></label>}
      {loading ? <p className="library-competition-empty" role="status">기록을 불러오는 중…</p> : standings.length > 0 ? <LibraryCompetitionTable standings={standings} /> : <p className="library-competition-empty">{past ? '아직 지난 기록이 없어요.' : '아직 챌린지를 열 수 없어요. 책방은 그대로 이용할 수 있어요.'}</p>}
      {past && history?.archive && <details className="library-competition-books"><summary><BookOpen aria-hidden="true" />보관된 책 {history.archive.books.length}권</summary><ul>{history.archive.books.map(book => <li key={book.id}><strong>{book.title}</strong><span>{book.author}</span>{book.reflection ? <span>{book.reflection}</span> : null}</li>)}</ul></details>}
      <footer className="library-competition-footer"><BookOpen aria-hidden="true" /><span>함께 채우는 책방 · 최대 100권</span></footer>
    </div>
  </div>;
}
