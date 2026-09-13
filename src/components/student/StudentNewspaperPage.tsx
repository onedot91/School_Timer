import { useEffect, useRef, useState } from 'react';
import { Circle, CircleCheck, Glasses, History, PencilLine, RefreshCw } from 'lucide-react';
import StudentHeader from './StudentHeader';
import NewspaperDialog from '../NewspaperDialog';
import { useNewspaper } from '../../lib/useNewspaper';
import { newspaperCommand } from '../../lib/newspaperClient';
import { isReadOnlyDataMode } from '../../lib/dataMode';
import { QUESTION_ERRORS, QUESTION_GLASSES, QUESTION_LABELS, NewspaperError, applyQuestionGlasses, detectQuestionGlasses, normalizeQuestionText, questionValidationCode, questionWeekLabel, parseNewspaperQuestion, segmentQuestionGlasses, type NewspaperQuestion, type NewspaperTopic, type QuestionGlasses, type QuestionType } from '../../lib/newspaperQuestion';

const QUESTION_GLASSES_ASSETS: Record<QuestionGlasses, { icon: string; character: string }> = {
  왜: { icon: '/newspaper/glasses-why.png', character: '/newspaper/character-why.png' },
  만약: { icon: '/newspaper/glasses-if.png', character: '/newspaper/character-if.png' },
  거꾸로: { icon: '/newspaper/glasses-reverse.png', character: '/newspaper/character-reverse.png' },
};

