import { TOURNAMENT_STAGE_HEIGHT, TOURNAMENT_STAGE_WIDTH } from './tournamentLayout';

// 대진표 위에 덮는 1600×900 무대의 애니메이션. 결과는 이미 정해져 있고, 여기서는 보여 주기만 한다.
// 흩뿌림에 쓰는 Math.random은 장식일 뿐 대진에는 쓰이지 않는다.

export interface TournamentMotionPoint {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface TournamentMotionContext {
  readonly layer: HTMLElement;
  readonly signal: AbortSignal;
  readonly getProfile: (student: number) => string;
}

const CENTER_X = TOURNAMENT_STAGE_WIDTH / 2;
const CENTER_Y = TOURNAMENT_STAGE_HEIGHT / 2;
const CONFETTI_COLORS = ['#f2c25a', '#5f9f86', '#e08a4f', '#d45a5f', '#8bb8cf'];
const SPRING = 'cubic-bezier(.2,1.35,.4,1)';

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const shuffled = <Item>(items: readonly Item[]): Item[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
};

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return; }
  const onAbort = () => { window.clearTimeout(timer); reject(signal.reason); };
  const timer = window.setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});

/** 건너뛰면 남은 애니메이션을 곧바로 취소하고 멈춘다. */
const play = async (
  { signal }: TournamentMotionContext,
  element: HTMLElement,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
) => {
  signal.throwIfAborted();
  const animation = element.animate(frames, { fill: 'both', ...options });
  const cancel = () => animation.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await animation.finished;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
  signal.throwIfAborted();
};

const playAndRemove = (context: TournamentMotionContext, element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
  void play(context, element, frames, options).catch(() => undefined).finally(() => element.remove());
};

const addElement = (context: TournamentMotionContext, className: string) => {
  const element = document.createElement('div');
  element.className = className;
  context.layer.append(element);
  return element;
};

const createToken = (context: TournamentMotionContext, student: number, size: number) => {
  const element = addElement(context, 'tournament-token');
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.fontSize = `${size * 0.24}px`;
  element.style.borderWidth = `${Math.max(4, size * 0.03)}px`;
  const image = document.createElement('img');
  image.src = context.getProfile(student);
  image.alt = '';
  const number = document.createElement('b');
  number.textContent = String(student);
  element.append(image, number);
  return {
    element,
    at: (x: number, y: number, scale = 1, rotate = 0) => (
      `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${rotate}deg) scale(${scale})`
    ),
  };
};

const burst = (context: TournamentMotionContext, x: number, y: number, count: number, power: number) => {
  for (let index = 0; index < count; index += 1) {
    const piece = addElement(context, 'tournament-confetti');
    const size = randomBetween(8, 19);
    const angle = randomBetween(0, Math.PI * 2);
    const distance = power * randomBetween(0.45, 1.15);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    Object.assign(piece.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size * randomBetween(0.5, 1)}px`,
      background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      borderRadius: index % 3 === 0 ? '50%' : '3px',
    });
    playAndRemove(context, piece, [
      { transform: 'translate(-50%, -50%)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${randomBetween(-300, 300)}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx * 1.1}px, ${dy + power * 0.8}px) rotate(${randomBetween(-600, 600)}deg)`, opacity: 0 },
    ], { duration: randomBetween(750, 1350), easing: 'cubic-bezier(.15,.7,.4,1)' });
  }
};

const ring = (context: TournamentMotionContext, x: number, y: number, from: number, to: number) => {
  const element = addElement(context, 'tournament-ring');
  Object.assign(element.style, { left: `${x - to}px`, top: `${y - to}px`, width: `${to * 2}px`, height: `${to * 2}px` });
  playAndRemove(context, element, [
    { transform: `scale(${from / to})`, opacity: 0.95 },
    { transform: 'scale(1)', opacity: 0 },
  ], { duration: 640, easing: 'cubic-bezier(.1,.7,.3,1)' });
};

const addDim = (context: TournamentMotionContext) => addElement(context, 'tournament-dim');

export interface TournamentDrawEntry extends TournamentMotionPoint {
  readonly key: string;
  readonly student: number;
}

