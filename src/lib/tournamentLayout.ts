import {
  TOURNAMENT_FIRST_ROUND_START,
  getTournamentContestants,
  getTournamentWinner,
  isTournamentByeMatch,
  type Tournament,
} from './tournament';

// 양쪽에서 가운데로 모이는 16:9 대진표 좌표. 화면·애니메이션·PNG가 같은 좌표를 쓴다.
// 라운드가 올라갈수록 칸이 커지고, 양 끝 열은 위아래 여백 없이 화면을 채운다.
export const TOURNAMENT_STAGE_WIDTH = 1600;
export const TOURNAMENT_STAGE_HEIGHT = 900;
export const TOURNAMENT_CHAMPION_KEY = 'champion';
export const TOURNAMENT_CHAMPION = { x: 800, y: 202, size: 196 } as const;
const ROWS_TOP = 10;
const ROWS_BOTTOM = 890;
const COLUMNS = [
  { x: 10, width: 132, height: 66, profile: 56, fontSize: 38, isRound: false },
  { x: 160, width: 132, height: 66, profile: 56, fontSize: 38, isRound: false },
  { x: 306, width: 160, height: 92, profile: 80, fontSize: 48, isRound: false },
  { x: 480, width: 175, height: 106, profile: 92, fontSize: 46, isRound: false },
  { x: 668, width: 118, height: 118, profile: 118, fontSize: 34, isRound: true },
] as const;
const FINAL_COLUMN = COLUMNS.length - 1;
// 결승 두 칸은 부전승 위치와 상관없이 나란히 놓는다.
const FINAL_CENTER_Y = 500;
const FINAL_BANNER_Y = 386;

/** 크게 보기 우측 상단 닫기 단추가 차지하는 폭과 높이(px). 단추 44px과 위아래·좌우 여백 8px. */
export const TOURNAMENT_CLOSE_AREA = 60;

/** 닫기 단추와 겹치지 않으면서 대진표를 가장 크게 놓을 수 있는 자리. */
export const getTournamentStageFit = (width: number, height: number) => {
  const fullScale = Math.min(width / TOURNAMENT_STAGE_WIDTH, height / TOURNAMENT_STAGE_HEIGHT);
  const fits = [[TOURNAMENT_CLOSE_AREA, 0], [0, TOURNAMENT_CLOSE_AREA]].map(([right, top]) => ({
    right,
    top,
    scale: Math.min(fullScale, (width - right) / TOURNAMENT_STAGE_WIDTH, (height - top) / TOURNAMENT_STAGE_HEIGHT),
  }));
  const best = fits[0].scale >= fits[1].scale ? fits[0] : fits[1];
  const spareX = width - TOURNAMENT_STAGE_WIDTH * best.scale;
  const spareY = height - TOURNAMENT_STAGE_HEIGHT * best.scale;
  return {
    scale: best.scale,
    left: Math.min(spareX / 2, spareX - best.right),
    top: Math.max(spareY / 2, best.top),
  };
};

/** 모서리를 둥글린 ㄱ자 길. */
const roundedElbow = (startX: number, startY: number, middleX: number, endY: number, endX: number): string => {
  const rise = endY - startY;
  if (Math.abs(rise) < 1) return `M${startX} ${startY}H${endX}`;
  const horizontal = Math.sign(endX - startX);
  const vertical = Math.sign(rise);
  const radius = Math.min(14, Math.abs(middleX - startX), Math.abs(endX - middleX), Math.abs(rise) / 2);
  return `M${startX} ${startY}H${middleX - horizontal * radius}`
    + `Q${middleX} ${startY} ${middleX} ${startY + vertical * radius}V${endY - vertical * radius}`
    + `Q${middleX} ${endY} ${middleX + horizontal * radius} ${endY}H${endX}`;
};

/** 경기 match의 이긴 학생이 올라가 앉는 칸. */
export const getTournamentDestinationKey = (match: number): string => (
  match === 1 ? TOURNAMENT_CHAMPION_KEY : `${Math.floor(match / 2)}:${match % 2}`
);

export interface TournamentSlot {
  readonly key: string;
  /** 이 칸의 학생이 뛰는 경기 */
  readonly match: number;
  readonly student: number | null;
  readonly isBye: boolean;
  /** 뽑기로 학생이 처음 앉는 칸 */
  readonly isEntry: boolean;
  readonly side: 'left' | 'right';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly profile: number;
  readonly fontSize: number;
  readonly isRound: boolean;
}

export interface TournamentConnector {
  readonly fromKey: string;
  readonly destinationKey: string;
  /** 이 선을 따라 올라간 학생이 있는지 */
  readonly isWon: boolean;
  readonly path: string;
}

