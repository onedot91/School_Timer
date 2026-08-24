export type DailyWritingPrompt = {
  readonly id: string;
  readonly topic: string;
  readonly requiredWord: string;
  readonly requiredWordMeaning: string;
};

export const DAILY_WRITING_PROMPTS = [
  { id: 'secret-passage', topic: '우리 반에 비밀 통로가 생긴다면', requiredWord: '살금살금', requiredWordMeaning: '남이 모르게 조용히 움직이는 모양' },
  { id: 'animal-day', topic: '하루 동안 동물이 되어 산다면', requiredWord: '어슬렁어슬렁', requiredWordMeaning: '몸을 조금 흔들며 천천히 걷는 모양' },
  { id: 'food-rain', topic: '하늘에서 음식이 비처럼 내린다면', requiredWord: '주룩주룩', requiredWordMeaning: '굵은 물줄기나 빗물이 계속 흐르는 모양' },
  { id: 'invention', topic: '나만의 특별한 발명품을 만든다면', requiredWord: '번뜩이다', requiredWordMeaning: '생각이나 느낌이 갑자기 떠오르다' },
  { id: 'talking-classroom', topic: '교실의 물건들이 말을 한다면', requiredWord: '소곤소곤', requiredWordMeaning: '남이 듣지 못하게 작은 목소리로 이야기하는 모양' },
  { id: 'smiling-earth', topic: '지구를 웃게 만드는 하루', requiredWord: '알뜰하다', requiredWordMeaning: '물건이나 시간을 아껴 쓰는 태도가 있다' },
  { id: 'tiny-desk-trip', topic: '작아진 내가 책상 위를 여행한다면', requiredWord: '아슬아슬', requiredWordMeaning: '위험할 만큼 아주 가까스로 이루어지는 모양' },
  { id: 'future-letter', topic: '미래의 나에게 편지를 쓴다면', requiredWord: '뿌듯하다', requiredWordMeaning: '잘한 일로 마음이 기쁘고 자랑스럽다' },
  { id: 'rainy-adventure', topic: '비 오는 날 발견한 작은 모험', requiredWord: '첨벙첨벙', requiredWordMeaning: '물이 튀도록 발로 자꾸 세게 밟는 모양' },
  { id: 'different-hearts', topic: '친구와 마음이 달랐던 날', requiredWord: '다독이다', requiredWordMeaning: '남의 마음을 편안하게 달래어 주다' },
  { id: 'neighborhood-playground', topic: '우리 동네에 새로운 놀이터를 만든다면', requiredWord: '오순도순', requiredWordMeaning: '여럿이 정답게 모여 지내는 모양' },
  { id: 'cloud-house', topic: '구름 위에 집을 짓는다면', requiredWord: '몽글몽글', requiredWordMeaning: '작고 부드러운 덩어리가 모여 있는 모양' },
  { id: 'brave-moment', topic: '내가 용기를 냈던 순간', requiredWord: '씩씩하다', requiredWordMeaning: '어려움을 두려워하지 않고 굳세다' },
  { id: 'robot-friend', topic: '학교에 로봇 친구가 온다면', requiredWord: '척척', requiredWordMeaning: '어려운 일을 막힘없이 잘 해내는 모양' },
  { id: 'stopped-time', topic: '하루 동안 시간을 멈출 수 있다면', requiredWord: '고요하다', requiredWordMeaning: '아무 소리 없이 조용하다' },
] as const satisfies readonly DailyWritingPrompt[];

export const pickDailyWritingPrompt = (
  currentTopic: string,
  randomSource: () => number = Math.random,
): DailyWritingPrompt => {
  const candidates = DAILY_WRITING_PROMPTS.filter((prompt) => prompt.topic !== currentTopic.trim());
  const index = Math.floor(randomSource() * candidates.length);
  return candidates[index] ?? DAILY_WRITING_PROMPTS[0];
};
