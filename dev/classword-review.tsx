import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { appDataMode } from '../src/lib/dataMode';
import '../src/index.css';
import '../src/classword.css';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

async function startReview(rootElement: HTMLElement): Promise<void> {
  if (!import.meta.env.DEV || appDataMode !== 'mock') return;
  const storage = new MemoryStorage();
  const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const dateDescriptor = Object.getOwnPropertyDescriptor(window, 'Date');
  const NativeDate = window.Date;
  let clockTime = NativeDate.parse('2026-09-11T09:00:00+09:00');
  let clockStartedAt = performance.now();
  let ticking = false;
  const now = () => clockTime + (ticking ? performance.now() - clockStartedAt : 0);
  const ReviewDate = new Proxy(NativeDate, {
    construct: (target, argumentsList) => Reflect.construct(target, argumentsList.length ? argumentsList : [now()]),
    apply: () => new NativeDate(now()).toString(),
    get: (target, property, receiver) => property === 'now' ? now : Reflect.get(target, property, receiver),
  });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(window, 'Date', { configurable: true, writable: true, value: ReviewDate });
  const [studentModule, teacherModule, client, domain, schedule, topics, vocabulary] = await Promise.all([
    import('../src/components/student/StudentClasswordPage'),
    import('../src/components/teacher/TeacherClasswordPanel'),
    import('../src/lib/classwordClient'),
    import('../src/lib/classword'),
    import('../src/lib/classwordSchedule'),
    import('../src/lib/classwordTopics'),
    import('../src/lib/classwordVocabularyGrade34'),
  ]);
  const StudentClasswordPage = studentModule.default;
  const TeacherClasswordPanel = teacherModule.default;
  const longestQuestion = vocabulary.CLASSWORD_VOCABULARY_V2.reduce((longest, question) => {
    const length = (value: typeof question) => value.meaning.length
      + value.examples.reduce((total, example) => total + example.prefix.length + example.suffix.length, 0);
    return length(question) > length(longest) ? question : longest;
  });

  function Review() {
    const [surface, setSurface] = useState<'student' | 'teacher'>('student');
    const [visible, setVisible] = useState(true);
    const [revision, setRevision] = useState(0);
    const [timestamp, setTimestamp] = useState(now);
    const [balance, setBalance] = useState<number | null>(null);
    const [answer, setAnswer] = useState('');
    const [message, setMessage] = useState('메모리 저장소 · 학생 1번 · 실제 저장소와 분리');
    const dateKey = domain.getKoreanDateKey(new NativeDate(timestamp));
    const displayDateKey = schedule.getClasswordDisplayDate(dateKey);
    const dateLabel = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new NativeDate(timestamp));

    useEffect(() => {
      const updateClock = () => setTimestamp(now());
      const interval = window.setInterval(updateClock, 200);
      const keyboard = (event: KeyboardEvent) => {
        if (event.key === 'F8') { event.preventDefault(); setVisible(value => !value); }
      };
      window.addEventListener('keydown', keyboard);
      return () => { window.clearInterval(interval); window.removeEventListener('keydown', keyboard); };
    }, []);

    useEffect(() => {
      let active = true;
      const refreshAnswer = () => {
        void client.loadTeacherClasswordQuizSummary(displayDateKey).then(summary => {
          if (active) setAnswer(summary.answer);
        });
      };
      refreshAnswer();
      window.addEventListener(client.CLASSWORD_LOCAL_CHANGE_EVENT, refreshAnswer);
      return () => { active = false; window.removeEventListener(client.CLASSWORD_LOCAL_CHANGE_EVENT, refreshAnswer); };
    }, [displayDateKey, revision]);

    const setClock = (value: string, run = false) => {
      clockTime = NativeDate.parse(value);
      clockStartedAt = performance.now();
      ticking = run;
      setTimestamp(now());
      if (run) setRevision(value => value + 1);
      window.dispatchEvent(new Event('focus'));
    };
    const action = async (run: () => Promise<void>) => {
      try { await run(); setMessage('검수 작업 완료'); }
      catch (error) { setMessage(error instanceof Error ? error.message : '검수 작업 실패'); }
    };
    const previewQuestion = async (longest: boolean) => {
      const question = longest ? longestQuestion
        : vocabulary.CLASSWORD_VOCABULARY_V2[Math.floor(Math.random() * vocabulary.CLASSWORD_VOCABULARY_V2.length)];
      if (!question) return;
      await client.updateTeacherClasswordQuiz({
        dateKey: displayDateKey, answer: question.answer, initialHint: question.initialHint, meaning: question.meaning,
        writtenExample: `${question.examples[0].prefix}${question.answer}${question.examples[0].suffix}`,
        spokenExample: `${question.examples[1].prefix}${question.answer}${question.examples[1].suffix}`,
      });
      if (surface === 'teacher') setRevision(value => value + 1);
    };
    const seedOwnEntry = async () => {
      const board = await client.loadClasswordBoard(dateKey);
      const topic = topics.CLASSWORD_TOPICS_V1.find(candidate => candidate.title === board.topic);
      const word = topic?.examples[0] ?? '가방';
      const initial = domain.getClasswordInitialFromWord(word);
      if (!domain.isClasswordInitial(initial)) return;
      const result = await client.saveClasswordEntry({ dateKey, initial, word, studentNumber: 1 }, board.topic);
      setBalance(result.balance);
    };

    return <>
      {surface === 'student' ? <StudentClasswordPage
        key={`student-${revision}`} studentNumber={1} profileAssignments={{}}
        onRewardBalance={setBalance} onMissionSubmitted={awarded => setMessage(`학생 낱말 저장 · 보상 ${awarded ? '지급' : '없음'}`)}
        onBack={() => setMessage('미션 돌아가기 콜백 확인')}
      /> : <div className="classword-review-teacher teacher-settings-theme"><div className="settings-dialog">
        <TeacherClasswordPanel key={`teacher-${revision}-${dateKey}`} profileAssignments={{}} />
      </div></div>}
      {visible ? <details className="classword-review-controls">
        <summary>QA 도구 · {dateLabel}</summary>
        <div>
          <fieldset><legend>화면</legend>
            <button onClick={() => setSurface('student')}>학생</button>
            <button onClick={() => setSurface('teacher')}>교사</button>
            <button onClick={() => setVisible(false)}>숨기기 (F8 복귀)</button>
          </fieldset>
          <fieldset><legend>한국 날짜 · 화면은 유지하고 날짜 갱신</legend>
            <button onClick={() => setClock('2026-09-11T09:00:00+09:00')}>9/11 금요일</button>
            <button onClick={() => setClock('2026-09-12T09:00:00+09:00')}>9/12 토요일</button>
            <button onClick={() => setClock('2026-09-14T09:00:00+09:00')}>9/14 월요일</button>
            <button onClick={() => setClock('2026-09-11T23:59:59+09:00')}>자정 1초 전</button>
            <button onClick={() => setClock(new NativeDate(now() + 1000).toISOString())}>1초 진행</button>
            <button onClick={() => setClock('2026-09-11T23:59:40+09:00', true)}>자정 자동 (20초)</button>
          </fieldset>
          <fieldset><legend>메모리 데이터</legend>
            <button onClick={() => void action(seedOwnEntry)}>내 낱말 만들기</button>
            <button onClick={() => void action(() => previewQuestion(false))}>무작위 문제</button>
            <button onClick={() => void action(() => previewQuestion(true))}>가장 긴 문제</button>
            <button onClick={() => void action(async () => { await client.resetTeacherClasswordQuiz(displayDateKey); if (surface === 'teacher') setRevision(value => value + 1); })}>자동 문제 복귀</button>
            <button onClick={() => { storage.clear(); setBalance(null); setRevision(value => value + 1); setMessage('메모리 데이터만 초기화'); }}>메모리 초기화</button>
          </fieldset>
          <output>표시 날짜 {displayDateKey} · 검수 정답 {answer} · 콜백 잔액 {balance ?? '아직 없음'}</output>
          <output role="status">{message}</output>
        </div>
      </details> : null}
    </>;
  }

  const reactRoot = createRoot(rootElement);
  reactRoot.render(<Review />);
  import.meta.hot?.dispose(() => {
    reactRoot.unmount();
    if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
    if (dateDescriptor) Object.defineProperty(window, 'Date', dateDescriptor);
  });
}

const rootElement = document.getElementById('root');
if (rootElement && import.meta.env.DEV && appDataMode === 'mock') {
  void startReview(rootElement).catch(error => {
    rootElement.textContent = error instanceof Error ? error.message : '검수 화면을 열지 못했습니다.';
  });
}
