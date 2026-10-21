// Generates public/pets/cat-sprite.svg: one row per animation, frames laid out left to right.
// The cat is a small rig (body, four legs, haunch, tail, head) so transitions are interpolated poses.
// Run: node dev/generatePetSprites.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { PET_ANIMATIONS, PET_SPRITE_FRAME } from '../src/lib/petSprites.ts';

const C = {
  line: '#3b2a1f',
  fur: '#f2a650',
  furFar: '#d98b3c',
  stripe: '#c46d2b',
  belly: '#fde7c6',
  nose: '#ee8f8c',
  earIn: '#f6b8aa',
  eye: '#2b1d14',
  mouth: '#7a3b2e',
  blush: '#f08c7d',
};
const SW = 3.2;
const GROUND = PET_SPRITE_FRAME.anchorY;
const DEG = Math.PI / 180;
const r = (value) => Math.round(value * 100) / 100;
const lerp = (from, to, t) => from + (to - from) * t;
const ease = (t) => (t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const outline = `stroke="${C.line}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;

// ---- Pose model ---------------------------------------------------------------------------
// Numbers are interpolated between poses; strings and booleans switch halfway.
const LEG = { a: 0, len: 26, reach: 1, lift: 0 };
const BASE = {
  bdx: 0, bdy: 0, brot: 0, bsx: 1, bsy: 1,
  nf: LEG, ff: LEG, nb: LEG, fb: LEG,
  fold: 0, lw: 13,
  hdx: 0, hdy: 0, hrot: 0,
  eyes: 'open', yawn: 0, tongue: 0, blush: .5, earL: 0, earR: 0, faceTurn: 0, whiskers: 1,
  wUp: 1, wGround: 0, wDown: 0, wHigh: 0, trot: 0, tflick: 0, tsx: 1, tailFront: false,
  frameRot: 0, pawOverHead: false, zStep: -1,
};
const LEG_KEYS = ['nf', 'ff', 'nb', 'fb'];

const pose = (base, overrides = {}) => {
  const next = { ...base, ...overrides };
  for (const key of LEG_KEYS) next[key] = { ...base[key], ...(overrides[key] ?? {}) };
  return next;
};
const legs = (overrides) => Object.fromEntries(LEG_KEYS.map((key) => [key, overrides]));

const lerpPose = (from, to, t) => {
  const next = {};
  for (const key of Object.keys(from)) {
    const a = from[key];
    const b = to[key];
    if (LEG_KEYS.includes(key)) next[key] = Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], t)]));
    else if (typeof a === 'number') next[key] = lerp(a, b, t);
    else next[key] = t < .5 ? a : b;
  }
  return next;
};

// ---- Geometry -------------------------------------------------------------------------------
const BODY_PATH = 'M46 80 C42 63 60 57 80 59 C101 57 117 64 116 80 C116 96 101 101 80 100 C60 101 49 96 46 80 Z';
const BODY_PIVOT = [56, 96];
const BODY_SCALE_ORIGIN = [80, 100];

const bodyTransform = (p) => (
  `translate(${r(p.bdx)} ${r(p.bdy)}) rotate(${r(p.brot)} ${BODY_PIVOT[0]} ${BODY_PIVOT[1]}) `
  + `translate(${BODY_SCALE_ORIGIN[0]} ${BODY_SCALE_ORIGIN[1]}) scale(${r(p.bsx)} ${r(p.bsy)}) translate(${-BODY_SCALE_ORIGIN[0]} ${-BODY_SCALE_ORIGIN[1]})`
);

const toWorld = (p, x, y) => {
  const sx = BODY_SCALE_ORIGIN[0] + (x - BODY_SCALE_ORIGIN[0]) * p.bsx;
  const sy = BODY_SCALE_ORIGIN[1] + (y - BODY_SCALE_ORIGIN[1]) * p.bsy;
  const cos = Math.cos(p.brot * DEG);
  const sin = Math.sin(p.brot * DEG);
  const dx = sx - BODY_PIVOT[0];
  const dy = sy - BODY_PIVOT[1];
  return [BODY_PIVOT[0] + dx * cos - dy * sin + p.bdx, BODY_PIVOT[1] + dx * sin + dy * cos + p.bdy];
};

const legLength = ([, pivotY], leg) => {
  const reachGround = Math.min(44, Math.max(4, (GROUND - pivotY) / Math.max(.3, Math.cos(leg.a * DEG))));
  return lerp(leg.len, reachGround, leg.reach) - leg.lift;
};

const drawLeg = ([x, y], leg, fill, width) => {
  const length = legLength([x, y], leg);
  return `
  <g transform="translate(${r(x)} ${r(y)}) rotate(${r(leg.a)})">
    <rect x="${r(-width / 2)}" y="-6" width="${r(width)}" height="${r(length + 6)}" rx="${r(width / 2)}" fill="${fill}" ${outline}/>
    <path d="M-2.6 ${r(length - 1)} v-3.6 M2.2 ${r(length - 1)} v-3.6" stroke="${C.line}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>
  </g>`;
};

// Tail control points relative to its base: two cubic segments.
const TAIL_SHAPES = {
  up: [[-16, 0], [-28, -11], [-26, -27], [-25, -36], [-20, -42], [-13, -44]],
  high: [[-10, -4], [-13, -18], [-9, -30], [-6, -40], [1, -45], [7, -41]],
  ground: [[-14, 3], [-12, 10], [8, 9.5], [24, 9], [32, 7.8], [40, 6.5]],
  down: [[-6, 6], [-5, 13], [-8, 19], [-10, 24], [-8, 29], [-4, 31]],
};
const GROUND_TAIL_BASE = [50, 107];

const drawTail = (p) => {
  const weights = { up: p.wUp, high: p.wHigh, ground: p.wGround, down: p.wDown };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const rump = toWorld(p, 50, 77);
  const base = [lerp(rump[0], GROUND_TAIL_BASE[0], p.wGround / total), lerp(rump[1], GROUND_TAIL_BASE[1], p.wGround / total)];
  const points = TAIL_SHAPES.up.map((_, index) => {
    let x = 0;
    let y = 0;
    for (const [shape, weight] of Object.entries(weights)) {
      x += TAIL_SHAPES[shape][index][0] * (weight / total);
      y += TAIL_SHAPES[shape][index][1] * (weight / total);
    }
    if (index >= 4) x += p.tflick * (index === 5 ? 1 : .5);
    return [base[0] + x * p.tsx, base[1] + y];
  });
  const [c1, c2, p1, c3, c4, p2] = points.map(([x, y]) => `${r(x)} ${r(y)}`);
  const d = `M${r(base[0])} ${r(base[1])} C${c1} ${c2} ${p1} C${c3} ${c4} ${p2}`;
  return `
  <g transform="rotate(${r(p.trot)} ${r(base[0])} ${r(base[1])})">
    <path d="${d}" fill="none" stroke="${C.line}" stroke-width="13" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${C.fur}" stroke-width="7.4" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${C.stripe}" stroke-width="7.4" stroke-dasharray="3.5 9" stroke-dashoffset="-6"/>
  </g>`;
};

const drawEyes = (kind) => [[109, 55], [128, 55]].map(([x, y]) => {
  const stroke = `fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linecap="round"`;
  if (kind === 'open') return `<ellipse cx="${x}" cy="${y}" rx="3.5" ry="4.5" fill="${C.eye}"/><circle cx="${x + 1.2}" cy="${y - 1.7}" r="1.35" fill="#fff"/>`;
  if (kind === 'wide') return `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="5.4" fill="${C.eye}"/><circle cx="${x + 1.4}" cy="${y - 2}" r="1.7" fill="#fff"/>`;
  if (kind === 'happy') return `<path d="M${x - 4} ${y + 1.5} q4 -5.5 8 0" ${stroke}/>`;
  if (kind === 'blink') return `<path d="M${x - 4} ${y + .5} q4 2.2 8 0" ${stroke}/>`;
  if (kind === 'squeeze') return `<path d="M${x - 4} ${y - 2} l7 2.4 l-7 2.4" ${stroke}/>`;
  return `<path d="M${x - 4} ${y} q4 3.5 8 0" fill="none" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"/>`;
}).join('');

