export const shouldSelectSpecialMotion = (randomValue = Math.random()): boolean =>
  randomValue >= 0 && randomValue < 0.05;
