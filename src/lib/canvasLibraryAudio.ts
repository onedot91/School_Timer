export type LibrarySound = 'footstep' | 'receive' | 'place' | 'page';

const MAX_VOICES = 4;

export const createLibraryAudio = (createContext: () => AudioContext = () => new AudioContext()) => {
  let context: AudioContext | null = null;
  let enabled = false;
  let paused = false;
  let disposed = false;
  let noise: AudioBuffer | null = null;
  const voices = new Set<() => void>();
  const lastPlayed = new Map<LibrarySound, number>();

  const silence = () => {
    for (const release of voices) release();
    lastPlayed.clear();
  };

  const unlock = async () => {
    if (!enabled || paused || disposed) return;
    try {
      context ??= createContext();
      if (context.state === 'suspended') await context.resume();
    } catch {}
  };

  const play = (kind: LibrarySound, alternate = false) => {
    const audio = context;
    if (!enabled || paused || disposed || !audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    if (now - (lastPlayed.get(kind) ?? -Infinity) < (kind === 'footstep' ? 0.2 : 0.1)) return;
    lastPlayed.set(kind, now);
    try {
      const footstep = kind === 'footstep';
      const duration = footstep ? 0.065 : kind === 'page' ? 0.15 : 0.12;
      while (voices.size >= MAX_VOICES) voices.values().next().value?.();
      if (!noise) {
        noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.2), audio.sampleRate);
        const data = noise.getChannelData(0);
        for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      }
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      let ended = false;
      const release = () => {
        if (ended) return;
        ended = true;
        source.onended = null;
        try { source.stop(); } catch {}
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        voices.delete(release);
      };
      voices.add(release);
      source.buffer = noise;
      source.playbackRate.value = alternate ? 0.92 : 1;
      filter.type = footstep || kind === 'place' ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(footstep ? (alternate ? 460 : 520) : kind === 'place' ? 900 : 2200, now);
      filter.Q.value = 0.7;
      const peak = footstep ? 0.024 : kind === 'page' ? 0.021 : 0.012;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      source.onended = release;
      source.start(now);
      source.stop(now + duration + 0.01);

      if (kind === 'receive' || kind === 'place') {
        while (voices.size >= MAX_VOICES) voices.values().next().value?.();
        const tone = audio.createOscillator();
        const toneGain = audio.createGain();
        let toneEnded = false;
        const releaseTone = () => {
          if (toneEnded) return;
          toneEnded = true;
          tone.onended = null;
          try { tone.stop(); } catch {}
          tone.disconnect();
          toneGain.disconnect();
          voices.delete(releaseTone);
        };
        voices.add(releaseTone);
        tone.type = 'sine';
        tone.frequency.setValueAtTime(kind === 'receive' ? 620 : 310, now);
        tone.frequency.exponentialRampToValueAtTime(kind === 'receive' ? 780 : 180, now + 0.09);
        toneGain.gain.setValueAtTime(0.0001, now);
        toneGain.gain.exponentialRampToValueAtTime(0.006, now + 0.008);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        tone.connect(toneGain);
        toneGain.connect(audio.destination);
        tone.onended = releaseTone;
        tone.start(now);
        tone.stop(now + 0.15);
      }
    } catch {
      silence();
    }
  };

  return {
    unlock,
    play,
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) silence();
    },
    setPaused(value: boolean) {
      paused = value;
      if (value) silence();
    },
    dispose() {
      disposed = true;
      silence();
      const audio = context;
      context = null;
      noise = null;
      if (audio && audio.state !== 'closed') void audio.close().catch(() => undefined);
    },
  };
};
