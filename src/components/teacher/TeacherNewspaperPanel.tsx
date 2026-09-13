import { useRef, useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import NewspaperDialog from '../NewspaperDialog';
import { useNewspaper } from '../../lib/useNewspaper';
import { newspaperCommand, readPendingNewspaperRequests } from '../../lib/newspaperClient';
import { isReadOnlyDataMode } from '../../lib/dataMode';
import { getKoreanIsoWeekKey } from '../../lib/weeklyMission';
import { NEWSPAPER_CONFIG, QUESTION_LABELS, QUESTION_ERRORS, NewspaperError, isQuestionMode, isQuestionWeek, questionValidationCode, normalizeQuestionText, questionWeekLabel, questionWeekOptions, selectQuestionDownload, buildQuestionTxt, questionTxtFilename, parseNewspaperQuestion, type NewspaperQuestion, type QuestionMode } from '../../lib/newspaperQuestion';

function QuestionEditor({ row, busy, onSave, onDelete }: { row: NewspaperQuestion; busy: boolean; onSave: (text: string) => void; onDelete: () => void }) {
  const [text, setText] = useState(row.question_text);
  const error = text !== row.question_text ? questionValidationCode(text) : null;
  return <div className="newspaper-editor">
    <span className="newspaper-download-state">{row.downloaded_at ? '누적 완료' : '누적 대기'}</span>
    <div className="newspaper-editor-field"><input aria-label={`${row.student_number}번 ${QUESTION_LABELS[row.question_type]} 수정`} value={text} disabled={busy || isReadOnlyDataMode}
      onChange={event => setText(event.target.value)} onBlur={() => { if (normalizeQuestionText(text) !== row.question_text && !error) onSave(text); }}
      onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) event.currentTarget.blur(); }} />
      <button className="newspaper-danger" disabled={busy || isReadOnlyDataMode} aria-label={`${row.student_number}번 ${QUESTION_LABELS[row.question_type]} 삭제`} onClick={onDelete}><Trash2 size={18} /></button></div>
    {error ? <p className="newspaper-error" role="alert">{QUESTION_ERRORS[error]}</p> : text !== row.question_text ? <small>수정 내용 저장 대기</small> : null}
  </div>;
}

