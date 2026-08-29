import { Dice5, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { getKoreanDateKey, type ClasswordBoard } from '../../lib/classword';
import type { ClasswordQuizTeacherSummary } from '../../lib/classwordQuiz';
import {
  clearClasswordDate,
  loadClasswordBoard,
  loadClasswordRounds,
  loadTeacherClasswordQuizSummary,
  loadClasswordUsedTopics,
  removeClasswordEntry,
  updateClasswordTopic,
} from '../../lib/classwordClient';
import ClasswordCalendar from './ClasswordCalendar';

const RANDOM_TOPICS = [
  '학교에서 볼 수 있는 것', '여름에 생각나는 것', '내가 좋아하는 음식', '동물',
  '우리 동네', '기분을 나타내는 말', '운동', '자연에서 볼 수 있는 것',
] as const;

const monthKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function TeacherClasswordPanel() {
  const today = getKoreanDateKey();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(today);
  const [rounds, setRounds] = useState<Awaited<ReturnType<typeof loadClasswordRounds>>>([]);
  const [usedTopics, setUsedTopics] = useState<readonly string[]>([]);
  const [board, setBoard] = useState<ClasswordBoard>({ dateKey: today, topic: '', entries: [] });
  const [todayBoard, setTodayBoard] = useState<ClasswordBoard>({ dateKey: today, topic: '', entries: [] });
  const [topic, setTopic] = useState('');
  const [quizSummary, setQuizSummary] = useState<ClasswordQuizTeacherSummary | null>(null);
  const [quizMessage, setQuizMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);

  const refresh = useCallback(async () => {
    try {
      const selectedBoardRequest = loadClasswordBoard(selectedDateKey);
      const [nextRounds, nextBoard, nextTodayBoard, nextUsedTopics] = await Promise.all([
        loadClasswordRounds(monthKeyOf(month)),
        selectedBoardRequest,
        selectedDateKey === today ? selectedBoardRequest : loadClasswordBoard(today),
        loadClasswordUsedTopics(),
      ]);
      setRounds(nextRounds);
      setBoard(nextBoard);
      setTodayBoard(nextTodayBoard);
      setUsedTopics(nextUsedTopics);
      setTopic(nextBoard.topic);
      setMessage('');
    } catch {
      setMessage('낱말판 정보를 불러오지 못했습니다.');
    }
  }, [month, selectedDateKey, today]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let active = true;
    const loadQuizSummary = async () => {
      try {
        const nextSummary = await loadTeacherClasswordQuizSummary(selectedDateKey);
        if (!active) return;
        setQuizSummary(nextSummary);
        setQuizMessage('');
      } catch {
        if (!active) return;
        setQuizSummary(null);
        setQuizMessage('낱말 퀴즈 정답자를 불러오지 못했습니다.');
      }
    };
    void loadQuizSummary();
    return () => { active = false; };
  }, [selectedDateKey]);

  const chooseRandomTopic = () => {
    const used = new Set(usedTopics);
    const candidates = RANDOM_TOPICS.filter((candidate) => !used.has(candidate));
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!candidate) {
      setMessage('모든 추천 주제를 한 번씩 사용했습니다.');
      return;
    }
    setTopic(candidate);
    setMessage('');
  };

  const saveTopic = async () => {
    const nextTopic = topic.trim();
    if (!nextTopic) {
      setMessage('주제를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await updateClasswordTopic(selectedDateKey, nextTopic);
      setMessage('주제를 저장했습니다.');
      await refresh();
    } catch {
      setMessage('주제를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setBusy(true);
    try {
      await removeClasswordEntry(entryId, 0, true);
      await refresh();
    } catch {
      setMessage('낱말을 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const clearEntries = async () => {
    setBusy(true);
    try {
      await clearClasswordDate(selectedDateKey);
      setClearStep(0);
      setMessage('이 날짜의 낱말을 모두 비웠습니다.');
      await refresh();
    } catch {
      setMessage('낱말을 비우지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="teacher-classword-panel">
      <header className="teacher-classword-heading">
        <div><span>학생 생활</span><h2>ㄱㄴㄷ 낱말판</h2></div>
        <p>날짜별 주제를 정하고 학생들이 남긴 낱말을 관리합니다.</p>
      </header>
      <section className="teacher-classword-today-entries" aria-labelledby="teacher-classword-today-title">
        <header>
          <div><span>{today}</span><h3 id="teacher-classword-today-title">오늘 입력 낱말</h3></div>
          <strong>{todayBoard.entries.length}/14칸</strong>
        </header>
        <ul className="teacher-classword-entry-list" aria-label="오늘 학생 낱말 목록">
          {todayBoard.entries.length === 0 ? <li className="is-empty">오늘은 아직 등록된 낱말이 없습니다.</li> : todayBoard.entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.initial}</strong><span>{entry.word}</span><small>{entry.studentNumber}번</small>
              <button type="button" onClick={() => void deleteEntry(entry.id)} disabled={busy} aria-label={`${entry.word} 삭제`}><Trash2 aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      </section>
      <section className="teacher-classword-quiz-summary" aria-labelledby="teacher-classword-quiz-title">
        <header>
          <div>
            <span>{selectedDateKey}</span>
            <h3 id="teacher-classword-quiz-title">낱말 퀴즈 정답자</h3>
          </div>
          <strong>{quizSummary?.correctStudentNumbers.length ?? 0}명</strong>
        </header>
        {quizSummary ? (
          <div className="teacher-classword-quiz-content">
            <span className="teacher-classword-quiz-initial">{quizSummary.question.initialHint}</span>
            <ul aria-label="낱말 퀴즈 정답 학생 번호">
              {quizSummary.correctStudentNumbers.length === 0
                ? <li className="is-empty">아직 정답자가 없습니다.</li>
                : quizSummary.correctStudentNumbers.map((studentNumber) => (
                    <li key={studentNumber}>{studentNumber}번</li>
                  ))}
            </ul>
          </div>
        ) : <p className="teacher-classword-message" role="status">{quizMessage || '정답자를 불러오는 중입니다.'}</p>}
      </section>
      <div className="teacher-classword-workspace">
        <ClasswordCalendar
          month={month}
          selectedDateKey={selectedDateKey}
          rounds={rounds}
          onMonthChange={setMonth}
          onSelect={(dateKey) => {
            setSelectedDateKey(dateKey);
            setClearStep(0);
          }}
        />
        <section className="teacher-classword-editor" aria-labelledby="teacher-classword-editor-title">
          <header>
            <div><span>{selectedDateKey}</span><h3 id="teacher-classword-editor-title">날짜별 주제 설정</h3></div>
            <strong>{board.entries.length}/14칸</strong>
          </header>
          <div className="teacher-classword-topic-field">
            <label htmlFor="teacher-classword-topic">이날의 주제</label>
            <span><input id="teacher-classword-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={40} disabled={busy} /><button type="button" onClick={chooseRandomTopic} disabled={busy} aria-label="사용하지 않은 주제 무작위 추천"><Dice5 aria-hidden="true" /> 추천</button></span>
          </div>
          <button type="button" className="teacher-classword-save" onClick={() => void saveTopic()} disabled={busy || !topic.trim()}><Save aria-hidden="true" /> 주제 저장</button>
          {message ? <p className="teacher-classword-message" role="status">{message}</p> : null}
          {selectedDateKey !== today ? (
            <details className="teacher-classword-history">
              <summary>선택한 날짜의 입력 낱말 <strong>{board.entries.length}개</strong></summary>
              <ul className="teacher-classword-entry-list" aria-label="선택 날짜 학생 낱말 목록">
                {board.entries.length === 0 ? <li className="is-empty">이 날짜에는 등록된 낱말이 없습니다.</li> : board.entries.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.initial}</strong><span>{entry.word}</span><small>{entry.studentNumber}번</small>
                    <button type="button" onClick={() => void deleteEntry(entry.id)} disabled={busy} aria-label={`${entry.word} 삭제`}><Trash2 aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {clearStep === 0 ? (
            <button type="button" className="teacher-classword-clear" onClick={() => setClearStep(1)} disabled={busy || board.entries.length === 0}>이 날짜 낱말 모두 비우기</button>
          ) : (
            <div className="teacher-classword-clear-confirm" role="group" aria-label="모든 낱말 삭제 확인">
              <span>{clearStep === 1 ? '학생 낱말이 모두 삭제됩니다.' : '마지막 확인입니다. 정말 비울까요?'}</span>
              <button type="button" onClick={() => clearStep === 1 ? setClearStep(2) : void clearEntries()} disabled={busy}>{clearStep === 1 ? '계속' : '모두 비우기'}</button>
              <button type="button" onClick={() => setClearStep(0)} disabled={busy}>취소</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
