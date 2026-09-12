import { BookOpen, Film, Music, Utensils } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  createTodayFriendRecommendationDelivery,
  formatTodayFriendCommonalities,
  parseTodayFriendCommonalities,
  type TodayFriendPayload,
  type TodayFriendRecommendationLetter,
} from '../../lib/todayFriend';
import {
  clearTodayFriendDeviceDraft,
  loadTodayFriendDeviceDraft,
  readyTodayFriendDeviceDraft,
  settleTodayFriendDeviceDraft,
  todayFriendDeviceDraftVersion,
  saveTodayFriendDeviceDraft,
} from '../../lib/todayFriendLocalStore';
import type { TodayFriendStudentMission } from '../../lib/todayFriendState';

interface TodayFriendMissionFormProps {
  readonly mission: TodayFriendStudentMission;
  readonly isSaving: boolean;
  readonly isPreview?: boolean;
  readonly pendingPayload?: TodayFriendPayload;
  readonly saveMessage?: string;
  readonly onSave: (payload: TodayFriendPayload, submit: boolean) => Promise<boolean>;
  readonly onSendRecommendation: (letter: TodayFriendRecommendationLetter) => Promise<boolean>;
}

const recommendationCategories = [
  { value: 'movie', label: '영화', icon: Film },
  { value: 'book', label: '책', icon: BookOpen },
  { value: 'music', label: '음악', icon: Music },
  { value: 'food', label: '음식', icon: Utensils },
] as const;

const declinedToExplainMessage = '말하고 싶지 않은 내용은 묻지 않아요.';

