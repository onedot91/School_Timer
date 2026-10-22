// Generates public/pets/<kind>-sprite.svg (one row per animation, frames left to right) and
// public/pets/<kind>-portrait.svg (one idle frame for pickers) for every species below.
// Every species shares one rig (body, four legs, haunch, tail, head), so transitions are interpolated
// poses and the carry grip is the same; species only change colours, ears, nose, tail and markings.
// Run: node dev/generatePetSprites.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { PET_ANIMATIONS, PET_CARRY_GRIPS, PET_SPRITE_FRAME, PET_TRICKS } from '../src/lib/petSprites.ts';

const C = {
  line: '#3b2a1f',
  eye: '#2b1d14',
  mouth: '#7a3b2e',
  blush: '#f08c7d',
};

// Fields: fur/furFar (near/far body side), legFur/legFar (default fur/furFar), haunchFur, headFur,
// belly, muzzle (null = none), pattern colour, bodyPattern, forehead, marking, ears, earFur, earIn,
// nose, noseType, eyeLine/eyeRing (for eyes on dark patches), whiskers, mane, wool, tail.
const SPECIES = {
  dog: {
    shape: { body: [1.05, 1], lift: -2 },
    fur: '#e3b27c', furFar: '#c99660', belly: '#fff3e3', muzzle: null, pattern: '#c99660',
    bodyPattern: 'none', forehead: 'none', ears: 'floppy', earsFront: true, earFur: '#9a6236', earIn: '#9a6236',
    nose: '#3b2a1f', noseType: 'dog', whiskers: false,
    snout: {
      path: 'M112 63 C116 56 136 55 146 59 C152 62 152 71 145 74 C136 78 118 78 113 72 C110 69 110 66 112 63 Z',
      fill: '#fff3e3', nose: [146, 61.5, 4.4, 3.3], mouth: [137, 70],
    },
    tail: { type: 'thin', outer: 12, inner: 6.6 },
  },
  rabbit: {
    shape: { body: [.92, 1.06], lift: 4, headShift: [-2, 2] },
    fur: '#f5f2ed', furFar: '#ddd8cf', belly: '#ffffff', muzzle: '#ffffff', pattern: '#ddd8cf',
    bodyPattern: 'none', forehead: 'none', ears: 'long', earIn: '#f6b6b8',
    nose: '#ee8f9b', noseType: 'triangle', whiskers: true,
    tail: { type: 'stub', color: '#ffffff', size: 6.5 },
  },
  chick: {
    fur: '#ffd84a', furFar: '#f2c22c', belly: '#fff1a8', muzzle: null, pattern: '#f2c22c',
    bodyPattern: 'none', forehead: 'none', ears: 'tuft', earsFront: true, earIn: '#ffd84a',
    nose: '#f29b2c', noseType: 'beak', whiskers: false,
    bird: true, legFur: '#f29b2c', legFar: '#f29b2c',
    bodyPath: 'M58 84 C57 68 70 60 84 60 C100 60 110 70 110 84 C110 99 98 104 84 104 C70 104 59 99 58 84 Z',
    tail: { type: 'feather', color: '#f2c22c' },
  },
  fox: {
    shape: { body: [1.08, .92], lift: -3, head: .95 }, legWidth: 11,
    fur: '#ec7a30', furFar: '#cf621f', legFur: '#5b3a2b', legFar: '#4a2e22', haunchFur: '#ec7a30',
    belly: '#fff6ec', muzzle: null, pattern: '#cf621f',
    bodyPattern: 'none', forehead: 'none', ears: 'pointed', earFur: '#ec7a30', earIn: '#fff1e6',
    nose: '#3b2a1f', noseType: 'triangle', whiskers: false,
    snout: {
      path: 'M110 60 C120 55 138 57 152 63.5 C153 65 151 67 148 68 C137 73 120 75 111 71 C107 68 107 63 110 60 Z',
      lower: 'M111 67 C124 69 140 68 152 64.5 C152 66 150 67.5 148 68 C137 73 120 75 111 71 Z',
      fill: '#ec7a30', nose: [150.5, 63.5, 3, 2.4], mouth: [141, 66], mouthScale: .58,
    },
    tail: { type: 'bushy', outer: 22, inner: 16.4, scale: 1.05, tuft: '#fff6ec', tuftSize: 8 },
  },
  cat: {
    fur: '#f2a650', furFar: '#d98b3c', belly: '#fde7c6', muzzle: '#fde7c6', pattern: '#c46d2b',
    bodyPattern: 'tabby', forehead: 'tabby', ears: 'pointed', earIn: '#f6b8aa',
    nose: '#ee8f8c', noseType: 'triangle', whiskers: true,
    tail: { type: 'thin', outer: 13, inner: 7.4, rings: '#c46d2b', dash: '3.5 9' },
  },
  hamster: {
    shape: { body: [.9, 1.06], lift: 8, head: 1.05, headShift: [-6, 6] },
    fur: '#eab275', furFar: '#d39858', belly: '#fff3e0', muzzle: '#fff3e0', pattern: '#d39858',
    bodyPattern: 'none', forehead: 'none', marking: 'cheekPouches', ears: 'round', earSize: 7, earIn: '#f4a7a0',
    nose: '#ee8f8c', noseType: 'triangle', whiskers: true,
    tail: { type: 'stub', color: '#f4c9a8', size: 4 },
  },
  squirrel: {
    shape: { body: [.88, .98], lift: 3, head: .95 },
    fur: '#c97a42', furFar: '#ae6331', belly: '#f7e0c4', muzzle: '#f7e0c4', pattern: '#8f4f26',
    bodyPattern: 'backStripe', forehead: 'none', ears: 'pointed', earIn: '#f0b9a0',
    nose: '#4a3428', noseType: 'triangle', whiskers: false,
    tail: { type: 'bushy', outer: 25, inner: 19.4, highlight: '#e3a46b', scale: 1.05 },
  },
  raccoon: {
    shape: { body: [1.02, 1.05], lift: 1.5 },
    fur: '#a09b95', furFar: '#86817b', belly: '#e9e5df', muzzle: '#f1eee9', pattern: '#4a4440',
    bodyPattern: 'none', forehead: 'none', marking: 'raccoonMask', ears: 'pointed', earIn: '#f1eee9',
    nose: '#2f2a28', noseType: 'triangle', eyeLine: '#ffffff', eyeRing: true, whiskers: true,
    tail: { type: 'thin', outer: 17, inner: 11.4, rings: '#4a4440', dash: '5 5' },
  },
  panda: {
    shape: { body: [1.12, 1.12], lift: 4, head: 1.08 }, legWidth: 16,
    fur: '#faf8f3', furFar: '#e6e2da', legFur: '#3a3431', legFar: '#2a2523', haunchFur: '#3a3431',
    belly: '#faf8f3', muzzle: '#ffffff', pattern: '#3a3431',
    bodyPattern: 'pandaBand', forehead: 'none', marking: 'pandaEyes', ears: 'round', earSize: 8.5,
    earFur: '#3a3431', earIn: '#3a3431',
    nose: '#2f2a28', noseType: 'triangle', eyeLine: '#ffffff', eyeRing: true, whiskers: false,
    tail: { type: 'stub', color: '#faf8f3', size: 5 },
  },
  koala: {
    shape: { body: [.95, 1.08], lift: 4, head: 1.05, headShift: [-2, 2] }, legWidth: 15,
    fur: '#a3aab3', furFar: '#899099', belly: '#eceae6', muzzle: null, pattern: '#899099',
    bodyPattern: 'none', forehead: 'none', ears: 'koala', earIn: '#f4f2ee',
    nose: '#3a3532', noseType: 'koala', whiskers: false,
    tail: { type: 'none' },
  },
  pig: {
    shape: { body: [1.12, 1.1], lift: 6, headShift: [0, 3] }, legWidth: 14,
    fur: '#f6b7c1', furFar: '#e59aa6', belly: '#fbd5db', muzzle: null, pattern: '#e59aa6',
    bodyPattern: 'none', forehead: 'none', ears: 'pig', earIn: '#ec8f9e',
    nose: '#f39aa9', noseType: 'snout', mouthDy: 5, whiskers: false,
    tail: { type: 'curl', color: '#f6b7c1' },
  },
  sheep: {
    shape: { body: [1.08, 1.12], lift: -1 }, legWidth: 10,
    fur: '#fbf7f0', furFar: '#e8e2d7', legFur: '#5d4c43', legFar: '#4a3c35', haunchFur: '#fbf7f0',
    headFur: '#f1dfc8', belly: '#fbf7f0', muzzle: '#f8ecdc', pattern: '#e8e2d7',
    bodyPattern: 'none', forehead: 'none', ears: 'sheep', earFur: '#f1dfc8', earIn: '#e9b8a8',
    nose: '#5d4c43', noseType: 'triangle', whiskers: false, wool: true,
    tail: { type: 'stub', color: '#fbf7f0', size: 6 },
  },
  tiger: {
    shape: { body: [1.12, 1], lift: -2 }, legWidth: 15,
    fur: '#f29434', furFar: '#d97c21', belly: '#fdf3e3', muzzle: '#fdf3e3', pattern: '#2e231b',
    bodyPattern: 'tiger', forehead: 'tiger', marking: 'tigerCheeks', ears: 'round', earSize: 8, earIn: '#fdf3e3',
    nose: '#e88a7c', noseType: 'triangle', whiskers: true,
    tail: { type: 'thin', outer: 14, inner: 8.4, rings: '#2e231b', dash: '4 6' },
  },
  penguin: {
    shape: { headShift: [-20, -10] },
    fur: '#33394a', furFar: '#262b38', belly: '#fbfaf6', muzzle: null, pattern: '#33394a',
    bodyPattern: 'penguinFront', forehead: 'none', marking: 'penguinFace', ears: 'none', earIn: '#33394a',
    nose: '#f39a2a', noseType: 'beak', whiskers: false,
    bird: true, legFur: '#f39a2a', legFar: '#f39a2a',
    bodyPath: 'M64 82 C62 60 73 48 86 48 C99 48 108 60 107 82 C106 100 97 108 86 108 C75 108 65 100 64 82 Z',
    tail: { type: 'feather', color: '#262b38' },
  },
  cow: {
    shape: { body: [1.15, 1.05], lift: -4 }, legWidth: 14,
    fur: '#f8f5f0', furFar: '#e3ddd3', belly: '#f8f5f0', muzzle: null, pattern: '#3a3330',
    bodyPattern: 'cowSpots', forehead: 'none', marking: 'cowPatch', ears: 'sheep', earFur: '#f8f5f0', earIn: '#f2b8b2',
    horns: '#efe3c4', nose: '#f4b6b0', noseType: 'snout', mouthDy: 5, whiskers: false,
    tail: { type: 'tuft', outer: 7, inner: 3.4, tuft: '#3a3330' },
  },
  monkey: {
    shape: { body: [.92, .95], lift: -3 }, legWidth: 11,
    fur: '#9b6a43', furFar: '#83573a', belly: '#f2d4b0', muzzle: null, pattern: '#83573a',
    bodyPattern: 'none', forehead: 'none', marking: 'monkeyFace', ears: 'monkey', earIn: '#f2d4b0',
    nose: '#5a3b28', noseType: 'triangle', whiskers: false,
    tail: { type: 'thin', outer: 9, inner: 4.6, scale: 1.08 },
  },
  hedgehog: {
    shape: { body: [.98, 1], lift: 9, head: .95, headShift: [-4, 8] }, legWidth: 12,
    fur: '#8a6446', furFar: '#74533a', headFur: '#f0d8b6', legFur: '#e8cba5', legFar: '#d2b28b',
    belly: '#f0d8b6', muzzle: null, pattern: '#74533a', spikes: '#6b4a33',
    bodyPattern: 'none', forehead: 'none', ears: 'round', earSize: 6, earFur: '#e8cba5', earIn: '#d9a99a',
    nose: '#3b2a1f', noseType: 'dog', whiskers: false,
    snout: {
      path: 'M111 61 C122 56 140 60 151 65.5 C152 67 150 68.5 147 69 C136 73 120 75 112 71 C108 68 108 64 111 61 Z',
      fill: '#f7e7cf', nose: [150, 65.5, 3.2, 2.6], mouth: [139, 67.2], mouthScale: .65,
    },
    tail: { type: 'none' },
  },
  elephant: {
    shape: { body: [1.13, 1.2], lift: 3, head: 1.04, headShift: [-4, 1] },
    fur: '#a9b0b9', furFar: '#8e96a0', belly: '#bfc5cc', muzzle: null, pattern: '#8e96a0',
    bodyPattern: 'none', forehead: 'none', ears: 'elephant', earsFront: true, earIn: '#e7bdb7',
    nose: '#a9b0b9', noseType: 'trunk', whiskers: false, legWidth: 19, toenails: '#efe9df', tusk: '#fffaf0',
    headPath: 'M89 60 C87 40 101 29 118 29 C135 29 146 41 146 56 C146 64 142 71 137 75 C130 80 118 81 106 79 C95 77 90 70 89 60 Z',
    mouthAt: [124, 76],
    tail: { type: 'tuft', outer: 6.4, inner: 3, tuft: '#6f7780', scale: .5 },
  },
  turtle: {
    shape: { body: [1.05, 1], lift: 7, head: .82, headShift: [10, 12] }, legWidth: 15,
    fur: '#8cb45c', furFar: '#77a04a', headFur: '#a7d07c', legFur: '#a7d07c', legFar: '#8fbb67', haunchFur: '#a7d07c',
    belly: '#8cb45c', muzzle: null, pattern: '#5e8a3e', rim: '#d8c27a', neck: true,
    bodyPattern: 'shell', forehead: 'none', ears: 'none', earIn: '#a7d07c',
    nose: '#5e8a3e', noseType: 'none', whiskers: false,
    bodyPath: 'M44 92 C44 70 60 56 80 56 C100 56 116 70 116 92 C116 97 112 100 106 100 L54 100 C48 100 44 97 44 92 Z',
    tail: { type: 'stub', color: '#a7d07c', size: 4 },
  },
  lion: {
    shape: { body: [1.04, 1.02], lift: -2, headShift: [-3, 0] }, legWidth: 15,
    fur: '#eab65e', furFar: '#d39c44', belly: '#fbe9c6', muzzle: '#fbe9c6', pattern: '#d39c44',
    bodyPattern: 'none', forehead: 'none', ears: 'round', earSize: 6.5, earIn: '#f6c89a',
    nose: '#7a4526', noseType: 'triangle', whiskers: false, mane: '#b8682c',
    tail: { type: 'tuft', outer: 7.4, inner: 3.6, tuft: '#b8682c' },
  },
  duck: {
    fur: '#fbfaf5', furFar: '#e4e0d6', belly: '#ffffff', muzzle: null, pattern: '#e4e0d6',
    bodyPattern: 'none', forehead: 'none', ears: 'none', earIn: '#fbfaf5',
    nose: '#f4a332', noseType: 'bill', whiskers: false,
    bird: true, legFur: '#f4a332', legFar: '#f4a332',
    bodyPath: 'M52 84 C51 70 64 62 82 62 C100 62 112 70 112 84 C112 98 98 104 82 104 C66 104 53 98 52 84 Z',
    tail: { type: 'feather', color: '#e4e0d6' },
  },
  frog: {
    shape: { body: [1.02, .9], lift: 7, head: 1.04, headShift: [-6, 7] }, legWidth: 14,
    fur: '#7cc36b', furFar: '#62a956', belly: '#e6f4c4', muzzle: null, pattern: '#4f9447',
    bodyPattern: 'frogSpots', forehead: 'none', ears: 'frog', earIn: '#7cc36b',
    eyesAt: [[105, 40], [128, 38]], eyeRing: true, wideMouth: true, crouch: true,
    nose: '#4f9447', noseType: 'nostrils', whiskers: false,
    tail: { type: 'none' },
  },
  giraffe: {
    shape: { body: [.8, .74], lift: 0, head: .68, headShift: [14, -29] }, legWidth: 11,
    fur: '#f3c45e', furFar: '#dcab48', belly: '#fbe7b6', muzzle: null, pattern: '#b9732f',
    bodyPattern: 'giraffeSpots', forehead: 'none', ears: 'giraffe', earFur: '#f3c45e', earIn: '#f0b79a',
    // A slim skull with a long muzzle reaching forward, not a round cat face.
    headPath: 'M98 52 C97 41 105 33 115 33 C125 33 132 40 133 50 C134 57 131 63 125 66 C116 70 101 66 98 52 Z',
    eyesAt: [[109, 48], [123, 47]],
    snout: {
      path: 'M118 52 C128 50 144 54 152 61 C156 65 154 71 148 73 C139 76 125 74 118 69 C112 64 112 55 118 52 Z',
      fill: '#f7ddb0', nose: [150, 63, 1.8, 1.3], mouth: [143, 69], mouthScale: .6,
    },
    ossicones: '#b9732f', nose: '#8a5527', noseType: 'triangle', whiskers: false, liesDown: true,
    neck: { from: [104, 76], width: 15, spots: '#b9732f' },
    tail: { type: 'tuft', outer: 6.4, inner: 3, tuft: '#7a4a24', scale: .55 },
  },
  zebra: {
    shape: { body: [1.08, 1], lift: -3, headShift: [-1, 1] }, legWidth: 13,
    fur: '#fbfaf6', furFar: '#e3e0d9', belly: '#fbfaf6', muzzle: null, pattern: '#2b2a2e',
    bodyPattern: 'zebra', forehead: 'tiger', ears: 'pointed', earFur: '#fbfaf6', earIn: '#f0c4bd',
    crest: '#2b2a2e', nose: '#3b3940', noseType: 'dog', whiskers: false,
    snout: {
      path: 'M110 60 C116 55 136 56 146 60 C152 63 152 72 145 75 C136 79 118 78 112 72 C108 68 108 63 110 60 Z',
      fill: '#4b4852', nose: [146, 63, 3.4, 2.6], mouth: [137, 70],
    },
    tail: { type: 'tuft', outer: 7, inner: 3.4, tuft: '#2b2a2e', scale: .9 },
  },
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
  frameRot: 0, fcx: 80, fcy: 40, pawOverHead: false, hindOverHead: false, headBehind: false, zStep: -1,
  // Species details: chick wings (0 folded .. 1 raised) and hamster cheeks (0 .. 1 puffed).
  wing: 0, cheek: 0,
  // Elephant trunk (0 hanging .. 1 raised) and water spray from its tip (0 .. 1).
  trunk: 0, spray: 0,
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

const legLength = ([, pivotY], leg, factor = 1) => {
  const reachGround = Math.min(44, Math.max(4, (GROUND - pivotY) / Math.max(.3, Math.cos(leg.a * DEG))));
  return lerp(leg.len * factor, reachGround, leg.reach) - leg.lift;
};

// Each species has its own build. `body` scales the body around its bottom centre, `lift` lowers the
// body (shorter legs) or raises it (negative, longer legs), `head` scales the head around the neck and
// `headShift` moves it. Poses stay shared, so every species keeps every motion.
const DEFAULT_SHAPE = { body: [1, 1], lift: 0, head: 1, headShift: [0, 0] };
const shapeOf = (sp) => ({ ...DEFAULT_SHAPE, ...(sp.shape ?? {}) });
const LEG_REFERENCE = 26;
const legFactor = (sp) => Math.min(1.06, Math.max(.4, (LEG_REFERENCE - shapeOf(sp).lift) / LEG_REFERENCE));
// Lowering the body shortens standing legs only; sitting and lying poses already rest on the ground.
const effectiveLift = (p, sp) => shapeOf(sp).lift * Math.min(1, Math.max(0, 1 - Math.max(0, p.bdy) / 16));
const shapePose = (p, sp) => {
  const shape = shapeOf(sp);
  return { ...p, bsx: p.bsx * shape.body[0], bsy: p.bsy * shape.body[1], bdy: p.bdy + effectiveLift(p, sp) };
};

const drawLeg = ([x, y], leg, fill, width, sp) => {
  const length = legLength([x, y], leg, legFactor(sp));
  if (sp.bird) {
    return `
  <g transform="translate(${r(x)} ${r(y)}) rotate(${r(leg.a)})">
    <path d="M0 -4 V${r(length - 1)} M0 ${r(length - 1)} l6 .6 M0 ${r(length - 1)} l3.4 -2.4 M0 ${r(length - 1)} l-3.6 .4" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 -4 V${r(length - 1)} M0 ${r(length - 1)} l6 .6 M0 ${r(length - 1)} l3.4 -2.4 M0 ${r(length - 1)} l-3.6 .4" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
  }
  const w = width * ((sp.legWidth ?? 13) / 13);
  return `
  <g transform="translate(${r(x)} ${r(y)}) rotate(${r(leg.a)})">
    <rect x="${r(-w / 2)}" y="-6" width="${r(w)}" height="${r(length + 6)}" rx="${r(w / 2)}" fill="${fill}" ${outline}/>
    ${sp.toenails
      ? [-w * .28, 0, w * .28].map((dx) => `<ellipse cx="${r(dx)}" cy="${r(length - 1.8)}" rx="2.4" ry="1.7" fill="${sp.toenails}" stroke="${C.line}" stroke-width="1"/>`).join('')
      : `<path d="M-2.6 ${r(length - 1)} v-3.6 M2.2 ${r(length - 1)} v-3.6" stroke="${C.line}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`}
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

const drawTail = (p, sp) => {
  const tail = sp.tail;
  if (tail.type === 'none') return '';
  const rump = toWorld(p, 50, 77);
  if (tail.type === 'stub') {
    const [x, y] = toWorld(p, 47, 80);
    return `<circle cx="${r(x)}" cy="${r(y)}" r="${tail.size}" fill="${tail.color}" ${outline}/>`;
  }
  if (tail.type === 'feather') {
    const [x, y] = toWorld(p, 60, 76);
    return `<g transform="rotate(${r(p.trot * .5)} ${r(x)} ${r(y)})">
      <path d="M${r(x)} ${r(y)} l-9 -6 l3 6 l-8 1 l8 3 z" fill="${tail.color}" ${outline}/>
    </g>`;
  }
  if (tail.type === 'curl') {
    const [x, y] = toWorld(p, 48, 78);
    const d = `M${r(x)} ${r(y)} c-5 -1 -9 -6 -5 -10 c3 -3 7 1 4 4 c-2 2 -4 0 -3 -1.5`;
    return `<g transform="rotate(${r(p.trot * .5)} ${r(x)} ${r(y)})">
      <path d="${d}" fill="none" stroke="${C.line}" stroke-width="6.4" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${tail.color}" stroke-width="3" stroke-linecap="round"/>
    </g>`;
  }
  const weights = { up: p.wUp, high: p.wHigh, ground: p.wGround, down: p.wDown };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const scale = tail.scale ?? 1;
  // A thick tail lying on the ground is raised by its extra thickness so it stays above the frame edge.
  const groundY = GROUND_TAIL_BASE[1] - Math.max(0, tail.outer - 13) / 2;
  // ...and hangs a little shorter, since its thickness already reaches further down.
  const hang = Math.min(1, 1.6 * 13 / tail.outer);
  const base = [lerp(rump[0], GROUND_TAIL_BASE[0], p.wGround / total), lerp(rump[1], groundY, p.wGround / total)];
  const points = TAIL_SHAPES.up.map((_, index) => {
    let x = 0;
    let y = 0;
    for (const [shape, weight] of Object.entries(weights)) {
      x += TAIL_SHAPES[shape][index][0] * (weight / total);
      y += TAIL_SHAPES[shape][index][1] * (weight / total);
    }
    if (index >= 4) x += p.tflick * (index === 5 ? 1 : .5);
    return [base[0] + x * p.tsx * scale, base[1] + (y < 0 ? y * scale : y * hang)];
  });
  const [c1, c2, p1, c3, c4, p2] = points.map(([x, y]) => `${r(x)} ${r(y)}`);
  const d = `M${r(base[0])} ${r(base[1])} C${c1} ${c2} ${p1} C${c3} ${c4} ${p2}`;
  const tip = points[5];
  const layers = [
    `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${tail.outer}" stroke-linecap="round"/>`,
    `<path d="${d}" fill="none" stroke="${sp.fur}" stroke-width="${tail.inner}" stroke-linecap="round"/>`,
  ];
  if (tail.rings) layers.push(`<path d="${d}" fill="none" stroke="${tail.rings}" stroke-width="${tail.inner}" stroke-dasharray="${tail.dash}" stroke-dashoffset="-6"/>`);
  if (tail.highlight) layers.push(`<path d="${d}" fill="none" stroke="${tail.highlight}" stroke-width="${r(tail.inner * .4)}" stroke-linecap="round"/>`);
  if (tail.tuft) layers.push(`<circle cx="${r(tip[0])}" cy="${r(tip[1])}" r="${tail.tuftSize ?? 6}" fill="${tail.tuft}" ${outline}/>`);
  const swing = tail.type === 'bushy' ? p.trot * .5 : p.trot;
  return `<g transform="rotate(${r(swing)} ${r(base[0])} ${r(base[1])})">${layers.join('')}</g>`;
};

const drawEyes = (kind, sp) => (sp.eyesAt ?? [[109, 55], [128, 55]]).map(([x, y]) => {
  const stroke = `fill="none" stroke="${sp.eyeLine ?? C.line}" stroke-width="2.6" stroke-linecap="round"`;
  const ring = (size) => (sp.eyeRing ? `<circle cx="${x}" cy="${y}" r="${size}" fill="#fff"/>` : '');
  if (kind === 'open') return `${ring(5)}<ellipse cx="${x}" cy="${y}" rx="3.5" ry="4.5" fill="${C.eye}"/><circle cx="${x + 1.2}" cy="${y - 1.7}" r="1.35" fill="#fff"/>`;
  if (kind === 'wide') return `${ring(6)}<ellipse cx="${x}" cy="${y}" rx="4.2" ry="5.4" fill="${C.eye}"/><circle cx="${x + 1.4}" cy="${y - 2}" r="1.7" fill="#fff"/>`;
  if (kind === 'happy') return `<path d="M${x - 4} ${y + 1.5} q4 -5.5 8 0" ${stroke}/>`;
  if (kind === 'blink') return `<path d="M${x - 4} ${y + .5} q4 2.2 8 0" ${stroke}/>`;
  if (kind === 'squeeze') return `<path d="M${x - 4} ${y - 2} l7 2.4 l-7 2.4" ${stroke}/>`;
  return `<path d="M${x - 4} ${y} q4 3.5 8 0" fill="none" stroke="${sp.eyeLine ?? C.line}" stroke-width="2.4" stroke-linecap="round"/>`;
}).join('');

const drawMouth = (p, sp) => {
  const open = p.yawn;
  // A frog's mouth runs almost across the whole face.
  const smile = sp.wideMouth
    ? `<path d="M100 63 C108 72 130 72 138 62" fill="none" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="M119 65.8 v1.8 M119 67.6 q-2.6 2.8 -5.2 0 M119 67.6 q2.6 2.8 5.2 0" fill="none" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`;
  const tongue = p.tongue > .5
    ? `<ellipse cx="120.5" cy="71.4" rx="2.6" ry="3.2" fill="#ee8f8c" stroke="${C.line}" stroke-width="1.1"/>`
    : '';
  const body = (() => {
    if (open < .08) return smile + tongue;
    const rx = 2.4 + 3.4 * open;
    const ry = 2 + 5.6 * open;
    const cy = 67.5 + ry;
    return `${open < .35 ? smile : `<path d="M119 65.8 v1.6" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`}
      <ellipse cx="119" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${C.mouth}" stroke="${C.line}" stroke-width="1.3"/>
      <ellipse cx="119" cy="${r(cy + ry * .45)}" rx="${r(rx * .62)}" ry="${r(ry * .42)}" fill="#ee8f8c"/>`;
  })();
  const [mx, my] = sp.snout?.mouth ?? sp.mouthAt ?? [119, 66 + (sp.mouthDy ?? 0)];
  // A slim snout gets a smaller mouth so it stays inside the snout outline.
  const scale = sp.snout?.mouthScale ?? 1;
  if (mx === 119 && my === 66 && scale === 1) return body;
  return `<g transform="translate(${r(mx)} ${r(my)}) scale(${scale}) translate(-119 -66)">${body}</g>`;
};

// A muzzle that grows out of the face: its outline is drawn behind the head so only the part sticking
// out is outlined, then its colour is filled over the face with the nose at the tip.
const drawSnoutBehind = (sp) => `<path d="${sp.snout.path}" fill="${sp.snout.fill}" ${outline}/>`;
const drawSnout = (sp) => {
  const { path, fill, lower, nose } = sp.snout;
  return `<path d="${path}" fill="${fill}"/>
    ${lower ? `<path d="${lower}" fill="${sp.belly}"/>` : ''}
    <ellipse cx="${nose[0]}" cy="${nose[1]}" rx="${nose[2] ?? 3.6}" ry="${nose[3] ?? 2.8}" fill="${sp.nose}"/>
    <ellipse cx="${r(nose[0] - 1)}" cy="${r(nose[1] - 1)}" rx="1.1" ry=".7" fill="#fff" opacity=".7"/>`;
};

const drawNose = (sp) => {
  if (sp.noseType === 'snout') {
    return `<ellipse cx="119" cy="65" rx="8" ry="5.6" fill="${sp.nose}" ${outline}/>
      <ellipse cx="116.4" cy="65" rx="1.2" ry="2" fill="${C.line}"/><ellipse cx="121.6" cy="65" rx="1.2" ry="2" fill="${C.line}"/>`;
  }
  if (sp.noseType === 'koala') {
    return `<ellipse cx="119" cy="62.5" rx="5.6" ry="7" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.4"/>
      <ellipse cx="117.4" cy="59.6" rx="1.6" ry="1.1" fill="#fff" opacity=".7"/>`;
  }
  if (sp.noseType === 'trunk' || sp.noseType === 'none') return '';
  if (sp.noseType === 'nostrils') {
    return `<circle cx="115.5" cy="59" r="1.2" fill="${sp.nose}"/><circle cx="122.5" cy="58.5" r="1.2" fill="${sp.nose}"/>`;
  }
  if (sp.noseType === 'dog') {
    return `<ellipse cx="119.5" cy="63" rx="4.4" ry="3.2" fill="${sp.nose}"/><ellipse cx="118.3" cy="62" rx="1.3" ry=".8" fill="#fff" opacity=".7"/>`;
  }
  return `<path d="M116.2 62.6 h5.6 l-2.8 3.2 z" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round"/>`;
};

// Elephant trunk from the muzzle: hangs and curls in, or (trunk = 1) rises with the tip curled up.
const TRUNK_DOWN = [[133, 70], [142, 74], [143, 88], [139, 101]];
const TRUNK_UP = [[133, 70], [146, 66], [150, 50], [143, 37]];
const TRUNK_REST = [[133, 70], [141, 77], [146, 84], [154, 86]];
const bezier = ([a, b, c, d], t) => [0, 1].map((k) => (
  (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t ** 2 * c[k] + t ** 3 * d[k]
));
const drawTrunk = (p, sp) => {
  // Sitting, the trunk hangs at full length; lying down, it rests forward along the ground.
  const lying = Math.min(1, Math.max(0, (p.bdy - 12) / 6));
  const hanging = TRUNK_DOWN.map(([x, y], i) => [lerp(x, TRUNK_REST[i][0], lying), lerp(y, TRUNK_REST[i][1], lying)]);
  const [a, b, c, d] = hanging.map(([x, y], i) => [lerp(x, TRUNK_UP[i][0], p.trunk), lerp(y, TRUNK_UP[i][1], p.trunk)]);
  // Outline a trunk that tapers from the face to the tip, with wrinkle lines across it.
  const samples = Array.from({ length: 15 }, (_, i) => i / 14);
  const sides = samples.map((t) => {
    const [x, y] = bezier([a, b, c, d], t);
    const [x2, y2] = bezier([a, b, c, d], Math.min(1, t + .02));
    const [x1, y1] = bezier([a, b, c, d], Math.max(0, t - .02));
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const [nx, ny] = [-(y2 - y1) / length, (x2 - x1) / length];
    const half = lerp(7.4, 4, t);
    return { left: [x + nx * half, y + ny * half], right: [x - nx * half, y - ny * half], normal: [nx, ny], half, at: [x, y] };
  });
  const point = ([x, y]) => `${r(x)} ${r(y)}`;
  const outlinePath = `M${sides.map((side) => point(side.left)).join(' L')} L${[...sides].reverse().map((side) => point(side.right)).join(' L')} Z`;
  const wrinkles = [.35, .5, .65, .8].map((t) => {
    const side = sides[Math.round(t * 14)];
    const [nx, ny] = side.normal;
    return `M${point([side.at[0] + nx * side.half * .8, side.at[1] + ny * side.half * .8])} L${point([side.at[0] - nx * side.half * .8, side.at[1] - ny * side.half * .8])}`;
  }).join(' ');
  const fur = sp.headFur ?? sp.fur;
  const drops = p.spray > 0
    ? [[0, -8], [-6, -13], [6, -14], [-2, -20], [9, -22], [-9, -21]].slice(0, Math.ceil(p.spray * 6))
      .map(([dx, dy], i) => `<circle cx="${r(d[0] + dx * p.spray)}" cy="${r(d[1] + dy * p.spray)}" r="${2.2 - i * .15}" fill="#8fd0f0" stroke="#4f8fb3" stroke-width="1"/>`).join('')
    : '';
  return `<path d="${outlinePath}" fill="${fur}" ${outline}/>
    <circle cx="${r(a[0] - 3)}" cy="${r(a[1] - 3)}" r="7.6" fill="${fur}"/>
    <path d="${wrinkles}" stroke="${C.line}" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>
    <ellipse cx="${r(d[0])}" cy="${r(d[1])}" rx="3.2" ry="1.6" fill="${C.line}" opacity=".55" transform="rotate(${r(Math.atan2(sides[14].normal[1], sides[14].normal[0]) * 180 / Math.PI)} ${r(d[0])} ${r(d[1])})"/>
    ${sp.tusk ? `<path d="M129 77 q1 7 9 8 q-4 -3 -4.5 -8 Z" fill="${sp.tusk}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
    ${drops}`;
};

// Duck bill: flat and wide with a rounded tip; the lower half drops as it quacks.
const drawBill = (p, sp) => {
  const open = Math.min(1, p.yawn * 1.6);
  return `<path d="M110 62 C118 59 130 59 136 62 C139 64 137 67 132 67 L111 67 Z" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M111 67.5 L131 ${r(67.5 + open * 3)} C135 ${r(68 + open * 4)} 134 ${r(71 + open * 4)} 129 ${r(71 + open * 4)} L111 ${r(70 + open * 2)} Z" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="125" cy="62.4" r=".9" fill="${C.line}" opacity=".6"/>`;
};

// Beak that opens with the yawn value (chirping, yawning).
const drawBeak = (p, sp) => {
  const open = Math.min(1, p.yawn * 1.6);
  return `<path d="M113 61.5 L126 64.5 L113 66 Z" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M113 66.5 L${r(124 - open * 2)} ${r(66.2 + open * 4)} L113 ${r(69 + open * 3)} Z" fill="${sp.nose}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>`;
};

const drawEars = (p, sp) => {
  const fur = sp.earFur ?? sp.headFur ?? sp.fur;
  const pair = (left, right) => `
  <g transform="rotate(${r(p.earL)} 104 41)">${left}</g>
  <g transform="rotate(${r(p.earR)} 126 38)">${right}</g>`;
  if (sp.ears === 'round' || sp.ears === 'koala') {
    const big = sp.ears === 'koala';
    const size = big ? 13 : sp.earSize ?? 8;
    const ear = (x, y) => `<circle cx="${x}" cy="${y}" r="${size}" fill="${fur}" ${outline}/><circle cx="${x + .6}" cy="${y + .6}" r="${r(size * (big ? .62 : .5))}" fill="${sp.earIn}"/>`;
    return big ? pair(ear(93.5, 42), ear(137.5, 40)) : pair(ear(100, 37), ear(131, 35));
  }
  if (sp.ears === 'pig') {
    return pair(
      `<path d="M95 44 Q93 26 108 31 Q107 41 95 44 Z" fill="${fur}" ${outline}/><path d="M98 39 Q98 31 105 33 Q104 38 98 39 Z" fill="${sp.earIn}"/>`,
      `<path d="M124 31 Q139 24 139 41 Q131 41 124 31 Z" fill="${fur}" ${outline}/><path d="M128 32 Q136 29 135.5 37 Q131 36 128 32 Z" fill="${sp.earIn}"/>`,
    );
  }
  if (sp.ears === 'floppy') {
    return pair(
      `<path d="M98 35 Q84 38 85.5 58 Q87 67 94.5 63.5 Q98.5 51 105 39 Z" fill="${fur}" ${outline}/>`,
      `<path d="M126 34 Q141 36 142.5 55 Q142 64 135.5 61.5 Q132.5 49 124 39 Z" fill="${fur}" ${outline}/>`,
    );
  }
  if (sp.ears === 'long') {
    // Laid back so the tips stay inside the frame at the top of a hop.
    const ear = (x, y, angle) => `<g transform="rotate(${angle} ${x} ${y})"><ellipse cx="${x}" cy="${y - 13}" rx="6.4" ry="14" fill="${fur}" ${outline}/><ellipse cx="${x}" cy="${y - 12.5}" rx="3" ry="10" fill="${sp.earIn}"/></g>`;
    return pair(ear(104, 38, -46), ear(121, 37, -54));
  }
  if (sp.ears === 'none') return '';
  // Giraffe: small leaf ears sticking out sideways behind the ossicones.
  if (sp.ears === 'giraffe') {
    const ear = (x, y, angle) => `<g transform="rotate(${angle} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="8.5" ry="4" fill="${fur}" ${outline}/><ellipse cx="${x}" cy="${y}" rx="4.6" ry="1.8" fill="${sp.earIn}"/></g>`;
    return pair(ear(96, 40, -24), ear(134, 37, 20));
  }
  // Frog: the eyes sit in two bumps on top of the head, so they stay still with the ear angles.
  if (sp.ears === 'frog') {
    return sp.eyesAt.map(([x, y]) => `<circle cx="${x}" cy="${y - 1}" r="9.5" fill="${fur}" ${outline}/>`).join('');
  }
  if (sp.ears === 'monkey') {
    const ear = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${fur}" ${outline}/><circle cx="${x}" cy="${y}" r="5.4" fill="${sp.earIn}"/>`;
    return pair(ear(90, 56), ear(142.5, 54));
  }
  if (sp.ears === 'elephant') {
    return pair(
      `<path d="M102 39 C92 33 78 36 73 47 C70 54 72 60 70 66 C69 74 76 84 86 85 C95 86 101 80 102 72 C103 62 104 50 102 39 Z" fill="${fur}" ${outline}/>
       <path d="M98 45 C90 41 81 44 78 52 C76 58 78 63 77 68 C77 74 82 80 88 80 C94 80 97 75 98 69 C99 61 99 53 98 45 Z" fill="${sp.earIn}"/>`,
      '',
    );
  }
  if (sp.ears === 'tuft') {
    return pair(
      `<path d="M112 34 q-3 -8 2 -11 q0 6 3 10 M117 33 q1 -9 7 -9 q-3 4 -3 9" fill="${fur}" stroke="${C.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
      '',
    );
  }
  if (sp.ears === 'sheep') {
    const ear = (x, y, angle) => `<g transform="rotate(${angle} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="9.5" ry="4.8" fill="${fur}" ${outline}/><ellipse cx="${x}" cy="${y}" rx="5.5" ry="2.2" fill="${sp.earIn}"/></g>`;
    return pair(ear(91, 50, -22), ear(141, 48, 22));
  }
  return pair(
    `<path d="M93 47 L97 21 L115 35 Z" fill="${fur}" ${outline}/><path d="M98.5 40 L100 28 L108.5 35 Z" fill="${sp.earIn}"/>`,
    `<path d="M115 34 L134 19 L136 46 Z" fill="${fur}" ${outline}/><path d="M121 34 L131 27 L132 40 Z" fill="${sp.earIn}"/>`,
  );
};

const bumps = (points, radius, fill, stroked) => points
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${stroked ? radius : r(radius - SW / 2)}" fill="${fill}"${stroked ? ` ${outline}` : ''}/>`)
  .join('');

const MANE_POINTS = Array.from({ length: 13 }, (_, i) => {
  const angle = (i / 13) * Math.PI * 2;
  return [r(116 + Math.cos(angle) * 28), r(57 + Math.sin(angle) * 25)];
});
const HEAD_WOOL = [[103, 38], [111, 33.5], [120, 33], [128.5, 36.5]];

const drawMarking = (p, sp) => {
  if (sp.marking === 'cheekPouches') {
    const puff = 1 + p.cheek * .35;
    return `<ellipse cx="100.5" cy="67" rx="${r(9.5 * puff)}" ry="${r(7.4 * puff)}" fill="${sp.belly}" stroke="${C.line}" stroke-width="1.3" opacity=".95"/>
      <ellipse cx="136" cy="66" rx="${r(8.5 * puff)}" ry="${r(7 * puff)}" fill="${sp.belly}" stroke="${C.line}" stroke-width="1.3" opacity=".95"/>`;
  }
  if (sp.marking === 'raccoonMask') {
    return `<ellipse cx="108" cy="45.5" rx="6.2" ry="2.8" fill="${sp.muzzle}"/><ellipse cx="129" cy="44.5" rx="6" ry="2.8" fill="${sp.muzzle}"/>
      <path d="M93 57 C95 48 105 47.5 112 52 Q118.5 55 125 52 C132 47.5 141.5 48 141.5 57 C139 63.5 130 63 124.5 60 Q118.5 58 112.5 60 C106 63 95.5 63.5 93 57 Z" fill="${sp.pattern}"/>`;
  }
  if (sp.marking === 'pandaEyes') {
    return `<ellipse cx="107.5" cy="56" rx="6.8" ry="8.6" transform="rotate(28 107.5 56)" fill="${sp.pattern}"/>
      <ellipse cx="129.5" cy="56" rx="6.6" ry="8.4" transform="rotate(-28 129.5 56)" fill="${sp.pattern}"/>`;
  }
  if (sp.marking === 'penguinFace') {
    return `<ellipse cx="119" cy="61" rx="17" ry="14.5" fill="${sp.belly}"/>`;
  }
  if (sp.marking === 'monkeyFace') {
    return `<circle cx="109.5" cy="55" r="9" fill="${sp.belly}"/><circle cx="127.5" cy="55" r="9" fill="${sp.belly}"/>
      <ellipse cx="118.5" cy="66" rx="14" ry="10.5" fill="${sp.belly}"/>`;
  }
  if (sp.marking === 'cowPatch') {
    return `<ellipse cx="131" cy="41" rx="9.5" ry="7.5" transform="rotate(-20 131 41)" fill="${sp.pattern}"/>`;
  }
  if (sp.marking === 'tigerCheeks') {
    return `<path d="M90.5 57 l8 1.2 M90 62.5 l8 -.2 M142 56.5 l-7.5 1.2 M142.5 62 l-7.5 -.2" stroke="${sp.pattern}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  return '';
};

const drawForehead = (sp) => {
  if (sp.forehead === 'tabby') return `<path d="M110 35 v6.5 M116.5 33.6 v7.6 M123 35 v6.5" stroke="${sp.pattern}" stroke-width="3" stroke-linecap="round"/>`;
  if (sp.forehead === 'tiger') return `<path d="M109 37 h6.5 M107.5 42 h6.5 M116.5 34.5 v7.5 M118.5 37 h6.5 M120 42 h6.5" stroke="${sp.pattern}" stroke-width="2.6" stroke-linecap="round"/>`;
  return '';
};

const drawHead = (p, sp) => {
  const shift = -3 * p.faceTurn;
  const leftWhisker = 11 + 6 * p.faceTurn;
  const headFur = sp.headFur ?? sp.fur;
  return `
  ${sp.mane ? `${bumps(MANE_POINTS, 10, sp.mane, true)}<ellipse cx="116" cy="57" rx="28" ry="25" fill="${sp.mane}"/>` : ''}
  ${sp.horns ? `<path d="M106 38 q-3 -9 2 -13 q1 6 4 11 Z M124 36 q1 -10 7 -12 q-1 7 -2 12 Z" fill="${sp.horns}" ${outline}/>` : ''}
  ${sp.ossicones ? `<path d="M109 38 L107 27 M123 36 L124 25" stroke="${C.line}" stroke-width="6.4" stroke-linecap="round"/><path d="M109 38 L107 27 M123 36 L124 25" stroke="${sp.fur}" stroke-width="3.2" stroke-linecap="round"/><circle cx="107" cy="26" r="3.8" fill="${sp.ossicones}" ${outline}/><circle cx="124" cy="24" r="3.8" fill="${sp.ossicones}" ${outline}/>` : ''}
  ${sp.crest ? `<path d="M90 50 C91 38 99 31 110 30" fill="none" stroke="${C.line}" stroke-width="12" stroke-linecap="round"/><path d="M90 50 C91 38 99 31 110 30" fill="none" stroke="${sp.crest}" stroke-width="7.4" stroke-linecap="round"/><path d="M90 50 C91 38 99 31 110 30" fill="none" stroke="${sp.fur}" stroke-width="7.4" stroke-dasharray="2.6 3.4"/>` : ''}
  ${sp.spikes ? drawSpikes(HEAD_SPIKES, sp.spikes) : ''}
  ${sp.earsFront ? '' : drawEars(p, sp)}
  ${sp.snout ? drawSnoutBehind(sp) : ''}
  ${sp.headPath ? `<path d="${sp.headPath}" fill="${headFur}" ${outline}/>` : `<ellipse cx="116" cy="57" rx="27" ry="24" fill="${headFur}" ${outline}/>`}
  ${sp.earsFront ? drawEars(p, sp) : ''}
  ${sp.wool ? bumps(HEAD_WOOL, 6.5, sp.fur, true) : ''}
  ${drawForehead(sp)}
  <g transform="translate(${r(shift)} 0)">
    ${drawMarking(p, sp)}
    ${sp.muzzle ? `<ellipse cx="119" cy="68" rx="12" ry="7.5" fill="${sp.muzzle}"/>` : ''}
    ${drawEyes(p.eyes, sp)}
    ${sp.snout ? drawSnout(sp) : ''}
    ${sp.noseType === 'beak' ? drawBeak(p, sp) : sp.noseType === 'bill' ? drawBill(p, sp) : `${sp.snout ? '' : drawNose(sp)}${drawMouth(p, sp)}`}
    ${sp.noseType === 'trunk' ? drawTrunk(p, sp) : ''}
    <ellipse cx="101.5" cy="64" rx="4.4" ry="2.6" fill="${C.blush}" opacity="${r(p.blush)}"/>
    ${sp.snout ? '' : `<ellipse cx="136" cy="63.5" rx="4" ry="2.5" fill="${C.blush}" opacity="${r(p.blush)}"/>`}
    ${sp.whiskers && p.whiskers > .5 ? `<path d="M135 66 l13 -3 M135 69 l13 1.5 M101 67 l-${r(leftWhisker)} -1.5 M101 69.5 l-${r(leftWhisker * .8)} 1.8" stroke="${C.line}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` : ''}
  </g>`;
};

const drawSleepZ = (step) => {
  if (step < 0) return '';
  const z = (x, y, size, opacity) => `<path d="M${r(x)} ${r(y)} h${size} l-${size} ${r(size * 1.1)} h${size}" fill="none" stroke="${C.line}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="${r(opacity)}"/>`;
  return z(118 + step * 3, 60 - step * 7, 6, .35 + step * .2) + (step >= 2 ? z(130 + step * 2, 46 - step * 5, 8, .75) : '');
};

const BODY_WOOL = [[51, 74], [57, 64.5], [67, 59.5], [79, 58], [91, 58.5], [102, 61], [111, 67.5], [115, 78]];

const drawBodyPattern = (sp, clipId, body) => {
  if (sp.bodyPattern === 'tabby') {
    return `<path d="M67 61 q2.4 6 -1 11 M79 59.6 q2.4 6.6 -1 12 M91 60.4 q2.4 6 -1 10.6" fill="none" stroke="${sp.pattern}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (sp.bodyPattern === 'tiger') {
    return `<path d="M58 63.5 q3.4 6 -.6 12 M68.5 60 q3.4 7 -.6 13.5 M79 59 q3.4 7.4 -.6 14 M89.5 59.4 q3.4 7 -.6 13.5 M100 61.4 q3 6.4 -.8 11.6 M53 82 q4 3 2 9" fill="none" stroke="${sp.pattern}" stroke-width="4.2" stroke-linecap="round"/>`;
  }
  if (sp.bodyPattern === 'backStripe') {
    return `<path d="M52 70 C64 61 90 57 109 63" fill="none" stroke="${sp.pattern}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M53 75 C65 66.5 90 63 108 68" fill="none" stroke="${sp.belly}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (sp.bodyPattern === 'pandaBand') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}"><ellipse cx="100" cy="80" rx="15" ry="30" fill="${sp.pattern}"/></g></g>`;
  }
  if (sp.bodyPattern === 'cowSpots') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}" fill="${sp.pattern}">
      <ellipse cx="60" cy="68" rx="11" ry="9" transform="rotate(-20 60 68)"/><ellipse cx="86" cy="62" rx="9" ry="7"/>
      <ellipse cx="102" cy="86" rx="8" ry="6.5" transform="rotate(25 102 86)"/><ellipse cx="72" cy="90" rx="7" ry="5"/>
    </g></g>`;
  }
  if (sp.bodyPattern === 'shell') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}">
      <rect x="38" y="91" width="84" height="14" fill="${sp.rim}"/>
      <path d="M38 91 H122" stroke="${sp.pattern}" stroke-width="2.4"/>
      <path d="M66 62 L80 58 L94 62 L98 76 L80 82 L62 76 Z M66 62 L56 59 M94 62 L105 61 M62 76 L49 86 M98 76 L111 86 M80 82 L80 91 M56 59 L46 74 M105 61 L114 74"
        fill="none" stroke="${sp.pattern}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    </g></g>`;
  }
  if (sp.bodyPattern === 'giraffeSpots') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}" fill="${sp.pattern}" stroke="${sp.fur}" stroke-width="2.4" stroke-linejoin="round">
      <path d="M50 66 l9 -4 l6 6 l-3 9 l-10 1 Z"/><path d="M68 60 l11 -2 l4 8 l-6 7 l-10 -3 Z"/><path d="M87 60 l10 1 l3 9 l-8 5 l-7 -6 Z"/>
      <path d="M103 66 l9 2 l2 9 l-9 3 l-4 -7 Z"/><path d="M56 82 l10 -2 l5 8 l-7 6 l-9 -4 Z"/><path d="M75 79 l11 0 l3 9 l-9 5 l-7 -5 Z"/>
      <path d="M93 81 l10 0 l3 8 l-8 6 l-7 -5 Z"/>
    </g></g>`;
  }
  if (sp.bodyPattern === 'zebra') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}" fill="none" stroke="${sp.pattern}" stroke-width="4.4" stroke-linecap="round">
      <path d="M54 66 q6 10 0 22 M64 61 q6 12 -1 26 M74 59 q6 14 -1 30 M84 59 q6 14 -1 30 M94 60 q6 13 -1 28 M104 63 q5 10 -1 22 M47 78 q6 3 6 12"/>
    </g></g>`;
  }
  if (sp.bodyPattern === 'frogSpots') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}" fill="${sp.pattern}">
      <ellipse cx="62" cy="70" rx="5" ry="3.6"/><ellipse cx="80" cy="64" rx="4" ry="3"/><ellipse cx="96" cy="70" rx="4.6" ry="3.4"/><ellipse cx="72" cy="80" rx="3.4" ry="2.6"/>
    </g></g>`;
  }
  if (sp.bodyPattern === 'penguinFront') {
    return `<g clip-path="url(#${clipId})"><g transform="${body}"><ellipse cx="101" cy="86" rx="15" ry="22" fill="${sp.belly}"/></g></g>`;
  }
  return '';
};
const CLIPPED_PATTERNS = new Set(['pandaBand', 'cowSpots', 'penguinFront', 'shell', 'giraffeSpots', 'zebra', 'frogSpots']);

// Spikes stick out of an outline: each base point gets a triangle pointing away from `center`.
const drawSpikes = ({ center, points }, color) => points.map(([x, y]) => {
  const dx = x - center[0];
  const dy = y - center[1];
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  const tip = [x + ux * 9, y + uy * 9];
  return `<path d="M${r(x - uy * 4.5)} ${r(y + ux * 4.5)} L${r(tip[0])} ${r(tip[1])} L${r(x + uy * 4.5)} ${r(y - ux * 4.5)} Z" fill="${color}" stroke="${C.line}" stroke-width="2" stroke-linejoin="round"/>`;
}).join('');
const BODY_SPIKES = { center: [82, 84], points: [[49, 76], [52, 68], [58, 62], [66, 58.5], [74, 57], [82, 57], [90, 57.5], [98, 59], [106, 63]] };
const HEAD_SPIKES = { center: [116, 57], points: [[94, 44], [99, 38], [105, 34], [112, 32], [91, 52]] };

// Birds stand on two thin legs under a round body; the far legs are hidden.
const BIRD_LEG_PIVOTS = { near: [92, 98], back: [76, 98] };

// Frog hind foot: long and webbed, with three spread toes pointing forward along the ground.
const drawWebbedFoot = ([x, y], fill) => `<path d="M${r(x - 9)} ${r(y + 1)} C${r(x - 6)} ${r(y - 4)} ${r(x + 4)} ${r(y - 4)} ${r(x + 8)} ${r(y - 3)} L${r(x + 14)} ${r(y - 5)} L${r(x + 11)} ${r(y - 1)} L${r(x + 16)} ${r(y)} L${r(x + 11)} ${r(y + 2)} L${r(x + 14)} ${r(y + 4.4)} L${r(x + 6)} ${r(y + 3.4)} C${r(x)} ${r(y + 4.4)} ${r(x - 8)} ${r(y + 4.4)} ${r(x - 9)} ${r(y + 1)} Z" fill="${fill}" ${outline}/>`;

const drawCat = (pose, sp, id) => {
  const p = shapePose(pose, sp);
  const shape = shapeOf(sp);
  const bodyPath = sp.bodyPath ?? BODY_PATH;
  const hipNear = toWorld(p, ...(sp.bird ? BIRD_LEG_PIVOTS.back : [57, 90]));
  const hipFar = toWorld(p, 62, 88);
  const shoulderNear = toWorld(p, ...(sp.bird ? BIRD_LEG_PIVOTS.near : [98, 90]));
  const shoulderFar = toWorld(p, 104, 88);
  const neck = toWorld(p, 106, 70);
  const body = bodyTransform(p);
  const legFur = sp.legFur ?? sp.fur;
  const legFar = sp.legFar ?? sp.furFar;
  const haunchFur = sp.haunchFur ?? sp.fur;
  const haunchRy = 7 + 8 * p.fold;
  const haunchRx = 8 + 12 * p.fold;
  // A sitting animal's haunch rests on the ground; a crouching frog's thigh stays on its hip, so it
  // lifts with the body in a jump or a stretch instead of staying behind on the ground.
  const haunchRestY = sp.crouch ? Math.min(GROUND - 1 - haunchRy, hipNear[1] + 4) : GROUND - 1 - haunchRy;
  const haunch = [lerp(hipNear[0], hipNear[0] + 1, p.fold), lerp(hipNear[1], haunchRestY, p.fold)];
  // Parts appear outright rather than fading, so in-between frames have no ghost shapes.
  const showHaunch = p.fold > .2 && !sp.bird;
  const showHindPaw = p.fold > .7 && !sp.bird;
  const showChest = p.fold > .5 && !p.tailFront && !sp.bird;
  const pawOverHead = p.pawOverHead && !sp.bird;
  // A bird lying down sits on its legs, so none show.
  const birdTucked = sp.bird && p.bdy > 12;
  const hindPaw = [haunch[0] + haunchRx * .72, sp.crouch ? Math.min(GROUND - 4.2, haunch[1] + haunchRy - 3) : GROUND - 4.2];
  const clipId = `body-${id}`;
  const frontLegPose = p.pawOverHead && sp.bird ? { ...p.nf, a: 0, reach: 1 } : p.nf;
  const frontLeg = drawLeg(shoulderNear, frontLegPose, legFur, p.lw, sp);
  const headScale = shape.head === 1 ? '' : ` translate(106 70) scale(${shape.head}) translate(-106 -70)`;
  const headX = neck[0] - 106 + p.hdx + shape.headShift[0];
  const headY = neck[1] - 70 + p.hdy + shape.headShift[1];
  const head = `<g transform="translate(${r(headX)} ${r(headY)}) rotate(${r(p.hrot)} 112 70)${headScale}">${drawHead(p, sp)}</g>`;
  // A neck from the body to the head, for animals whose head sits out in front (turtle) or up high
  // (giraffe, whose long neck carries the body's spots).
  const neckSpec = sp.neck === true ? { from: [100, 84], width: 15 } : sp.neck;
  const neckFrom = neckSpec ? toWorld(p, ...neckSpec.from) : null;
  const neckPath = neckFrom ? `M${r(neckFrom[0])} ${r(neckFrom[1])} L${r(110 + headX)} ${r(68 + headY)}` : '';
  const neckFur = sp.headFur ?? sp.fur;
  const neckShape = neckFrom
    ? `<path d="${neckPath}" stroke="${C.line}" stroke-width="${neckSpec.width}" stroke-linecap="round"/><path d="${neckPath}" stroke="${neckFur}" stroke-width="${r(neckSpec.width - 5.4)}" stroke-linecap="round"/>
      ${neckSpec.spots ? `<path d="${neckPath}" stroke="${neckSpec.spots}" stroke-width="${r(neckSpec.width - 11)}" stroke-dasharray="4 6" stroke-dashoffset="-3"/>` : ''}`
    : '';
  const striped = sp.bodyPattern === 'tabby' || sp.bodyPattern === 'tiger' || sp.bodyPattern === 'zebra';
  const wing = sp.bird
    ? `<g transform="rotate(${r(-55 * p.wing)} 92 74)"><path d="M92 74 C84 70 66 72 64 84 C70 90 86 90 94 82 Z" fill="${sp.furFar}" ${outline}/></g>`
    : '';
  // Legs sit behind the body so its outline crosses the top of each leg; near legs are lighter.
  return `
  <clipPath id="${clipId}"><path d="${bodyPath}" transform="${body}"/></clipPath>
  <g transform="rotate(${r(p.frameRot)} ${r(p.fcx)} ${r(p.fcy)})">
    ${sp.bird ? '' : drawLeg(shoulderFar, p.ff, legFar, p.lw, sp)}
    ${sp.bird ? '' : drawLeg(hipFar, p.fb, legFar, p.lw, sp)}
    ${p.tailFront ? '' : drawTail(p, sp)}
    ${p.hindOverHead || birdTucked ? '' : drawLeg(hipNear, p.nb, legFur, p.lw, sp)}
    ${pawOverHead || birdTucked ? '' : frontLeg}
    ${neckShape}
    ${p.headBehind ? head : ''}
    <g transform="${body}">${sp.wool ? bumps(BODY_WOOL, 8, sp.fur, true) : ''}${sp.spikes ? drawSpikes(BODY_SPIKES, sp.spikes) : ''}</g>
    <path d="${bodyPath}" transform="${body}" fill="${sp.fur}" ${outline} vector-effect="non-scaling-stroke"/>
    ${CLIPPED_PATTERNS.has(sp.bodyPattern) ? drawBodyPattern(sp, clipId, body) : ''}
    <g transform="${body}">
      ${sp.wool ? bumps(BODY_WOOL, 8, sp.fur, false) : ''}
      ${sp.belly !== sp.fur ? `<ellipse cx="84" cy="${sp.bird ? 95 : 92}" rx="${sp.bird ? 16 : 21}" ry="5.5" fill="${sp.belly}"/>` : ''}
      ${CLIPPED_PATTERNS.has(sp.bodyPattern) ? '' : drawBodyPattern(sp, clipId, body)}
      ${wing}
    </g>
    ${showHindPaw && !sp.crouch ? `<ellipse cx="${r(hindPaw[0])}" cy="${r(hindPaw[1])}" rx="8.5" ry="4.4" fill="${legFur}" ${outline}/>
      <path d="M${r(hindPaw[0] + 3)} ${r(hindPaw[1] + 1.5)} v-2.6 M${r(hindPaw[0] + 6)} ${r(hindPaw[1] + 1)} v-2.4" stroke="${C.line}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>` : ''}
    ${showHaunch ? `<ellipse cx="${r(haunch[0])}" cy="${r(haunch[1])}" rx="${r(haunchRx)}" ry="${r(haunchRy)}" fill="${haunchFur}" ${outline}/>
      ${striped ? `<path d="M${r(haunch[0] - 8)} ${r(haunch[1] - haunchRy * .55)} q5 3 4 ${r(haunchRy * .65)} M${r(haunch[0] - 1)} ${r(haunch[1] - haunchRy * .7)} q4 3 3 ${r(haunchRy * .55)}" fill="none" stroke="${sp.pattern}" stroke-width="3.4" stroke-linecap="round"/>` : ''}` : ''}
    ${showHindPaw && sp.crouch ? drawWebbedFoot(hindPaw, legFur) : ''}
    ${showChest && sp.belly !== sp.fur ? `<ellipse cx="${r(shoulderNear[0] + 3)}" cy="${r(shoulderNear[1] - 5)}" rx="7.5" ry="11" fill="${sp.belly}"/>` : ''}
    ${p.tailFront ? drawTail(p, sp) : ''}
    ${p.headBehind ? '' : head}
    ${pawOverHead ? frontLeg : ''}
    ${p.hindOverHead ? drawLeg(hipNear, p.nb, legFur, p.lw, sp) : ''}
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
  // Bounding run: front legs move together and back legs together (half a cycle apart), the body
  // rocks and lifts, the ears fold back and the tail streams behind. Same stance rule as walk.
  run: Array.from({ length: 8 }, (_, i) => {
    const phase = (i / 8) * tau;
    const leg = (offset, spread = 0) => ({
      a: -34 * Math.sin(phase + offset) + spread,
      lift: Math.max(0, Math.cos(phase + offset)) * 7,
    });
    const squash = Math.cos(phase * 2);
    return pose(STAND, {
      bdy: -2 - 2.6 * Math.abs(Math.sin(phase)),
      brot: 4 * Math.sin(phase),
      bsx: 1 + .04 * squash, bsy: 1 - .04 * squash,
      nf: leg(0), ff: leg(.45, 4), nb: leg(Math.PI), fb: leg(Math.PI + .45, -4),
      trot: -16 + 6 * Math.sin(phase), tflick: 4 * Math.sin(phase + 1),
      earL: -9, earR: 9,
      hdy: 1.6 * Math.cos(phase * 2 + .4),
    });
  }),
  // Turns to face the viewer, then looks up and flicks an ear.
  lookAround: Array.from({ length: 8 }, (_, i) => pose(STAND, {
    faceTurn: [0, .5, 1, 1, 1, .5, 0, 0][i],
    hdx: [0, -2, -4, -4, -4, -2, 0, 0][i],
    hrot: [0, 0, -2, -2, -8, -6, -3, 0][i],
    eyes: i === 3 ? 'blink' : 'open',
    earL: [0, 0, 0, 0, -6, -2, 0, 0][i], earR: [0, 0, 0, 0, 10, 4, 0, 0][i],
    trot: wave(i, 8) * 5,
  })),
  // Curious head tilt to one side, then the other.
  tilt: Array.from({ length: 6 }, (_, i) => pose(STAND, {
    hrot: [0, 9, 11, -9, -10, 0][i],
    hdy: [0, -.5, -.5, -.5, -.5, 0][i],
    earL: [0, -8, -8, 6, 6, 0][i], earR: [0, 8, 8, -6, -6, 0][i],
    eyes: i === 0 || i === 5 ? 'open' : 'wide',
  })),
  // Sitting, the near hind paw comes up and scratches the cheek fast, head leaning into it.
  scratch: Array.from({ length: 8 }, (_, i) => {
    const up = i > 0 && i < 7;
    return pose(SIT, {
      nb: up ? { a: i % 2 === 1 ? -150 : -140, len: 32, reach: 0 } : { a: i === 7 ? -60 : 0, len: i === 7 ? 18 : 4, reach: 0 },
      hindOverHead: up || i === 7,
      hdx: up ? -11 : -3, hdy: up ? 11 : 1, hrot: up ? 22 : 0,
      eyes: up ? 'squeeze' : 'open',
      yawn: up ? .12 : 0,
      earL: up ? (i % 2 ? -6 : 4) : 0, earR: up ? (i % 2 ? 6 : -4) : 0,
    });
  }),
  // Startled by a touch: flinch, jump with wide eyes, ears flat and tail up, land ready to run.
  startle: [
    { bdy: 3, bsy: .92, bsx: 1.05, nf: { a: 8 }, ff: { a: 8 }, nb: { a: -8 }, fb: { a: -8 }, earL: -14, earR: 14, wUp: .5, wHigh: .5 },
    {
      bdy: -10, bsy: 1.08, bsx: .96, ...legs({ len: 24, reach: 0 }),
      nf: { a: -24 }, ff: { a: -20 }, nb: { a: 24 }, fb: { a: 20 },
      earL: -18, earR: 18, wUp: 0, wHigh: 1, yawn: .2,
    },
    {
      bdy: -6, ...legs({ len: 26, reach: 0 }),
      nf: { a: -14 }, ff: { a: -12 }, nb: { a: 16 }, fb: { a: 14 },
      earL: -16, earR: 16, wUp: 0, wHigh: 1,
    },
    { bdy: 3, bsy: .92, bsx: 1.04, nf: { a: 6 }, ff: { a: 6 }, nb: { a: -6 }, fb: { a: -6 }, earL: -12, earR: 12, wUp: .3, wHigh: .7 },
  ].map((overrides) => pose(STAND, { eyes: 'wide', ...overrides })),
  // Lying flat with front legs stretched forward and hind legs stretched back, then tucking in.
  sploot: (() => {
    const flat = pose(LOAF, {
      eyes: 'open', whiskers: 1, fold: .3, hdx: -10, hrot: 5,
      nf: { a: -82, len: 26, reach: 0 }, ff: { a: -80, len: 24, reach: 0 },
      nb: { a: 82, len: 28, reach: 0 }, fb: { a: 80, len: 26, reach: 0 },
    });
    const tucked = pose(LOAF, { eyes: 'open', whiskers: 1 });
    return [
      tucked, lerpPose(tucked, flat, .5),
      ...[0, 1, 2, 3].map((i) => pose(flat, {
        bsy: .96 + breath(i, 4) * .04,
        eyes: ['open', 'blink', 'happy', 'open'][i],
        tflick: wave(i, 4) * 4,
      })),
      lerpPose(flat, tucked, .5), pose(tucked, { eyes: 'blink' }),
    ];
  })(),
};


// ---- Signature moves ------------------------------------------------------------------------
// One per species, in the `trick` (standing) or `trickSit` (sitting) row named by PET_TRICKS.
// Every move starts and ends in the row's resting pose so the engine can enter and leave it.
const eight = (frame) => Array.from({ length: 8 }, (_, i) => frame(i));
const at = (values, i) => values[i];
const crouch = { bdy: 4, nf: { a: 6 }, ff: { a: 6 }, nb: { a: -6 }, fb: { a: -6 } };
const airborne = (len, nf, ff, nb, fb) => ({
  nf: { a: nf, len, reach: 0 }, ff: { a: ff, len, reach: 0 }, nb: { a: nb, len, reach: 0 }, fb: { a: fb, len, reach: 0 },
});

const TRICK_FRAMES = {
  // 꾹꾹이: front paws knead in turn, eyes squeezed happy.
  cat: () => eight((i) => pose(STAND, {
    bdy: .6,
    nf: { a: i % 2 === 0 ? -10 : 0, lift: i % 2 === 0 ? 4 : 0 },
    ff: { a: i % 2 === 1 ? -10 : 0, lift: i % 2 === 1 ? 4 : 0 },
    hdy: i % 2 === 0 ? 1 : 0,
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .85,
    trot: wave(i, 8) * 5, bsy: 1 + breath(i, 8) * .03,
  })),
  // Tail wagging hard, panting with the tongue out.
  dog: () => eight((i) => pose(STAND, {
    wUp: i === 0 || i === 7 ? .5 : 0, wHigh: i === 0 || i === 7 ? .5 : 1,
    trot: at([-6, 20, -20, 22, -22, 20, -12, 0], i), tflick: at([0, 8, -8, 8, -8, 8, -4, 0], i),
    yawn: i === 0 || i === 7 ? 0 : .32,
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .75,
    bdy: at([0, -1, 0, -1, 0, -1, 0, 0], i), hdy: at([0, 1, 0, 1, 0, 1, 0, 0], i),
  })),
  // Two quick hops with the ears flopping back.
  rabbit: () => [
    crouch,
    { bdy: -9, ...airborne(26, -20, -16, 24, 20) },
    { bdy: -12, ...airborne(20, -28, -24, 28, 26) },
    { bdy: 3 },
    { bdy: -9, ...airborne(26, -20, -16, 24, 20) },
    { bdy: -12, ...airborne(20, -28, -24, 28, 26) },
    { bdy: 3 },
    {},
  ].map((overrides, i) => pose(pose(STAND, overrides), {
    earL: at([0, -8, -12, -4, -8, -12, -4, 0], i), earR: at([0, -6, -10, -3, -6, -10, -3, 0], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .7,
  })),
  // Wings flapping with little chirps.
  chick: () => eight((i) => pose(STAND, {
    wing: at([0, 1, .2, 1, .2, 1, .3, 0], i),
    bdy: at([0, -3, -1, -4, -1, -3, 0, 0], i),
    yawn: at([0, .4, .1, .5, .1, .4, 0, 0], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .75,
  })),
  // Mouse pounce: crouch, wiggle, leap, then dive nose-first into the ground.
  fox: () => [
    { ...crouch, bdy: 5, brot: 4, hdy: 3, tflick: 6, wUp: .6, wHigh: .4 },
    { ...crouch, bdy: 6, brot: 5, hdy: 3, tflick: -6, wUp: .6, wHigh: .4 },
    { bdy: -2, brot: -14, ...airborne(26, -30, -26, 30, 26), wUp: 0, wHigh: 1 },
    { bdy: -10, brot: -2, ...airborne(22, -20, -18, 26, 24), wUp: 0, wHigh: 1 },
    { bdy: -8, brot: 12, ...airborne(26, -40, -36, 20, 18), hrot: 7, wUp: 0, wHigh: 1 },
    { bdy: 3, brot: 14, hrot: 12, hdy: 3, eyes: 'squeeze', wUp: .3, wHigh: .7 },
    { bdy: 1, brot: 6, eyes: 'happy', wUp: .6, wHigh: .4 },
    {},
  ].map((overrides) => pose(STAND, { eyes: 'wide', ...overrides })),
  // Paw at the mouth, cheeks puffing up while munching.
  hamster: () => eight((i) => pose(SIT, {
    nf: i === 0 || i === 7 ? { a: -3 } : { a: -150, len: 21, reach: 0 },
    pawOverHead: i > 0 && i < 7,
    cheek: at([0, .3, .6, 1, .8, 1, .7, .2], i),
    hdy: at([1, 2, 2.5, 2, 2.5, 2, 2, 1], i),
    yawn: at([0, 0, .14, 0, .14, 0, .14, 0], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .8,
  })),
  // Tail flicked up and shivering while looking around.
  squirrel: () => eight((i) => pose(SIT, {
    wGround: at([.5, 0, 0, 0, 0, 0, 0, .5], i), wHigh: at([.5, 1, 1, 1, 1, 1, 1, .5], i),
    tflick: at([0, 10, -8, 10, -8, 10, -4, 0], i), trot: at([0, 4, -4, 4, -4, 2, 0, 0], i),
    hrot: at([0, 6, -6, 6, -4, 0, 0, 0], i), earR: at([0, 0, 0, 14, 0, 0, 0, 0], i),
  })),
  // Rubbing the front paws together, as if washing them.
  raccoon: () => eight((i) => pose(SIT, {
    nf: { a: at([-3, -62, -48, -62, -48, -62, -48, -3], i), len: i === 0 || i === 7 ? 26 : 20, reach: i === 0 || i === 7 ? 1 : 0 },
    ff: { a: at([-3, -50, -60, -50, -60, -50, -60, -3], i), len: i === 0 || i === 7 ? 26 : 19, reach: i === 0 || i === 7 ? 1 : 0 },
    pawOverHead: i > 0 && i < 7,
    hrot: i === 0 || i === 7 ? 0 : 8, hdy: i === 0 || i === 7 ? 1 : 2,
  })),
  // Rocking side to side on its bottom.
  panda: () => eight((i) => pose(SIT, {
    frameRot: at([-5, -10, -5, 0, 5, 10, 5, 0], i), fcx: 70, fcy: 118,
    hrot: at([4, 7, 4, 0, -4, -7, -4, 0], i),
    eyes: i === 7 ? 'open' : 'happy', blush: .8,
  })),
  // Nodding off, then waking with a start.
  koala: () => eight((i) => pose(SIT, {
    hrot: at([0, 6, 12, 18, 22, -4, 0, 0], i), hdy: at([1, 2, 3, 4, 5, 0, 1, 1], i),
    eyes: at(['open', 'blink', 'closed', 'closed', 'closed', 'wide', 'open', 'blink'], i),
  })),
  // Nose to the ground, sniffing with the tail wiggling.
  pig: () => eight((i) => pose(STAND, {
    hdy: at([1, 4, 6, 6, 6, 6, 4, 1], i), hdx: at([0, 2, 3, 3, 3, 3, 2, 0], i),
    hrot: at([4, 12, 16, 14, 16, 14, 10, 2], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy',
    trot: wave(i, 8) * 16, bdy: .5,
  })),
  // Stiff-legged spring into the air, twice.
  sheep: () => [
    crouch,
    { bdy: -8, ...airborne(26, 0, 0, 0, 0) },
    { bdy: -12, ...airborne(26, -4, -4, 4, 4) },
    { bdy: -6, ...airborne(26, 0, 0, 0, 0) },
    { bdy: 2 },
    { bdy: -8, ...airborne(26, 0, 0, 0, 0) },
    { bdy: -11, ...airborne(26, -4, -4, 4, 4) },
    {},
  ].map((overrides, i) => pose(pose(STAND, overrides), {
    earL: at([0, -10, -14, -8, 0, -10, -14, 0], i), earR: at([0, 10, 14, 8, 0, 10, 14, 0], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .7,
  })),
  // Rearing up on one paw for a big roar.
  tiger: () => eight((i) => pose(STAND, {
    brot: at([-2, -5, -8, -8, -8, -6, -3, 0], i),
    hrot: at([-2, -5, -8, -9, -9, -6, -2, 0], i),
    yawn: at([0, .4, .8, 1, 1, .7, .3, 0], i),
    eyes: at(['open', 'squeeze', 'squeeze', 'squeeze', 'squeeze', 'squeeze', 'open', 'open'], i),
    nf: {
      a: at([0, -25, -55, -65, -65, -45, -15, 0], i),
      len: at([26, 24, 22, 22, 22, 22, 24, 26], i),
      reach: i === 0 || i === 7 ? 1 : 0,
    },
    earL: at([0, -5, -10, -12, -12, -8, -3, 0], i), earR: at([0, 5, 10, 12, 12, 8, 3, 0], i),
    wUp: .4, wHigh: .6,
  })),
  // Waddling from foot to foot with the flippers out.
  penguin: () => eight((i) => pose(STAND, {
    frameRot: at([-7, 0, 7, 0, -7, 0, 7, 0], i), fcx: 84, fcy: 118,
    wing: at([.45, .2, .45, .2, .45, .2, .45, 0], i),
    bdy: at([0, -1.5, 0, -1.5, 0, -1.5, 0, 0], i),
    eyes: i === 7 ? 'open' : 'happy', blush: .7,
  })),
  // Head up for a long moo.
  cow: () => eight((i) => pose(STAND, {
    hrot: at([-4, -8, -10, -10, -8, -4, -2, 0], i),
    yawn: at([0, .4, .8, 1, .9, .6, .2, 0], i),
    eyes: at(['open', 'closed', 'closed', 'closed', 'closed', 'closed', 'open', 'open'], i),
    earL: at([0, -6, -10, -6, -10, -6, 0, 0], i), earR: at([0, 6, 10, 6, 10, 6, 0, 0], i),
    tflick: at([0, 6, -6, 6, -6, 4, 0, 0], i),
  })),
  // Clapping the front paws and laughing.
  monkey: () => eight((i) => pose(SIT, {
    nf: i === 0 || i === 7 ? { a: -3 } : { a: at([0, -72, -42, -72, -42, -72, -42, 0], i), len: 20, reach: 0 },
    ff: i === 0 || i === 7 ? { a: -3 } : { a: at([0, -42, -72, -42, -72, -42, -72, 0], i), len: 19, reach: 0 },
    pawOverHead: i > 0 && i < 7,
    yawn: i === 0 || i === 7 ? 0 : .3,
    hdy: at([1, 0, 1.5, 0, 1.5, 0, 1.5, 1], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .75,
  })),
  // Curling up into a spiky ball, rocking, then uncurling.
  hedgehog: () => {
    const ball = pose(STAND, {
      bdy: 8, bsx: .86, bsy: 1.04, ...legs({ len: 4, reach: 0 }),
      hdx: -18, hdy: 11, hrot: 30, eyes: 'closed', whiskers: 0,
    });
    return [
      pose(STAND, { bdy: 3, eyes: 'wide' }),
      lerpPose(STAND, ball, .55),
      ...[-6, 6, -6, 6].map((frameRot) => pose(ball, { frameRot, fcx: 80, fcy: 104 })),
      lerpPose(ball, STAND, .55),
      pose(STAND, { eyes: 'blink' }),
    ];
  },
  // Raising the trunk and spraying water.
  elephant: () => eight((i) => pose(STAND, {
    trunk: at([0, .4, .8, 1, 1, 1, .6, 0], i),
    spray: at([0, 0, 0, .4, .8, 1, .4, 0], i),
    hrot: at([0, -3, -5, -6, -6, -5, -3, 0], i),
    eyes: at(['open', 'open', 'happy', 'happy', 'happy', 'happy', 'open', 'open'], i),
    earL: at([0, -8, 4, -8, 4, -8, 0, 0], i),
  })),
  // Pulling head and legs into the shell, wobbling there, then peeking back out.
  turtle: () => {
    const hidden = (frameRot) => pose(STAND, {
      headBehind: true, hdx: -26, hdy: 5, bdy: 4, ...legs({ len: 3, reach: 0 }),
      frameRot, fcx: 80, fcy: 112, eyes: 'closed',
    });
    return [
      pose(STAND, { eyes: 'wide' }),
      pose(STAND, { hdx: -12, hdy: 2, bdy: 2, eyes: 'blink' }),
      hidden(-2), hidden(2), hidden(-2), hidden(2),
      pose(STAND, { hdx: -12, hdy: 3, bdy: 2, eyes: 'open' }),
      pose(STAND, { eyes: 'happy', blush: .75 }),
    ];
  },
  // Quacking with the wings flapping and the tail feathers wiggling.
  duck: () => eight((i) => pose(STAND, {
    wing: at([0, .9, .2, .9, .2, .9, .2, 0], i),
    bdy: at([0, -2, 0, -2, 0, -2, 0, 0], i),
    yawn: at([0, .6, 0, .6, 0, .6, 0, 0], i),
    trot: at([0, 8, -8, 8, -8, 8, -4, 0], i),
    eyes: i === 0 || i === 7 ? 'open' : 'happy', blush: .75,
  })),
  // A big leap out of the crouch, all four legs flung out, cheering in the air.
  frog: () => frogHop(1.5, true),
  // Swinging the long neck from side to side, then a lick of the long tongue.
  giraffe: () => eight((i) => pose(STAND, {
    hdx: at([0, -3, -6, -3, 0, 2, 0, 0], i),
    hdy: at([0, 2, 4, 2, 0, -1, 0, 0], i),
    hrot: at([0, -6, -10, -6, 2, 6, 2, 0], i),
    tongue: i === 5 || i === 6 ? 1 : 0,
    eyes: i >= 3 && i <= 6 ? 'happy' : 'open', blush: .7,
    trot: wave(i, 8) * 6,
  })),
  // A playful buck: weight onto the front legs and both hind legs kicked out behind.
  zebra: () => [
    pose(STAND, {}),
    pose(STAND, { brot: 6, bdy: 1, nf: { a: 6 }, ff: { a: 6 }, hdy: 2 }),
    pose(STAND, { brot: 10, bdy: -2, nf: { a: 10 }, ff: { a: 10 }, nb: { a: 40, lift: 6 }, fb: { a: 34, lift: 6 }, hdy: 4, wHigh: 1, wUp: 0, eyes: 'squeeze' }),
    pose(STAND, { brot: 11, bdy: -3, nf: { a: 10 }, ff: { a: 10 }, nb: { a: 50, lift: 8 }, fb: { a: 44, lift: 8 }, hdy: 4, wHigh: 1, wUp: 0, eyes: 'squeeze' }),
    pose(STAND, { brot: 8, bdy: 0, nf: { a: 6 }, ff: { a: 6 }, nb: { a: 20, lift: 4 }, fb: { a: 16, lift: 4 }, hdy: 2, ...HAPPY_FACE }),
    pose(STAND, { brot: 2, ...HAPPY_FACE }),
    pose(STAND, { ...HAPPY_FACE, earL: -6, earR: 6 }),
    pose(STAND, {}),
  ],
  // Shaking the mane from side to side.
  lion: () => eight((i) => pose(STAND, {
    hrot: at([0, -12, 12, -12, 12, -8, 4, 0], i),
    eyes: at(['open', 'squeeze', 'squeeze', 'squeeze', 'squeeze', 'closed', 'happy', 'open'], i),
    tflick: at([0, 6, -6, 6, -6, 4, 0, 0], i), trot: at([0, 4, -4, 4, -4, 2, 0, 0], i),
  })),
};

// The row a species does not use is filled with resting frames; the engine never plays it.
// ---- Species-specific replacements -----------------------------------------------------------
// A species can replace shared rows that would look wrong on its body. The turtle never sits:
// wherever others sit or lie down, it pulls head and legs into its shell and rests there.
const turtleRest = pose(STAND, {
  bdy: 5, ...legs({ len: 3, reach: 0 }), headBehind: true, hdx: -24, hdy: 5, eyes: 'closed', whiskers: 0,
});
const turtlePeek = pose(STAND, { bdy: 4, ...legs({ len: 3, reach: 0 }), hdx: -9, hdy: 4 });
const turtleSun = pose(STAND, {
  bdy: 5,
  nf: { a: -78, len: 16, reach: 0 }, ff: { a: -74, len: 15, reach: 0 },
  nb: { a: 78, len: 16, reach: 0 }, fb: { a: 74, len: 15, reach: 0 },
  hdx: 2, hdy: 7, eyes: 'happy', blush: .75,
});
const restBreath = (n, extra = () => ({})) => Array.from({ length: n }, (_, i) => pose(turtleRest, {
  bsy: 1 + breath(i, n) * .02, ...extra(i),
}));
const peekAndHide = (middle) => [
  turtleRest, lerpPose(turtleRest, turtlePeek, .5), turtlePeek,
  ...middle,
  lerpPose(turtlePeek, turtleRest, .5), turtleRest,
];
// Crawl: diagonal legs step together in short, low strokes; the shell barely rocks while the head
// nods forward with each step. Used for the walk and for the slow getaway after a fright.
const turtleCrawl = Array.from({ length: 8 }, (_, i) => {
  const phase = (i / 8) * tau;
  const leg = (offset) => ({ a: -14 * Math.sin(phase + offset), lift: Math.max(0, Math.cos(phase + offset)) * 2.5, reach: 0 });
  return pose(STAND, {
    bdy: 1 + .5 * Math.cos(phase * 2),
    brot: .8 * Math.sin(phase),
    nf: leg(0), fb: leg(0), ff: leg(Math.PI), nb: leg(Math.PI),
    hdx: 1.5 * Math.cos(phase * 2),
    hdy: .6 * Math.cos(phase * 2 + .5),
  });
});
// ---- Gaits ----------------------------------------------------------------------------------
// One walk cycle of 8 frames, tuned per animal. Same stance rule as the shared walk: a paw lifts
// only while it swings forward. `pairs`: diagonal (trot), lateral (same-side legs together, the
// heavy amble of an elephant) or bound (fronts together, backs together, as squirrels move).
const gait = ({
  swing = 24, lift = 5, bob = 1.2, pairs = 'diagonal', roll = 0, nod = 0, headBob = 1, low = 0,
  tail = 6, wag = 0, ears = 0, squash = 0, extra = () => ({}),
} = {}) => Array.from({ length: 8 }, (_, i) => {
  const phase = (i / 8) * tau;
  const leg = (offset) => ({ a: -swing * Math.sin(phase + offset), lift: Math.max(0, Math.cos(phase + offset)) * lift });
  const [nf, ff, nb, fb] = {
    diagonal: [0, Math.PI, Math.PI, 0],
    lateral: [0, Math.PI, 0, Math.PI],
    bound: [0, .45, Math.PI, Math.PI + .45],
  }[pairs].map(leg);
  const beat = Math.cos(phase * 2);
  return pose(STAND, {
    bdy: low + (pairs === 'bound' ? -bob * Math.abs(Math.sin(phase)) : bob * beat),
    brot: roll * Math.sin(phase),
    bsx: 1 + squash * beat, bsy: 1 - squash * beat,
    nf, ff, nb, fb,
    hdx: nod * beat,
    hdy: low * .6 + headBob * Math.cos(phase * 2 + .5),
    trot: tail * Math.sin(phase), tflick: wag * Math.sin(phase * 2),
    earL: -ears * beat, earR: ears * beat,
    ...extra(i, phase),
  });
});

// Rabbit: gathers, pushes off with both hind legs, sails, lands on the front paws and brings the
// hind legs up under itself again. `height` scales the hop (the run hops higher and longer).
const rabbitHop = (height) => [
  { bdy: 3, brot: 0, f: 6, b: -10, bLen: 20, lf: 0, lb: 0, ear: 0 },
  { bdy: -2, brot: -10, f: -20, b: 30, bLen: 26, lf: 2, lb: 0, ear: -4 },
  { bdy: -8, brot: -5, f: -30, b: 36, bLen: 26, lf: 4, lb: 2, ear: -8 },
  { bdy: -10, brot: 2, f: -22, b: 24, bLen: 24, lf: 4, lb: 4, ear: -8 },
  { bdy: -5, brot: 9, f: -6, b: 12, bLen: 24, lf: 0, lb: 6, ear: -4 },
  { bdy: 1, brot: 4, f: 6, b: -14, bLen: 22, lf: 0, lb: 5, ear: 2 },
  { bdy: 4, brot: 0, f: 8, b: -14, bLen: 20, lf: 0, lb: 0, ear: 3 },
  { bdy: 3, brot: 0, f: 7, b: -12, bLen: 20, lf: 0, lb: 0, ear: 1 },
].map(({ bdy, brot, f, b, bLen, lf, lb, ear }, i) => pose(STAND, {
  bdy: bdy > 0 ? bdy : bdy * height, brot,
  nf: { a: f, lift: lf }, ff: { a: f + 4, lift: lf },
  nb: { a: b, len: bLen, lift: lb }, fb: { a: b - 4, len: bLen, lift: lb },
  earL: ear * height, earR: -ear * height,
  trot: 4 * Math.sin((i / 8) * tau),
}));

// Sheep run: a stiff-legged pronk, all four legs straight as it springs up together.
const sheepPronk = Array.from({ length: 8 }, (_, i) => {
  const up = Math.sin((i / 8) * Math.PI);
  return pose(STAND, {
    bdy: 3 - 13 * up, brot: 3 * Math.sin((i / 8) * tau),
    nf: { a: -8 - 6 * up, lift: 6 * up }, ff: { a: -4 - 6 * up, lift: 6 * up },
    nb: { a: 8 + 6 * up, lift: 6 * up }, fb: { a: 4 + 6 * up, lift: 6 * up },
    bsx: 1 - .03 * up, bsy: 1 + .03 * up,
    earL: -6 * up, earR: 6 * up,
  });
});

// The turtle, koala, penguin and elephant never break into a run: they get away at a brisk
// version of their own walk, so the run row repeats it with a little more effort.
const penguinWaddle = gait({ swing: 10, lift: 2, bob: 1.6, roll: 6, headBob: .8, tail: 2, extra: (i, phase) => ({ wing: .18 + .14 * Math.sin(phase) }) });
const elephantStomp = gait({ swing: 16, lift: 5, bob: .9, pairs: 'lateral', roll: 1.2, nod: 1, headBob: .8, tail: 7, wag: 4, ears: 5, squash: .02, extra: (i, phase) => ({ trunk: .12 + .1 * Math.sin(phase * 2 + 1) }) });
const koalaClamber = gait({ swing: 16, lift: 3, bob: 1.6, roll: 2, headBob: 1.2, low: 2, tail: 0 });

// A frog never stands on four straight legs: at rest it crouches with the hind legs folded beside
// the body, the body sloping up to the head, and short front legs propping up the chest.
const FROG_HIND = { a: 0, len: 4, reach: 0, lift: 0 };
const frogify = (p) => {
  const standing = 1 - Math.min(1, p.fold);
  return pose(p, {
    fold: 1, lw: 15,
    brot: p.brot - 14 * standing,
    bdy: p.bdy + 6 * standing,
    nb: standing > .5 ? FROG_HIND : p.nb, fb: standing > .5 ? FROG_HIND : p.fb,
    nf: { len: Math.min(p.nf.len, 20) }, ff: { len: Math.min(p.ff.len, 20) },
  });
};
const FROG_CROUCH = frogify(STAND);
// One hop: gather, push off with the hind legs straightening out behind, sail, land on the front
// paws, and fold back into the crouch. `height` scales the jump; `cheer` adds a happy face in the air.
const frogHop = (height, cheer = false) => {
  const air = cheer ? HAPPY_FACE : {};
  const kick = (a, len, lift = 0) => ({ a, len, reach: 0, lift });
  return [
    FROG_CROUCH,
    pose(FROG_CROUCH, { bdy: FROG_CROUCH.bdy + 2, brot: FROG_CROUCH.brot + 3 }),
    pose(STAND, { fold: .15, lw: 15, brot: -20, bdy: -4 * height, nf: { a: -26, len: 20, reach: 0 }, ff: { a: -22, len: 20, reach: 0 }, nb: kick(52, 30), fb: kick(48, 30), ...air }),
    pose(STAND, { fold: 0, lw: 15, brot: -8, bdy: -11 * height, nf: { a: -38, len: 20, reach: 0, lift: 3 }, ff: { a: -34, len: 20, reach: 0, lift: 3 }, nb: kick(64, 30, 2), fb: kick(60, 30, 2), ...air }),
    pose(STAND, { fold: 0, lw: 15, brot: 6, bdy: -8 * height, nf: { a: -18, len: 20, reach: 0 }, ff: { a: -14, len: 20, reach: 0 }, nb: kick(40, 26, 3), fb: kick(36, 26, 3), ...air }),
    pose(STAND, { fold: .5, lw: 15, brot: 8, bdy: 0, nf: { a: 4, len: 20 }, ff: { a: 6, len: 20 }, nb: kick(18, 14), fb: kick(14, 14) }),
    pose(FROG_CROUCH, { brot: FROG_CROUCH.brot + 4, bdy: FROG_CROUCH.bdy + 1 }),
    FROG_CROUCH,
  ];
};

// A giraffe never sits up like a cat: it folds its legs under its body and lies down with the long
// neck still upright. Shared sitting and lying frames blend into that pose by how far they fold,
// keeping their face (eyes, mouth, head tilt, sleep marks).
const GIRAFFE_REST = pose(STAND, {
  bdy: 19, ...legs({ a: 0, len: 4, reach: 0 }),
  nf: { a: -78, len: 15, reach: 0 }, ff: { a: 70, len: 8, reach: 0 },
  hdy: -16, hdx: -2, wUp: 0, wGround: 1,
});
const FACE_KEYS = ['eyes', 'yawn', 'tongue', 'blush', 'hrot', 'earL', 'earR', 'faceTurn', 'zStep'];
const giraffeRest = (p) => {
  const settled = Math.min(1, p.fold / .5);
  if (settled === 0) return p;
  const face = Object.fromEntries(FACE_KEYS.map((key) => [key, p[key]]));
  const lying = pose(GIRAFFE_REST, { ...face, hdy: GIRAFFE_REST.hdy + (p.zStep >= 0 || p.eyes === 'closed' ? 8 : 0) });
  return lerpPose(pose(p, { fold: 0, pawOverHead: false, hindOverHead: false, tailFront: false }), lying, settled);
};

const lowHop = ANIMATION_POSES.happy.map((p) => pose(p, { bdy: p.bdy < 0 ? p.bdy * .45 : p.bdy }));
const SPECIES_POSES = {
  cat: {},
  dog: {
    walk: gait({ swing: 26, lift: 6, bob: 1.8, tail: 4, wag: 12, extra: () => ({ tongue: 1 }) }),
  },
  fox: {
    walk: gait({ swing: 22, lift: 8, bob: 1.6, tail: 3, wag: 3, headBob: .6 }),
  },
  rabbit: { walk: rabbitHop(.7), run: rabbitHop(1.3) },
  chick: {
    walk: gait({ swing: 16, lift: 4, bob: 2, nod: 3, headBob: 1.4, tail: 4, extra: (i, phase) => ({ wing: .12 + .12 * Math.sin(phase * 2) }) }),
  },
  hamster: { walk: gait({ swing: 18, lift: 3, bob: .6, headBob: .5, tail: 0, extra: (i) => ({ cheek: .25 }) }) },
  squirrel: {
    walk: gait({ swing: 22, lift: 6, bob: 3, pairs: 'bound', headBob: 1, tail: 10, wag: 6 }),
  },
  raccoon: { walk: gait({ swing: 18, lift: 4, bob: 1, roll: 2, low: 2, headBob: .8, tail: 7 }) },
  panda: { walk: gait({ swing: 20, lift: 4, bob: 1.2, roll: 3, nod: 1.5, squash: .02, tail: 2 }) },
  koala: { walk: koalaClamber, run: koalaClamber },
  pig: { walk: gait({ swing: 20, lift: 5, bob: 2.4, tail: 4, wag: 8, ears: 4 }) },
  sheep: { walk: gait({ swing: 20, lift: 6, bob: 2.2, tail: 4, wag: 6, ears: 3 }), run: sheepPronk },
  tiger: { walk: gait({ swing: 28, lift: 4, bob: .6, low: 3, nod: 1, headBob: .5, tail: 9, wag: 4 }) },
  lion: { walk: gait({ swing: 26, lift: 5, bob: 1, low: -1, headBob: .6, tail: 6, wag: 8 }) },
  penguin: { walk: penguinWaddle, run: gait({ swing: 12, lift: 3, bob: 2, roll: 8, headBob: 1, tail: 2, extra: (i, phase) => ({ wing: .3 + .25 * Math.sin(phase * 2) }) }) },
  cow: { walk: gait({ swing: 18, lift: 4, bob: 1, nod: 2.5, headBob: 1, tail: 8, wag: 5 }), happy: lowHop },
  monkey: { walk: gait({ swing: 24, lift: 7, bob: 3.4, pairs: 'bound', headBob: 1.2, tail: 8 }) },
  hedgehog: { walk: gait({ swing: 16, lift: 2.5, bob: .5, headBob: .6, tail: 0 }) },
  elephant: { walk: elephantStomp, run: elephantStomp },
  duck: {
    walk: gait({ swing: 14, lift: 3, bob: 1.6, roll: 5, nod: 2, headBob: 1, tail: 6, wag: 8, extra: (i, phase) => ({ wing: .08 + .08 * Math.sin(phase) }) }),
    run: gait({ swing: 18, lift: 4, bob: 2, roll: 7, nod: 2.5, headBob: 1.2, tail: 6, wag: 10, extra: (i, phase) => ({ wing: .45 + .4 * Math.sin(phase * 2) }) }),
  },
  // Frogs hop out of their crouch: the folded hind legs kick out long behind, the front paws land first.
  // Happy: a small cheerful hop in place (the walker lifts the sprite for the jump itself).
  frog: { walk: frogHop(.7), run: frogHop(1.15), happy: [0, 2, 3, 4, 5, 7].map((i) => frogHop(.35, true)[i]) },
  // Giraffes pace: both legs on one side move together, and the long neck nods with each step.
  // Tall heads get a lower happy hop.
  giraffe: {
    walk: gait({ swing: 18, lift: 5, bob: .8, pairs: 'lateral', nod: 2, headBob: 1.4, roll: 1, tail: 6, wag: 4 }),
    happy: lowHop,
    // A rocking gallop with the neck swinging, low enough that the head stays in the frame.
    run: gait({ swing: 28, lift: 6, bob: 1.2, pairs: 'bound', nod: 2.5, headBob: 1.2, tail: 8, wag: 6 }),
    startle: ANIMATION_POSES.startle.map((p) => pose(p, { bdy: p.bdy < 0 ? p.bdy * .4 : p.bdy })),
    // Carried, the tail stays half up off the bottom edge and the head droops below the top edge.
    carried: ANIMATION_POSES.carried.map((p) => pose(p, { wDown: .5, wUp: .5, hdy: p.hdy + 9, hdx: p.hdx - 3 })),
  },
  // Zebra: a springy horse trot with the head bobbing and the tail swishing.
  zebra: { walk: gait({ swing: 24, lift: 7, bob: 2, nod: 1.5, headBob: 1, tail: 5, wag: 6, ears: 2 }), happy: lowHop },
  turtle: {
    walk: turtleCrawl,
    run: turtleCrawl,
    // Startled: ducks into the shell for a moment instead of jumping.
    startle: [lerpPose(STAND, turtleRest, .6), pose(turtleRest, { eyes: 'squeeze' }), pose(turtleRest, { eyes: 'squeeze' }), lerpPose(turtleRest, turtlePeek, .6)],
    sit: restBreath(4),
    sitDown: steps(5, STAND, turtleRest),
    standUp: steps(5, turtleRest, STAND),
    lieDown: restBreath(5),
    sleep: restBreath(4, (i) => ({ zStep: i })),
    petSit: Array.from({ length: 6 }, (_, i) => pose(turtlePeek, {
      eyes: 'happy', blush: .85, hrot: [-4, -6, -4, 0, 2, 0][i],
    })),
    groom: peekAndHide([
      pose(turtlePeek, { faceTurn: .6 }), pose(turtlePeek, { faceTurn: 1, eyes: 'blink' }), pose(turtlePeek, { hrot: -6 }),
    ]),
    scratch: peekAndHide([
      pose(turtlePeek, { yawn: .6, eyes: 'squeeze' }), pose(turtlePeek, { yawn: 1, eyes: 'squeeze' }), pose(turtlePeek, { eyes: 'blink' }),
    ]),
    wakeUp: [
      turtleRest, turtleRest, lerpPose(turtleRest, turtlePeek, .5), turtlePeek,
      pose(turtlePeek, { yawn: 1, eyes: 'squeeze' }),
      lerpPose(turtlePeek, STAND, .4), lerpPose(turtlePeek, STAND, .75), pose(STAND, { eyes: 'blink' }),
    ],
    sploot: [
      turtleRest, lerpPose(turtleRest, turtleSun, .5),
      ...[0, 1, 2, 3].map((i) => pose(turtleSun, { bsy: .98 + breath(i, 4) * .03, eyes: ['happy', 'blink', 'happy', 'open'][i] })),
      lerpPose(turtleSun, turtleRest, .5), turtleRest,
    ],
  },
};

const sharedFramesFor = (kind, name) => {
  if (name !== 'trick' && name !== 'trickSit') return ANIMATION_POSES[name];
  if (PET_TRICKS[kind] === name) return TRICK_FRAMES[kind]();
  return name === 'trick' ? ANIMATION_POSES.idle : eight(() => pose(SIT));
};
const framesFor = (kind, name) => {
  const replaced = SPECIES_POSES[kind]?.[name];
  if (replaced) return replaced;
  const frames = sharedFramesFor(kind, name);
  if (name === 'carried') return frames;
  // Crouching animals (frog) fold every shared standing pose into their crouch.
  if (SPECIES[kind].crouch) return frames.map(frogify);
  // Lying-down animals (giraffe) turn every sit into lying with folded legs.
  if (SPECIES[kind].liesDown) return frames.map(giraffeRest);
  return frames;
};

// ---- Sheets ---------------------------------------------------------------------------------
const { width: W, height: H, columns, rows } = PET_SPRITE_FRAME;
const CRAYON_FILTER = `<filter id="crayon" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="wobble"/>
    <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2" xChannelSelector="R" yChannelSelector="G" result="drawn"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.2  0 0 0 0 0.08  0.9 0 0 0 -0.34" result="tint"/>
    <feComposite in="tint" in2="drawn" operator="in" result="texture"/>
    <feMerge><feMergeNode in="drawn"/><feMergeNode in="texture"/></feMerge>
  </filter>`;
const minify = (svg) => svg.replace(/\n\s*\n/g, '\n').replace(/^\s+/gm, '');
const outputDir = new URL('../public/pets/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

for (const [kind, species] of Object.entries(SPECIES)) {
  if (!TRICK_FRAMES[kind] || !PET_TRICKS[kind]) throw new Error(`${kind}: missing signature move`);
  const frames = Object.entries(PET_ANIMATIONS).flatMap(([name, spec]) => {
    const poses = framesFor(kind, name);
    if (!poses || poses.length !== spec.frames) throw new Error(`${name}: expected ${spec.frames} frames, got ${poses?.length ?? 0}`);
    return poses.map((p, i) => `<g transform="translate(${i * W} ${spec.row * H})"><g filter="url(#crayon)">${drawCat(p, species, `${name}-${i}`)}</g></g>`);
  });
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * columns}" height="${H * rows}" viewBox="0 0 ${W * columns} ${H * rows}">
<defs>${CRAYON_FILTER}</defs>
${frames.join('\n')}
</svg>
`;
  const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${CRAYON_FILTER}</defs>
<g filter="url(#crayon)">${drawCat(ANIMATION_POSES.idle[0], species, 'portrait')}</g>
</svg>
`;
  writeFileSync(new URL(`${kind}-sprite.svg`, outputDir), minify(sheet));
  writeFileSync(new URL(`${kind}-portrait.svg`, outputDir), minify(portrait));
  console.log(`wrote ${kind} (${frames.length} frames)`);
}

// Where the walker's pointer holds a carried pet: the scruff between the shoulders and the head.
// Every species shares the rig, so one grip serves all of them.
// Where the walker's pointer holds each carried pet: the scruff between the shoulders and the head.
// These must match PET_CARRY_GRIPS in src/lib/petSprites.ts; the generator fails when they drift.
const grips = Object.fromEntries(Object.entries(SPECIES).map(([kind, species]) => {
  const [x, y] = toWorld(shapePose(ANIMATION_POSES.carried[0], species), 101, 60);
  return [kind, { x: Math.round(x), y: Math.round(y) }];
}));
const drifted = Object.entries(grips).filter(([kind, grip]) => (
  PET_CARRY_GRIPS[kind]?.x !== grip.x || PET_CARRY_GRIPS[kind]?.y !== grip.y
));
if (drifted.length > 0) throw new Error(`update PET_CARRY_GRIPS: ${JSON.stringify(Object.fromEntries(drifted))}`);

// ---- Egg ------------------------------------------------------------------------------------
// public/pets/egg-stages.svg: six frames left to right, from a whole egg to a cracked-open one
// with eyes peeking out, sitting down in a twig nest like the egg in the home scene.
const EGG_W = 120;
const EGG_H = 110;
const EGG_PATH = 'M60 14 C78 14 89 42 89 62 C89 84 76 96 60 96 C44 96 31 84 31 62 C31 42 42 14 60 14 Z';
const EGG_FILL = '#fbf8f1';
// The crack that finally splits the egg, running across it a little above the middle.
const ZIGZAG = [[26, 52], [35, 45], [42, 53], [50, 44], [57, 52], [64, 43], [71, 51], [78, 44], [85, 52], [94, 46]];
const zig = ZIGZAG.map(([x, y]) => `${x} ${y}`).join(' L');
const zigBack = [...ZIGZAG].reverse().map(([x, y]) => `${x} ${y}`).join(' L');
const crack = (d, width = 2) => `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const speckles = `<g fill="#d3cabb"><circle cx="68" cy="66" r="1.8"/><circle cx="52" cy="76" r="1.4"/><circle cx="74" cy="80" r="1.3"/><circle cx="45" cy="60" r="1.2"/><circle cx="64" cy="30" r="1.3"/><circle cx="56" cy="88" r="1.1"/></g>`;
// Shell with everything drawn on it clipped to the egg, so no crack runs past the outline.
const shell = (stage, marks = '') => `
  <clipPath id="egg-${stage}"><path d="${EGG_PATH}"/></clipPath>
  <path d="${EGG_PATH}" fill="${EGG_FILL}"/>
  <g clip-path="url(#egg-${stage})">
    <path d="M44 86 C54 94 74 93 84 78 C82 90 72 98 58 97 C48 96 42 92 44 86 Z" fill="#ece4d4"/>
    <ellipse cx="48" cy="36" rx="5.5" ry="11" transform="rotate(-22 48 36)" fill="#fff"/>
    ${speckles}${marks}
  </g>
  <path d="${EGG_PATH}" fill="none" ${outline}/>`;
const nestBack = `
  <path d="M14 80 C16 66 38 62 60 62 C82 62 104 66 106 80 Z" fill="#7a4e25" ${outline}/>
  <path d="M22 76 C34 68 86 68 98 76" fill="none" stroke="#5c3818" stroke-width="2" stroke-linecap="round"/>`;
const nestFront = `
  <path d="M12 78 C24 88 44 90 60 90 C76 90 96 88 108 78 C108 96 88 106 60 106 C32 106 12 96 12 78 Z" fill="#b9773a" ${outline}/>
  <path d="M18 88 C34 97 86 98 102 88 M24 96 C40 102 80 103 96 96" fill="none" stroke="#8a5526" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M20 84 C38 92 60 93 78 91 M34 101 C50 104 70 104 86 100" fill="none" stroke="#dca25e" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M13 80 l-8 -5 M14 86 l-9 1 M107 80 l8 -6 M106 86 l9 0 M30 88 l-4 6 M88 89 l5 5" stroke="#7a4e25" stroke-width="2.6" stroke-linecap="round"/>`;
// A curved scrap of shell that has flown off.
const chip = (x, y, angle) => `<path d="M${x} ${y} q4 -4 9 -1 q-1 5 -5 7 q-3 -2 -4 -6 Z" fill="${EGG_FILL}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${angle} ${x} ${y})"/>`;
// Dark inside showing through the gap under a lifted top.
// `depth` grows as the top lifts higher and more of the inside shows.
const opening = (depth = 16) => `<path d="M26 52 C40 ${52 + depth} 80 ${52 + depth} 94 52 L${zigBack.split(' L').slice(1).join(' L')} Z" fill="#2a2018"/>`;
const peekingEyes = `
  <circle cx="51" cy="57" r="3.8" fill="#fff"/><circle cx="52" cy="57.8" r="2" fill="${C.eye}"/>
  <circle cx="69" cy="57" r="3.8" fill="#fff"/><circle cx="70" cy="57.8" r="2" fill="${C.eye}"/>`;
// The egg broken along the zigzag: the bottom stays in the nest, the top lifts or comes off.
// `marks` are the cracks and holes drawn so far; each half keeps its own share of them.
const splitEgg = (stage, topTransform, inside, marks = '', depth = 16) => `
  <clipPath id="egg-bottom-${stage}"><path d="M0 ${EGG_H} L0 52 L${zig} L${EGG_W} 46 L${EGG_W} ${EGG_H} Z"/></clipPath>
  <clipPath id="egg-top-${stage}"><path d="M0 0 L${EGG_W} 0 L${EGG_W} 46 L${zigBack} L0 52 Z"/></clipPath>
  <clipPath id="egg-in-${stage}"><path d="${EGG_PATH}"/></clipPath>
  <g clip-path="url(#egg-bottom-${stage})">${shell(`${stage}b`, marks)}<g clip-path="url(#egg-in-${stage})">${opening(depth)}${inside}${crack(`M${zig}`, 2.4)}</g></g>
  <g transform="${topTransform}"><g clip-path="url(#egg-top-${stage})">${shell(`${stage}t`, marks)}</g><g clip-path="url(#egg-in-${stage})">${crack(`M${zig}`, 2.4)}</g></g>`;

// Cracks grow a little with every feed, so each stage keeps all earlier ones and adds a piece.
const CRACKS = {
  top: [[62, 14], [66, 21], [63, 26], [68, 31], [65, 37]],
  left: [[31, 60], [37, 56], [35, 50], [41, 46], [39, 40]],
  ring: ZIGZAG,
  down: [[57, 52], [55, 59], [59, 65], [57, 71]],
  right: [[78, 44], [82, 37], [80, 31]],
  join: [[64, 43], [65, 38]],
};
const partial = (points, segments) => (segments > 0 ? crack(`M${points.slice(0, segments + 1).map(([x, y]) => `${x} ${y}`).join(' L')}`) : '');
// Little dark holes where a flake of shell has already fallen out.
const HOLES = [
  'M62 25 l5 -2 l3 4 l-3 4 l-5 -1 Z',
  'M36 49 l5 -3 l4 4 l-3 4 l-5 -1 Z',
  'M77 38 l5 -1 l1 5 l-5 2 Z',
];
const hole = (d) => `<path d="${d}" fill="#2a2018" stroke="${C.line}" stroke-width="1.4" stroke-linejoin="round"/>`;
// Flakes that have dropped into the nest, drawn over its front rim.
const FALLEN = [[28, 84, -20], [86, 85, 30], [46, 93, 70], [72, 94, -40], [18, 90, 10]];

// Per stage: how many segments of each crack show, how many holes and fallen flakes, and how
// far the top has lifted (0 = whole). Stage 20 is the open egg with eyes peeking out.
const EGG_PLAN = [
  {},
  { top: 1 }, { top: 2 }, { top: 4 },
  { top: 4, left: 1 }, { top: 4, left: 2 }, { top: 4, left: 4 },
  { top: 4, left: 4, ring: 3 }, { top: 4, left: 4, ring: 5 }, { top: 4, left: 4, ring: 7 }, { top: 4, left: 4, ring: 9 },
  { top: 4, left: 4, ring: 9, down: 2 }, { top: 4, left: 4, ring: 9, down: 3, right: 1, join: 1 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 1 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 1, fallen: 1 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 2, fallen: 2 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 3, fallen: 3 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 3, fallen: 3, lift: 1 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 3, fallen: 4, lift: 2 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 3, fallen: 4, lift: 3 },
  { top: 4, left: 4, ring: 9, down: 3, right: 2, join: 1, holes: 3, fallen: 5, lift: 4 },
];
const LIFTS = [
  null,
  'translate(0 -2) rotate(-2 60 48)',
  'translate(1 -4) rotate(-5 60 48)',
  'translate(1 -7) rotate(-9 60 48)',
  'translate(22 -5) rotate(30 70 46)',
];
const EGG_STAGES = EGG_PLAN.map((plan, stage) => {
  const marks = Object.entries(CRACKS).map(([name, points]) => partial(points, plan[name] ?? 0)).join('')
    + HOLES.slice(0, plan.holes ?? 0).map(hole).join('');
  const lift = plan.lift ?? 0;
  const art = lift === 0
    ? shell(stage, marks)
    // Once the top is up far enough, eyes peek out from the dark gap.
    : splitEgg(stage, LIFTS[lift], lift >= 2 ? peekingEyes : '', marks, [0, 3, 10, 13, 16][lift]);
  const fallen = FALLEN.slice(0, plan.fallen ?? 0).map(([x, y, angle]) => chip(x, y, angle)).join('');
  return { art, fallen };
});
const eggFrames = EGG_STAGES.map(({ art, fallen }, i) => (
  `<g transform="translate(${i * EGG_W} 0)"><g filter="url(#crayon-egg)">${nestBack}${art}${nestFront}${fallen}</g></g>`
)).join('\n');
const eggSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${EGG_W * EGG_STAGES.length}" height="${EGG_H}" viewBox="0 0 ${EGG_W * EGG_STAGES.length} ${EGG_H}">
<defs>${CRAYON_FILTER.replace('id="crayon"', 'id="crayon-egg"').replace(`width="${W}" height="${H}"`, `width="${EGG_W}" height="${EGG_H}"`)}</defs>
${eggFrames}
</svg>
`;
writeFileSync(new URL('egg-stages.svg', outputDir), minify(eggSheet));
console.log('wrote egg stages');
