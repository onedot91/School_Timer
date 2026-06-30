export interface StudentCharacter {
  id: string;
  name: string;
  creatorName?: string;
  imageSrc: string;
  speechImageSrc?: string;
  speechImageAlt?: string;
  alt: string;
  themeColor?: string;
  speech?: string;
  speechTop?: string;
  walkTransform?: {
    right: string;
    left: string;
  };
}

export const STUDENT_CHARACTER_WALK_SECONDS = 34;

export const STUDENT_CHARACTERS: StudentCharacter[] = [
  {
    id: 'student-1-tiger',
    name: '호랑이 자캐',
    creatorName: '1번',
    imageSrc: '/student-characters/character-1.png',
    alt: '1번 학생이 만든 호랑이 캐릭터',
    themeColor: '#D94A35',
    speech: '호걸이 좋지',
    walkTransform: {
      right: 'none',
      left: 'scaleX(-1)',
    },
  },
  {
    id: 'student-2-runner',
    name: '달리는 자캐',
    creatorName: '2번',
    imageSrc: '/student-characters/character-2.png',
    alt: '2번 학생이 만든 달리는 캐릭터',
    themeColor: '#D63D2E',
    speech: '2026년 동안 잘 지내자.',
    walkTransform: {
      right: 'none',
      left: 'scaleX(-1)',
    },
  },
  {
    id: 'student-3-vending-machine',
    name: '자판기 자캐',
    creatorName: '3번',
    imageSrc: '/student-characters/character-3.png',
    alt: '3번 학생이 만든 자판기 캐릭터',
    themeColor: '#E65A3B',
    speech: '저는 삼겹살을 먹고 싶어요.',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-4-turtle',
    name: '거북이 자캐',
    creatorName: '4번',
    imageSrc: '/student-characters/character-4.png',
    alt: '4번 학생이 만든 거북이 캐릭터',
    themeColor: '#4E9A62',
    speech: '저 포도를 먹고 말테야.',
    speechTop: '20%',
    walkTransform: {
      right: 'rotate(90deg)',
      left: 'rotate(-90deg)',
    },
  },
  {
    id: 'student-5-star',
    name: '별 자캐',
    creatorName: '5번',
    imageSrc: '/student-characters/character-5.png',
    alt: '5번 학생이 만든 별 캐릭터',
    themeColor: '#F26A1B',
    speech: '공부 열심히 해.',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-6-wizard',
    name: '마법사 자캐',
    creatorName: '6번',
    imageSrc: '/student-characters/character-6.png',
    alt: '6번 학생이 만든 마법사 캐릭터',
    themeColor: '#6D45B8',
    speech: '연금술사의 토큰이 있으면 나한테 오도록 해!',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-7-orange-car',
    name: '주황 자동차 자캐',
    creatorName: '7번',
    imageSrc: '/student-characters/character-7.png',
    alt: '7번 학생이 만든 주황 자동차 캐릭터',
    themeColor: '#F36B1D',
    speech: '나는 시속 300km로 달리는 중..',
    walkTransform: {
      right: 'scaleX(-1)',
      left: 'none',
    },
  },
  {
    id: 'student-8-taegeuk',
    name: '태극 자캐',
    creatorName: '8번',
    imageSrc: '/student-characters/character-8.png',
    alt: '8번 학생이 만든 태극 캐릭터',
    themeColor: '#1E5BD7',
    speech: '뀨',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-9-heart',
    name: '하트 자캐',
    creatorName: '9번',
    imageSrc: '/student-characters/character-9.png',
    speechImageSrc: '/student-characters/character-9-speaking.png',
    speechImageAlt: '말풍선이 있는 9번 하트 캐릭터',
    alt: '9번 학생이 만든 하트 캐릭터',
    themeColor: '#E23A3A',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-10-magic-bear',
    name: '마법 곰 자캐',
    creatorName: '10번',
    imageSrc: '/student-characters/character-10.png',
    alt: '10번 학생이 만든 마법 곰 캐릭터',
    themeColor: '#7ED957',
    speech: '고마워!',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-11-monster',
    name: '몬스터 자캐',
    creatorName: '11번',
    imageSrc: '/student-characters/character-11.png',
    alt: '11번 학생이 만든 몬스터 캐릭터',
    themeColor: '#5B2CCB',
    speech: '바이바이 안녕하세용',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-13-earth-robot',
    name: '지구 로봇 자캐',
    creatorName: '13번',
    imageSrc: '/student-characters/character-13.png',
    alt: '13번 학생이 만든 지구 로봇 캐릭터',
    themeColor: '#1FA8E8',
    speech: '친하게 지내자.',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-22-raongi',
    name: '라옹이 자캐',
    creatorName: '22번',
    imageSrc: '/student-characters/character-22.png',
    alt: '22번 학생이 만든 라옹이 캐릭터',
    themeColor: '#F4C21F',
    speech: '이건 라옹이야.',
    walkTransform: {
      right: 'scaleX(-1)',
      left: 'none',
    },
  },
  {
    id: 'student-15-alien',
    name: '초록 외계인 자캐',
    creatorName: '15번',
    imageSrc: '/student-characters/character-15.png',
    alt: '15번 학생이 만든 초록 외계인 캐릭터',
    themeColor: '#1FCF7A',
    speech: '따랑해~',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-16-melon-turtle',
    name: '메론빵 거북이 자캐',
    creatorName: '16번',
    imageSrc: '/student-characters/character-16.png',
    alt: '16번 학생이 만든 메론빵 거북이 캐릭터',
    themeColor: '#74C947',
    speech: '안녕 나는 메론빵 거북이야.',
    walkTransform: {
      right: 'rotate(90deg)',
      left: 'rotate(-90deg)',
    },
  },
  {
    id: 'student-18-cat-girl',
    name: '고양이 소녀 자캐',
    creatorName: '18번',
    imageSrc: '/student-characters/character-18.png',
    alt: '18번 학생이 만든 고양이 소녀 캐릭터',
    themeColor: '#F08AB5',
    speech: '나랑 잘 지내자.',
    walkTransform: {
      right: 'none',
      left: 'scaleX(-1)',
    },
  },
  {
    id: 'student-21-star-capsule',
    name: '별 캡슐 자캐',
    creatorName: '21번',
    imageSrc: '/student-characters/character-21.png',
    alt: '21번 학생이 만든 별 캡슐 캐릭터',
    themeColor: '#F4D12E',
    speech: '사랑해♥',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
  {
    id: 'student-23-flower',
    name: '꽃옷 자캐',
    creatorName: '23번',
    imageSrc: '/student-characters/character-23.png',
    alt: '23번 학생이 만든 꽃옷 캐릭터',
    themeColor: '#F08AB5',
    speech: '안녕하세요. 할무니예유.',
    walkTransform: {
      right: 'none',
      left: 'scaleX(-1)',
    },
  },
  {
    id: 'student-12-clover',
    name: '클로버 자캐',
    creatorName: '12번',
    imageSrc: '/student-characters/character-12.png',
    alt: '12번 학생이 만든 클로버 캐릭터',
    themeColor: '#A6C84A',
    speech: '나를 먹지마!!!',
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
];
