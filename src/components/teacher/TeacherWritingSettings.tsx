import { Dices, RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DAILY_WRITING_COOK_IMAGE_SOURCE,
  getNextDailyWritingDateKey,
  isDailyWritingWeekday,
  type DailyWritingAssignment,
} from '../../lib/dailyWriting';
import { pickDailyWritingPrompt } from '../../lib/dailyWritingPrompts';
import TeacherWritingCalendar from './TeacherWritingCalendar';
import StableLabel from '../StableLabel';
import SettingsPanelFrame, { SettingsStatusChip } from './SettingsPanelFrame';

type DailyWritingPublishInput = {
  readonly dateKey: string;
  readonly topic: string;
  readonly requiredWord: string;
  readonly requiredWordMeaning: string;
};

type TeacherWritingSettingsProps = {
  readonly assignment: DailyWritingAssignment | null;
  readonly assignedDateKeys: readonly string[];
  readonly completedStudentNumbers: ReadonlySet<number>;
  readonly isPublishing: boolean;
  readonly rewardingStudentNumber: number | null;
  readonly status: string;
  readonly onPublish: (input: DailyWritingPublishInput) => Promise<boolean>;
  readonly onReward: (studentNumber: number) => Promise<boolean>;
  readonly onCancelReward: (studentNumber: number) => Promise<boolean>;
};

export default function TeacherWritingSettings({
  assignment,
  assignedDateKeys,
  completedStudentNumbers,
  isPublishing,
  rewardingStudentNumber,
  status,
  onPublish,
  onReward,
  onCancelReward,
}: TeacherWritingSettingsProps) {
  const [dateKey, setDateKey] = useState(assignment?.dateKey ?? getNextDailyWritingDateKey());
  const [topic, setTopic] = useState(assignment?.topic ?? '');
  const [requiredWord, setRequiredWord] = useState(assignment?.requiredWord ?? '');
  const [requiredWordMeaning, setRequiredWordMeaning] = useState(assignment?.requiredWordMeaning ?? '');

  useEffect(() => {
    if (!assignment) return;
    setDateKey(assignment.dateKey);
    setTopic(assignment.topic);
    setRequiredWord(assignment.requiredWord);
    setRequiredWordMeaning(assignment.requiredWordMeaning);
  }, [assignment]);

  const canPublish = isDailyWritingWeekday(dateKey)
    && topic.trim().length > 0
    && requiredWord.trim().length > 0
    && requiredWordMeaning.trim().length > 0;

  const fillRandomPrompt = () => {
    const prompt = pickDailyWritingPrompt(topic);
    setTopic(prompt.topic);
    setRequiredWord(prompt.requiredWord);
    setRequiredWordMeaning(prompt.requiredWordMeaning);
  };

  return (
    <SettingsPanelFrame
      label="글쓰기"
      className="teacher-writing-settings"
      status={(
        <>
          <img className="teacher-writing-guide" src={DAILY_WRITING_COOK_IMAGE_SOURCE} alt="밥과 주걱을 든 밥집 아주머니 가히" />
          <h3>글밥짓기</h3>
          <SettingsStatusChip tone={completedStudentNumbers.size > 0 ? 'accent' : 'neutral'}>지급 {completedStudentNumbers.size} / 23</SettingsStatusChip>
        </>
      )}
      action={(
        <button
          type="button"
          className="settings-frame-primary"
          disabled={!canPublish || isPublishing}
          onClick={() => void onPublish({ dateKey, topic, requiredWord, requiredWordMeaning })}
        >
          <Send size={18} aria-hidden="true" />
          <StableLabel busy={isPublishing} busyLabel="보내는 중" label={assignment?.dateKey === dateKey ? '편지 다시 보내기' : '23명에게 보내기'} />
        </button>
      )}
    >
      <div className="teacher-writing-workspace">
        <section className="teacher-writing-compose" aria-labelledby="teacher-writing-compose-title">
          <header>
            <h3 id="teacher-writing-compose-title">글밥 편지</h3>
            <button type="button" className="teacher-writing-random-button" onClick={fillRandomPrompt}>
              <Dices size={17} aria-hidden="true" />
              랜덤 채우기
            </button>
          </header>

          <TeacherWritingCalendar
            value={dateKey}
            assignedDateKeys={assignedDateKeys}
            onChange={setDateKey}
          />
          <label>
            <span>글쓰기 주제</span>
            <textarea
              value={topic}
              maxLength={100}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="예: 우리 반에 비밀 통로가 생긴다면"
            />
          </label>
          <div className="teacher-writing-word-row">
            <label>
              <span>꼭 쓸 낱말</span>
              <input
                value={requiredWord}
                maxLength={20}
                onChange={(event) => setRequiredWord(event.target.value)}
                placeholder="예: 살금살금"
              />
            </label>
            <label>
              <span>낱말 뜻</span>
              <input
                value={requiredWordMeaning}
                maxLength={120}
                onChange={(event) => setRequiredWordMeaning(event.target.value)}
                placeholder="예: 남이 모르게 조용히 움직이는 모양"
              />
            </label>
          </div>

          <p className="teacher-writing-publish-status" role="status">{status}</p>
        </section>

      </div>

      <section className="teacher-writing-submissions" aria-labelledby="teacher-writing-submissions-title">
        <header>
          <h3 id="teacher-writing-submissions-title">제출 확인과 보상</h3>
        </header>

        {assignment ? (
          <div className="teacher-writing-student-grid">
            {Array.from({ length: 23 }, (_, index) => index + 1).map((studentNumber) => {
              const isCompleted = completedStudentNumbers.has(studentNumber);
              const isUpdating = rewardingStudentNumber === studentNumber;
              return (
                <button
                  key={studentNumber}
                  type="button"
                  className={isCompleted ? 'is-completed' : ''}
                  disabled={rewardingStudentNumber !== null}
                  aria-label={isCompleted ? `${studentNumber}번 25고마 지급 취소` : `${studentNumber}번 제출 확인 후 25고마 지급`}
                  onClick={() => void (isCompleted ? onCancelReward(studentNumber) : onReward(studentNumber))}
                >
                  <b>{studentNumber}번</b>
                  <span>{isCompleted
                    ? <><RotateCcw size={14} aria-hidden="true" />{isUpdating ? '취소 중' : '지급 취소'}</>
                    : isUpdating ? '지급 중' : '+25 고마'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="teacher-writing-empty">편지를 보내면 제출 확인표가 열립니다.</p>
        )}
      </section>
    </SettingsPanelFrame>
  );
}