/** 카드 섞기: 23명이 가운데서 소용돌이치며 섞인 뒤 자기 자리로 날아간다. */
export const playTournamentDraw = async (
  context: TournamentMotionContext,
  entries: readonly TournamentDrawEntry[],
  onLand: (key: string) => void,
): Promise<void> => {
  const tokenSize = 150;
  const tokens = entries.map((entry) => ({ entry, token: createToken(context, entry.student, tokenSize) }));
  await Promise.all(shuffled(tokens).map(({ token }, index) => {
    const startAngle = index / entries.length * Math.PI * 2;
    const turns = randomBetween(1.3, 2.4) * (index % 2 === 0 ? -1 : 1);
    const spread = randomBetween(0.35, 1);
    const frames: Keyframe[] = [
      { transform: token.at(CENTER_X + Math.cos(startAngle) * 900, CENTER_Y + Math.sin(startAngle) * 560, 0.5), opacity: 0 },
      { transform: token.at(CENTER_X + Math.cos(startAngle) * 420, CENTER_Y + Math.sin(startAngle) * 300), opacity: 1, offset: 0.2 },
    ];
    for (let step = 1; step <= 22; step += 1) {
      const progress = step / 22;
      const angle = startAngle + turns * Math.PI * 2 * progress;
      const radius = (1 - progress) * 300
        + 170 * spread * Math.abs(Math.sin(progress * 9 + index)) * (1 - progress * 0.8);
      frames.push({
        transform: token.at(
          CENTER_X + Math.cos(angle) * radius * 1.4,
          CENTER_Y + Math.sin(angle) * radius,
          0.9 + 0.25 * Math.sin(progress * 14 + index),
          Math.sin(progress * 10 + index) * 25,
        ),
        offset: 0.2 + 0.8 * progress,
      });
    }
    return play(context, token.element, frames, { duration: 2800, easing: 'linear' });
  }));
  ring(context, CENTER_X, CENTER_Y, 60, 520);
  burst(context, CENTER_X, CENTER_Y, 60, 420);

  await Promise.all(shuffled(tokens).map(async ({ entry, token }, index) => {
    await wait(index * 110, context.signal);
    const direction = entry.x < CENTER_X ? -1 : 1;
    await play(context, token.element, [
      { transform: token.at(CENTER_X, CENTER_Y) },
      { transform: token.at((CENTER_X + entry.x) / 2, Math.min(CENTER_Y, entry.y) - 110, 1.35, direction * 220), offset: 0.5 },
      { transform: token.at(entry.x, entry.y, entry.size / tokenSize, direction * 360) },
    ], { duration: 740, easing: 'cubic-bezier(.35,.1,.3,1)' });
    token.element.remove();
    onLand(entry.key);
    ring(context, entry.x, entry.y, 24, 78);
  }));
};

export interface TournamentMatchMotion {
  readonly winner: { readonly student: number; readonly from: TournamentMotionPoint };
  readonly loser: { readonly student: number; readonly from: TournamentMotionPoint };
  readonly destination: TournamentMotionPoint;
  /** 이긴 학생이 타고 올라갈 대진표 선 */
  readonly path: string;
  /** 대진표 위쪽(첫 번째) 선수가 이겼는지. 무대에서는 왼쪽에 선다. */
  readonly isWinnerFirst: boolean;
  readonly isFinal: boolean;
  /** 무대가 걷히고 승자가 원래 자리로 돌아가기 시작할 때 */
  readonly onReturn: () => void;
  readonly onLand: () => void;
}

