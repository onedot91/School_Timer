export interface StudentCharacter {
  id: string;
  name: string;
  creatorName?: string;
  imageSrc: string;
  alt: string;
  themeColor?: string;
}

export const STUDENT_CHARACTER_ROTATION_SECONDS = 12;

export const STUDENT_CHARACTERS: StudentCharacter[] = [
  {
    id: 'student-2-tiger',
    name: '호랑이 자캐',
    creatorName: '2번',
    imageSrc: '/student-characters/character-2.png',
    alt: '2번 학생이 만든 호랑이 캐릭터',
    themeColor: '#D94A35',
  },
  {
    id: 'student-3-turtle',
    name: '거북이 자캐',
    creatorName: '3번',
    imageSrc: '/student-characters/character-3.png',
    alt: '3번 학생이 만든 거북이 캐릭터',
    themeColor: '#4E9A62',
  },
  {
    id: 'student-6-wizard',
    name: '마법사 자캐',
    creatorName: '6번',
    imageSrc: '/student-characters/character-6.png',
    alt: '6번 학생이 만든 마법사 캐릭터',
    themeColor: '#6D45B8',
  },
  {
    id: 'student-12-clover',
    name: '클로버 자캐',
    creatorName: '12번',
    imageSrc: '/student-characters/character-12.png',
    alt: '12번 학생이 만든 클로버 캐릭터',
    themeColor: '#A6C84A',
  },
];