export interface TournamentBanner {
  readonly label: '8강' | '4강' | '결승';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** 양쪽 리본 꼬리가 튀어나온 길이 */
  readonly tail: number;
}

export interface TournamentLayout {
  readonly banners: readonly TournamentBanner[];
  readonly slots: readonly TournamentSlot[];
  readonly connectors: readonly TournamentConnector[];
}

export const getTournamentLayout = (tournament: Tournament): TournamentLayout => {
  const slots: TournamentSlot[] = [];
  const connectors: TournamentConnector[] = [];

  const isWonBy = (match: number, student: number | null) => (
    student !== null && getTournamentWinner(tournament, match) === student
  );

  const buildSide = (side: 'left' | 'right', rootMatch: number) => {
    const columnX = (column: number) => (side === 'left'
      ? COLUMNS[column].x
      : TOURNAMENT_STAGE_WIDTH - COLUMNS[column].x - COLUMNS[column].width);
    const entryX = (column: number) => columnX(column) + (side === 'left' ? 0 : COLUMNS[column].width);
    const exitX = (column: number) => columnX(column) + (side === 'left' ? COLUMNS[column].width : 0);

    const firstRound = Array.from({ length: 8 }, (_, index) => rootMatch * 8 + index);
    const rowCount = firstRound.reduce((sum, match) => sum + (isTournamentByeMatch(tournament, match) ? 1 : 2), 0);
    const pitch = (ROWS_BOTTOM - ROWS_TOP) / rowCount;
    let row = 0;
    const nextRowCenter = () => ROWS_TOP + pitch * (row++ + 0.5);

    const addSlot = (match: number, offset: number, column: number, center: number, isBye: boolean) => {
      const { width, height, profile, fontSize, isRound } = COLUMNS[column];
      slots.push({
        key: `${match}:${offset}`,
        match,
        student: getTournamentContestants(tournament, match)[offset],
        isBye,
        isEntry: isBye || column === 0,
        side,
        x: columnX(column),
        y: center - height / 2,
        width,
        height,
        profile,
        fontSize,
        isRound,
      });
    };

    /** match의 승자가 앉는 칸을 놓고, 그 칸의 세로 중심을 돌려준다. */
    const placeWinnerSlot = (match: number, column: number): number => {
      const isBye = isTournamentByeMatch(tournament, match);
      let center: number;
      if (isBye) {
        center = nextRowCenter();
      } else {
        const inputs = [0, 1].map((offset) => {
          if (match < TOURNAMENT_FIRST_ROUND_START) return placeWinnerSlot(match * 2 + offset, column - 1);
          const y = nextRowCenter();
          addSlot(match, offset, column - 1, y, false);
          return y;
        });
        center = column === FINAL_COLUMN ? FINAL_CENTER_Y : (inputs[0] + inputs[1]) / 2;
        const middleX = (exitX(column - 1) + entryX(column)) / 2;
        const contestants = getTournamentContestants(tournament, match);
        inputs.forEach((y, offset) => connectors.push({
          fromKey: `${match}:${offset}`,
          destinationKey: getTournamentDestinationKey(match),
          isWon: isWonBy(match, contestants[offset]),
          path: roundedElbow(exitX(column - 1), y, middleX, center, entryX(column)),
        }));
      }
      addSlot(Math.floor(match / 2), match % 2, column, center, isBye);
      return center;
    };

    return { center: placeWinnerSlot(rootMatch, FINAL_COLUMN), x: exitX(FINAL_COLUMN) };
  };

  const finalists = [buildSide('left', 2), buildSide('right', 3)];
  const contestants = getTournamentContestants(tournament, 1);
  finalists.forEach((finalist, index) => connectors.push({
    fromKey: `1:${index}`,
    destinationKey: TOURNAMENT_CHAMPION_KEY,
    isWon: isWonBy(1, contestants[index]),
    path: `M${finalist.x} ${finalist.center}H${TOURNAMENT_CHAMPION.x}V${TOURNAMENT_CHAMPION.y + 130}`,
  }));

  // 현수막은 맞붙는 두 칸 사이에 건다. 결승은 우승 자리와 결승 칸 사이에 건다.
  const banners = [2, 3, 4, 5, 6, 7].map((match): TournamentBanner => {
    const [upper, lower] = slots.filter((slot) => slot.match === match).sort((first, second) => first.y - second.y);
    const position = { x: upper.x + upper.width / 2, y: (upper.y + upper.height + lower.y) / 2 };
    return match >= 4
      ? { ...position, label: '8강', width: 100, height: 46, tail: 19 }
      : { ...position, label: '4강', width: 124, height: 62, tail: 24 };
  });
  banners.push({ label: '결승', x: TOURNAMENT_CHAMPION.x, y: FINAL_BANNER_Y, width: 182, height: 52, tail: 22 });

  return { slots, connectors, banners };
};
