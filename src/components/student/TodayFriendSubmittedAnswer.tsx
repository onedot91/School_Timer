import type { TodayFriendPayload } from '../../lib/todayFriend';

const categoryLabels = { movie: '영화', book: '책', music: '음악', food: '음식' } as const;

export default function TodayFriendSubmittedAnswer({ payload }: { readonly payload: TodayFriendPayload }) {
  const fields: readonly (readonly [string, string])[] = (() => {
    switch (payload.kind) {
      case 'interview': return [['친구의 답', payload.answer]];
      case 'commonality': return [['대화로 찾은 공통점', payload.commonality]];
      case 'recommendation': return [['추천 종류', categoryLabels[payload.category]], ['추천할 것', payload.title], ['추천하는 이유', payload.reason]];
      case 'compliment': return [['어떤 행동을 칭찬하고 싶나요?', payload.compliment], ['그 행동이 왜 좋았나요?', payload.reason ?? ''], ['친구에게 전하고 싶은 한마디', payload.message ?? '']];
      case 'emotion': return [['친구의 오늘 감정', payload.emotion], ['그렇게 느낀 이유', payload.declinedToExplain ? '친구가 이유를 말하고 싶지 않았어요.' : payload.reason]];
    }
  })();

  return (
    <dl className="today-friend-submitted-answer" aria-label="제출한 답안" tabIndex={0}>
      {fields.filter(([, value]) => value.length > 0).map(([label, value]) => (
        <div className="today-friend-field-card" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
