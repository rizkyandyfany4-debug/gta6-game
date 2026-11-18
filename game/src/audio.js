// VICE HEAT: Neon Bay — tiny WebAudio synth.
// No audio files: every sound is an oscillator or a burst of filtered
// noise, made on the fly. The context is created on the first user
// gesture only, and everything is a no-op until then (and in headless
// runs, where no gesture ever happens).

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  const lastPlayed = new Map();

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function throttle(name, ms) {
    const now = performance.now();
    const last = lastPlayed.get(name) ?? -10000;
    if (now - last < ms) return false;
    lastPlayed.set(name, now);
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2, freq = 1200) {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  function setEngine(on, speed01) {
    const c = ensure();
    if (!c) return;
    if (on && !engineOsc) {
      engineOsc = c.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = c.createGain();
      engineGain.gain.value = 0.03;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(c.destination);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, c.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(on ? 0.028 + speed01 * 0.03 : 0, c.currentTime, 0.1);
    }
  }

  function play(name) {
    if (name === 'shot') {
      if (!throttle('shot', 90)) return;
      noise(0.14, 0.25, 2400);
      tone(180, 0.1, 'square', 0.08, 60);
    } else if (name === 'punch') {
      if (!throttle('punch', 120)) return;
      noise(0.08, 0.2, 500);
      tone(120, 0.08, 'sine', 0.14, 70);
    } else if (name === 'cash') {
      tone(880, 0.12, 'sine', 0.1);
      setTimeout(() => tone(1320, 0.18, 'sine', 0.1), 90);
    } else if (name === 'mission') {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.1), i * 110));
    } else if (name === 'siren') {
      // Two-tone wail handled by the update loop, not a one-shot.
    } else if (name === 'car') {
      tone(220, 0.1, 'square', 0.05, 330);
    } else if (name === 'crash') {
      if (!throttle('crash', 300)) return;
      noise(0.25, 0.25, 700);
    } else if (name === 'down') {
      tone(160, 0.25, 'sawtooth', 0.09, 50);
    } else if (name === 'busted' || name === 'wasted') {
      [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.09), i * 160));
    }
  }

  function update(dt, wanted) {
    const c = ensure();
    if (!c) return;
    if (wanted > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.85;
        tone(740, 0.4, 'sine', 0.035, 960);
        setTimeout(() => tone(960, 0.4, 'sine', 0.035, 740), 420);
      }
    }
  }

  return { unlock, play, setEngine, update };
}