/** 원래 자리에서 대진표 선을 따라 빛을 남기며 다음 칸으로 올라간다. */
const climb = async (
  context: TournamentMotionContext,
  token: ReturnType<typeof createToken>,
  size: number,
  { winner, destination, path, isFinal }: TournamentMatchMotion,
) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${TOURNAMENT_STAGE_WIDTH} ${TOURNAMENT_STAGE_HEIGHT}`);
  svg.setAttribute('class', 'tournament-trail');
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trail.setAttribute('d', path);
  svg.append(trail);
  context.layer.append(svg);
  const length = trail.getTotalLength();
  trail.style.strokeDasharray = String(length);

  const startScale = winner.from.size / size;
  const endScale = destination.size / size;
  const { from } = winner;
  const frames: Keyframe[] = [
    { transform: token.at(from.x, from.y, startScale) },
    // 웅크렸다가 출발한다.
    { transform: token.at(from.x, from.y + 5, startScale * 0.84), offset: 0.1 },
    { transform: token.at(from.x, from.y, startScale * 1.35), offset: 0.2 },
  ];
  const steps = 24;
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const point = trail.getPointAtLength(length * progress);
    frames.push({
      transform: token.at(point.x, point.y, startScale * 1.2 + (endScale - startScale) * progress),
      offset: 0.28 + 0.54 * progress,
    });
  }
  frames.push(
    { transform: token.at(destination.x, destination.y, endScale * 1.25), offset: 0.92 },
    { transform: token.at(destination.x, destination.y, endScale) },
  );
  const duration = isFinal ? 1700 : 1400;
  const trailAnimation = trail.animate([
    { strokeDashoffset: length },
    { strokeDashoffset: length, offset: 0.28 },
    { strokeDashoffset: 0, offset: 0.82 },
    { strokeDashoffset: 0 },
  ], { duration, fill: 'both' });
  context.signal.addEventListener('abort', () => trailAnimation.cancel(), { once: true });
  await play(context, token.element, frames, { duration, easing: 'linear' });
  svg.remove();
};

/** 무대 VS: 두 학생이 가운데로 크게 나와 맞붙고, 이긴 학생이 자기 칸에서 다음 칸으로 올라간다. */
export const playTournamentMatch = async (context: TournamentMotionContext, motion: TournamentMatchMotion): Promise<void> => {
  const { winner, loser, destination, isFinal } = motion;
  const size = 400;
  const stageY = 420;
  const winY = 370;
  const side = motion.isWinnerFirst ? -1 : 1;
  const winnerX = CENTER_X + side * 340;
  const loserX = CENTER_X - side * 340;
  const dim = addDim(context);
  const loserToken = createToken(context, loser.student, size);
  const winnerToken = createToken(context, winner.student, size);

  await Promise.all([
    play(context, dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 350 }),
    ...([[winnerToken, winner, winnerX], [loserToken, loser, loserX]] as const).map(([token, entrant, x]) => (
      play(context, token.element, [
        { transform: token.at(entrant.from.x, entrant.from.y, entrant.from.size / size) },
        { transform: token.at(x, stageY) },
      ], { duration: 640, easing: SPRING })
    )),
  ]);

  const versus = addElement(context, 'tournament-versus');
  versus.textContent = 'VS';
  await play(context, versus, [
    { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(.85)', opacity: 1, offset: 0.6 },
    { transform: 'translate(-50%, -50%) scale(1)' },
  ], { duration: 340, easing: 'ease-out' });
  await wait(isFinal ? 1000 : 520, context.signal);
  versus.remove();

  playAndRemove(context, loserToken.element, [
    { transform: loserToken.at(loserX, stageY), filter: 'grayscale(0)' },
    { transform: loserToken.at(loserX - side * 70, stageY - 30, 0.9, -side * 10), filter: 'grayscale(1)', offset: 0.3 },
    { transform: loserToken.at(loserX - side * 160, 1200, 0.6, -side * 60), filter: 'grayscale(1)' },
  ], { duration: 780, easing: 'cubic-bezier(.5,0,.8,.5)' });
  winnerToken.element.classList.add('tournament-token-winner');
  const announce = addElement(context, 'tournament-announce');
  announce.textContent = isFinal ? `우승 ${winner.student}번!` : `${winner.student}번 승리!`;
  void play(context, announce, [
    { transform: 'translate(-50%, 40%) scale(.5)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 1, offset: 0.6 },
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
  ], { duration: 480, delay: 260, easing: 'ease-out' }).catch(() => undefined);
  await play(context, winnerToken.element, [
    { transform: winnerToken.at(winnerX, stageY) },
    { transform: winnerToken.at(CENTER_X, winY, 1.28), offset: 0.7 },
    { transform: winnerToken.at(CENTER_X, winY, 1.2) },
  ], { duration: 640, easing: 'cubic-bezier(.2,.9,.3,1)' });
  ring(context, CENTER_X, winY, 200, 560);
  burst(context, CENTER_X, winY, 70, 520);

  if (isFinal) {
    void play(context, winnerToken.element, [
      { transform: winnerToken.at(CENTER_X, winY, 1.2) },
      { transform: winnerToken.at(CENTER_X, winY - 16, 1.25, 2) },
      { transform: winnerToken.at(CENTER_X, winY, 1.2) },
    ], { duration: 900, iterations: 4, easing: 'ease-in-out' }).catch(() => undefined);
    for (let index = 0; index < 11; index += 1) {
      burst(context, randomBetween(220, 1380), randomBetween(120, 520), 44, 330);
      await wait(320, context.signal);
    }
  } else {
    await wait(800, context.signal);
  }

  motion.onReturn();
  winnerToken.element.style.boxShadow = '0 0 0 12px #f6dfa4, 0 0 50px 14px #f0bd4b';
  await Promise.all([
    play(context, announce, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }),
    play(context, dim, [{ opacity: 1 }, { opacity: 0 }], { duration: 520 }),
    play(context, winnerToken.element, [
      { transform: winnerToken.at(CENTER_X, winY, 1.2) },
      { transform: winnerToken.at(winner.from.x, winner.from.y, winner.from.size / size) },
    ], { duration: 560, easing: 'cubic-bezier(.6,0,.3,1)' }),
  ]);
  await climb(context, winnerToken, size, motion);
  winnerToken.element.remove();
  motion.onLand();
  ring(context, destination.x, destination.y, destination.size * 0.4, destination.size * 1.3);
  burst(context, destination.x, destination.y, 18, destination.size * 1.3);
  await wait(isFinal ? 900 : 450, context.signal);
};