const drawMouth = (p) => {
  const open = p.yawn;
  const smile = `<path d="M119 65.8 v1.8 M119 67.6 q-2.6 2.8 -5.2 0 M119 67.6 q2.6 2.8 5.2 0" fill="none" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`;
  const tongue = p.tongue > .5
    ? `<ellipse cx="120.5" cy="71.4" rx="2.6" ry="3.2" fill="${C.nose}" stroke="${C.line}" stroke-width="1.1"/>`
    : '';
  if (open < .08) return smile + tongue;
  const rx = 2.4 + 3.4 * open;
  const ry = 2 + 5.6 * open;
  const cy = 67.5 + ry;
  return `${open < .35 ? smile : `<path d="M119 65.8 v1.6" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`}
    <ellipse cx="119" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${C.mouth}" stroke="${C.line}" stroke-width="1.3"/>
    <ellipse cx="119" cy="${r(cy + ry * .45)}" rx="${r(rx * .62)}" ry="${r(ry * .42)}" fill="${C.nose}"/>`;
};

const drawHead = (p) => {
  const shift = -3 * p.faceTurn;
  const leftWhisker = 11 + 6 * p.faceTurn;
  return `
  <g transform="rotate(${r(p.earL)} 104 41)">
    <path d="M93 47 L97 21 L115 35 Z" fill="${C.fur}" ${outline}/>
    <path d="M98.5 40 L100 28 L108.5 35 Z" fill="${C.earIn}"/>
  </g>
  <g transform="rotate(${r(p.earR)} 126 38)">
    <path d="M115 34 L134 19 L136 46 Z" fill="${C.fur}" ${outline}/>
    <path d="M121 34 L131 27 L132 40 Z" fill="${C.earIn}"/>
  </g>
  <ellipse cx="116" cy="57" rx="27" ry="24" fill="${C.fur}" ${outline}/>
  <path d="M110 35 v6.5 M116.5 33.6 v7.6 M123 35 v6.5" stroke="${C.stripe}" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(${r(shift)} 0)">
    <ellipse cx="119" cy="68" rx="12" ry="7.5" fill="${C.belly}"/>
    ${drawEyes(p.eyes)}
    <path d="M116.2 62.6 h5.6 l-2.8 3.2 z" fill="${C.nose}" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round"/>
    ${drawMouth(p)}
    <ellipse cx="101.5" cy="64" rx="4.4" ry="2.6" fill="${C.blush}" opacity="${r(p.blush)}"/>
    <ellipse cx="136" cy="63.5" rx="4" ry="2.5" fill="${C.blush}" opacity="${r(p.blush)}"/>
    ${p.whiskers > .5 ? `<path d="M135 66 l13 -3 M135 69 l13 1.5 M101 67 l-${r(leftWhisker)} -1.5 M101 69.5 l-${r(leftWhisker * .8)} 1.8" stroke="${C.line}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` : ''}
  </g>`;
};

const drawSleepZ = (step) => {
  if (step < 0) return '';
  const z = (x, y, size, opacity) => `<path d="M${r(x)} ${r(y)} h${size} l-${size} ${r(size * 1.1)} h${size}" fill="none" stroke="${C.line}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="${r(opacity)}"/>`;
  return z(118 + step * 3, 60 - step * 7, 6, .35 + step * .2) + (step >= 2 ? z(130 + step * 2, 46 - step * 5, 8, .75) : '');
};