export default function TeacherNewspaperPanel() {
  const [selectedWeek, setSelectedWeek] = useState(getKoreanIsoWeekKey);
  const { data, loading, error, refresh, currentWeek } = useNewspaper(0, selectedWeek);
  const [topicDraft, setTopicDraft] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuestionMode>('all');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<NewspaperQuestion | 'reset' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [download, setDownload] = useState<{ text: string; filename: string } | null>(null);
  const topic = data?.topics.find(row => row.week_key === selectedWeek);
  const weeks = [...new Set([...questionWeekOptions(), selectedWeek, ...(data?.weeks ?? []), ...(data?.topics.map(row => row.week_key) ?? [])])].sort();
  const run = async (command: Record<string, unknown>, success: string | ((result: Record<string, unknown>) => string), onResult?: (result: Record<string, unknown>) => void) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice('');
    try { const result = await newspaperCommand(0, command); onResult?.(result); setNotice(typeof success === 'string' ? success : success(result)); setFailed(false); setConfirm(null); setConfirmation(''); await refresh(); }
    catch (error) { setFailed(true); setNotice(error instanceof NewspaperError ? QUESTION_ERRORS[error.code] ?? '처리하지 못했습니다. 다시 시도해 주세요.' : '처리 결과를 확인하지 못했습니다. 다시 눌러 확인해 주세요.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const saveFile = (file: { text: string; filename: string }) => {
    const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = file.filename; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadQuestions = (mode: QuestionMode, cumulative: boolean, weekKey = selectedWeek) => void run({ action: 'download', weekKey, mode, cumulative }, result => {
    const count = Array.isArray(result.questions) ? result.questions.length : 0;
    return count ? `${count}개 질문을 ${cumulative ? '누적' : '전체'} 다운로드했습니다.` : cumulative ? '새로 누적할 질문이 없습니다.' : '다운로드할 질문이 없습니다.';
  }, result => {
    if (!Array.isArray(result.questions)) throw new NewspaperError('QUESTION_INVALID_RESPONSE', 502);
    const rows = result.questions.map(parseNewspaperQuestion);
    if (rows.length === 0) return;
    const file = { text: buildQuestionTxt(rows, mode), filename: questionTxtFilename(weekKey, mode, cumulative) };
    setDownload(file); saveFile(file);
  });
  return <div className="newspaper teacher-newspaper">
    <div className="newspaper-toolbar"><h2>질문 현황</h2><button disabled={loading || busy} onClick={() => void refresh()}><RefreshCw size={17} /> 새로고침</button></div>
    <div className="newspaper-topic-settings">
      <label>적용 주<select value={selectedWeek} disabled={busy} onChange={event => { setSelectedWeek(event.target.value); setTopicDraft(null); setNotice(''); setDownload(null); }}>{weeks.map(week => <option key={week} value={week}>{data?.topics.some(row => row.week_key === week) ? '●' : '○'} {questionWeekLabel(week)} ({week}){week === currentWeek ? ' · 오늘' : ''}</option>)}</select></label>
      <label>주제<input value={topicDraft ?? topic?.topic_text ?? ''} disabled={busy || loading || !!error || isReadOnlyDataMode} maxLength={NEWSPAPER_CONFIG.topicMaxLength} onChange={event => setTopicDraft(event.target.value)} /></label>
      <button className="newspaper-primary" disabled={busy || loading || !!error || isReadOnlyDataMode || !(topicDraft ?? topic?.topic_text ?? '').trim()} onClick={() => void run({ action: 'topic', weekKey: selectedWeek, topicText: topicDraft ?? topic?.topic_text ?? '', expectedUpdatedAt: topic?.updated_at ?? null }, '주제 저장 완료', () => setTopicDraft(null))}>{busy ? '처리 중' : '주제 저장'}</button>
    </div>
    {loading ? <p role="status">확인 중…</p> : null}
    {error ? <p role="alert" className="newspaper-error">{error}</p> : null}
    <p role={failed ? 'alert' : 'status'} className={failed ? 'newspaper-error' : 'newspaper-feedback'}>{notice}</p>
    {data && !error ? <>
      <div className="newspaper-status-grid">{Array.from({ length: NEWSPAPER_CONFIG.studentCount }, (_, i) => {
        const number = i + 1;
        const states = (['personal', 'topic'] as const).map(type => {
          const row = data.questions.find(item => item.student_number === number && item.question_type === type);
          return { type, label: row ? row.downloaded_at ? '누적 완료' : '제출 · 누적 대기' : '미제출', row };
        });
        const label = `${number}번 ${states.map(state => `${QUESTION_LABELS[state.type]} ${state.label}`).join(', ')}`;
        return <div key={number} className="newspaper-student-status" title={label} aria-label={label}><strong>{number}번</strong>{states.map(state => <span key={state.type} data-submitted={!!state.row}>{state.type === 'personal' ? '개인' : '주제'} {state.row ? state.row.downloaded_at ? '✓ 누적' : '✓ 제출' : '—'}</span>)}</div>;
      })}</div>
      <section className="newspaper-downloads"><h3>신문 이미지용 TXT</h3><p>수정한 질문은 누적 대기로 돌아갑니다.</p>
        <div className="newspaper-download-groups">{[true, false].map(cumulative => <div key={String(cumulative)}><h4>{cumulative ? '누적 다운로드' : '전체 다운로드'}</h4><div className="newspaper-download-buttons">{(['personal', 'topic', 'all'] as const).map(mode => {
          const count = selectQuestionDownload(data.questions, mode, cumulative).length;
          return <button key={mode} disabled={busy || count === 0 || isReadOnlyDataMode} onClick={() => downloadQuestions(mode, cumulative)}><Download size={16} /> {QUESTION_LABELS[mode]} {cumulative ? '누적' : '전체'} ({count})</button>;
        })}</div></div>)}</div>
        <div className="newspaper-summary">{(['personal', 'topic'] as const).map(type => {
          const submitted = data.questions.filter(row => row.question_type === type);
          const complete = submitted.filter(row => row.downloaded_at).length;
          return <span key={type}>{QUESTION_LABELS[type]} · 완료 {complete} · 대기 {submitted.length - complete} · {type === 'personal' ? `미제출 ${NEWSPAPER_CONFIG.studentCount - submitted.length}` : `제출 ${submitted.length}`}</span>;
        })}</div>
        {download ? <button onClick={() => saveFile(download)}>방금 만든 TXT 다시 받기</button> : null}
        {readPendingNewspaperRequests(0).map(({ requestId, command }) => {
          const { mode, cumulative, weekKey } = command;
          return command.action === 'download' && isQuestionMode(mode) && typeof cumulative === 'boolean' && isQuestionWeek(weekKey)
            ? <button key={requestId} disabled={busy || isReadOnlyDataMode} onClick={() => downloadQuestions(mode, cumulative, weekKey)}>응답 미확인 TXT 다시 받기 · {questionWeekLabel(weekKey)} · {QUESTION_LABELS[mode]}</button> : null;
        })}
      </section>
      <div className="newspaper-toolbar"><div className="newspaper-tabs" role="group" aria-label="관리자 질문 필터">{(['all', 'personal', 'topic'] as const).map(mode => <button key={mode} aria-pressed={filter === mode} onClick={() => setFilter(mode)}>{mode === 'all' ? '전체 보기' : QUESTION_LABELS[mode]}</button>)}</div><button className="newspaper-danger" disabled={busy || isReadOnlyDataMode} onClick={() => setConfirm('reset')}>초기화</button></div>
      <div className="newspaper-editor-list">{Array.from({ length: NEWSPAPER_CONFIG.studentCount }, (_, index) => <section key={index} className="newspaper-student-row"><h3>{index + 1}번</h3>{(['personal', 'topic'] as const).filter(type => filter === 'all' || type === filter).map(type => {
        const row = data.questions.find(item => item.student_number === index + 1 && item.question_type === type);
        return row ? <QuestionEditor key={`${row.id}:${row.updated_at}`} row={row} busy={busy} onSave={text => void run({ action: 'update', id: row.id, questionText: text, expectedUpdatedAt: row.updated_at }, `${row.student_number}번 수정 완료`)} onDelete={() => setConfirm(row)} /> : <p key={type} className="newspaper-missing" aria-label={`${index + 1}번 ${QUESTION_LABELS[type]} 미제출`}>{QUESTION_LABELS[type]} 미제출</p>;
      })}</section>)}</div>
    </> : null}
    {confirm ? <NewspaperDialog title={confirm === 'reset' ? '정말 초기화시키겠습니까?' : `${confirm.student_number}번 ${QUESTION_LABELS[confirm.question_type]} 삭제`} busy={busy} onClose={() => { setConfirm(null); setConfirmation(''); }}>
      <p>{confirm === 'reset' ? '모든 주차의 개인 질문, 주제 질문, 주제 기록이 전부 삭제됩니다.' : '이 질문을 삭제합니다.'}</p><p>이 작업은 되돌릴 수 없습니다. 지급된 고마는 유지됩니다.</p>
      {confirm === 'reset' ? <label>확인 문구: 모든 기록 초기화<input aria-label="초기화 확인 문구" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label> : null}
      {failed ? <p role="alert" className="newspaper-error">{notice}</p> : null}
      <div className="newspaper-toolbar"><button disabled={busy} onClick={() => setConfirm(null)}>취소</button><button className="newspaper-danger" disabled={busy || confirm === 'reset' && confirmation !== '모든 기록 초기화'} onClick={() => void run(confirm === 'reset' ? { action: 'reset', confirmation } : { action: 'delete', id: confirm.id, expectedUpdatedAt: confirm.updated_at }, confirm === 'reset' ? '초기화 완료' : `${confirm.student_number}번 삭제 완료`, () => { setDownload(null); setTopicDraft(null); })}>{busy ? '처리 중' : confirm === 'reset' ? '모든 기록 초기화' : '삭제'}</button></div>
    </NewspaperDialog> : null}
  </div>;
}
