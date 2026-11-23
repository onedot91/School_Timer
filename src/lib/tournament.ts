// 23명 단판 토너먼트 대진표. 브라우저 저장소에 접근하지 않는 순수 모듈이다.
// 경기 번호는 트리 순서: 1 = 결승, 2·3 = 4강, 4~7 = 8강, 8~15 = 16강, 16~31 = 1회전.

export const TOURNAMENT_STUDENT_COUNT = 23;
export const TOURNAMENT_SEAT_COUNT = 32;
export const TOURNAMENT_FIRST_ROUND_START = 16;
export const TOURNAMENT_BYE = 0;
export const TOURNAMENT_TITLE_MAX_LENGTH = 20;
export const TOURNAMENT_DEFAULT_TITLE = '토너먼트';
/** 부전승을 뺀 실제 경기 수 (우승자 한 명을 뺀 모두가 한 번씩 진다). */
export const TOURNAMENT_MATCH_COUNT = TOURNAMENT_STUDENT_COUNT - 1;

export interface Tournament {
  readonly title: string;
  /** 32자리. 부전승 자리는 TOURNAMENT_BYE, 나머지는 1~23번이 한 번씩 들어간다. */
  readonly seats: readonly number[];
  /** 경기 번호 → 이긴 학생 번호. 부전승 경기는 기록하지 않는다. */
  readonly winners: Readonly<Record<string, number>>;
}

type RandomInt = (maxExclusive: number) => number;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

/** 나머지 연산 치우침이 없는 균등 난수. */
export const getUniformRandomInt: RandomInt = (maxExclusive) => {
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
};

export const limitTournamentTitle = (title: string): string => (
  Array.from(title).slice(0, TOURNAMENT_TITLE_MAX_LENGTH).join('')
);

export const createTournament = (title: string, randomInt: RandomInt = getUniformRandomInt): Tournament => {
  const students = Array.from({ length: TOURNAMENT_STUDENT_COUNT }, (_, index) => index + 1);
  for (let index = students.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [students[index], students[target]] = [students[target], students[index]];
  }

  // 16강 8경기마다 부전승이 하나씩 들어가고, 남는 하나는 무작위 한 경기에 더 들어간다.
  const doubleByeGroup = randomInt(8);
  const seats: number[] = [];
  let next = 0;
  for (let group = 0; group < 8; group += 1) {
    const byeMatch = randomInt(2);
    for (let match = 0; match < 2; match += 1) {
      const hasBye = group === doubleByeGroup || match === byeMatch;
      seats.push(students[next], hasBye ? TOURNAMENT_BYE : students[next + 1]);
      next += hasBye ? 1 : 2;
    }
  }
  return { title: limitTournamentTitle(title), seats, winners: {} };
};

export const isTournamentByeMatch = (tournament: Tournament, match: number): boolean => (
  match >= TOURNAMENT_FIRST_ROUND_START
  && tournament.seats[(match - TOURNAMENT_FIRST_ROUND_START) * 2 + 1] === TOURNAMENT_BYE
);

export const getTournamentWinner = (tournament: Tournament, match: number): number | null => (
  isTournamentByeMatch(tournament, match)
    ? tournament.seats[(match - TOURNAMENT_FIRST_ROUND_START) * 2]
    : tournament.winners[String(match)] ?? null
);

export const getTournamentContestants = (
  tournament: Tournament,
  match: number,
): readonly [number | null, number | null] => {
  if (match >= TOURNAMENT_FIRST_ROUND_START) {
    const seat = (match - TOURNAMENT_FIRST_ROUND_START) * 2;
    return [tournament.seats[seat] || null, tournament.seats[seat + 1] || null];
  }
  return [getTournamentWinner(tournament, match * 2), getTournamentWinner(tournament, match * 2 + 1)];
};

/** 두 선수가 모두 정해진 경기의 결과만 남긴다. 앞 경기가 취소되면 뒤 경기 결과도 함께 사라진다. */
const keepReachableWinners = (base: Tournament, requested: Readonly<Record<string, unknown>>): Tournament => {
  const winners: Record<string, number> = {};
  const tournament: Tournament = { ...base, winners };
  for (let match = TOURNAMENT_SEAT_COUNT - 1; match >= 1; match -= 1) {
    const winner = requested[String(match)];
    const [first, second] = getTournamentContestants(tournament, match);
    if (first === null || second === null) continue;
    if (typeof winner === 'number' && (winner === first || winner === second)) winners[String(match)] = winner;
  }
  return tournament;
};

export const normalizeTournament = (value: unknown): Tournament | null => {
  if (!isRecord(value) || !Array.isArray(value.seats) || value.seats.length !== TOURNAMENT_SEAT_COUNT) return null;
  const seats: number[] = [];
  const seen = new Set<number>();
  for (const [index, seat] of value.seats.entries()) {
    if (seat === TOURNAMENT_BYE) {
      if (index % 2 === 0) return null;
    } else {
      if (typeof seat !== 'number' || !Number.isInteger(seat) || seat < 1 || seat > TOURNAMENT_STUDENT_COUNT || seen.has(seat)) return null;
      seen.add(seat);
    }
    seats.push(seat);
  }
  if (seen.size !== TOURNAMENT_STUDENT_COUNT) return null;
  const title = typeof value.title === 'string' ? limitTournamentTitle(value.title) : '';
  return keepReachableWinners({ title, seats, winners: {} }, isRecord(value.winners) ? value.winners : {});
};

export const setTournamentWinner = (tournament: Tournament, match: number, student: number): Tournament => (
  keepReachableWinners(tournament, { ...tournament.winners, [String(match)]: student })
);

export const clearTournamentWinner = (tournament: Tournament, match: number): Tournament => {
  const { [String(match)]: _removed, ...rest } = tournament.winners;
  return keepReachableWinners(tournament, rest);
};

export const countTournamentResults = (tournament: Tournament): number => Object.keys(tournament.winners).length;
