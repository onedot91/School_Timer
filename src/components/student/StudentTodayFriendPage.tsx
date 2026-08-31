import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react';

import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import {
  getTodayFriendDateKey,
  TODAY_FRIEND_GENRES,
  TODAY_FRIEND_REWARD,
  type TodayFriendGenre,
  type TodayFriendPayload,
} from '../../lib/todayFriend';
import {
  loadStudentTodayFriendMission,
  saveStudentTodayFriendDraft,
  submitStudentTodayFriendMission,
} from '../../lib/todayFriendClient';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';
import StudentHeader from './StudentHeader';
import TodayFriendMissionForm from './TodayFriendMissionForm';

interface StudentTodayFriendPageProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onBack: () => void;
  readonly onSendRecommendation: (recipient: number, title: string, content: string) => Promise<boolean>;
}

const GENRE_COPY = {
  interview: '인터뷰',
  commonality: '공통점 찾기',
  recommendation: '추천하기',
  compliment: '칭찬하기',
  emotion: '감정 찾기',
} as const;

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

  const loadMission = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    setPreviewGenre(null);
    try {
      setMission(await loadStudentTodayFriendMission(studentNumber, dateKey));
    } catch (error) {
      if (error instanceof Error) setLoadError('오늘의 미션을 불러오지 못했어요.');
      else throw error;
    } finally {
      setIsLoading(false);
    }
  }, [dateKey, studentNumber]);

  useEffect(() => { void loadMission(); }, [loadMission]);

  const saveMission = async (payload: TodayFriendPayload, submit: boolean) => {
    if (!mission || isSaving) return false;
    setIsSaving(true);
    try {
      const submission = submit
        ? await submitStudentTodayFriendMission({ mission, payload })
        : await saveStudentTodayFriendDraft({ mission, payload });
      setMission({ ...mission, submission });
      return true;
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const friendProfile = mission ? getFailureProfileImage(mission.partnerNumber, profileAssignments) : '';
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
    <div className="student-view student-today-friend-view">
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
                aria-pressed={displayedGenre === genre}
                onClick={() => setPreviewGenre(genre)}
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
        {displayedMission ? (
          <>
        <section className="student-today-friend-assignment" aria-labelledby="student-today-friend-assignment-title">
          <p className="student-today-friend-assignment-prompt">나의 오늘의 친구는?</p>
          <h2 id="student-today-friend-assignment-title" className="sr-only">
            {displayedMission.partnerNumber}번 친구
          </h2>
          <div className="student-today-friend-profile" aria-label={`오늘의 친구 ${displayedMission.partnerNumber}번`}>
            <figure className="student-today-friend-person">
              <img
                src={friendProfile}
                alt={`${displayedMission.partnerNumber}번 친구의 동물 프로필`}
                width="192"
                height="192"
              />
              <figcaption><strong>{displayedMission.partnerNumber}번 친구</strong></figcaption>
            </figure>
          </div>
        </section>

        <section className="student-today-friend-guide" data-genre={displayedMission.genre} aria-label={`${GENRE_COPY[displayedMission.genre]} 미션`}>
          <div className="today-friend-illustration-placeholder" aria-label={`${GENRE_COPY[displayedMission.genre]} 일러스트 자리`}>
            <span>일러스트 2:1</span>
          </div>
          {displayedMission.question ? <aside className="today-friend-question"><span>질문</span><strong>{displayedMission.question}</strong></aside> : null}
          {status === 'submitted' ? <aside className="today-friend-status-card" data-status="submitted"><Clock3 aria-hidden="true" /><span><strong>선생님 확인을 기다리고 있어요</strong><small>승인되면 {TODAY_FRIEND_REWARD}고마를 받아요.</small></span></aside> : null}
          {status === 'approved' ? <aside className="today-friend-status-card" data-status="approved"><CheckCircle2 aria-hidden="true" /><span><strong>오늘의 친구 미션 완료!</strong><small>{TODAY_FRIEND_REWARD}고마 지급 완료</small></span></aside> : null}
          {status === 'revision_requested' && displayedMission.submission?.teacherFeedback ? <aside className="today-friend-revision"><strong>선생님이 수정을 부탁했어요</strong><p>{displayedMission.submission.teacherFeedback}</p></aside> : null}
          {status !== 'submitted' && status !== 'approved' ? (
            <TodayFriendMissionForm key={displayedMission.genre} mission={displayedMission} isSaving={isSaving} isPreview={isPreview} onSave={saveMission} onSendRecommendation={onSendRecommendation} />
          ) : null}
        </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
