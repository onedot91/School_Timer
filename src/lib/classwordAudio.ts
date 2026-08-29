export type ClasswordSound = 'select' | 'success' | 'error' | 'complete';

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  const AudioContextConstructor = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
};

const playTone = (
  context: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number,
  volume: number,
): void => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + startOffset;
  const end = start + duration;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
};

export const playClasswordSound = async (sound: ClasswordSound): Promise<void> => {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    if (sound === 'select') {
      playTone(context, 440, 0, 0.06, 0.035);
      return;
    }
    if (sound === 'error') {
      playTone(context, 220, 0, 0.12, 0.05);
      playTone(context, 174, 0.08, 0.14, 0.045);
      return;
    }
    const frequencies = sound === 'complete' ? [523, 659, 784, 1047] : [523, 659];
    frequencies.forEach((frequency, index) => {
      playTone(context, frequency, index * 0.08, sound === 'complete' ? 0.18 : 0.12, 0.045);
    });
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
};
