import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auctionPageSource = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

test('학생 편지 읽음 저장은 다른 편지 저장 중에도 편지별로 독립 처리한다', () => {
  assert.match(auctionPageSource, /studentLetterReadOverlayRef = useRef<Map<string, string>>\(new Map\(\)\)/);
  assert.match(auctionPageSource, /studentLetterReadOverlayRef\.current\.has\(letterId\)/);
  assert.match(auctionPageSource, /studentLetterReadOverlayRef\.current\.set\(letterId, readAt\)/);
  assert.match(auctionPageSource, /setStudentLife\(\(current\) => markStudentLetterRead\(current, studentNumber, letterId, readAt\)\)/);
  assert.match(auctionPageSource, /setStudentLifeSnapshot\(saved\)/);
  assert.match(auctionPageSource, /setStudentLifeSnapshot\(normalizedStudentLife\)/);
  assert.match(auctionPageSource, /saved = await updateStoredStudentLifeState/);
  assert.doesNotMatch(
    auctionPageSource,
    /const readStudentLetter = async \(letterId: string\) => \{\s*await saveStudentLifeChange/,
  );
});
