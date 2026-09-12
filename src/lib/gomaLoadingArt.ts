export const GOMA_FLIGHT_ARTWORK_SRC = '/images/loading/goma-pencil.png';

export const gomaLoadingVariants = ['flight', 'jumping', 'parachute', 'skating', 'sailing', 'bubble', 'train', 'moon', 'rocket', 'carrot'] as const;
export type GomaLoadingVariant = typeof gomaLoadingVariants[number];

const kineticArtworkName = {
  jumping: 'jumping',
  parachute: 'parachute-arms',
  skating: 'skating',
  sailing: 'sailing',
  bubble: 'bubble',
  train: 'train',
  moon: 'moon-side',
  rocket: 'rocket',
  carrot: 'carrot',
} as const;

export const gomaKineticArtworkSrc = (variant: Exclude<GomaLoadingVariant, 'flight'>) => (
  `/images/loading/goma-${kineticArtworkName[variant]}.webp`
);

export const GOMA_LOADING_PRELOAD_SRCS = [
  GOMA_FLIGHT_ARTWORK_SRC,
  ...Object.values(kineticArtworkName).map((name) => `/images/loading/goma-${name}.webp`),
] as const;
