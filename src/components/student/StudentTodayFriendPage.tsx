import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { storageAvailabilityMessage } from '../../lib/storageAvailabilityCopy';

import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import {
  getTodayFriendDateKey,
  getTodayFriendPreviewGenre,
  TODAY_FRIEND_GENRES,
  TODAY_FRIEND_REWARD,
  type TodayFriendGenre,
  type TodayFriendPayload,
  type TodayFriendRecommendationLetter,
} from '../../lib/todayFriend';
import {
  loadStudentTodayFriendMission,
  loadTodayFriendSubmissionReceipt,
  saveStudentTodayFriendDraft,
  submitStudentTodayFriendMission,
  TodayFriendClientError,
} from '../../lib/todayFriendClient';
import { createTodayFriendSubmissionDraftStore, selectLatestTodayFriendSubmission, type TodayFriendPendingSubmission } from '../../lib/todayFriendSubmissionDraft';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';
import StudentHeader from './StudentHeader';
import TodayFriendMissionForm from './TodayFriendMissionForm';
import TodayFriendPartnerCard from './TodayFriendPartnerCard';
import TodayFriendSubmittedAnswer from './TodayFriendSubmittedAnswer';

interface StudentTodayFriendPageProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onBack: () => void;
  readonly onSendRecommendation: (letter: TodayFriendRecommendationLetter) => Promise<boolean>;
}

const GENRE_COPY = {
  interview: '인터뷰',
  commonality: '공통점 찾기',
  recommendation: '추천하기',
  compliment: '칭찬하기',
  emotion: '감정 찾기',
} as const;

const TODAY_FRIEND_ILLUSTRATION_BY_GENRE = {
  interview: '/today-friend/interview.png',
  commonality: '/today-friend/commonality.png',
  recommendation: '/today-friend/recommendation.png',
  compliment: '/today-friend/compliment.png',
  emotion: '/today-friend/emotion.png',
} as const satisfies Readonly<Record<TodayFriendGenre, string>>;

const PREVIEW_INTERVIEW_QUESTION = '요즘 가장 재미있게 한 일은 무엇인가요?';