const drawCat = (p) => {
  const hipNear = toWorld(p, 57, 90);
  const hipFar = toWorld(p, 62, 88);
  const shoulderNear = toWorld(p, 98, 90);
  const shoulderFar = toWorld(p, 104, 88);
  const neck = toWorld(p, 106, 70);
  const body = bodyTransform(p);
  const haunchRy = 7 + 8 * p.fold;
  const haunchRx = 8 + 12 * p.fold;
  const haunch = [lerp(hipNear[0], hipNear[0] + 1, p.fold), lerp(hipNear[1], GROUND - 1 - haunchRy, p.fold)];
  // Parts appear outright rather than fading, so in-between frames have no ghost shapes.
  const showHaunch = p.fold > .2;
  const showHindPaw = p.fold > .7;
  const showChest = p.fold > .5 && !p.tailFront;
  const hindPaw = [haunch[0] + haunchRx * .72, GROUND - 4.2];
  const frontLeg = drawLeg(shoulderNear, p.nf, C.fur, p.lw);
  const head = `<g transform="translate(${r(neck[0] - 106 + p.hdx)} ${r(neck[1] - 70 + p.hdy)}) rotate(${r(p.hrot)} 112 70)">${drawHead(p)}</g>`;
  // Legs sit behind the body so its outline crosses the top of each leg; near legs are lighter.
  return `
  <g transform="rotate(${r(p.frameRot)} 80 40)">
    ${drawLeg(shoulderFar, p.ff, C.furFar, p.lw)}
    ${drawLeg(hipFar, p.fb, C.furFar, p.lw)}
    ${p.tailFront ? '' : drawTail(p)}
    ${drawLeg(hipNear, p.nb, C.fur, p.lw)}
    ${p.pawOverHead ? '' : frontLeg}
    <path d="${BODY_PATH}" transform="${body}" fill="${C.fur}" ${outline} vector-effect="non-scaling-stroke"/>
    <g transform="${body}">
      <ellipse cx="84" cy="92" rx="21" ry="5.5" fill="${C.belly}"/>
      <path d="M67 61 q2.4 6 -1 11 M79 59.6 q2.4 6.6 -1 12 M91 60.4 q2.4 6 -1 10.6" fill="none" stroke="${C.stripe}" stroke-width="4" stroke-linecap="round"/>
    </g>
    ${showHindPaw ? `<ellipse cx="${r(hindPaw[0])}" cy="${r(hindPaw[1])}" rx="8.5" ry="4.4" fill="${C.fur}" ${outline}/>
      <path d="M${r(hindPaw[0] + 3)} ${r(hindPaw[1] + 1.5)} v-2.6 M${r(hindPaw[0] + 6)} ${r(hindPaw[1] + 1)} v-2.4" stroke="${C.line}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>` : ''}
    ${showHaunch ? `<ellipse cx="${r(haunch[0])}" cy="${r(haunch[1])}" rx="${r(haunchRx)}" ry="${r(haunchRy)}" fill="${C.fur}" ${outline}/>
      <path d="M${r(haunch[0] - 8)} ${r(haunch[1] - haunchRy * .55)} q5 3 4 ${r(haunchRy * .65)} M${r(haunch[0] - 1)} ${r(haunch[1] - haunchRy * .7)} q4 3 3 ${r(haunchRy * .55)}" fill="none" stroke="${C.stripe}" stroke-width="3.4" stroke-linecap="round"/>` : ''}
    ${showChest ? `<ellipse cx="${r(shoulderNear[0] + 3)}" cy="${r(shoulderNear[1] - 5)}" rx="7.5" ry="11" fill="${C.belly}"/>` : ''}
    ${p.tailFront ? drawTail(p) : ''}
    ${head}
    ${p.pawOverHead ? frontLeg : ''}
    ${drawSleepZ(p.zStep)}
  </g>`;
};

// ---- Key poses ------------------------------------------------------------------------------
const STAND = pose(BASE);
const SIT = pose(BASE, {
  bdy: 10, brot: -26,
  nf: { a: -3 }, ff: { a: -3 },
  nb: { a: 0, len: 4, reach: 0 }, fb: { a: 0, len: 4, reach: 0 },
  fold: 1, lw: 14, hdx: -3, hdy: 1,
  wUp: 0, wGround: 1,
});
const LOAF = pose(BASE, {
  bdy: 16, bsx: 1.04, bsy: .96,
  ...legs({ a: 0, len: 6, reach: 0 }),
  nb: { a: -30, len: 6, reach: 0 }, fb: { a: -30, len: 6, reach: 0 },
  fold: .55, hdx: -14, hdy: 5, hrot: 9,
  eyes: 'closed', blush: .45, whiskers: 0,
  wUp: 0, wGround: 1, tailFront: true,
});
const BOW = pose(BASE, {
  brot: 16,
  nf: { a: -55 }, ff: { a: -50 }, nb: { a: 8 }, fb: { a: 6 },
  hdx: -5, hdy: 2, hrot: -4,
  wUp: 0, wHigh: 1, eyes: 'squeeze', yawn: .5,
});
const FRONT = pose(BASE, { bsx: .5, hdx: -19, faceTurn: 1, tsx: .4 });
const HAPPY_FACE = { eyes: 'happy', blush: .7 };

const tau = Math.PI * 2;
const wave = (i, n, phase = 0) => Math.sin((i / n) * tau + phase);
const breath = (i, n) => (1 - Math.cos((i / n) * tau)) / 2;
const steps = (n, from, to, map = (t) => t) => Array.from({ length: n }, (_, i) => lerpPose(from, to, ease(map((i + 1) / n))));
// Raised and ground tails blend into a coil, so the tail hangs down on the way between them.
const viaHangingTail = (frames) => frames.map((p) => {
  const t = p.wGround / (p.wUp + p.wGround + p.wDown + p.wHigh || 1);
  return t < .5
    ? pose(p, { wUp: 1 - 2 * t, wDown: 2 * t, wGround: 0 })
    : pose(p, { wUp: 0, wDown: 2 - 2 * t, wGround: 2 * t - 1 });
});

const ANIMATION_POSES = {
  idle: Array.from({ length: 8 }, (_, i) => pose(STAND, {
    bsy: 1 + breath(i, 8) * .025,
    trot: wave(i, 8) * 7,
    hrot: wave(i, 8) * 1.5,
    eyes: i === 6 ? 'blink' : 'open',
  })),
  // Facing right, a paw on the ground pushes backward (toward -x) and lifts while it swings forward.
  // With rotate(a), the paw sits at x ≈ -a, so `a` rises during stance: lift only while it falls.
  walk: Array.from({ length: 8 }, (_, i) => {
    const phase = (i / 8) * tau;
    const swing = (offset) => -24 * Math.sin(phase + offset);
    const raise = (offset) => Math.max(0, Math.cos(phase + offset)) * 5;
    const leg = (offset) => ({ a: swing(offset), lift: raise(offset) });
    return pose(STAND, {
      bdy: 1.2 * Math.cos(phase * 2),
      nf: leg(0), fb: leg(0), ff: leg(Math.PI), nb: leg(Math.PI),
      trot: 6 * Math.sin(phase),
      hdy: Math.cos(phase * 2 + .5),
    });
  }),
  sit: Array.from({ length: 4 }, (_, i) => pose(SIT, {
    bsy: 1 + breath(i, 4) * .03,
    tflick: wave(i, 4) * 4,
    eyes: i === 3 ? 'blink' : 'open',
  })),
  sleep: Array.from({ length: 4 }, (_, i) => pose(LOAF, { bsy: .96 + breath(i, 4) * .04, hdy: 5 - breath(i, 4), zStep: i })),
  happy: [
    { bdy: 5, ...legs({ a: 0 }), nf: { a: 6 }, ff: { a: 6 }, nb: { a: -6 }, fb: { a: -6 } },
    { bdy: -8, ...legs({ len: 26, reach: 0 }), nf: { a: -22 }, ff: { a: -18 }, nb: { a: 26 }, fb: { a: 22 } },
    { bdy: -15, ...legs({ len: 18, reach: 0 }), nf: { a: -32 }, ff: { a: -28 }, nb: { a: 30 }, fb: { a: 28 } },
    { bdy: -9, ...legs({ len: 26, reach: 0 }), nf: { a: -16 }, ff: { a: -12 }, nb: { a: 12 }, fb: { a: 10 } },
    { bdy: 4, nf: { a: 4 }, ff: { a: 4 }, nb: { a: -4 }, fb: { a: -4 } },
    {},
  ].map((overrides, i) => {
    const merged = pose(STAND, overrides);
    return pose(merged, {
      ...HAPPY_FACE,
      yawn: i > 0 && i < 4 ? .25 : 0,
      wUp: 1 - [.2, .6, 1, .7, .4, .2][i], wHigh: [.2, .6, 1, .7, .4, .2][i],
      trot: [4, 8, 10, 8, 5, 2][i],
    });
  }),
  pet: Array.from({ length: 6 }, (_, i) => pose(STAND, {
    bdy: [1, 1.6, 1, .5, 0, .5][i],
    hrot: [-5, -7, -5, -1, 2, -1][i],
    bsy: 1 + [.3, .6, .3, 0, .2, .4][i] * .025,
    eyes: 'happy', blush: .85,
    wUp: .4, wHigh: .6, trot: [10, 14, 18, 14, 10, 6][i],
  })),
  petBack: Array.from({ length: 6 }, (_, i) => pose(STAND, {
    bdy: -1.5 - breath(i, 6), bsy: 1.03 + breath(i, 6) * .03,
    hrot: -6, hdy: -1,
    eyes: 'happy', blush: .75,
    wUp: 0, wHigh: 1, trot: wave(i, 6) * 3, tflick: wave(i * 2, 6) * 2,
  })),
  petSit: Array.from({ length: 6 }, (_, i) => pose(SIT, {
    hdy: 3,
    hrot: [-6, -8, -6, -2, 1, -2][i],
    bsy: 1 + breath(i, 6) * .03,
    eyes: 'happy', blush: .85,
    tflick: wave(i, 6) * 3,
  })),
  // Held by the scruff: rear sags, legs and tail dangle straight down. The walker swings the
  // whole frame around PET_CARRY_GRIP, so the frames only add a small limb sway.
  carried: Array.from({ length: 6 }, (_, i) => pose(STAND, {
    bdy: 4, brot: -18, bsx: 1.05, bsy: .95,
    nf: { a: -10 + wave(i, 6) * 3, len: 24, reach: 0 },
    ff: { a: -6 + wave(i, 6, .7) * 3, len: 22, reach: 0 },
    nb: { a: wave(i, 6, 1.4) * 3, len: 27, reach: 0 },
    fb: { a: wave(i, 6, 2.1) * 3, len: 25, reach: 0 },
    wUp: 0, wDown: 1, trot: wave(i, 6, -.8) * 6,
    hrot: 5, eyes: 'wide', yawn: .18, earL: -20, earR: 20, blush: .35,
  })),
  turn: [lerpPose(STAND, FRONT, .55), FRONT, lerpPose(STAND, FRONT, .55)],
  sitDown: viaHangingTail(steps(5, STAND, SIT)),
  standUp: viaHangingTail(steps(5, SIT, STAND)),
  lieDown: steps(5, SIT, LOAF).map((p, i) => pose(p, { eyes: i < 2 ? 'open' : i < 4 ? 'blink' : 'closed' })),
  wakeUp: [
    lerpPose(LOAF, BOW, .3), lerpPose(LOAF, BOW, .6), lerpPose(LOAF, BOW, .85), BOW,
    pose(BOW, { yawn: 1, earL: -6, earR: 6 }),
    lerpPose(BOW, STAND, .4), lerpPose(BOW, STAND, .75), pose(STAND, { eyes: 'blink' }),
  ],
  groom: Array.from({ length: 8 }, (_, i) => {
    const angles = [-80, -157, -157, -157, -157, -157, -80, 0];
    const lengths = [30, 22, 22, 22, 22, 22, 30, 26];
    const licking = i >= 2 && i <= 5;
    return pose(SIT, {
      nf: { a: angles[i], len: lengths[i], reach: i === 7 ? 1 : 0 },
      pawOverHead: i >= 1 && i <= 5,
      hrot: licking ? 10 : 4, hdy: licking ? 2 + (i % 2) * 1.5 : 1,
      eyes: licking ? 'closed' : 'open',
      tongue: licking && i % 2 === 0 ? 1 : 0,
    });
  }),
  yawn: Array.from({ length: 6 }, (_, i) => pose(STAND, {
    yawn: [.3, .7, 1, 1, .5, 0][i],
    eyes: ['closed', 'squeeze', 'squeeze', 'squeeze', 'closed', 'blink'][i],
    hrot: [-3, -6, -8, -8, -4, 0][i],
    earL: [0, -4, -7, -7, -3, 0][i], earR: [0, 4, 7, 7, 3, 0][i],
  })),
  stretch: [
    lerpPose(STAND, BOW, .4), lerpPose(STAND, BOW, .8), BOW, pose(BOW, { yawn: .9 }),
    lerpPose(BOW, STAND, .5), STAND,
  ],
  twitch: Array.from({ length: 4 }, (_, i) => pose(STAND, {
    earR: [0, 18, -6, 0][i],
    trot: [0, 6, -3, 0][i],
    tflick: [0, 6, -3, 0][i],
  })),
};

// ---- Sheet ----------------------------------------------------------------------------------
const { width: W, height: H, columns, rows } = PET_SPRITE_FRAME;
const frames = Object.entries(PET_ANIMATIONS).flatMap(([name, spec]) => {
  const poses = ANIMATION_POSES[name];
  if (!poses || poses.length !== spec.frames) throw new Error(`${name}: expected ${spec.frames} frames, got ${poses?.length ?? 0}`);
  return poses.map((p, i) => `<g transform="translate(${i * W} ${spec.row * H})"><g filter="url(#crayon)">${drawCat(p)}</g></g>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * columns}" height="${H * rows}" viewBox="0 0 ${W * columns} ${H * rows}">
<defs>
  <filter id="crayon" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="wobble"/>
    <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2" xChannelSelector="R" yChannelSelector="G" result="drawn"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.2  0 0 0 0 0.08  0.9 0 0 0 -0.34" result="tint"/>
    <feComposite in="tint" in2="drawn" operator="in" result="texture"/>
    <feMerge><feMergeNode in="drawn"/><feMergeNode in="texture"/></feMerge>
  </filter>
</defs>
${frames.join('\n')}
</svg>
`;

const outputUrl = new URL('../public/pets/cat-sprite.svg', import.meta.url);
mkdirSync(new URL('.', outputUrl), { recursive: true });
writeFileSync(outputUrl, svg.replace(/\n\s*\n/g, '\n').replace(/^\s+/gm, ''));
console.log(`wrote ${outputUrl.pathname} (${frames.length} frames)`);

// Where the walker's pointer holds a carried pet: the scruff between the shoulders and the head.
const carried = ANIMATION_POSES.carried[0];
const [scruffX, scruffY] = toWorld(carried, 101, 60);
console.log(`carried scruff ≈ (${r(scruffX)}, ${r(scruffY)})`);
