import { useEffect, useRef, useState } from 'react';
import StudentMailboxPage from '../../src/components/student/StudentMailboxPage';
import StudentEmotionPage from '../../src/components/student/StudentEmotionPage';
import StudentFailureExhibitionPage from '../../src/components/student/StudentFailureExhibitionPage';
import ClasswordQuiz from '../../src/components/student/ClasswordQuiz';
import TodayFriendMissionForm from '../../src/components/student/TodayFriendMissionForm';
import { settleClasswordQuizInput } from '../../src/lib/classwordQuizAnswerStore';
import { getKoreanLocalDateKey } from '../../src/lib/studentEmotion';
import type { TodayFriendStudentMission } from '../../src/lib/todayFriendState';
import type { StudentEmotionSaveConflict } from '../../src/lib/studentEmotionConflict';

const quizIdentity = { dateKey: getKoreanLocalDateKey(), studentNumber: 1, questionId: 'browser-fixture-quiz' };
const friendMission: TodayFriendStudentMission = { dateKey: getKoreanLocalDateKey(), studentNumber: 1, partnerNumber: 2, genre: 'interview', question: '친구의 답을 적어 주세요.', submission: null };
interface FormDriver {
  hydrate(text: string): void;
  complete(saved?: boolean): void;
  settleQuiz(): Promise<boolean>;
  lastSubmission(): readonly unknown[];
  emotionConflict(status: StudentEmotionSaveConflict['status'], revision?: number): void;
  reloadCount(): number;
}
declare global { interface Window { saveReliabilityForms: FormDriver } }

export function SaveReliabilityBrowserForms({ form }: { form: string }) {
  const [mail, setMail] = useState<{ title: string; content: string }>();
  const [emotion, setEmotion] = useState<{ emotionId: 'happy'; comment: string; selfMessage: string }>();
  const [failure, setFailure] = useState<{ failure: string; lesson: string }>();
  const [conflict, setConflict] = useState<StudentEmotionSaveConflict | null>(null);
  const reloadCount = useRef(0);
  const pending = useRef<Array<(saved: boolean) => void>>([]);
  const lastSubmission = useRef<readonly unknown[]>([]);
  const save = (...args: unknown[]) => new Promise<boolean>(resolve => { lastSubmission.current = args; pending.current.push(resolve); });
  useEffect(() => {
    window.saveReliabilityForms = {
      hydrate: text => {
        setMail({ title: `${text} title`, content: `${text} content` });
        setEmotion({ emotionId: 'happy', comment: `${text} event`, selfMessage: `${text} self` });
        setFailure({ failure: `${text} failure`, lesson: `${text} lesson` });
      },
      complete: (saved = true) => { const resolve = pending.current.shift(); if (!resolve) throw new Error('NO_FORM_SUBMISSION'); resolve(saved); },
      settleQuiz: () => settleClasswordQuizInput(localStorage, quizIdentity),
      lastSubmission: () => lastSubmission.current,
      emotionConflict: (status, revision = 3) => setConflict(status === 'ready' ? {
        status, snapshot: { studentNumber: 1, dateKey: getKoreanLocalDateKey(), expectedRevisions: { 'scope:studentEmotionHistory:1': revision },
          latestEntry: { id: 'fixture-emotion', studentNumber: 1, dateKey: getKoreanLocalDateKey(), emotionId: 'calm',
            comment: `서버 기록 ${revision} ${'긴 내용 확인 '.repeat(5)}`.slice(0, 60), selfMessage: '최신 기록을 확인한 뒤 내 입력을 다시 저장해요.',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } },
      } : { status }),
      reloadCount: () => reloadCount.current,
    };
  }, []);
  return <>
    <output aria-label="폼 검증 준비">준비됨</output>
    {form === 'mailbox' ? <StudentMailboxPage studentNumber={1} draft={mail} profileAssignments={{}} letters={[]} sentLetters={[]}
      unreadCount={0} isSaving={false} onRead={async () => undefined} onSend={save} onBack={() => undefined} /> : null}
    {form === 'emotion' || form === 'emotion-conflict' ? <StudentEmotionPage studentNumber={1} draft={emotion} todayEntry={null} history={[]} isSaving={false}
      saveConflict={conflict} onResolveConflict={save} onReloadConflict={async () => { reloadCount.current++; }} onSave={save} onBack={() => undefined} /> : null}
    {form === 'failure' ? <StudentFailureExhibitionPage studentNumber={1} savedDraft={failure} profileAssignments={{}} stories={[]}
      isSaving={false} onCreate={save} onStamp={async () => true} onOpenBookshelf={() => undefined} onBack={() => undefined} /> : null}
    {form === 'quiz' ? <ClasswordQuiz studentNumber={1} loading={false} saving={false} loadError="" onSubmit={save}
      state={{ dateKey: quizIdentity.dateKey, completed: false, completedAt: null, rewardAmount: null,
        question: { id: quizIdentity.questionId, initialHint: 'ㅂㄱ', meaning: '합성 검증 문제',
          examples: [{ register: 'written', prefix: '기록을 ', suffix: '하다.' }, { register: 'spoken', prefix: '답을 ', suffix: '하자.' }] } }} /> : null}
    {form === 'today-friend' ? <TodayFriendMissionForm mission={friendMission} isSaving={false}
      pendingPayload={{ kind: 'interview', answer: '저장 확인 중인 친구 답' }} onSave={save} onSendLetter={save} /> : null}
  </>;
}
