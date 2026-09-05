import { RefreshCw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryCompetitionClient, LibraryCompetitionClientError, type LibraryCompetitionResponse } from '../../lib/libraryCompetitionClient';
import type { LibraryCompetitionSpeed } from '../../lib/libraryCompetition';
import { LibraryCompetitionCountFields } from '../student/library/LibraryCompetitionTable';

export function TeacherLibraryCompetitionPanel() {
  const [response, setResponse] = useState<LibraryCompetitionResponse | null>(null);
  const [counts, setCounts] = useState<Readonly<Record<string, string>>>({});
  const [speed, setSpeed] = useState<LibraryCompetitionSpeed>(1);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const apply = useCallback((next: LibraryCompetitionResponse) => {
    setResponse(next);
    setCounts(Object.fromEntries(next.competition.standings.filter(row => !row.isOurSchool).map(row => [row.schoolId, String(row.count)])));
    const latest = next.competition.state?.adjustments.at(-1);
    setSpeed(latest?.speed ?? 1);
    setPaused(latest?.paused ?? false);
    setConfirming(false);
    setConflict(false);
  }, []);
  const load = useCallback(async () => {
    if (pending.current) return;
    const token = ++request.current;
    setBusy(true);
    setMessage('');
    try {
      const next = await libraryCompetitionClient.read('enter');
      if (token === request.current) apply(next);
    } catch (error) {
      if (token !== request.current) return;
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally { if (token === request.current) setBusy(false); }
  }, [apply]);
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
  useEffect(() => { if (confirming) confirmRef.current?.focus(); }, [confirming]);
  useEffect(() => {
    if (wasConfirming.current && !confirming) {
      (conflict ? refreshRef : saveRef).current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming, conflict]);
  const state = response?.competition.state;
  const standings = response?.competition.standings ?? [];
  const changedCounts = standings.filter(row => !row.isOurSchool && Number(counts[row.schoolId]) !== row.count);
  const valid = standings.filter(row => !row.isOurSchool).every(row => {
    const value = counts[row.schoolId];
    return value !== undefined && value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
  });
  const save = async () => {
    if (!state || pending.current || !valid || conflict) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const next = await libraryCompetitionClient.settings({ expectedRevision: state.revision, speed, paused,
        counts: changedCounts.map(row => ({ schoolId: row.schoolId, count: Number(counts[row.schoolId]) })),
      });
      apply(next);
      setMessage('책방 챌린지 설정을 저장했습니다.');
    } catch (error) {
      if (error instanceof LibraryCompetitionClientError) {
        setMessage(error.message);
        if (['LIBRARY_COMPETITION_CONFLICT', 'SHARED_SETTINGS_CONFLICT', 'LIBRARY_SEASON_CHANGED'].includes(error.code)) {
          setConflict(true);
          setConfirming(false);
        }
      } else if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally { pending.current = false; setBusy(false); }
  };
  return <section className="teacher-library-competition-panel" aria-labelledby="teacher-library-competition-title" aria-busy={busy}>
    <header className="teacher-library-competition-heading"><div><Trophy aria-hidden="true" /><h2 id="teacher-library-competition-title">책방 챌린지</h2></div><button ref={refreshRef} type="button" disabled={busy} onClick={() => { void load(); }}><RefreshCw aria-hidden="true" />최신값 확인</button></header>
    {message && <p role="status" className="library-competition-message">{message}</p>}
    {busy && !response ? <p role="status">챌린지를 불러오는 중…</p> : !state ? <p>학생 책방의 순위판을 처음 열면 이번 달 챌린지가 시작됩니다.</p> : <>
      <p className="teacher-library-competition-summary"><strong>{state.seasonId.replace('-', '년 ')}월</strong><span>우리 학교는 책장에 꽂힌 책만 자동 집계합니다.</span></p>
      <form onSubmit={event => { event.preventDefault(); if (valid && !conflict && !busy) setConfirming(true); }}>
        <fieldset disabled={busy || confirming || conflict}>
          <legend>상대 학교 성장 설정</legend>
          <div className="teacher-library-competition-options"><label>성장 속도<select value={speed} onChange={event => {
            const value = Number(event.target.value);
            if (value === 0.5 || value === 1 || value === 1.5) setSpeed(value);
          }}><option value={0.5}>느리게 · 0.5배</option><option value={1}>보통 · 1배</option><option value={1.5}>빠르게 · 1.5배</option></select></label>
            <label className="teacher-library-competition-pause"><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} />상대 성장 일시정지</label></div>
          <LibraryCompetitionCountFields standings={standings} counts={counts} disabled={busy || confirming || conflict} onChange={(schoolId, value) => setCounts(current => ({ ...current, [schoolId]: value }))} />
        </fieldset>
        {confirming ? <div className="teacher-library-competition-confirm" role="group" aria-label="변경 사항 확인"><h3>이 설정을 반 전체에 적용할까요?</h3><p>권수 변경 {changedCounts.length}개 학교 · 성장 {speed}배 · {paused ? '일시정지' : '진행'}</p>
          {changedCounts.length > 0 && <ul>{changedCounts.map(row => <li key={row.schoolId}>{row.schoolName}: {row.count} → {counts[row.schoolId]}권</li>)}</ul>}
          <div><button type="button" disabled={busy} onClick={() => setConfirming(false)}>돌아가기</button><button ref={confirmRef} type="button" disabled={busy} onClick={() => { void save(); }}>{busy ? '저장 중…' : '확인하고 적용'}</button></div>
        </div> : <button ref={saveRef} className="teacher-library-competition-save" type="submit" disabled={busy || conflict || !valid}>변경 사항 확인</button>}
      </form>
      <details className="teacher-library-competition-history"><summary>변경 이력 {state.adjustments.length}건</summary>{state.adjustments.length === 0 ? <p>아직 변경한 설정이 없습니다.</p> : <ol>{[...state.adjustments].reverse().map(entry => <li key={entry.id}><time dateTime={entry.at}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.at))}</time><span>{entry.speed}배 · {entry.paused ? '일시정지' : '진행'} · 권수 설정 {entry.counts.length}개 학교</span></li>)}</ol>}</details>
    </>}
  </section>;
}
