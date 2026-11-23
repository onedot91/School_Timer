import { useId, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { getFailureProfileImage, type FailureProfileAssignments } from '../../lib/failureExhibition';
import {
  TOURNAMENT_DEFAULT_TITLE,
  getTournamentContestants,
  getTournamentWinner,
  type Tournament,
} from '../../lib/tournament';
import {
  TOURNAMENT_CHAMPION,
  TOURNAMENT_CHAMPION_KEY,
  TOURNAMENT_STAGE_HEIGHT,
  TOURNAMENT_STAGE_WIDTH,
  getTournamentLayout,
  type TournamentBanner,
  type TournamentSlot,
} from '../../lib/tournamentLayout';

// 종이를 오려 붙인 느낌의 대진표. PNG로 내보낼 때 스타일시트가 빠지므로 색과 글꼴을 SVG 속성에 직접 쓴다.
// 그림자는 흐림 필터 대신 겹친 종이로 그려 애니메이션 중에도 가볍다.
const COLORS = {
  sky: '#f8efdc',
  hillBack: '#dfe8cf',
  hillFront: '#c9dcbb',
  cloud: '#fffaf0',
  paper: '#fffdf8',
  ink: '#4a3a22',
  muted: '#7d6c49',
  shadow: '#6b5536',
  edge: '#d9c7a2',
  lostPaper: '#f1e6cf',
  lostBadge: '#94866b',
  track: '#e2d3b4',
  road: '#e08a4f',
  stitch: '#fff3dc',
  moved: '#f9e7c4',
  goldOuter: '#f2c25a',
  goldInner: '#fbe3a4',
  goldText: '#a5660f',
} as const;
const BANNER_COLORS = {
  '8강': { face: '#4f9079', tail: '#37695a' },
  '4강': { face: '#d9793c', tail: '#a9571f' },
  결승: { face: '#cc4f56', tail: '#983640' },
} as const;
const FONT_FAMILY = '"SUIT Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const TITLE_MAX_WIDTH = 620;
const ROAD_WIDTH = 9;

// 크게 보기에서 화면 비율이 달라도 배경이 끊기지 않도록 무대 밖까지 그린다.
const BACK_HILL = 'M-600 760C-200 640 120 800 420 730S1000 620 1300 720S1900 660 2300 740V1500H-600Z';
const FRONT_HILL = 'M-600 835C-100 760 260 880 640 822S1300 780 1640 846S2100 800 2300 830V1500H-600Z';
const CLOUDS = [
  'M620 118c-34 0-34-40 2-40c6-26 52-28 60-2c34-6 38 42 2 42z',
  'M940 176c-30 0-30-34 2-34c6-24 46-24 54-2c30-4 34 36 2 36z',
] as const;

const getRosettePoints = (outer: number, inner: number) => Array.from({ length: 44 }, (_, index) => {
  const angle = index / 44 * Math.PI * 2;
  const radius = index % 2 === 0 ? outer : inner;
  return `${(TOURNAMENT_CHAMPION.x + Math.cos(angle) * radius).toFixed(1)},${(TOURNAMENT_CHAMPION.y + Math.sin(angle) * radius).toFixed(1)}`;
}).join(' ');
const ROSETTE_OUTER = getRosettePoints(138, 121);
const ROSETTE_INNER = getRosettePoints(122, 109);

const STAR_POINTS = Array.from({ length: 10 }, (_, index) => {
  const angle = -Math.PI / 2 + index * Math.PI / 5;
  const radius = index % 2 === 0 ? 1 : 0.45;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
});

const getRoundLabel = (match: number) => (
  match >= 16 ? '1회전' : match >= 8 ? '16강' : match >= 4 ? '8강' : match >= 2 ? '4강' : '결승'
);
/** 라운드마다 프로필을 받치는 색종이 */
const getProfilePaper = (match: number) => (
  match >= 8 ? '#cfe0d4' : match >= 4 ? '#bfe0cf' : match >= 2 ? '#f6cfae' : '#f4b9b4'
);

interface TournamentBracketProps {
  readonly tournament: Tournament;
  readonly profileAssignments: FailureProfileAssignments;
  /** 애니메이션이 대신 보여 주는 동안 비워 둘 칸 */
  readonly hiddenKeys?: ReadonlySet<string>;
  /** 아직 뽑지 않은 빈 대진표 */
  readonly isEmpty?: boolean;
  readonly svgRef?: Ref<SVGSVGElement>;
  readonly onSelect?: (match: number, student: number) => void;
}

const EMPTY_KEYS: ReadonlySet<string> = new Set();

/** 같은 모양을 아래로 어긋나게 겹쳐 종이 그림자를 만든다. */
const withPaperShadow = (renderShape: (fill: string, opacity: number, dy: number) => ReactNode, fill: string) => (
  <>
    {renderShape(COLORS.shadow, 0.07, 8)}
    {renderShape(COLORS.shadow, 0.17, 3)}
    {renderShape(fill, 1, 0)}
  </>
);

export default function TournamentBracket({
  tournament,
  profileAssignments,
  hiddenKeys = EMPTY_KEYS,
  isEmpty = false,
  svgRef,
  onSelect,
}: TournamentBracketProps) {
  const idPrefix = `tournament-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const clipId = `${idPrefix}-profile`;
  const fadedId = `${idPrefix}-faded`;
  const layout = getTournamentLayout(tournament);
  const title = tournament.title.trim() || TOURNAMENT_DEFAULT_TITLE;
  const titleSize = Math.min(50, TITLE_MAX_WIDTH / (Array.from(title).length * 0.92));
  const champion = hiddenKeys.has(TOURNAMENT_CHAMPION_KEY) ? null : getTournamentWinner(tournament, 1);

  const renderProfile = (student: number, centerX: number, centerY: number, size: number, isFaded = false) => (
    <image
      href={getFailureProfileImage(student, profileAssignments)}
      x={centerX - size / 2}
      y={centerY - size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid slice"
      clipPath={`url(#${clipId})`}
      filter={isFaded ? `url(#${fadedId})` : undefined}
      opacity={isFaded ? 0.62 : undefined}
    />
  );

  const renderNumberBadge = (student: number, centerX: number, centerY: number, fontSize: number, fill: string) => (
    <>
      <rect x={centerX - fontSize * 1.05} y={centerY - fontSize * 0.68} width={fontSize * 2.1} height={fontSize * 1.36} rx={fontSize * 0.68} fill={fill} />
      <text x={centerX} y={centerY + fontSize * 0.36} textAnchor="middle" fontSize={fontSize} fontWeight={900} fill="#ffffff">{student}</text>
    </>
  );

  const renderRoad = (path: string) => (
    <>
      <path d={path} fill="none" stroke={COLORS.road} strokeWidth={ROAD_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke={COLORS.stitch} strokeWidth={2} strokeDasharray="7 8" />
    </>
  );

  const renderSlot = (slot: TournamentSlot) => {
    const { key, match, x, y, width, height } = slot;
    const student = isEmpty || hiddenKeys.has(key) ? null : slot.student;
    const winner = getTournamentWinner(tournament, match);
    // 이긴 학생은 다음 칸으로 옮겨 가고, 떠난 칸에는 지나온 길만 남는다.
    const hasMovedUp = student !== null && winner === student;
    const isLoser = student !== null && winner !== null && winner !== student;
    const isPlayable = onSelect !== undefined && student !== null && !isLoser
      && getTournamentContestants(tournament, match).every((contestant) => contestant !== null);
    const select = () => { if (student !== null) onSelect?.(match, student); };
    const interaction = isPlayable ? {
      role: 'button',
      tabIndex: 0,
      'aria-pressed': hasMovedUp,
      'aria-label': `${getRoundLabel(match)} ${student}번 승리${hasMovedUp ? ' 취소' : ''}`,
      onClick: select,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select();
      },
    } : {};
    const centerY = y + height / 2;
    const profileX = x + (slot.isRound ? width / 2 : height / 2);
    const numberX = x + height / 2 + slot.profile / 2 + (width - height / 2 - slot.profile / 2) / 2 - 3;
    const frame = { x, width, height, rx: height / 2 };

    const renderMoved = () => {
      if (slot.isRound) {
        return <circle cx={profileX} cy={centerY} r={width / 2} fill={COLORS.moved} stroke={COLORS.road} strokeWidth={4} strokeDasharray="9 8" />;
      }
      const exitX = slot.side === 'left' ? x + width : x;
      const startX = slot.isEntry
        ? exitX + (slot.side === 'left' ? -46 : 46)
        : slot.side === 'left' ? x : x + width;
      return (
        <>
          {renderRoad(`M${startX} ${centerY}H${exitX}`)}
          <circle cx={slot.isEntry ? startX : x + width / 2} cy={centerY} r={12} fill={COLORS.road} />
        </>
      );
    };

    const renderStudent = (current: number) => (
      <>
        {isLoser
          ? <rect {...frame} y={y} fill={COLORS.lostPaper} />
          : withPaperShadow((fill, opacity, dy) => <rect {...frame} y={y + dy} fill={fill} opacity={opacity} />, COLORS.paper)}
        {isLoser ? null : <circle cx={profileX} cy={centerY} r={height / 2} fill={getProfilePaper(match)} />}
        {renderProfile(current, profileX, centerY, slot.isRound ? slot.profile - 14 : slot.profile - 2, isLoser)}
        {slot.isRound
          ? renderNumberBadge(current, profileX, y + height, slot.fontSize, isLoser ? COLORS.lostBadge : COLORS.ink)
          : (
            <text
              x={numberX}
              y={centerY + slot.fontSize * 0.36}
              textAnchor="middle"
              fontSize={slot.fontSize}
              fontWeight={900}
              letterSpacing={-1.5}
              fill={isLoser ? COLORS.muted : COLORS.ink}
            >
              {current}
            </text>
          )}
      </>
    );

    return (
      <g key={key} data-slot={key} className={isPlayable ? 'tournament-slot' : undefined} {...interaction}>
        {student === null
          ? <rect {...frame} y={y} fill={COLORS.paper} fillOpacity={0.62} stroke={COLORS.edge} strokeWidth={3} strokeDasharray="9 8" />
          : hasMovedUp ? renderMoved() : renderStudent(student)}
        {isPlayable ? (
          <>
            <rect className="tournament-slot-frame" {...frame} y={y} fill="#ffffff" fillOpacity={0} stroke={COLORS.road} strokeWidth={6} strokeOpacity={0} />
            {hasMovedUp ? (
              <g className="tournament-slot-undo" opacity={0}>
                <circle cx={x + width / 2} cy={centerY} r={25} fill={COLORS.paper} />
                <path
                  d={`M${x + width / 2 - 13} ${centerY - 5}h17a9 9 0 0 1 0 18h-6m-11-18l9-9m-9 9l9 9`}
                  fill="none"
                  stroke={COLORS.ink}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
          </>
        ) : null}
        {slot.isBye && !isEmpty ? (
          <text
            x={slot.side === 'left' ? x - 14 : x + width + 14}
            y={centerY + 8}
            textAnchor={slot.side === 'left' ? 'end' : 'start'}
            fontSize={23}
            fontWeight={800}
            fill={COLORS.muted}
          >
            부전승
          </text>
        ) : null}
      </g>
    );
  };

  const renderBanner = ({ label, x, y, width, height, tail }: TournamentBanner) => {
    const colors = BANNER_COLORS[label];
    const left = x - width / 2;
    const top = y - height / 2;
    const drop = height * 0.15;
    const isFinal = label === '결승';
    const fontSize = height * (isFinal ? 0.64 : 0.58);
    return (
      <g key={`${label}-${x}-${y}`}>
        {[-1, 1].map((side) => {
          const inner = x + side * (width / 2 - 14);
          const outer = x + side * (width / 2 + tail);
          const notch = x + side * (width / 2 + tail * 0.45);
          const path = `M${inner} ${top + drop}H${outer}L${notch} ${y + drop}L${outer} ${top + height + drop}H${inner}Z`;
          return (
            <g key={side}>
              <path d={path} fill={COLORS.shadow} opacity={0.16} transform="translate(0 4)" />
              <path d={path} fill={colors.tail} />
              <path d={`M${x + side * width / 2} ${top + height}l${-side * 14} ${drop}v${-drop}z`} fill="#000000" fillOpacity={0.35} />
            </g>
          );
        })}
        {withPaperShadow((fill, opacity, dy) => <rect x={left} y={top + dy * 0.6} width={width} height={height} rx={7} fill={fill} opacity={opacity} />, colors.face)}
        <rect x={left + 6} y={top + 6} width={width - 12} height={height - 12} rx={4} fill="none" stroke="#fff7e6" strokeOpacity={0.85} strokeWidth={2} strokeDasharray="7 5" />
        <text x={x} y={y + fontSize * 0.36} textAnchor="middle" fontSize={fontSize} fontWeight={900} letterSpacing={1} fill="#fffdf6">{label}</text>
        {isFinal ? [-1, 1].map((side) => (
          <polygon
            key={side}
            points={STAR_POINTS.map(([pointX, pointY]) => `${x + side * 60 + pointX * 14},${y + pointY * 14}`).join(' ')}
            fill="#fffdf6"
          />
        )) : null}
      </g>
    );
  };

  const connectors = layout.connectors.map((connector) => ({
    ...connector,
    isWon: connector.isWon && !hiddenKeys.has(connector.destinationKey),
  }));

  return (
    <svg
      ref={svgRef}
      className="tournament-bracket"
      viewBox={`0 0 ${TOURNAMENT_STAGE_WIDTH} ${TOURNAMENT_STAGE_HEIGHT}`}
      fontFamily={FONT_FAMILY}
      role="group"
      aria-label={`${title} 대진표`}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath>
        <filter id={fadedId}><feColorMatrix type="saturate" values="0.3" /></filter>
      </defs>
      <rect x={-600} y={-600} width={2900} height={2100} fill={COLORS.sky} />
      {[[BACK_HILL, COLORS.hillBack], [FRONT_HILL, COLORS.hillFront]].map(([path, fill]) => (
        <g key={path}>
          <path d={path} fill={COLORS.shadow} opacity={0.08} transform="translate(0 -5)" />
          <path d={path} fill={fill} />
        </g>
      ))}
      {CLOUDS.map((path) => (
        <g key={path}>
          <path d={path} fill={COLORS.shadow} opacity={0.12} transform="translate(0 4)" />
          <path d={path} fill={COLORS.cloud} />
        </g>
      ))}
      <text x={TOURNAMENT_STAGE_WIDTH / 2} y={52} textAnchor="middle" fontSize={titleSize} fontWeight={900} letterSpacing={-1} fill={COLORS.ink}>{title}</text>
      {connectors.filter((connector) => !connector.isWon).map((connector) => (
        <path key={connector.fromKey} d={connector.path} fill="none" stroke={COLORS.track} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* 이긴 길이 빈 길에 덮이지 않도록 나중에 그린다. */}
      {connectors.filter((connector) => connector.isWon).map((connector) => <g key={connector.fromKey}>{renderRoad(connector.path)}</g>)}
      {layout.banners.map(renderBanner)}
      {layout.slots.map(renderSlot)}
      <g data-slot={TOURNAMENT_CHAMPION_KEY}>
        {withPaperShadow((fill, opacity, dy) => <polygon points={ROSETTE_OUTER} fill={fill} opacity={opacity} transform={`translate(0 ${dy})`} />, COLORS.goldOuter)}
        {withPaperShadow((fill, opacity, dy) => <polygon points={ROSETTE_INNER} fill={fill} opacity={opacity} transform={`translate(0 ${dy * 0.6})`} />, COLORS.goldInner)}
        {withPaperShadow((fill, opacity, dy) => <circle cx={TOURNAMENT_CHAMPION.x} cy={TOURNAMENT_CHAMPION.y + dy * 0.6} r={98} fill={fill} opacity={opacity} />, COLORS.paper)}
        {champion === null ? (
          <text x={TOURNAMENT_CHAMPION.x} y={TOURNAMENT_CHAMPION.y + 17} textAnchor="middle" fontSize={46} fontWeight={900} fill={COLORS.goldText}>우승</text>
        ) : (
          <>
            {renderProfile(champion, TOURNAMENT_CHAMPION.x, TOURNAMENT_CHAMPION.y, 186)}
            {renderNumberBadge(champion, TOURNAMENT_CHAMPION.x, TOURNAMENT_CHAMPION.y + 104, 48, COLORS.goldText)}
          </>
        )}
      </g>
    </svg>
  );
}
