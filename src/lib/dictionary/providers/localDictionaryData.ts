import type {
  DictionaryCaseOption,
  DictionaryLexicalOrigin,
  DictionaryPartOfSpeech,
  Syllable,
} from '../models';

export interface LocalDictionarySeedSense {
  definition: string;
  example: string;
  simplifiedDefinition?: string;
  simplifiedExample?: string;
  partOfSpeech?: DictionaryPartOfSpeech;
}

export interface LocalDictionarySeedEntry {
  lemma: string;
  aliases?: string[];
  partOfSpeech: DictionaryPartOfSpeech;
  lexicalOrigin: DictionaryLexicalOrigin;
  homographNumber?: number | null;
  senses: LocalDictionarySeedSense[];
  syllables?: Syllable[] | null;
  syllableNote?: string | null;
  caseOptions?: DictionaryCaseOption[] | null;
}

export const LOCAL_DICTIONARY_ENTRIES: LocalDictionarySeedEntry[] = [
  {
    lemma: '고구마',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '땅속에서 자라며 쪄서 많이 먹는 달콤한 먹거리예요.',
        example: '간식 시간에 따뜻한 고구마를 친구와 나누어 먹었어요.',
      },
    ],
  },
  {
    lemma: '바나나',
    partOfSpeech: 'noun',
    lexicalOrigin: 'loanword',
    senses: [
      {
        definition: '노랗고 길쭉하며 달콤한 과일이에요.',
        example: '아침에 바나나 한 개를 먹고 학교에 갔어요.',
      },
    ],
  },
  {
    lemma: '하늘',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '땅 위로 높게 펼쳐져 보이는 넓은 공간이에요.',
        example: '비가 그친 뒤에 하늘이 아주 맑아졌어요.',
      },
    ],
  },
  {
    lemma: '강아지',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '아직 다 자라지 않은 어린 개를 말해요.',
        example: '공원에서 만난 강아지가 꼬리를 흔들었어요.',
      },
    ],
  },
  {
    lemma: '눈',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '사물을 보는 데 쓰는 몸의 기관이에요.',
        example: '책을 가까이에서 오래 보면 눈이 피곤할 수 있어요.',
      },
      {
        definition: '겨울에 하늘에서 하얗게 내려오는 얼음 조각이에요.',
        example: '아침에 운동장에 눈이 소복하게 쌓였어요.',
      },
    ],
  },
  {
    lemma: '말',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '생각이나 느낌을 입으로 나타내는 소리예요.',
        example: '친구에게 고운 말로 마음을 전했어요.',
      },
      {
        definition: '사람이 타거나 짐을 나르는 큰 동물이에요.',
        example: '동화책 속 왕자가 흰 말을 타고 나타났어요.',
      },
    ],
  },
  {
    lemma: '배',
    partOfSpeech: 'noun',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '음식을 먹으면 불러오는 몸의 부분이에요.',
        example: '점심을 많이 먹어서 배가 든든해졌어요.',
      },
      {
        definition: '사람이나 짐을 싣고 물 위를 다니는 큰 탈것이에요.',
        example: '항구에서 큰 배가 천천히 떠났어요.',
      },
      {
        definition: '물기가 많고 아삭한 맛이 나는 과일이에요.',
        example: '후식으로 시원한 배를 잘라 먹었어요.',
      },
    ],
  },
  {
    lemma: '사과',
    partOfSpeech: 'noun',
    lexicalOrigin: 'unknown',
    senses: [
      {
        definition: '빨갛거나 노랗고 단맛이 나는 과일이에요.',
        example: '도시락 옆에 사과 조각을 담아 갔어요.',
      },
      {
        definition: '잘못을 인정하고 미안하다고 말하는 일이에요.',
        example: '실수한 뒤에 바로 사과를 해서 마음이 풀렸어요.',
      },
    ],
  },
  {
    lemma: '학교',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '학생들이 모여 배우고 생활하는 곳이에요.',
        example: '아침마다 학교에 가서 친구들과 함께 공부해요.',
      },
    ],
    syllables: [
      { char: '학', isHanja: true, hanjaChar: '學', hanjaMeaning: '배우다', relatedWords: ['학생', '과학'] },
      { char: '교', isHanja: true, hanjaChar: '校', hanjaMeaning: '학교', relatedWords: ['교문', '교정'] },
    ],
  },
  {
    lemma: '학생',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '학교에서 배우는 사람을 말해요.',
        example: '학생들은 종이 울리면 교실로 들어갔어요.',
      },
    ],
    syllables: [
      { char: '학', isHanja: true, hanjaChar: '學', hanjaMeaning: '배우다', relatedWords: ['학교', '과학'] },
      { char: '생', isHanja: true, hanjaChar: '生', hanjaMeaning: '나다', relatedWords: ['생일', '생활'] },
    ],
  },
  {
    lemma: '교실',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '학생들이 수업을 듣는 방이에요.',
        example: '쉬는 시간이 끝나서 모두 교실로 돌아왔어요.',
      },
    ],
    syllables: [
      { char: '교', isHanja: true, hanjaChar: '敎', hanjaMeaning: '가르치다', relatedWords: ['교육', '교사'] },
      { char: '실', isHanja: true, hanjaChar: '室', hanjaMeaning: '방', relatedWords: ['실내', '침실'] },
    ],
  },
  {
    lemma: '도서관',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '책을 읽거나 빌릴 수 있도록 모아 둔 곳이에요.',
        example: '방과 후에 도서관에서 읽고 싶은 책을 골랐어요.',
      },
    ],
    syllables: [
      { char: '도', isHanja: true, hanjaChar: '圖', hanjaMeaning: '그림', relatedWords: ['지도', '도형'] },
      { char: '서', isHanja: true, hanjaChar: '書', hanjaMeaning: '글', relatedWords: ['독서', '도서'] },
      { char: '관', isHanja: true, hanjaChar: '館', hanjaMeaning: '집', relatedWords: ['박물관', '미술관'] },
    ],
  },
  {
    lemma: '시간',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '어떤 일이 이어지는 동안이나 때를 말해요.',
        example: '숙제를 할 시간을 미리 정해 두었어요.',
      },
    ],
    syllables: [
      { char: '시', isHanja: true, hanjaChar: '時', hanjaMeaning: '때', relatedWords: ['시계', '시각'] },
      { char: '간', isHanja: true, hanjaChar: '間', hanjaMeaning: '사이', relatedWords: ['간격', '공간'] },
    ],
  },
  {
    lemma: '가족',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '한집에서 함께 살거나 가까운 사이로 이어진 사람들을 말해요.',
        example: '주말에는 가족과 함께 공원에 놀러 갔어요.',
      },
    ],
    syllables: [
      { char: '가', isHanja: true, hanjaChar: '家', hanjaMeaning: '집', relatedWords: ['가정', '가구'] },
      { char: '족', isHanja: true, hanjaChar: '族', hanjaMeaning: '무리', relatedWords: ['민족', '부족'] },
    ],
  },
  {
    lemma: '친구',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '서로 아끼며 가까이 지내는 사람을 말해요.',
        example: '친구와 함께 문제를 풀면서 서로 도와주었어요.',
      },
    ],
    syllables: [
      { char: '친', isHanja: true, hanjaChar: '親', hanjaMeaning: '가깝다', relatedWords: ['친절', '친척'] },
      { char: '구', isHanja: true, hanjaChar: '舊', hanjaMeaning: '오래되다', relatedWords: ['구식', '구세대'] },
    ],
  },
  {
    lemma: '선생님',
    partOfSpeech: 'noun',
    lexicalOrigin: 'mixed',
    senses: [
      {
        definition: '학생을 가르쳐 주는 어른을 높여 이르는 말이에요.',
        example: '선생님께서 오늘의 준비물을 다시 알려 주셨어요.',
      },
    ],
    syllables: [
      { char: '선', isHanja: true, hanjaChar: '先', hanjaMeaning: '먼저', relatedWords: ['선배', '선두'] },
      { char: '생', isHanja: true, hanjaChar: '生', hanjaMeaning: '나다', relatedWords: ['생일', '생활'] },
      { char: '님', isHanja: false },
    ],
  },
  {
    lemma: '음악',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '소리와 리듬으로 느낌을 나타내는 것을 말해요.',
        example: '수업이 끝난 뒤에 잔잔한 음악을 들었어요.',
      },
    ],
    syllables: [
      { char: '음', isHanja: true, hanjaChar: '音', hanjaMeaning: '소리', relatedWords: ['발음', '소음'] },
      { char: '악', isHanja: true, hanjaChar: '樂', hanjaMeaning: '즐기다', relatedWords: ['악기', '국악'] },
    ],
  },
  {
    lemma: '과학',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '자연이나 세상이 어떻게 움직이는지 살피며 배우는 분야예요.',
        example: '과학 시간에 자석이 붙는 물건을 찾아보았어요.',
      },
    ],
    syllables: [
      { char: '과', isHanja: true, hanjaChar: '科', hanjaMeaning: '분야', relatedWords: ['과목', '학과'] },
      { char: '학', isHanja: true, hanjaChar: '學', hanjaMeaning: '배우다', relatedWords: ['학교', '학생'] },
    ],
  },
  {
    lemma: '사회',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '사람들이 함께 어울려 살아가는 세상을 말해요.',
        example: '사회 시간에 우리 동네의 모습을 살펴보았어요.',
      },
    ],
    syllables: [
      { char: '사', isHanja: true, hanjaChar: '社', hanjaMeaning: '모임', relatedWords: ['회사', '사원'] },
      { char: '회', isHanja: true, hanjaChar: '會', hanjaMeaning: '모이다', relatedWords: ['회의', '회장'] },
    ],
  },
  {
    lemma: '체육',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '몸을 건강하게 기르고 움직이는 활동이나 과목이에요.',
        example: '체육 시간에 친구들과 공놀이를 했어요.',
      },
    ],
    syllables: [
      { char: '체', isHanja: true, hanjaChar: '體', hanjaMeaning: '몸', relatedWords: ['체조', '신체'] },
      { char: '육', isHanja: true, hanjaChar: '育', hanjaMeaning: '기르다', relatedWords: ['교육', '보육'] },
    ],
  },
  {
    lemma: '방학',
    aliases: ['여름방학', '겨울방학'],
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '학교 수업을 쉬는 기간을 말해요.',
        example: '여름 방학에는 매일 아침 운동을 하기로 했어요.',
      },
    ],
    syllables: [
      { char: '방', isHanja: true, hanjaChar: '放', hanjaMeaning: '놓다', relatedWords: ['방송', '해방'] },
      { char: '학', isHanja: true, hanjaChar: '學', hanjaMeaning: '배우다', relatedWords: ['학교', '학생'] },
    ],
  },
  {
    lemma: '운동장',
    partOfSpeech: 'noun',
    lexicalOrigin: 'sino_korean',
    senses: [
      {
        definition: '달리기나 놀이를 할 수 있게 넓게 만든 마당이에요.',
        example: '점심시간에 운동장으로 나가 친구들과 뛰어놀았어요.',
      },
    ],
    syllables: [
      { char: '운', isHanja: true, hanjaChar: '運', hanjaMeaning: '움직이다', relatedWords: ['운전', '운반'] },
      { char: '동', isHanja: true, hanjaChar: '動', hanjaMeaning: '움직이다', relatedWords: ['활동', '자동차'] },
      { char: '장', isHanja: true, hanjaChar: '場', hanjaMeaning: '마당', relatedWords: ['시장', '광장'] },
    ],
  },
  {
    lemma: '먹다',
    aliases: ['먹어', '먹어요', '먹었다', '먹었어', '먹었어요', '먹어서', '먹으면', '먹는', '먹고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '음식이나 약을 입에 넣어 삼키다.',
        example: '점심에 김밥을 먹고 운동장에 나갔어요.',
      },
    ],
  },
  {
    lemma: '가다',
    aliases: ['가', '가요', '갔다', '갔어', '갔어요', '가서', '가면', '가는'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '한 곳에서 다른 곳으로 움직여 옮기다.',
        example: '종이 울리면 모두 교실로 가요.',
      },
    ],
  },
  {
    lemma: '예쁘다',
    aliases: ['예뻐', '예뻐요', '예뻤다', '예뻤어', '예뻤어요', '예뻐서'],
    partOfSpeech: 'adjective',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '모양이나 빛깔이 곱고 사랑스럽다.',
        example: '봄에 핀 꽃이 아주 예뻐 보여요.',
      },
    ],
  },
  {
    lemma: '크다',
    aliases: ['커', '커요', '컸다', '컸어', '컸어요', '커서'],
    partOfSpeech: 'adjective',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '길이나 넓이, 부피가 보통보다 많다.',
        example: '운동장 나무가 생각보다 아주 커요.',
      },
    ],
  },
  {
    lemma: '공부하다',
    aliases: ['공부해', '공부해요', '공부했다', '공부했어', '공부했어요', '공부해서', '공부하면', '공부하는', '공부하고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'mixed',
    senses: [
      {
        definition: '지식이나 기능을 배우고 익히다.',
        example: '친구와 함께 도서관에서 공부했어요.',
      },
    ],
  },
  {
    lemma: '좋아하다',
    aliases: ['좋아해', '좋아해요', '좋아했다', '좋아했어', '좋아했어요', '좋아해서', '좋아하면', '좋아하는', '좋아하고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'mixed',
    senses: [
      {
        definition: '어떤 대상이나 일을 마음에 들어 하다.',
        example: '민서는 과학 시간을 특히 좋아해요.',
      },
    ],
  },
  {
    lemma: '좋다',
    aliases: ['좋아', '좋아요', '좋았다', '좋았어', '좋았어요', '좋아서', '좋으면', '좋은'],
    partOfSpeech: 'adjective',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '마음에 들거나 느낌이 만족스럽다.',
        example: '오늘은 날씨가 좋아서 운동장에 나가 놀았어요.',
      },
    ],
  },
  {
    lemma: '듣다',
    aliases: ['들어', '들어요', '들었다', '들었어', '들었어요', '들어서', '들으면', '듣는', '듣고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '소리를 귀로 느끼다.',
        example: '선생님 말씀을 잘 듣고 차례를 기다렸어요.',
      },
    ],
  },
  {
    lemma: '걷다',
    aliases: ['걸어', '걸어요', '걸었다', '걸었어', '걸었어요', '걸어서', '걸으면', '걷는', '걷고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '발을 번갈아 옮기며 앞으로 나아가다.',
        example: '집까지 천천히 걸어서 돌아왔어요.',
      },
    ],
  },
  {
    lemma: '돕다',
    aliases: ['도와', '도와요', '도왔다', '도왔어', '도왔어요', '도와서', '도우면', '돕는', '돕고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '남이 일을 잘할 수 있게 힘을 보태다.',
        example: '친구가 무거운 책을 옮길 때 함께 도와줬어요.',
      },
    ],
  },
  {
    lemma: '춥다',
    aliases: ['추워', '추워요', '추웠다', '추웠어', '추웠어요', '추워서', '추우면'],
    partOfSpeech: 'adjective',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '날씨나 몸의 느낌이 차갑다.',
        example: '바람이 불어서 손끝이 추워졌어요.',
      },
    ],
  },
  {
    lemma: '부르다',
    aliases: ['불러', '불러요', '불렀다', '불렀어', '불렀어요', '불러서', '부르면', '부르는', '부르고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '이름을 말하거나 오라고 하다.',
        example: '출석을 부를 때 또렷하게 대답했어요.',
      },
    ],
  },
  {
    lemma: '모르다',
    aliases: ['몰라', '몰라요', '몰랐다', '몰랐어', '몰랐어요', '몰라서', '모르면', '모르는'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '어떤 것을 알지 못하다.',
        example: '모르는 문제가 나오면 천천히 다시 읽어 봐요.',
      },
    ],
  },
  {
    lemma: '짓다',
    aliases: ['지어', '지어요', '지었다', '지었어', '지었어요', '지어서', '지으면', '짓는', '짓고'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '집이나 문장, 표정 같은 것을 만들어 내다.',
        example: '발표 제목을 함께 지어 보았어요.',
      },
    ],
  },
  {
    lemma: '낫다',
    aliases: ['나아', '나아요', '나았다', '나았어', '나았어요', '나아서', '나으면'],
    partOfSpeech: 'verb',
    lexicalOrigin: 'native_korean',
    senses: [
      {
        definition: '아프던 몸이나 상처가 좋아지다.',
        example: '푹 쉬고 약을 먹으니 감기가 많이 나았어요.',
      },
    ],
  },
];
