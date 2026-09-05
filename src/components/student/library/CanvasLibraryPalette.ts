export const CANVAS_LIBRARY_PALETTE = {
  ink: ['#253044', '#596b78'],
  timber: ['#704536', '#9b6045', '#c98a5b', '#efbd7d'],
  stone: ['#66858b', '#9eb8b4', '#d5dfce', '#f2edcf'],
  green: ['#2f6759', '#4f9271', '#8bc28e', '#d5e8ad'],
  paper: ['#c89454', '#e9bd69', '#f7d994', '#fff2c7'],
  bookCoral: ['#e98591', '#ffc4b5'],
  bookBlue: ['#73add5', '#b8e0f4'],
  bookSage: ['#84c6a0', '#c9ecb5'],
  lavender: ['#a88bc8', '#dbc7f3'],
  bear: ['#643a2d', '#a8573c', '#d98b50', '#eda569'],
  scarf: ['#3a7536', '#72b94c'],
} as const;

export type CanvasLibraryPalette = typeof CANVAS_LIBRARY_PALETTE;
