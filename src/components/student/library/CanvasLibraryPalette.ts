export const CANVAS_LIBRARY_PALETTE = {
  ink: ['#253044', '#596b78'],
  timber: ['#78503d', '#ac7551', '#dda873', '#f5d09b'],
  recess: ['#704b3e', '#8a5d49', '#a27354'],
  stone: ['#66858b', '#9eb8b4', '#d5dfce', '#f2edcf'],
  green: ['#346b59', '#67a889', '#a8d9b5', '#dcf0c7'],
  paper: ['#b18750', '#e6c783', '#f2dca6', '#fff2cf'],
  bookCoral: ['#e98591', '#ffc4b5'],
  bookBlue: ['#73add5', '#b8e0f4'],
  bookSage: ['#84c6a0', '#c9ecb5'],
  bookSpines: [
    ['#e98591', '#ffc4b5'], ['#73add5', '#b8e0f4'],
    ['#84c6a0', '#c9ecb5'], ['#ceac58', '#f6dfa0'],
    ['#a88bc8', '#dbc7f3'], ['#4f9997', '#a9d9cf'],
    ['#ce8864', '#efc5a0'], ['#687fba', '#b2c2e7'],
  ],
  lavender: ['#a88bc8', '#dbc7f3'],
  bear: ['#643a2d', '#a8573c', '#d98b50', '#eda569'],
  cat: ['#17191d', '#292c31', '#42464d'],
  catEyes: '#f2cf55',
  clerk: {
    outline: '#643f32', fur: '#f5d09b', furLight: '#fff2cf',
    ear: '#dda873', earShade: '#ac7551', coral: '#e77c66', coralLight: '#ffb09a',
  },
  scarf: ['#3a7536', '#72b94c'],
} as const;

export type CanvasLibraryPalette = typeof CANVAS_LIBRARY_PALETTE;