const getDeviceStorage = (): Storage | null => {
  try { // no-excuse-ok: catch
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

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
  pendingPayload,
  saveMessage = '',
  onSave,
  onSendRecommendation,
}: TodayFriendMissionFormProps) {
  const savedPayload = pendingPayload ?? mission.submission?.payload;
  const [deviceDraft] = useState(() => {
    const storage = getDeviceStorage();
    return isPreview || pendingPayload ? null : loadTodayFriendDeviceDraft(storage, mission);
  });
  const savedCommonalities = savedPayload?.kind === 'commonality'
    ? parseTodayFriendCommonalities(savedPayload.commonality)
    : null;
  const [primaryText, setPrimaryText] = useState(() => deviceDraft?.primaryText ?? savedCommonalities?.[0] ?? getPayloadText(savedPayload));
  const [secondaryText, setSecondaryText] = useState(() => (
    deviceDraft?.secondaryText
      ?? savedCommonalities?.[1]
      ?? (savedPayload?.kind === 'recommendation' || savedPayload?.kind === 'emotion' || savedPayload?.kind === 'compliment'
        ? savedPayload.reason ?? ''
        : '')
  ));
  const [tertiaryText, setTertiaryText] = useState(() => (
    deviceDraft?.tertiaryText
      ?? savedCommonalities?.[2]
      ?? (savedPayload?.kind === 'compliment' ? savedPayload.message ?? '' : '')
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
  const editedRef = useRef(false);
  const [inputReady, setInputReady] = useState(false);
  useEffect(() => {
    let active = true;
    setInputReady(false);
    void readyTodayFriendDeviceDraft(getDeviceStorage(), mission).then((draft) => {
      if (!active) return;
      if (draft && !editedRef.current && !isPreview && !pendingPayload) {
        setPrimaryText(draft.primaryText); setSecondaryText(draft.secondaryText);
        setTertiaryText(draft.tertiaryText); setCategory(draft.category); setDeclinedToExplain(draft.declinedToExplain);
      }
      setInputReady(true);
    });
    return () => { active = false; };
  }, [mission.dateKey, mission.studentNumber, mission.partnerNumber, mission.genre, mission.question]);

  useEffect(() => {
    if (!hasEdited || isPreview || !inputReady) return;
    editedRef.current = true;
    const storage = getDeviceStorage();
    saveTodayFriendDeviceDraft(storage, mission, {
      primaryText,
      secondaryText,
      tertiaryText,
      category,
      declinedToExplain,
    });
    let active = true;
    void settleTodayFriendDeviceDraft(storage, mission).then(saved => {
      if (active) setFormMessage(saved ? '' : '이 기기에 임시 보관하지 못했어요.');
    });
    return () => { active = false; };
  }, [category, declinedToExplain, hasEdited, isPreview, inputReady, mission, primaryText, secondaryText, tertiaryText]);

  const buildPayload = (): TodayFriendPayload => {
    switch (mission.genre) {
      case 'interview': return { kind: 'interview', answer: primaryText.trim() };
      case 'commonality': return {
        kind: 'commonality',
        commonality: formatTodayFriendCommonalities([primaryText, secondaryText, tertiaryText]),
      };
      case 'recommendation': return { kind: 'recommendation', category, title: primaryText.trim(), reason: secondaryText.trim(), letterId: null };
      case 'compliment': return { kind: 'compliment', compliment: primaryText.trim(), reason: secondaryText.trim(), message: tertiaryText.trim() };
      case 'emotion': return { kind: 'emotion', emotion: primaryText.trim(), reason: secondaryText.trim(), declinedToExplain };
    }
  };

  const isComplete = primaryText.trim().length > 0 && (
    mission.genre === 'commonality' || mission.genre === 'compliment'
      ? secondaryText.trim().length > 0 && tertiaryText.trim().length > 0
      : mission.genre !== 'recommendation' && mission.genre !== 'emotion'
        ? true
      : mission.genre === 'emotion' && declinedToExplain
        ? true
        : secondaryText.trim().length > 0
  );

  const submit = async () => {
    if (!inputReady || isPreview || isSubmitting || isSaving) return;
    setFormMessage('');
    if (!isComplete) {
      setFormMessage('비어 있는 내용을 먼저 적어 주세요.');
      return;
    }
    setIsSubmitting(true);
    const submittedVersion = todayFriendDeviceDraftVersion(getDeviceStorage(), mission);
    try {
      const payload = pendingPayload ?? buildPayload();
      let submittedPayload = payload;
      if (payload.kind === 'recommendation' && !pendingPayload) {
        const revision = mission.submission?.status === 'submitted'
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
      const storage = getDeviceStorage();
      if (saved && submittedVersion) await clearTodayFriendDeviceDraft(storage, mission, submittedVersion);
      setFormMessage(saved
        ? payload.kind === 'recommendation' ? '친구에게 편지를 보내고 미션을 제출했어요.' : '제출했어요.'
        : '저장 결과를 확인하지 못했어요. 다시 눌러 확인해 주세요.');
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
      <fieldset className="today-friend-form-fields" disabled={!inputReady || isSaving || isSubmitting || Boolean(pendingPayload)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        {mission.genre === 'interview' ? (
          <label className="today-friend-answer-card today-friend-field-card"><span>친구의 답</span><textarea value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구가 말한 내용을 적어요." maxLength={600} /></label>
        ) : null}
        {mission.genre === 'commonality' ? (
          <>
            <div className="today-friend-commonality-warning" role="note">
              <p>눈으로 바로 보이는 특징은 제외해요.</p>
              <ul className="today-friend-commonality-examples">
                <li data-kind="avoid"><span>안 돼요</span> 키가 비슷하다, 안경을 쓴다, 옷 색깔이 같다</li>
                <li data-kind="ok"><span>좋아요</span> 좋아하는 음식, 주말에 하는 일, 키우는 동물</li>
              </ul>
            </div>
            <div className="today-friend-field-card today-friend-commonality-list" role="group" aria-label="대화로 찾은 공통점">
              <label className="today-friend-commonality-item"><span aria-hidden="true">1</span><input value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} aria-label="공통점 1" placeholder="대화로 알게 된 첫 번째 공통점" maxLength={120} /></label>
              <label className="today-friend-commonality-item"><span aria-hidden="true">2</span><input value={secondaryText} onChange={(event) => { setSecondaryText(event.target.value); setHasEdited(true); }} aria-label="공통점 2" placeholder="대화로 알게 된 두 번째 공통점" maxLength={120} /></label>
              <label className="today-friend-commonality-item"><span aria-hidden="true">3</span><input value={tertiaryText} onChange={(event) => { setTertiaryText(event.target.value); setHasEdited(true); }} aria-label="공통점 3" placeholder="대화로 알게 된 세 번째 공통점" maxLength={120} /></label>
            </div>
          </>
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
                      <option.icon aria-hidden="true" />{option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="today-friend-recommendation-texts">
                <label><span>추천할 것</span><input value={primaryText} onChange={(event) => { setPrimaryText(event.target.value); setHasEdited(true); }} placeholder="친구에게 추천하고 싶은 것을 적어요." maxLength={80} /></label>
                <label><span>추천하는 이유</span><textarea value={secondaryText} onChange={(event) => { setSecondaryText(event.target.value); setHasEdited(true); }} placeholder="친구에게 추천하고 싶은 이유를 적어요." maxLength={600} /></label>
              </div>
            </div>
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
      </fieldset>
      {saveMessage || formMessage ? <p className="today-friend-form-message" role="status">{saveMessage || formMessage}</p> : null}
      <div className="today-friend-form-actions">
        <button type="submit" disabled={!inputReady || isSaving || isSubmitting || isPreview}>
          <span>{isSubmitting ? mission.genre === 'recommendation' ? '편지와 미션 저장 중…' : '저장 중…' : isSaving ? '저장 중…' : pendingPayload ? '저장 확인 후 다시 제출' : mission.submission?.status === 'submitted' ? '다시 제출' : '선생님께 제출'}</span>
          {isSubmitting || isSaving ? null : <small>성의 없이 적으면 고마가 차감될 수 있어요</small>}
        </button>
      </div>
    </form>
  );
}
