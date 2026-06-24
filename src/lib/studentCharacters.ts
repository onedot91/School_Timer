export interface StudentCharacter {
  id: string;
  name: string;
  creatorName?: string;
  imageSrc: string;
  alt: string;
  themeColor?: string;
  walkTransform?: {
    right: string;
    left: string;
  };
}

export const STUDENT_CHARACTER_WALK_SECONDS = 24;

export const STUDENT_CHARACTERS: StudentCharacter[] = [
  {
    id: 'student-1-tiger',
    name: '호랑이 자캐',
    creatorName: '1번',
    imageSrc: '/student-characters/character-1.png',
    alt: '1번 학생이 만든 호랑이 캐릭터',
    themeColor: '#D94A35',
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
    walkTransform: {
      right: 'none',
      left: 'scaleX(-1)',
    },
  },
  {
    id: 'student-8-taegeuk',
    name: '태극 자캐',
    creatorName: '8번',
    imageSrc: '/student-characters/character-8.png',
    alt: '8번 학생이 만든 태극 캐릭터',
    themeColor: '#1E5BD7',
    walkTransform: {
      right: 'none',
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
    walkTransform: {
      right: 'none',
      left: 'none',
    },
  },
];