export default function StudentTodayFriendPage({
  studentNumber,
  profileAssignments,
  onBack,
  onSendRecommendation,
}: StudentTodayFriendPageProps) {
  const dateKey = getTodayFriendDateKey();
  const [mission, setMission] = useState<TodayFriendStudentMission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [previewGenre, setPreviewGenre] = useState<TodayFriendGenre | null>(null);
  const [draftStore] = useState(createTodayFriendSubmissionDraftStore);
  const [pendingSubmission, setPendingSubmission] = useState<TodayFriendPendingSubmission | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const loadSequence = useRef(0);
  const saving = useRef(false);

  const loadMission = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setLoadError('');
    setMission(null);
    setPreviewGenre(null);
    try {
      const loaded = await loadStudentTodayFriendMission(studentNumber, dateKey);
      if (sequence !== loadSequence.current) return;
      const pending = loaded ? draftStore.load(loaded) : null;
      setMission(loaded);
      setPendingSubmission(pending);
      setSaveMessage(pending ? '입력을 보존했어요. 저장 여부를 확인해 주세요.' : '');
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (sequence === loadSequence.current) setLoadError('오늘의 미션을 불러오지 못했어요.');
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [dateKey, draftStore, studentNumber]);

  useEffect(() => {
    void loadMission();
    return () => { loadSequence.current += 1; };
  }, [loadMission]);

  const saveMission = async (payload: TodayFriendPayload, submit: boolean) => {
    if (!mission || saving.current) return false;
    const previous = draftStore.load(mission);
    const pending = draftStore.prepare(mission, payload, submit);
    if (!pending) return false;
    const sequence = loadSequence.current;
    saving.current = true;
    setIsSaving(true);
    setPendingSubmission(pending);
    setSaveMessage('');
    try {
      const latest = previous ? await loadStudentTodayFriendMission(studentNumber, dateKey) : mission;
      if (!latest || sequence !== loadSequence.current) return false;
      const receipt = previous ? await loadTodayFriendSubmissionReceipt(pending.requestId) : null;
      if (previous && !receipt?.found && draftStore.load(latest)?.requestId !== pending.requestId) {
        setSaveMessage('미션이 변경됐어요. 입력을 보존했으니 선생님에게 확인해 주세요.');
        return false;
      }
      const input = { mission: { ...mission, planningRevision: pending.planningRevision }, payload: pending.payload, requestId: pending.requestId, expectedRevision: pending.expectedRevision };
      const submission = receipt?.found && receipt.submission ? receipt.submission : pending.submit
        ? await submitStudentTodayFriendMission(input)
        : await saveStudentTodayFriendDraft(input);
      draftStore.confirm(mission, pending.requestId);
      if (sequence !== loadSequence.current) return true;
      setPendingSubmission(null);
      setMission({ ...latest, submission: selectLatestTodayFriendSubmission(latest.submission, submission) });
      return true;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (sequence !== loadSequence.current) return false;
      if (error instanceof TodayFriendClientError && error.code === 'TODAY_FRIEND_SUBMISSION_CONFLICT') {
        draftStore.confirm(mission, pending.requestId);
        setPendingSubmission(null);
        try {
          const latest = await loadStudentTodayFriendMission(studentNumber, dateKey);
          if (latest && sequence === loadSequence.current) setMission(latest);
        } catch (refreshError) {
          if (!(refreshError instanceof Error)) throw refreshError;
        }
        if (sequence !== loadSequence.current) return false;
        setSaveMessage('다른 기기의 변경과 겹쳤어요. 입력을 확인한 뒤 다시 제출해 주세요.');
      } else {
        setSaveMessage(storageAvailabilityMessage(error) ?? '입력을 보존했어요. 저장 여부를 확인해 주세요.');
      }
      return false;
    } finally {
      saving.current = false;
      if (sequence === loadSequence.current) setIsSaving(false);
    }
  };

  const displayedGenre = previewGenre ?? mission?.genre ?? 'interview';
  const isPreview = previewGenre !== null;
  const displayedMission = mission ? {
    ...mission,
    genre: displayedGenre,
    question: displayedGenre === 'interview' ? mission.question ?? PREVIEW_INTERVIEW_QUESTION : null,
    submission: isPreview ? null : mission.submission,
  } : null;
  const status = displayedMission?.submission?.status;

  return (
    <div className="student-view student-today-friend-view" data-genre={displayedGenre}>
      <StudentHeader
        title="오늘의 친구"
        onBack={onBack}
        backLabel="미션으로 돌아가기"
        backText="미션"
        actions={mission ? (
          <div className="student-header-segmented today-friend-preview-tabs" role="group" aria-label="미션 카테고리 미리보기">
            {TODAY_FRIEND_GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                disabled={isSaving}
                aria-pressed={displayedGenre === genre}
                onClick={() => setPreviewGenre(getTodayFriendPreviewGenre(mission.genre, genre))}
              >
                {GENRE_COPY[genre]}
              </button>
            ))}
          </div>
        ) : null}
      />

      <main className="student-today-friend-main">
        {isLoading ? <section className="student-today-friend-loading" aria-label="오늘의 친구 불러오는 중"><Clock3 aria-hidden="true" /><p>오늘의 친구를 준비하고 있어요.</p></section> : null}
        {loadError ? <section className="student-today-friend-loading" role="alert"><p>{loadError}</p><button type="button" onClick={() => { void loadMission(); }}><RefreshCw aria-hidden="true" />다시 불러오기</button></section> : null}
        {!isLoading && !loadError && !mission ? (
          <section className="student-today-friend-loading" role="status">
            <Clock3 aria-hidden="true" />
            <h2>주말에는 오늘의 친구도 쉬어요</h2>
            <p>오늘의 친구 미션은 월요일부터 금요일까지 만날 수 있어요.</p>
            <button type="button" onClick={onBack}>미션으로 돌아가기</button>
          </section>
        ) : null}
        {displayedMission ? (
          <>
        <TodayFriendPartnerCard
          key={`${displayedMission.dateKey}-${displayedMission.studentNumber}-${displayedMission.partnerNumber}`}
          mission={displayedMission}
          profileAssignments={profileAssignments}
        />

        <section className="student-today-friend-guide" data-genre={displayedMission.genre} aria-label={`${GENRE_COPY[displayedMission.genre]} 미션`}>
          <img
            className="today-friend-illustration"
            src={TODAY_FRIEND_ILLUSTRATION_BY_GENRE[displayedMission.genre]}
            alt={`${GENRE_COPY[displayedMission.genre]} 장르 일러스트`}
            width={1774}
            height={887}
            decoding="async"
          />
          {displayedMission.question ? <aside className="today-friend-question"><span>질문</span><strong>{displayedMission.question}</strong></aside> : null}
          {status === 'submitted' ? <aside className="today-friend-status-card" data-status="submitted"><Clock3 aria-hidden="true" /><strong>선생님 확인 대기</strong></aside> : null}
          {status === 'approved' ? <aside className="today-friend-status-card" data-status="approved"><CheckCircle2 aria-hidden="true" /><span><strong>오늘의 친구 미션 완료!</strong><small>{TODAY_FRIEND_REWARD}고마 지급 완료</small></span></aside> : null}
          {status === 'revision_requested' && displayedMission.submission?.teacherFeedback ? <aside className="today-friend-revision"><strong>선생님이 수정을 부탁했어요</strong><p>{displayedMission.submission.teacherFeedback}</p></aside> : null}
          {(status === 'submitted' || status === 'approved') && displayedMission.submission ? (
            <TodayFriendSubmittedAnswer payload={displayedMission.submission.payload} />
          ) : null}
          {(status !== 'submitted' && status !== 'approved') || (!isPreview && pendingSubmission) ? (
            <TodayFriendMissionForm key={JSON.stringify([displayedMission.dateKey, displayedMission.studentNumber, displayedMission.partnerNumber, displayedMission.genre, displayedMission.question])} mission={displayedMission} isSaving={isSaving} isPreview={isPreview} pendingPayload={isPreview ? undefined : pendingSubmission?.payload} saveMessage={isPreview ? '' : saveMessage} onSave={saveMission} onSendRecommendation={onSendRecommendation} />
          ) : null}
        </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
