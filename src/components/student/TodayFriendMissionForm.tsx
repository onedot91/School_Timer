import { useEffect, useState, type FormEvent } from 'react';

import type { TodayFriendPayload } from '../../lib/todayFriend';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';

interface TodayFriendMissionFormProps {
  readonly mission: TodayFriendStudentMission;
  readonly isSaving: boolean;
  readonly isPreview?: boolean;
  readonly onSave: (payload: TodayFriendPayload, submit: boolean) => Promise<boolean>;
  readonly onSendRecommendation: (recipient: number, title: string, content: string) => Promise<boolean>;
}

const getPayloadText = (payload: TodayFriendPayload | undefined): string => {
  if (!payload) return '';
  switch (payload.kind) {
    case 'interview': return payload.answer;
    case 'commonality': return payload.commonality;
    case 'compliment': return payload.compliment;
    case 'emotion': return payload.emotion;
    case 'recommendation': return payload.title;
  }
};

export default function TodayFriendMissionForm({
  mission,
  isSaving,
  isPreview = false,
  onSave,
  onSendRecommendation,
}: TodayFriendMissionFormProps) {
  const savedPayload = mission.submission?.payload;
  const [primaryText, setPrimaryText] = useState(() => getPayloadText(savedPayload));
  const [secondaryText, setSecondaryText] = useState(() => (
    savedPayload?.kind === 'recommendation' || savedPayload?.kind === 'emotion' ? savedPayload.reason : ''
  ));
  const [category, setCategory] = useState<'movie' | 'book' | 'music' | 'food'>(() => (
    savedPayload?.kind === 'recommendation' ? savedPayload.category : 'book'
  ));
  const [declinedToExplain, setDeclinedToExplain] = useState(() => (
    savedPayload?.kind === 'emotion' ? savedPayload.declinedToExplain : false
  ));
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    setPrimaryText(getPayloadText(mission.submission?.payload));
    setSecondaryText(
      mission.submission?.payload.kind === 'recommendation' || mission.submission?.payload.kind === 'emotion'
        ? mission.submission.payload.reason
        : '',
    );
    setCategory(mission.submission?.payload.kind === 'recommendation' ? mission.submission.payload.category : 'book');
    setDeclinedToExplain(mission.submission?.payload.kind === 'emotion' ? mission.submission.payload.declinedToExplain : false);
  }, [mission.submission?.id, mission.submission?.revision, mission.submission?.status]);

  const buildPayload = (): TodayFriendPayload => {
    switch (mission.genre) {
      case 'interview': return { kind: 'interview', answer: primaryText.trim() };
      case 'commonality': return { kind: 'commonality', commonality: primaryText.trim() };
      case 'recommendation': return { kind: 'recommendation', category, title: primaryText.trim(), reason: secondaryText.trim(), letterId: null };
      case 'compliment': return { kind: 'compliment', compliment: primaryText.trim() };
      case 'emotion': return { kind: 'emotion', emotion: primaryText.trim(), reason: secondaryText.trim(), declinedToExplain };
    }
  };

  const isComplete = primaryText.trim().length > 0 && (
    mission.genre !== 'recommendation' && mission.genre !== 'emotion'
      ? true
      : mission.genre === 'emotion' && declinedToExplain
        ? true
        : secondaryText.trim().length > 0
  );

  const save = async (submit: boolean) => {
    if (isPreview) return;
    setFormMessage('');
    if (submit && !isComplete) {
      setFormMessage('비어 있는 내용을 먼저 적어 주세요.');
      return;
    }
    const payload = buildPayload();
    if (submit && payload.kind === 'recommendation') {
      const sent = await onSendRecommendation(
        mission.partnerNumber,
        `[오늘의 친구] ${payload.title}`,
        `${payload.reason}\n\n${mission.studentNumber}번이 추천해요.`,
      );
      if (!sent) {
        setFormMessage('편지를 보내지 못했어요. 잠시 후 다시 눌러 주세요.');
        return;
      }
    }
    const saved = await onSave(payload, submit);
    setFormMessage(saved ? submit ? '제출했어요.' : '임시 저장했어요.' : '저장하지 못했어요. 다시 시도해 주세요.');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(true);
  };

  return (
    <form className="today-friend-form" data-genre={mission.genre} onSubmit={handleSubmit}>
      <div className="today-friend-form-fields">
        {mission.genre === 'interview' ? (
          <label className="today-friend-answer-card"><span>친구의 답</span><textarea value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} placeholder="친구가 말한 내용을 적어요." maxLength={600} /></label>
        ) : null}
        {mission.genre === 'commonality' ? (
          <label><span>대화로 찾은 공통점</span><textarea value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} placeholder="대화하며 알게 된 공통점을 적어요." maxLength={600} /><small>눈으로 바로 보이는 특징은 제외해요.</small></label>
        ) : null}
        {mission.genre === 'recommendation' ? (
          <>
            <label><span>추천 종류</span><select value={category} onChange={(event) => {
              const value = event.target.value;
              if (value === 'movie' || value === 'book' || value === 'music' || value === 'food') setCategory(value);
            }}><option value="movie">영화</option><option value="book">책</option><option value="music">음악</option><option value="food">음식</option></select></label>
            <label><span>추천할 것</span><input value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} maxLength={80} /></label>
            <label><span>추천하는 이유</span><textarea value={secondaryText} onChange={(event) => setSecondaryText(event.target.value)} maxLength={600} /></label>
          </>
        ) : null}
        {mission.genre === 'compliment' ? (
          <label><span>친구에게 전할 칭찬</span><textarea value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} placeholder="어떤 행동이 왜 좋았는지 적어요." maxLength={800} /></label>
        ) : null}
        {mission.genre === 'emotion' ? (
          <>
            <label><span>친구의 오늘 감정</span><input value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} maxLength={60} /></label>
            <label><span>그렇게 느낀 이유</span><textarea value={secondaryText} disabled={declinedToExplain} onChange={(event) => setSecondaryText(event.target.value)} maxLength={600} /></label>
            <label className="today-friend-private-choice"><input type="checkbox" checked={declinedToExplain} onChange={(event) => setDeclinedToExplain(event.target.checked)} /><span>친구가 이유를 말하고 싶지 않았어요.</span></label>
            <small className="today-friend-privacy-note">말하고 싶지 않은 내용은 묻지 않아요.</small>
          </>
        ) : null}
      </div>
      {formMessage ? <p className="today-friend-form-message" role="status">{formMessage}</p> : null}
      <div className="today-friend-form-actions">
        <button type="button" disabled={isSaving || isPreview} onClick={() => { void save(false); }}>임시 저장</button>
        <button type="submit" disabled={isSaving || isPreview}>{isSaving ? '저장 중…' : mission.submission?.status === 'revision_requested' ? '고쳐서 다시 제출' : '선생님께 제출'}</button>
      </div>
    </form>
  );
}
