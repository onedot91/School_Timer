let auctionAudioContext: AudioContext | null = null;
let auctionAudioPreparePromise: Promise<AudioContext | null> | null = null;
let auctionAudioMasterGain: GainNode | null = null;
let auctionAudioCompressor: DynamicsCompressorNode | null = null;

const getAuctionAudioContext = () => {
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!auctionAudioContext) {
      auctionAudioContext = new AudioContextConstructor();
    }
    return auctionAudioContext;
  } catch {
    return null;
  }
};

const getAuctionAudioOutput = (ctx: AudioContext) => {
  if (!auctionAudioMasterGain || !auctionAudioCompressor) {
    auctionAudioCompressor = ctx.createDynamicsCompressor();
    auctionAudioCompressor.threshold.setValueAtTime(-20, ctx.currentTime);
    auctionAudioCompressor.knee.setValueAtTime(18, ctx.currentTime);
    auctionAudioCompressor.ratio.setValueAtTime(4, ctx.currentTime);
    auctionAudioCompressor.attack.setValueAtTime(0.006, ctx.currentTime);
    auctionAudioCompressor.release.setValueAtTime(0.2, ctx.currentTime);

    auctionAudioMasterGain = ctx.createGain();
    auctionAudioMasterGain.gain.setValueAtTime(0.54, ctx.currentTime);
    auctionAudioMasterGain.connect(auctionAudioCompressor);
    auctionAudioCompressor.connect(ctx.destination);
  }

  return auctionAudioMasterGain;
};

export const prepareAuctionAudio = () => {
  if (!auctionAudioPreparePromise) {
    auctionAudioPreparePromise = (async () => {
      try {
        const ctx = getAuctionAudioContext();
        if (!ctx) return null;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        getAuctionAudioOutput(ctx);
        return ctx;
      } catch {
        return null;
      } finally {
        auctionAudioPreparePromise = null;
      }
    })();
  }

  return auctionAudioPreparePromise;
};

export const playAuctionSound = async (kind: 'start' | 'bid' | 'final', stepIndex = 0) => {
  try {
    const ctx = await prepareAuctionAudio();
    if (!ctx) return;

    const outputNode = getAuctionAudioOutput(ctx);

    const playTone = ({
      frequency,
      startOffset,
      duration,
      type,
      volume,
      endFrequency = frequency,
      filterFrequency = 3600,
    }: {
      frequency: number;
      startOffset: number;
      duration: number;
      type: OscillatorType;
      volume: number;
      endFrequency?: number;
      filterFrequency?: number;
    }) => {
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + startOffset;
      const endTime = startTime + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, endFrequency), endTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFrequency, startTime);
      filter.Q.setValueAtTime(0.65, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + Math.min(0.026, duration * 0.28));
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.28), startTime + duration * 0.58);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(outputNode);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.03);
    };

    const playNoise = (startOffset: number, duration: number, volume: number, filterType: BiquadFilterType) => {
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) {
        const progress = index / channel.length;
        const decay = Math.pow(1 - progress, 2.3);
        channel[index] = (Math.random() * 2 - 1) * decay;
      }

      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + startOffset;
      const endTime = startTime + duration;

      filter.type = filterType;
      filter.frequency.setValueAtTime(filterType === 'highpass' ? 1400 : 1100, startTime);
      filter.frequency.exponentialRampToValueAtTime(filterType === 'highpass' ? 420 : 180, endTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(outputNode);
      source.start(startTime);
      source.stop(endTime + 0.02);
    };

    if (kind === 'start') {
      playNoise(0, 0.06, 0.07, 'highpass');
      playTone({ frequency: 196, startOffset: 0, duration: 0.06, type: 'sine', volume: 0.055, endFrequency: 164.81, filterFrequency: 900 });
      playTone({ frequency: 523.25, startOffset: 0.055, duration: 0.09, type: 'triangle', volume: 0.06, endFrequency: 659.25 });
      playTone({ frequency: 783.99, startOffset: 0.125, duration: 0.11, type: 'sine', volume: 0.052, endFrequency: 987.77 });
      return;
    }

    if (kind === 'bid') {
      const stepLift = Math.min(stepIndex, 8) * 28;
      const baseFrequency = 523.25 + stepLift;
      playTone({ frequency: 174.61, startOffset: 0, duration: 0.045, type: 'sine', volume: 0.035, endFrequency: 130.81, filterFrequency: 700 });
      playTone({ frequency: baseFrequency, startOffset: 0.012, duration: 0.08, type: 'triangle', volume: 0.064, endFrequency: baseFrequency * 1.32 });
      playTone({ frequency: baseFrequency * 1.5, startOffset: 0.058, duration: 0.09, type: 'sine', volume: 0.04, endFrequency: baseFrequency * 1.72 });
      playNoise(0.006, 0.048, 0.032, 'highpass');
      return;
    }

    playNoise(0, 0.2, 0.1, 'lowpass');
    playTone({ frequency: 220, startOffset: 0, duration: 0.11, type: 'sine', volume: 0.07, endFrequency: 146.83, filterFrequency: 780 });
    playTone({ frequency: 329.63, startOffset: 0.08, duration: 0.15, type: 'triangle', volume: 0.07, endFrequency: 493.88 });
    playTone({ frequency: 659.25, startOffset: 0.19, duration: 0.18, type: 'triangle', volume: 0.078, endFrequency: 880 });
    playTone({ frequency: 987.77, startOffset: 0.34, duration: 0.22, type: 'sine', volume: 0.068, endFrequency: 1318.51 });
    playTone({ frequency: 1567.98, startOffset: 0.52, duration: 0.36, type: 'sine', volume: 0.048, endFrequency: 1975.53, filterFrequency: 5200 });
  } catch {
    // Audio is decorative; ignore browser autoplay or output failures.
  }
};
