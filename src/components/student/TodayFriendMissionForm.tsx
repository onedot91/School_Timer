import { useEffect, useState, type FormEvent } from 'react';

import {
  createTodayFriendRecommendationDelivery,
  type TodayFriendPayload,
  type TodayFriendRecommendationLetter,
} from '../../lib/todayFriend';
import {
  clearTodayFriendDeviceDraft,
  loadTodayFriendDeviceDraft,
  saveTodayFriendDeviceDraft,
} from '../../lib/todayFriendLocalStore';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';

interface TodayFriendMissionFormProps {
  readonly mission: TodayFriendStudentMission;
  readonly isSaving: boolean;
  readonly isPreview?: boolean;
  readonly onSave: (payload: TodayFriendPayload, submit: boolean) => Promise<boolean>;
  readonly onSendRecommendation: (letter: TodayFriendRecommendationLetter) => Promise<boolean>;
}

const recommendationCategories = [
  { value: 'movie', label: '영화' },
  { value: 'book', label: '책' },
  { value: 'music', label: '음악' },
  { value: 'food', label: '음식' },
] as const;

const declinedToExplainMessage = '말하고 싶지 않은 내용은 묻지 않아요.';

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
  const [deviceDraft] = useState(() => (
    isPreview ? null : loadTodayFriendDeviceDraft(window.localStorage, mission)
  ));
  const [primaryText, setPrimaryText] = useState(() => deviceDraft?.primaryText ?? getPayloadText(savedPayload));
  const [secondaryText, setSecondaryText] = useState(() => (
    deviceDraft?.secondaryText
      ?? (savedPayload?.kind === 'recommendation' || savedPayload?.kind === 'emotion' || savedPayload?.kind === 'compliment'
        ? savedPayload.reason ?? ''
        : '')
  ));
  const [tertiaryText, setTertiaryText] = useState(() => (
    deviceDraft?.tertiaryText ?? (savedPayload?.kind === 'compliment' ? savedPayload.message ?? '' : '')
  ));
  const [category, setCategory] = useState<'movie' | 'book' | 'music' | 'food'>(() => (
    deviceDraft?.category ?? (savedPayload?.kind === 'recommendation' ? savedPayload.category : 'book')
  ));
  const [declinedToExplain, setDeclinedToExplain] = useState(() => (
    deviceDraft?.declinedToExplain ?? (savedPayload?.kind === 'emotion' ? savedPayload.declinedToExplain : false)
  ));
  const [formMessage, setFormMessage] = useState(deviceDraft ? '이 기기에 자동 저장한 내용을 불러왔어요.' : '');
  const [hasEdited, setHasEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPrimaryText(deviceDraft?.primaryText ?? getPayloadText(mission.submission?.payload));
    setSecondaryText(
      deviceDraft?.secondaryText
        ?? (mission.submission?.payload.kind === 'recommendation' || mission.submission?.payload.kind === 'emotion' || mission.submission?.payload.kind === 'compliment'
          ? mission.submission.payload.reason ?? ''
          : ''),
    );
    setTertiaryText(deviceDraft?.tertiaryText ?? (mission.submission?.payload.kind === 'compliment' ? mission.submission.payload.message ?? '' : ''));
    setCategory(deviceDraft?.category ?? (mission.submission?.payload.kind === 'recommendation' ? mission.submission.payload.category : 'book'));
    setDeclinedToExplain(deviceDraft?.declinedToExplain ?? (mission.submission?.payload.kind === 'emotion' ? mission.submission.payload.declinedToExplain : false));
  }, [deviceDraft, mission.submission?.id, mission.submission?.revision, mission.submission?.status]);

  useEffect(() => {
    if (!hasEdited || isPreview) return;
    const saved = saveTodayFriendDeviceDraft(window.localStorage, mission, {
      primaryText,
      secondaryText,
      tertiaryText,
      category,
      declinedToExplain,
    });
    setFormMessage(saved ? '이 기기에 자동 저장했어요.' : '자동 저장하지 못했어요. 제출은 계속할 수 있어요.');
  }, [category, declinedToExplain, hasEdited, isPreview, mission, primaryText, secondaryText, tertiaryText]);

  const buildPayload = (): TodayFriendPayload => {
    switch (mission.genre) {
      case 'interview': return { kind: 'interview', answer: primaryText.trim() };
      case 'commonality': return { kind: 'commonality', commonality: primaryText.trim() };
      case 'recommendation': return { kind: 'recommendation', category, title: primaryText.trim(), reason: secondaryText.trim(), letterId: null };
      case 'compliment': return { kind: 'compliment', compliment: primaryText.trim(), reason: secondaryText.trim(), message: tertiaryText.trim() };
      case 'emotion': return { kind: 'emotion', emotion: primaryText.trim(), reason: secondaryText.trim(), declinedToExplain };
    }
  };

  const isComplete = primaryText.trim().length > 0 && (
    mission.genre === 'compliment'
      ? secondaryText.trim().length > 0 && tertiaryText.trim().length > 0
      : mission.genre !== 'recommendation' && mission.genre !== 'emotion'
        ? true
      : mission.genre === 'emotion' && declinedToExplain
        ? true
        : secondaryText.trim().length > 0
  );

  const submit = async () => {
    if (isPreview || isSubmitting) return;
    setFormMessage('');
    if (!isComplete) {
      setFormMessage('비어 있는 내용을 먼저 적어 주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      let submittedPayload = payload;
      if (payload.kind === 'recommendation') {
        const revision = mission.submission?.status === 'revision_requested'
          ? mission.submission.revision + 1
          : mission.submission?.revision ?? 1;
        const delivery = createTodayFriendRecommendationDelivery({
          dateKey: mission.dateKey,
          studentNumber: mission.studentNumber,
          partnerNumber: mission.partnerNumber,
          revision,
          payload,
        });
        const sent = await onSendRecommendation(delivery.letter);
        if (!sent) {
          setFormMessage('편지를 보내지 못했어요. 잠시 후 다시 눌러 주세요.');
          return;
        }
        submittedPayload = delivery.payload;
      }
      const saved = await onSave(submittedPayload, true);
      if (saved) clearTodayFriendDeviceDraft(window.localStorage, mission);
      setFormMessage(saved
        ? payload.kind === 'recommendation' ? '친구에게 편지를 보내고 미션을 제출했어요.' : '제출했어요.'
        : '제출하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form className="today-friend-form" data-genre={mission.genre} onSubmit={handleSubmit}>
      <div className="today-friend-form-fields">
        {mission.genre === 'interview' ? (
          <label className="today-friend-answer-card today-friend-field-card"><span>친구의 답</span><textarea value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구가 말한 내용을 적어요." maxLength={600} /></label>
        ) : null}
        {mission.genre === 'commonality' ? (
          <label className="today-friend-field-card"><span>대화로 찾은 공통점</span><textarea value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="대화하며 알게 된 공통점을 적어요." maxLength={600} /><small>눈으로 바로 보이는 특징은 제외해요.</small></label>
        ) : null}
        {mission.genre === 'recommendation' ? (
          <>
            <div className="today-friend-field-card today-friend-recommendation-basics" role="group" aria-label="추천 기본 정보">
              <div className="today-friend-recommendation-category">
                <span>추천 종류</span>
                <div className="today-friend-recommendation-category-options" role="group" aria-label="추천 종류">
                  {recommendationCategories.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="today-friend-recommendation-category-option"
                      aria-pressed={category === option.value}
                      onClick={() => {
                        setCategory(option.value);
                        setHasEdited(true);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <label><span>추천할 것</span><input value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구에게 추천할 이름을 적어요." maxLength={80} /></label>
            </div>
            <label className="today-friend-field-card"><span>추천하는 이유</span><textarea value={secondaryText} onChange={(event) => { setSecondaryText(event.target.value); setHasEdited(true); }} placeholder="친구에게 추천하고 싶은 이유를 적어요." maxLength={600} /></label>
          </>
        ) : null}
        {mission.genre === 'compliment' ? (
          <>
            <label className="today-friend-field-card"><span>어떤 행동을 칭찬하고 싶나요?</span><input value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구가 한 멋진 행동을 적어요." maxLength={120} /></label>
            <label className="today-friend-field-card"><span>그 행동이 왜 좋았나요?</span><input value={secondaryText} onChange={(event) => { setSecondaryText(event.target.value); setHasEdited(true); }} placeholder="내가 좋다고 느낀 이유를 적어요." maxLength={160} /></label>
            <label className="today-friend-field-card today-friend-compliment-message"><span>친구에게 전하고 싶은 한마디</span><span className="today-friend-compliment-quote-control"><span aria-hidden="true">“</span><input value={tertiaryText} onChange={(event) => { setTertiaryText(event.target.value); setHasEdited(true); }} placeholder="친구에게 직접 말하듯 적어요." maxLength={120} /><span aria-hidden="true">”</span></span></label>
          </>
        ) : null}
        {mission.genre === 'emotion' ? (
          <>
            <label className="today-friend-field-card"><span>친구의 오늘 감정</span><input value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구가 말한 감정을 적어요." maxLength={60} /></label>
            <div className="today-friend-field-card today-friend-emotion-reason-card">
              <label className="today-friend-emotion-reason-field"><span>그렇게 느낀 이유</span><textarea value={declinedToExplain ? declinedToExplainMessage : secondaryText} disabled={declinedToExplain} onChange={(event) => { setSecondaryText(event.target.value); setHasEdited(true); }} placeholder="왜 그렇게 느꼈는지 적어요." maxLength={600} /></label>
              <div className="today-friend-privacy-card">
                <label className="today-friend-private-choice"><input type="checkbox" checked={declinedToExplain} onChange={(event) => { setDeclinedToExplain(event.target.checked); setHasEdited(true); }} /><span>친구가 이유를 말하고 싶지 않았어요.</span></label>
              </div>
            </div>
          </>
        ) : null}
      </div>
      {formMessage ? <p className="today-friend-form-message" role="status">{formMessage}</p> : null}
      <div className="today-friend-form-actions">
        <button type="submit" disabled={isSaving || isSubmitting || isPreview}>{isSubmitting ? mission.genre === 'recommendation' ? '편지와 미션 저장 중…' : '저장 중…' : isSaving ? '저장 중…' : mission.submission?.status === 'revision_requested' ? '고쳐서 다시 제출' : '선생님께 제출'}</button>
      </div>
    </form>
  );
}
