import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, HeartHandshake, RefreshCw } from 'lucide-react';

import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import {
  getTodayFriendDateKey,
  TODAY_FRIEND_REWARD,
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
  interview: { label: '인터뷰', instruction: '오늘의 질문을 하고, 친구의 답을 잘 듣고 적어요.' },
  commonality: { label: '공통점 찾기', instruction: '서로 이야기하며 대화해야 알 수 있는 공통점을 찾아요.' },
  recommendation: { label: '추천하기', instruction: '좋아하는 것을 하나 골라 추천 편지를 보내요.' },
  compliment: { label: '칭찬하기', instruction: '친구의 구체적인 행동과 그때 든 마음을 적어요.' },
  emotion: { label: '감정 찾기', instruction: '친구의 오늘 감정과 이유를 조심스럽게 물어봐요.' },
} as const;

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

  const loadMission = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
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
  const status = mission?.submission?.status;

  return (
    <div className="student-view student-today-friend-view">
      <StudentHeader
        title="오늘의 친구"
        onBack={onBack}
        backLabel="미션으로 돌아가기"
        backText="미션"
      />

      <main className="student-today-friend-main">
        {isLoading ? <section className="student-today-friend-loading" aria-label="오늘의 친구 불러오는 중"><Clock3 aria-hidden="true" /><p>오늘의 친구를 준비하고 있어요.</p></section> : null}
        {loadError ? <section className="student-today-friend-loading" role="alert"><p>{loadError}</p><button type="button" onClick={() => { void loadMission(); }}><RefreshCw aria-hidden="true" />다시 불러오기</button></section> : null}
        {mission ? (
          <>
        <section className="student-today-friend-assignment" aria-labelledby="student-today-friend-assignment-title">
          <p className="student-today-friend-eyebrow">오늘 함께 이야기할 친구</p>
          <h2 id="student-today-friend-assignment-title" className="sr-only">
            {mission.partnerNumber}번 친구
          </h2>
          <div className="student-today-friend-profile" aria-label={`오늘의 친구 ${mission.partnerNumber}번`}>
            <figure className="student-today-friend-person">
              <img
                src={friendProfile}
                alt={`${mission.partnerNumber}번 친구의 동물 프로필`}
                width="192"
                height="192"
              />
              <figcaption><strong>{mission.partnerNumber}번</strong><span>오늘의 파트너</span></figcaption>
            </figure>
          </div>
          <div className="today-friend-genre-chip"><HeartHandshake aria-hidden="true" /><span>{GENRE_COPY[mission.genre].label}</span></div>
        </section>

        <section className="student-today-friend-guide" aria-labelledby="student-today-friend-guide-title">
          <div className="student-today-friend-guide-heading">
            <span>오늘 할 일</span>
            <h2 id="student-today-friend-guide-title">{GENRE_COPY[mission.genre].label}</h2>
            <p>{GENRE_COPY[mission.genre].instruction}</p>
          </div>
          {mission.question ? <aside className="today-friend-question"><span>오늘의 질문</span><strong>{mission.question}</strong></aside> : null}
          {status === 'submitted' ? <aside className="today-friend-status-card" data-status="submitted"><Clock3 aria-hidden="true" /><span><strong>선생님 확인을 기다리고 있어요</strong><small>승인되면 {TODAY_FRIEND_REWARD}고마를 받아요.</small></span></aside> : null}
          {status === 'approved' ? <aside className="today-friend-status-card" data-status="approved"><CheckCircle2 aria-hidden="true" /><span><strong>오늘의 친구 미션 완료!</strong><small>{TODAY_FRIEND_REWARD}고마 지급 완료</small></span></aside> : null}
          {status === 'revision_requested' && mission.submission?.teacherFeedback ? <aside className="today-friend-revision"><strong>선생님이 수정을 부탁했어요</strong><p>{mission.submission.teacherFeedback}</p></aside> : null}
          {status !== 'submitted' && status !== 'approved' ? (
            <TodayFriendMissionForm mission={mission} isSaving={isSaving} onSave={saveMission} onSendRecommendation={onSendRecommendation} />
          ) : null}
        </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
