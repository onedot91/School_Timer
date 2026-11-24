import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  TOURNAMENT_BYE,
  TOURNAMENT_MATCH_COUNT,
  clearTournamentWinner,
  countTournamentResults,
  createTournament,
  getTournamentContestants,
  getTournamentWinner,
  isTournamentByeMatch,
  normalizeTournament,
  setTournamentWinner,
  type Tournament,
} from './tournament';
import { getTournamentDestinationKey, getTournamentLayout } from './tournamentLayout';

const playAll = (tournament: Tournament): Tournament => {
  let next = tournament;
  for (let match = 31; match >= 1; match -= 1) {
    const [first, second] = getTournamentContestants(next, match);
    if (first !== null && second !== null) next = setTournamentWinner(next, match, first);
  }
  return next;
};

test('23명이 한 번씩 들어가고 부전승 9명은 16강 자리마다 고르게 흩어진다', () => {
  for (let round = 0; round < 200; round += 1) {
    const { seats } = createTournament('오목 대회');
    assert.deepEqual(seats.filter(Boolean).sort((a, b) => a - b), Array.from({ length: 23 }, (_, index) => index + 1));
    const byesPerGroup = Array.from({ length: 8 }, (_, group) => (
      seats.slice(group * 4, group * 4 + 4).filter((seat) => seat === TOURNAMENT_BYE).length
    ));
    assert.deepEqual([...byesPerGroup].sort(), [1, 1, 1, 1, 1, 1, 1, 2]);
    for (let seat = 0; seat < 32; seat += 2) assert.notEqual(seats[seat], TOURNAMENT_BYE);
  }
});

test('모든 학생의 부전승 확률이 같다', () => {
  const trials = 9_200;
  const byes = new Map<number, number>();
  for (let trial = 0; trial < trials; trial += 1) {
    const tournament = createTournament('');
    for (let match = 16; match < 32; match += 1) {
      if (!isTournamentByeMatch(tournament, match)) continue;
      const student = getTournamentWinner(tournament, match)!;
      byes.set(student, (byes.get(student) ?? 0) + 1);
    }
  }
  const expected = trials * 9 / 23;
  for (let student = 1; student <= 23; student += 1) {
    // 표준편차 약 47의 6배: 우연으로는 사실상 벗어나지 않는 범위
    assert.ok(Math.abs((byes.get(student) ?? 0) - expected) < 285, `${student}번 ${byes.get(student)}회`);
  }
});

test('이긴 학생이 다음 경기로 올라가 22경기 뒤 우승자가 정해진다', () => {
  const tournament = playAll(createTournament('팔씨름'));
  assert.equal(countTournamentResults(tournament), TOURNAMENT_MATCH_COUNT);
  assert.ok(getTournamentWinner(tournament, 1));
});

test('앞 경기를 취소하면 그 결과에 이어진 뒤 경기만 사라진다', () => {
  const tournament = playAll(createTournament(''));
  const match = [16, 17, 18, 19, 20, 21, 22, 23].find((candidate) => !isTournamentByeMatch(tournament, candidate))!;
  const cleared = clearTournamentWinner(tournament, match);
  const gone = Object.keys(tournament.winners).filter((key) => !(key in cleared.winners)).map(Number);
  const path: number[] = [];
  for (let current = match; current >= 1; current = Math.floor(current / 2)) path.push(current);
  assert.deepEqual(gone.sort((a, b) => a - b), path.sort((a, b) => a - b));
});

test('이긴 학생을 바꾸면 이전 학생의 뒤 경기 기록은 남지 않는다', () => {
  const tournament = playAll(createTournament(''));
  const [, loser] = getTournamentContestants(tournament, 2);
  const changed = setTournamentWinner(tournament, 2, loser!);
  assert.equal(getTournamentContestants(changed, 1)[0], loser);
  assert.notEqual(getTournamentWinner(changed, 1), getTournamentWinner(tournament, 1));
});

test('저장된 값은 그대로 복원하고 망가진 값은 버린다', () => {
  const tournament = playAll(createTournament('줄넘기'));
  assert.deepEqual(normalizeTournament(JSON.parse(JSON.stringify(tournament))), tournament);
  for (const broken of [null, undefined, {}, [], { seats: [] }, { ...tournament, seats: tournament.seats.map(() => 1) },
    { ...tournament, seats: [0, ...tournament.seats.slice(1)] }]) {
    assert.equal(normalizeTournament(broken), null);
  }
  const tampered = normalizeTournament({ ...tournament, winners: { 1: 99, 2: '3', 31: 24, nope: 1 } });
  assert.deepEqual(tampered?.winners, {});
  assert.equal(normalizeTournament({ ...tournament, title: '가'.repeat(50) })?.title.length, 20);
});

test('대진표 칸은 화면 안에서 서로 겹치지 않는다', () => {
  for (let round = 0; round < 100; round += 1) {
    const { slots, banners } = getTournamentLayout(createTournament(''));
    assert.equal(banners.length, 7);
    // 1회전 14 + 부전승 9 + (1회전에서 올라온) 16강 7 + 8강 8 + 4강 4 + 결승 2
    assert.equal(slots.length, 44);
    assert.equal(new Set(slots.map((slot) => slot.key)).size, 44);
    assert.deepEqual(
      slots.filter((slot) => slot.isEntry).map((slot) => slot.student).sort((a, b) => Number(a) - Number(b)),
      Array.from({ length: 23 }, (_, index) => index + 1),
    );
    slots.forEach((slot, index) => {
      assert.ok(slot.x >= 0 && slot.y >= 0 && slot.x + slot.width <= 1600 && slot.y + slot.height <= 900);
      for (const other of slots.slice(index + 1)) {
        assert.ok(slot.x + slot.width <= other.x || other.x + other.width <= slot.x
          || slot.y + slot.height <= other.y || other.y + other.height <= slot.y, `${slot.key} / ${other.key}`);
      }
      for (const banner of banners) {
        const reach = banner.width / 2 + banner.tail;
        const badge = slot.isRound ? slot.fontSize * 0.68 : 0;
        assert.ok(slot.x + slot.width <= banner.x - reach || slot.x >= banner.x + reach
          || slot.y + slot.height + badge <= banner.y - banner.height / 2
          || slot.y >= banner.y + banner.height * 0.66, `${banner.label}이 ${slot.key} 칸을 가림`);
      }
      const circle = { left: 662, right: 938, top: 64, bottom: 340 };
      assert.ok(slot.x + slot.width <= circle.left || slot.x >= circle.right || slot.y >= circle.bottom || slot.y + slot.height <= circle.top);
    });
  }
});

test('이긴 학생이 앉을 칸은 다음 경기의 자리와 같다', () => {
  const tournament = playAll(createTournament(''));
  const { slots } = getTournamentLayout(tournament);
  for (const key of Object.keys(tournament.winners)) {
    const match = Number(key);
    const destination = slots.find((slot) => slot.key === getTournamentDestinationKey(match));
    if (match === 1) assert.equal(destination, undefined);
    else assert.equal(destination?.student, getTournamentWinner(tournament, match));
  }
});

test('동작 줄이기가 켜져 있어도 대진표 연출을 재생하고 건너뛸 수 있다', async () => {
  const [viewer, motion, styles] = await Promise.all(['../components/teacher/TournamentViewer.tsx', './tournamentMotion.ts', '../tournament.css']
    .map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  assert.doesNotMatch(viewer + motion + styles, /prefers-reduced-motion/);
  assert.match(viewer, /abortRef\.current\?\.abort\(\)[\s\S]*?건너뛰기/);
});