function QuestionComposer({ actor, week, type, question, topic, hasPersonal, onSaved, onFocus }: {
  actor: number; week: string; type: QuestionType; question?: NewspaperQuestion; topic?: NewspaperTopic; hasPersonal: boolean;
  onSaved: () => Promise<void>; onFocus: () => void;
}) {
  const draftKey = `school-timer-newspaper-draft-v1:${actor}:${week}:${type}`;
  const [text, setText] = useState(() => { try { return localStorage.getItem(draftKey) ?? question?.question_text ?? ''; } catch { return question?.question_text ?? ''; } });
  const [saved, setSaved] = useState(question);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [glassesOpen, setGlassesOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const composing = useRef(false);
  const selected = detectQuestionGlasses(text);
  const highlightedSegments = segmentQuestionGlasses(text);
  const hasHighlight = highlightedSegments.some(segment => segment.glasses);
  const changed = normalizeQuestionText(text) !== saved?.question_text;
  const saveState = saved && !changed ? 'submitted' : text ? 'draft' : 'empty';
  useEffect(() => {
    setSaved(question);
    if (!changed) setText(question?.question_text ?? '');
  }, [question?.id, question?.updated_at]);
  const clearDraft = () => { try { localStorage.removeItem(draftKey); } catch { return; } };
  const updateText = (value: string) => { setText(value); setMessage(''); try { localStorage.setItem(draftKey, value); } catch { setMessage('임시 보관을 못 했어요. 이 화면에서 제출해 주세요.'); } };
  const submit = async () => {
    if (locked.current || composing.current) return;
    const code = questionValidationCode(text) ?? (type === 'topic' && !topic ? 'QUESTION_TOPIC_REQUIRED' : type === 'topic' && !hasPersonal ? 'QUESTION_PERSONAL_REQUIRED' : null);
    if (code) { setFailed(true); setMessage(QUESTION_ERRORS[code]); input.current?.focus(); return; }
    locked.current = true; setBusy(true); setMessage('');
    try {
      const result = await newspaperCommand(actor, { action: 'submit', studentNumber: actor, weekKey: week, questionType: type,
        questionText: text, expectedUpdatedAt: saved?.updated_at ?? null, ...(type === 'topic' ? { topicRevision: topic?.updated_at } : {}) });
      const row = parseNewspaperQuestion(result.question);
      setSaved(row); setText(row.question_text); clearDraft();
      setFailed(false); setMessage('제출 완료'); await onSaved();
    } catch (error) { setFailed(true); setMessage(error instanceof NewspaperError ? QUESTION_ERRORS[error.code] ?? '저장하지 못했어요. 다시 눌러 주세요.' : '저장 결과를 확인하지 못했어요. 다시 눌러 확인해 주세요.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <section className="newspaper-compose" data-save-state={saveState} onFocus={onFocus} onClick={onFocus}>
    <div className="newspaper-compose-heading">
      <div className="newspaper-compose-title"><h2>{QUESTION_LABELS[type]}</h2>{topic && type === 'topic' ? <span className="newspaper-topic-badge" title={`이번 주 주제: ${topic.topic_text}`}>이번 주 주제: <strong>{topic.topic_text}</strong></span> : null}</div>
      <span className="newspaper-save-state" data-state={saveState}>
        {saveState === 'submitted' ? <CircleCheck size={16} aria-hidden="true" /> : saveState === 'draft' ? <PencilLine size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
        {saveState === 'submitted' ? '제출됨' : saveState === 'draft' ? '작성 중' : '미제출'}
      </span>
    </div>
    <div className="newspaper-glasses">
      <div className="newspaper-glasses-picker">
        <button className={`newspaper-glasses-trigger${selected ? ' is-active' : ''}`} type="button" aria-expanded={glassesOpen} aria-controls={`glasses-${type}`} aria-pressed={selected !== null} onClick={() => setGlassesOpen(!glassesOpen)} disabled={busy}>
          <span className="newspaper-glasses-icon" data-glasses={selected ?? undefined} aria-hidden="true">{selected ? <img src={QUESTION_GLASSES_ASSETS[selected].icon} width="40" height="34" alt="" /> : <Glasses size={18} />}</span>
          <span className="newspaper-glasses-label">{selected ? `${selected} 안경` : '질문 안경'}</span>
        </button>
        {glassesOpen ? <div id={`glasses-${type}`} className="newspaper-glasses-options">{Object.entries(QUESTION_GLASSES).map(([word, explanation]) => {
          if (word !== '왜' && word !== '만약' && word !== '거꾸로') return null;
          return <button key={word} type="button" aria-label={`${word} 안경: ${explanation}`} aria-pressed={selected === word} onClick={() => {
            const before = input.current?.selectionStart ?? text.length;
            const next = applyQuestionGlasses(text, word);
            updateText(next); setGlassesOpen(false);
            requestAnimationFrame(() => { input.current?.focus(); const cursor = Math.max(word.length + 1, before + next.length - text.length); input.current?.setSelectionRange(cursor, cursor); });
          }}>{word}</button>;
        })}</div> : null}
      </div>
      <span className="newspaper-glasses-character" aria-hidden="true">{selected ? <img src={QUESTION_GLASSES_ASSETS[selected].character} width="72" height="72" alt="" /> : null}</span>
    </div>
    <form data-glasses={hasHighlight || undefined} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="sr-only" htmlFor={`newspaper-${type}`}>{QUESTION_LABELS[type]}</label>
      <div className={`newspaper-highlight-input${hasHighlight ? ' has-highlight' : ''}`}>
        {hasHighlight ? <div className="newspaper-highlight-mirror" aria-hidden="true">{highlightedSegments.map((segment, index) => segment.glasses ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>)}</div> : null}
        <input id={`newspaper-${type}`} ref={input} value={text} disabled={busy || isReadOnlyDataMode} placeholder={type === 'personal' ? '평소 궁금한 내용에 대해 질문해요' : `${topic?.topic_text ?? '이번 주 주제'}에 대해 질문해요`}
          aria-describedby={`newspaper-message-${type}`} onChange={event => updateText(event.target.value)}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault(); }} />
        <button className="newspaper-primary newspaper-inline-submit" disabled={busy || isReadOnlyDataMode}>{busy ? '제출 중' : saved ? '수정하기' : '제출'}</button>
      </div>
    </form>
    <p id={`newspaper-message-${type}`} className={failed ? 'newspaper-error' : 'newspaper-feedback'} role={failed ? 'alert' : 'status'}>{message}</p>
  </section>;
}

export default function StudentNewspaperPage({ studentNumber, onBack, onReward }: { studentNumber: number; onBack: () => void; onReward: () => Promise<void> }) {
  const { data, loading, error, refresh, week } = useNewspaper(studentNumber);
  const [tab, setTab] = useState<QuestionType>('personal');
  const [history, setHistory] = useState(false);
  const topic = data?.topics.find(row => row.week_key === week);
  const own = data?.questions.filter(row => row.student_number === studentNumber) ?? [];
  const afterSave = async () => { await refresh(); await onReward(); };
  return <div className="student-newspaper-page newspaper">
    <StudentHeader title="신문 질문하기" status={`${studentNumber}번 · ${questionWeekLabel(week)}`} onBack={onBack} backText="미션" backLabel="미션으로 돌아가기"
      actions={<><button onClick={() => void refresh()} disabled={loading} aria-label="질문 새로고침"><RefreshCw size={18} aria-hidden="true" /></button><button onClick={() => setHistory(true)} disabled={!data}><History size={18} aria-hidden="true" /> 내 기록</button></>} />
    <div className="newspaper-scroll" role="region" aria-label="신문 질문">
      {loading ? <p role="status">확인 중…</p> : null}
      {error ? <div role="alert" className="newspaper-error">{error} <button onClick={() => void refresh()}>새로고침</button></div> : null}
      {data && !error ? <>
        <div className={`newspaper-composers${topic ? '' : ' is-single'}`}>
          <QuestionComposer key={`${studentNumber}:${week}:personal`} actor={studentNumber} week={week} type="personal" question={own.find(row => row.question_type === 'personal')} hasPersonal={false} onFocus={() => setTab('personal')} onSaved={afterSave} />
          {topic ? <QuestionComposer key={`${studentNumber}:${week}:topic`} actor={studentNumber} week={week} type="topic" topic={topic} question={own.find(row => row.question_type === 'topic')} hasPersonal={own.some(row => row.question_type === 'personal')} onFocus={() => setTab('topic')} onSaved={afterSave} /> : null}
        </div>
        <section className="newspaper-collection">
          <div className="newspaper-toolbar"><h2>이번 주 질문 모음</h2><div className="newspaper-tabs" role="group" aria-label="질문 모음 유형">{(['personal', 'topic'] as const).map(type => <button key={type} aria-pressed={tab === type} onClick={() => setTab(type)}>{type === 'personal' ? '개인' : '주제'} {data.questions.filter(row => row.question_type === type).length}</button>)}</div></div>
          <div className="newspaper-question-grid">{data.questions.filter(row => row.question_type === tab).map(row => <article key={row.id} className="newspaper-question"><span>{row.student_number}번</span><p>{row.question_text}</p></article>)}</div>
          {!data.questions.some(row => row.question_type === tab) ? <p className="newspaper-empty">아직 없어요.</p> : null}
        </section>
      </> : null}
    </div>
    {history && data ? <NewspaperDialog title="내 기록" onClose={() => setHistory(false)}>
      {data.history.length === 0 ? <p className="newspaper-empty">아직 없어요.</p> : [...new Set(data.history.map(row => row.week_key))].sort().reverse().map(key => <section className="newspaper-history-week" key={key}>
        <h3>{questionWeekLabel(key)} <small>{key}</small></h3>{data.history.filter(row => row.week_key === key).map(row => <article key={row.id}><span>{QUESTION_LABELS[row.question_type]}</span><p>{row.question_text}</p></article>)}
      </section>)}
    </NewspaperDialog> : null}
  </div>;
}
