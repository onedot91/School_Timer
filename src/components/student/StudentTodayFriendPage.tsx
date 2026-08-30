import { HandHeart, MessageCircleHeart, Smile } from 'lucide-react';

import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../../lib/failureExhibition';
import {
  getTodayFriendDateKey,
  getTodayFriendNumber,
  TODAY_FRIEND_REWARD,
} from '../../lib/todayFriend';
import StudentHeader from './StudentHeader';

interface StudentTodayFriendPageProps {
  readonly studentNumber: number;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onBack: () => void;
}

const TODAY_FRIEND_STEPS = [
  { icon: Smile, title: '먼저 웃으며 인사하기', description: '친구를 만나면 반갑게 인사해요.' },
  { icon: MessageCircleHeart, title: '이야기 끝까지 들어 주기', description: '친구가 말할 때 눈을 보고 들어요.' },
  { icon: HandHeart, title: '좋은 점 한 가지 말해 주기', description: '친구의 멋진 점을 찾아 알려 줘요.' },
] as const;

export default function StudentTodayFriendPage({
  studentNumber,
  profileAssignments,
  onBack,
}: StudentTodayFriendPageProps) {
  const dateKey = getTodayFriendDateKey();
  const friendNumber = getTodayFriendNumber(studentNumber, dateKey);
  const friendProfile = getFailureProfileImage(friendNumber, profileAssignments);

  return (
    <div className="student-view student-today-friend-view">
      <StudentHeader
        title="오늘의 친구"
        onBack={onBack}
        backLabel="미션으로 돌아가기"
        backText="미션"
      />

      <main className="student-today-friend-main">
        <section className="student-today-friend-assignment" aria-labelledby="student-today-friend-assignment-title">
          <p className="student-today-friend-eyebrow">오늘 내가 먼저 다가갈 친구</p>
          <h2 id="student-today-friend-assignment-title" className="sr-only">
            {friendNumber}번 친구
          </h2>
          <div className="student-today-friend-profile" aria-label={`오늘의 친구 ${friendNumber}번`}>
            <figure className="student-today-friend-person">
              <img
                src={friendProfile}
                alt={`${friendNumber}번 친구의 동물 프로필`}
                width="192"
                height="192"
              />
              <figcaption><strong>{friendNumber}번</strong><span>오늘의 친구</span></figcaption>
            </figure>
          </div>
        </section>

        <section className="student-today-friend-guide" aria-labelledby="student-today-friend-guide-title">
          <div className="student-today-friend-guide-heading">
            <span>친구 미션</span>
            <h2 id="student-today-friend-guide-title">이렇게 해 봐요</h2>
          </div>
          <ol className="student-today-friend-steps">
            {TODAY_FRIEND_STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title}>
                <span className="student-today-friend-step-number">{index + 1}</span>
                <span className="student-today-friend-step-icon" aria-hidden="true"><Icon /></span>
                <span className="student-today-friend-step-copy">
                  <strong>{title}</strong>
                  <span>{description}</span>
                </span>
              </li>
            ))}
          </ol>
          <aside className="student-today-friend-verification">
            <img src="/mission-status-faces/teacher.png" alt="" width="192" height="192" />
            <span>
              <strong>다 했다면 선생님께 알려 주세요</strong>
              <small>선생님 확인 뒤 {TODAY_FRIEND_REWARD}고마를 받을 수 있어요.</small>
            </span>
          </aside>
        </section>
      </main>
    </div>
  );
}
