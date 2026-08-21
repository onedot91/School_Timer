import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyFeaturedWriting,
  moveFeaturedWriting,
  normalizeBookstoreSettings,
} from './bookstore.js';

test('우수글 설정은 잘못된 저장값을 제거하고 공개 상태와 순서를 보존한다', () => {
  const settings = normalizeBookstoreSettings({
    featuredWritings: [
      {
        id: 'writing-1',
        title: '  우리 반의 봄  ',
        author: '  3번  ',
        summary: '  따뜻한 봄 이야기  ',
        content: '  운동장에서 만난 봄을 썼습니다.  ',
        isPublished: true,
      },
      { id: '', title: '잘못된 글', content: '본문' },
      null,
    ],
  });

  assert.deepEqual(settings.featuredWritings, [{
    id: 'writing-1',
    title: '우리 반의 봄',
    author: '3번',
    summary: '따뜻한 봄 이야기',
    content: '운동장에서 만난 봄을 썼습니다.',
    isPublished: true,
  }]);
});

test('빈 우수글은 교사 편집에 필요한 안전한 기본값을 만든다', () => {
  const writing = createEmptyFeaturedWriting('writing-new');

  assert.deepEqual(writing, {
    id: 'writing-new',
    title: '',
    author: '',
    summary: '',
    content: '',
    isPublished: false,
  });
});

test('우수글 이동은 배열 경계를 넘지 않고 진열 순서를 바꾼다', () => {
  const settings = normalizeBookstoreSettings({
    featuredWritings: [
      { id: 'a', title: '첫 글', author: '1번', summary: '', content: '첫 본문', isPublished: true },
      { id: 'b', title: '둘째 글', author: '2번', summary: '', content: '둘째 본문', isPublished: true },
    ],
  });

  assert.deepEqual(
    moveFeaturedWriting(settings.featuredWritings, 'b', -1).map((writing) => writing.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    moveFeaturedWriting(settings.featuredWritings, 'a', -1).map((writing) => writing.id),
    ['a', 'b'],
  );
});
