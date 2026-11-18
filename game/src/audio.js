// All sound is synthesised with WebAudio — no audio files, no network.
// A tiny engine hum follows the car's speed, a two-tone siren wails while the
// police chase, and one-shots cover shots, crashes, pickups and mission jingles.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that alternates between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.25, filterFreq = 1200) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // A lazy bass-and-hat groove in A minor, 112 BPM. Steps run on a timer.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 55, 0, 82.41, 0, 73.42, 0];

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Continuous layers, called every frame: engine by speed, siren by wanted. */
    update(speedRatio, wanted) {
      if (!ctx || muted) return;
      if (engineGain) {
        engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + speedRatio * 140, ctx.currentTime, 0.1);
      }
      if (sirenGain && sirenOsc) {
        if (wanted > 0) {
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
          const beat = Math.floor(ctx.currentTime * 2.4) % 2 === 0;
          sirenOsc.frequency.setTargetAtTime(beat ? 660 : 880, ctx.currentTime, 0.05);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        }
      }
    },
    click() { tone(880, 0.06, 'square', 0.08); },
    pickup() { tone(660, 0.09, 'sine', 0.18); tone(990, 0.12, 'sine', 0.18, 0.07); },
    cash() { tone(1320, 0.07, 'triangle', 0.16); tone(1760, 0.1, 'triangle', 0.16, 0.06); },
    shot() { noise(0.12, 0.3, 2400); tone(180, 0.08, 'square', 0.12, 0, 60); },
    punch() { noise(0.07, 0.2, 700); },
    crash() { noise(0.22, 0.35, 500); tone(90, 0.18, 'sawtooth', 0.14, 0, 45); },
    horn() { tone(370, 0.22, 'square', 0.1); tone(466, 0.22, 'square', 0.08); },
    busted() { tone(392, 0.16, 'square', 0.14); tone(311, 0.16, 'square', 0.14, 0.16); tone(233, 0.3, 'square', 0.14, 0.32); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.16, i * 0.09));
    },
    fail() { tone(220, 0.2, 'sawtooth', 0.12); tone(174, 0.32, 'sawtooth', 0.12, 0.18); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (muted || !ctx) return;
        const step = musicStep % 16;
        const bass = BASS[step];
        if (bass) tone(bass, 0.22, 'triangle', 0.14);
        if (step % 4 === 2) noise(0.03, 0.05, 6000);
        musicStep += 1;
      }, 60000 / 112 / 2);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
